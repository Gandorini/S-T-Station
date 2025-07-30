from dotenv import load_dotenv
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from music21 import *
import json
import tempfile
import os
from typing import Dict, List, Optional
import numpy as np
from sheets_crud import router as sheets_router
from sheet_validation import router as sheet_validation_router
from supabase import create_client
from PyPDF2 import PdfReader
from PIL import Image
import requests


app = FastAPI()

# Configurar CORS (deve ser antes de tudo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Permite todas as origens
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)



class SheetAnalysis:
    def __init__(self):
        self.title = ""
        self.composer = ""
        self.instrument = ""
        self.key = ""
        self.time_signature = ""
        self.tempo = 0
        self.difficulty = ""
        self.notes = 0
        self.measures = 0
        self.chords = []
        self.scales = []
        self.melody_contour = []
        self.rhythm_complexity = 0
        self.harmonic_complexity = 0
        self.technical_difficulty = 0
        self.expression_markers = []
        self.dynamics = []
        self.articulations = []
        self.recommended_instruments = []

def analyze_melody_contour(score: stream.Score) -> List[str]:
    """Analisa o contorno melódico da partitura"""
    contour = []
    for part in score.parts:
        for measure in part.getElementsByClass('Measure'):
            for note in measure.getElementsByClass('Note'):
                if len(contour) == 0:
                    contour.append('start')
                elif note.pitch.midi > contour[-1]:
                    contour.append('up')
                elif note.pitch.midi < contour[-1]:
                    contour.append('down')
                else:
                    contour.append('same')
    return contour

def calculate_rhythm_complexity(score: stream.Score) -> float:
    """Calcula a complexidade rítmica da partitura"""
    rhythm_values = []
    for part in score.parts:
        for measure in part.getElementsByClass('Measure'):
            for note in measure.getElementsByClass('Note'):
                rhythm_values.append(note.quarterLength)
    
    if not rhythm_values:
        return 0
    
    # Calcula a variância dos valores rítmicos
    return np.var(rhythm_values)

def analyze_harmonic_complexity(score: stream.Score) -> float:
    """Analisa a complexidade harmônica da partitura"""
    chords = []
    for part in score.parts:
        for measure in part.getElementsByClass('Measure'):
            chord = measure.getElementsByClass('Chord')
            if chord:
                chords.append(len(chord[0].pitches))
    
    if not chords:
        return 0
    
    # Calcula a média de notas por acorde
    return np.mean(chords)

def detect_expression_markers(score: stream.Score) -> List[str]:
    """Detecta marcadores de expressão na partitura"""
    markers = []
    for part in score.parts:
        for element in part.getElementsByClass(['Dynamic', 'Expression']):
            markers.append(element.value)
    return list(set(markers))

def analyze_technical_difficulty(score: stream.Score) -> float:
    """Analisa a dificuldade técnica da partitura"""
    factors = {
        'rhythm': calculate_rhythm_complexity(score),
        'harmony': analyze_harmonic_complexity(score),
        'range': 0,
        'tempo': 0
    }
    
    # Análise de extensão
    for part in score.parts:
        notes = part.getElementsByClass('Note')
        if notes:
            pitches = [note.pitch.midi for note in notes]
            factors['range'] = max(pitches) - min(pitches)
    
    # Análise de tempo
    for part in score.parts:
        tempos = part.getElements('MetronomeMark')
        if tempos:
            factors['tempo'] = tempos[0].number
    
    # Cálculo final da dificuldade
    difficulty = (
        factors['rhythm'] * 0.3 +
        factors['harmony'] * 0.3 +
        (factors['range'] / 12) * 0.2 +
        (factors['tempo'] / 200) * 0.2
    )
    
    return min(max(difficulty, 0), 1)

from sheets_crud import get_current_user # Import the dependency
from functools import lru_cache

@lru_cache()
def get_supabase_admin_client():
    """Create and return a Supabase admin client for privileged operations."""
    url = os.environ.get("SUPABASE_URL")
    secret_key = os.environ.get("SUPABASE_ROLE_KEY")
    if not url or not secret_key:
        raise ValueError("Supabase URL and Service Role Key must be set.")
    return create_client(url, secret_key)

@app.delete("/users/me")
def delete_current_user(user: dict = Depends(get_current_user)):
    """
    Deletes the currently authenticated user's profile and auth record.
    This is a protected endpoint.
    """
    user_id = user["id"]
    supabase_admin = get_supabase_admin_client()

    # 1. Delete the user's profile from the public `profiles` table
    # We can use the admin client for this, or the regular one. Admin is fine.
    profile_response = supabase_admin.table("profiles").delete().eq("id", user_id).execute()

    if profile_response.error and profile_response.error.code != 'PGRST116': # Ignore if profile not found
        print(f"Could not delete profile for user {user_id}: {profile_response.error.message}")
        # Decide if you want to stop or continue. We'll continue.

    # 2. Delete the user from `auth.users`
    # This requires the admin client.
    auth_response = supabase_admin.auth.admin.delete_user(user_id)

    if auth_response.error:
        # If this fails, it's a more serious problem.
        raise HTTPException(status_code=500, detail=f"Failed to delete user from authentication system: {auth_response.error.message}")

    return {"ok": True, "message": "User and profile deleted successfully."}

app.include_router(sheets_router)
app.include_router(sheet_validation_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)