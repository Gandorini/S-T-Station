import os
import shutil
import subprocess
from fastapi import APIRouter, UploadFile, File, HTTPException, Request
from fastapi.responses import JSONResponse
from tempfile import TemporaryDirectory
import music21
from supabase import create_client, Client
import cv2
import pytesseract
import re
import PyPDF2
from pdf2image import convert_from_path
import numpy as np
from dotenv import load_dotenv
from azure.cognitiveservices.vision.customvision.prediction import CustomVisionPredictionClient
from msrest.authentication import ApiKeyCredentials
import requests
from urllib.parse import urlparse

load_dotenv()

router = APIRouter()

# Configurações do Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configurações do Azure Custom Vision
ENDPOINT = os.getenv("AZURE_ENDPOINT", "https://westeurope.api.cognitive.microsoft.com/")
PREDICTION_KEY = os.getenv("AZURE_PREDICTION_KEY")
PROJECT_ID = os.getenv("AZURE_PROJECT_ID")
PUBLISH_ITERATION_NAME = os.getenv("AZURE_PUBLISH_ITERATION_NAME")


def run_audiveris_docker(input_path, output_dir):
    input_dir = os.path.dirname(input_path)
    file_name = os.path.basename(input_path)
    # Corrige o caminho para Windows (barra invertida para barra normal)
    input_dir_docker = input_dir.replace('\\', '/')
    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{input_dir_docker}:/data",
        "lsouchet/audiveris",
        "-batch", f"/data/{file_name}",
        "-export", "-output", "/data/output"
    ]
    result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        raise RuntimeError(f"Erro ao rodar Audiveris via Docker: {result.stderr}")

def convert_musicxml_to_midi(musicxml_path, midi_path):
    score = music21.converter.parse(musicxml_path)
    score.write("midi", fp=midi_path)

def upload_to_supabase(file_path, bucket_name="music-sheets"):
    import re
    with open(file_path, "rb") as f:
        file_name = os.path.basename(file_path)
        # Remove caracteres especiais e espaços do nome do arquivo
        file_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file_name)
        # Opcional: prefixo para organização, sem subdiretórios do usuário
        file_key = f"uploads/{file_name}"
        response = supabase.storage.from_(bucket_name).upload(file_key, f, {"upsert": True})
        if response.get("error"):
            raise RuntimeError(f"Erro ao fazer upload para o Supabase: {response['error']['message']}")
        return supabase.storage.from_(bucket_name).get_public_url(file_key)

def is_music_sheet_or_tab(text: str) -> bool:
    print("\n===== TEXTO EXTRAÍDO PELO OCR =====\n", text, "\n===============================\n")
    # Regex para cifras (ex: C, Gm, F/A, Bb7, C#m7, etc)
    cifra_pattern = r'\b([A-G][#b]?m?(maj7|m7|7|sus4|sus2|dim|aug|add9)?(/[A-G][#b]?)?)\b'
    # Regex para tablatura (linhas típicas de tab)
    tab_pattern = r'^[eBGDAE]\|(-|\d|h|p|/|\\|b|x|o)+$'
    # Regex para símbolos de partitura (clave, compasso, etc)
    partitura_pattern = r'[𝄞𝄢𝄡𝄫𝄪𝄬𝄭𝄮𝄯𝄰𝄱𝄲𝄳𝄴𝄵𝄶𝄷𝄸𝄹𝄺𝄻𝄼𝄽𝄾𝄿𝅀𝅁𝅂𝅃𝅄𝅅𝅆𝅇𝅈𝅉𝅊𝅋𝅌𝅍𝅎𝅏𝅐𝅑𝅒𝅓𝅔𝅕𝅖𝅗𝅘𝅙𝅚𝅛𝅜𝅝𝅗𝅥𝅘𝅥𝅘𝅥𝅮𝅘𝅥𝅯𝅘𝅥𝅰𝅘𝅥𝅱𝅘𝅧𝅨𝅩𝅥𝅲𝅥𝅦𝅪𝅫𝅬𝅮𝅯𝅰𝅱𝅲𝅭𝅳𝅴𝅵𝅶𝅷𝅸𝅹𝅺𝅻𝅼𝅽𝅾𝅿𝆀𝆁𝆂𝆃𝆄𝆊𝆋𝆅𝆆𝆇𝆈𝆉𝆌𝆍𝆎𝆏𝆐𝆑𝆒𝆓𝆔𝆕𝆖𝆗𝆘𝆙𝆚𝆛𝆜𝆝𝆞𝆟𝆠𝆡𝆢𝆣𝆤𝆥𝆦𝆧𝆨𝆩𝆪𝆫𝆬𝆭𝆮𝆯𝆰𝆱𝆲𝆳𝆴𝆵𝆶𝆷𝆸𝆹𝆺𝆹𝅥𝆺𝅥𝆹𝅥𝅮𝆺𝅥𝅮𝆹𝅥𝅯]'
    # Regex para compasso e clave
    compasso_clave_pattern = r'\b(4/4|3/4|2/4|6/8|12/8|C|clave|G clef|F clef|treble|bass)\b'

    # Busca por cifra
    if re.search(cifra_pattern, text, re.MULTILINE):
        return True
    # Busca por tablatura
    tab_lines = [line for line in text.splitlines() if re.match(tab_pattern, line.strip())]
    if len(tab_lines) >= 3:  # Pelo menos 3 linhas típicas de tab
        return True
    # Busca por símbolos de partitura
    if re.search(partitura_pattern, text):
        return True
    # Busca por compasso/clave
    if re.search(compasso_clave_pattern, text, re.IGNORECASE):
        return True
    return False

def detect_staff_lines(image_path: str) -> bool:
    # Detecta pentagramas usando OpenCV
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return False
    edges = cv2.Canny(img, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=img.shape[1]//2, maxLineGap=10)
    if lines is None:
        return False
    # Conta linhas horizontais
    horizontal_lines = [l for l in lines if abs(l[0][1] - l[0][3]) < 5]
    return len(horizontal_lines) >= 5  # Pelo menos 5 linhas paralelas

def extract_text_from_pdf(pdf_path: str) -> str:
    text = ""
    try:
        reader = PyPDF2.PdfReader(pdf_path)
        for page in reader.pages:
            text += page.extract_text() or ""
    except Exception:
        pass
    return text

def extract_text_from_image(image_path: str) -> str:
    return pytesseract.image_to_string(image_path, lang='eng')

@router.post("/validate-sheet")
def validate_sheet(file: UploadFile = File(...)):
    # Cria diretório temporário para processar o arquivo
    with TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, file.filename)
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        output_dir = os.path.join(tmpdir, "output")
        os.makedirs(output_dir, exist_ok=True)

        # Executa o Audiveris via Docker
        try:
            run_audiveris_docker(input_path, output_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao executar Audiveris via Docker: {str(e)}")

        # Procura arquivos MusicXML no output
        found_xml = False
        for root, _, files in os.walk(output_dir):
            for fname in files:
                if fname.lower().endswith(".xml"):
                    found_xml = True
                    break

        if found_xml:
            return JSONResponse({"valid": True, "message": "Partitura reconhecida com sucesso."})
        else:
            return JSONResponse({"valid": False, "message": "Não foi possível reconhecer uma partitura no arquivo enviado."})

@router.post("/validate-and-convert")
def validate_and_convert(file: UploadFile = File(...)):
    with TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, file.filename)
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        output_dir = os.path.join(tmpdir, "output")
        os.makedirs(output_dir, exist_ok=True)

        try:
            run_audiveris_docker(input_path, output_dir)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao executar Audiveris via Docker: {str(e)}")

        # Procura o arquivo MusicXML
        musicxml_path = None
        for root, _, files in os.walk(output_dir):
            for fname in files:
                if fname.lower().endswith(".xml"):
                    musicxml_path = os.path.join(root, fname)
                    break

        if not musicxml_path:
            return JSONResponse({
                "valid": False, 
                "message": "Não foi possível reconhecer uma partitura no arquivo enviado."
            })

        # Gera o arquivo MIDI
        midi_path = os.path.join(output_dir, "output.mid")
        try:
            convert_musicxml_to_midi(musicxml_path, midi_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Erro ao converter MusicXML para MIDI: {str(e)}")

        try:
            # Upload do MusicXML
            xml_url = upload_to_supabase(musicxml_path, "music-sheets-xml")
            # Upload do MIDI
            midi_url = upload_to_supabase(midi_path, "music-sheets-midi")
            
            # Extrai informações da partitura usando music21
            score = music21.converter.parse(musicxml_path)
            metadata = {
                "title": score.metadata.title if score.metadata and score.metadata.title else "Sem título",
                "composer": score.metadata.composer if score.metadata and score.metadata.composer else "Compositor desconhecido",
                "key": str(score.analyze("key")),
                "time_signature": str(score.getTimeSignatures()[0]) if score.getTimeSignatures() else "Desconhecido",
                "measures": len(score.measureOffsets()),
            }

        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            return JSONResponse({
                "valid": False,
                "message": f"Erro inesperado ao fazer upload dos arquivos: {str(e)}",
                "traceback": tb
            })

        return JSONResponse({
            "valid": True,
            "message": "Partitura processada com sucesso.",
            "midi_url": midi_url,
            "xml_url": xml_url,
            "metadata": metadata
        })

@router.post("/validate-deep")
def validate_deep(file: UploadFile = File(...)):
    with TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, file.filename)
        with open(input_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        ext = os.path.splitext(file.filename)[1].lower()

        # Converte PDFs em imagens para processamento
        if ext == ".pdf":
            images = convert_from_path(input_path)
            if not images:
                return JSONResponse({
                    "valid": False, 
                    "message": "Não foi possível processar o arquivo PDF."
                })
            image_path = os.path.join(tmpdir, "page1.png")
            images[0].save(image_path)
            input_path = image_path

        # Validação do arquivo
        try:
            predictions = validate_with_custom_vision(input_path)
            # Logging das probabilidades para análise futura
            os.makedirs("logs", exist_ok=True)
            with open("logs/azure_predictions.log", "a", encoding="utf-8") as logf:
                from datetime import datetime
                logf.write(f"[{datetime.now().isoformat()}] arquivo={file.filename} predictions={predictions}\n")
            allowed_tags = ["partitura", "partituras", "cifra", "cifras"]
            # Aceita se qualquer tag permitida for a predição de maior probabilidade
            best = max(predictions, key=lambda p: p["probability"], default=None)
            if best and best["tag_name"].lower() in allowed_tags:
                return JSONResponse({
                    "valid": True,
                    "message": f"Arquivo validado com sucesso.",
                    "prediction": best
                })
            else:
                return JSONResponse({
                    "valid": False,
                    "message": "O arquivo não foi reconhecido como partitura ou cifra.",
                    "predictions": predictions
                })
        except ValueError as e:
            return JSONResponse({
                "valid": False,
                "message": f"Erro de configuração no serviço de validação: {str(e)}"
            })
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            return JSONResponse({
                "valid": False,
                "message": f"Erro inesperado ao validar o arquivo: {str(e)}",
                "traceback": tb
            })

def validate_with_custom_vision(file_path: str):
    """
    Valida um arquivo usando o Azure Custom Vision.

    :param file_path: Caminho para o arquivo a ser validado.
    :return: Resultado da classificação do Azure Custom Vision.
    """
    try:
        if not ENDPOINT or not PREDICTION_KEY or not PROJECT_ID or not PUBLISH_ITERATION_NAME:
            raise ValueError("As configurações do Azure Custom Vision não estão completas.")

        credentials = ApiKeyCredentials(in_headers={"Prediction-key": PREDICTION_KEY})
        predictor = CustomVisionPredictionClient(ENDPOINT, credentials)

        with open(file_path, "rb") as image_contents:
            results = predictor.classify_image(PROJECT_ID, PUBLISH_ITERATION_NAME, image_contents.read())

        print("RESULTADO AZURE:", results)
        print("DIR:", dir(results))

        if not hasattr(results, "predictions"):
            raise Exception(f"Resposta inesperada do Azure: {results}")

        predictions = []
        for prediction in results.predictions:
            predictions.append({
                "tag_name": prediction.tag_name,
                "probability": prediction.probability
            })

        return predictions
    except Exception as e:
        raise
