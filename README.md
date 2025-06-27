# S & T Station

## Descrição

O **S & T Station** é uma plataforma web inovadora dedicada à partilha, organização e acesso a partituras e cifras musicais. O projecto visa apoiar músicos, estudantes e professores, proporcionando um ambiente digital seguro e eficiente para explorar, carregar, visualizar e gerir documentos musicais em diversos formatos.

## Funcionalidades Principais

- **Exploração de Biblioteca**: Aceda a uma vasta colecção de partituras e cifras, organizadas por instrumento, compositor e nível de dificuldade.
- **Upload de Documentos Musicais**: Carregue ficheiros nos formatos PDF, MusicXML, SVG e outros, tornando-os imediatamente disponíveis para visualização e partilha.
- **Visualização Integrada**: Visualize partituras directamente na aplicação, com suporte a diferentes formatos e dispositivos.
- **Interação Social**: Comente, avalie, favorite e adicione partituras a playlists personalizadas.
- **Gestão de Playlists**: Crie e organize playlists para estudo, prática ou partilha com outros utilizadores.
- **Conversão de Formatos**: Utilize o serviço integrado para converter ficheiros para o formato MEI, facilitando a interoperabilidade com outros softwares musicais.

## Estrutura do Projecto

A estrutura do projecto está organizada da seguinte forma:

```
PAP_2222123_WalissonGandorini_Finalizada-main/
├── audiveris-5.5.3/           # Ferramentas e scripts auxiliares para análise musical
├── data/                      # Exemplos e dados de partituras
├── docs/                      # Documentação adicional
├── project/                   # Aplicação principal (frontend e backend)
│   ├── src/                   # Código-fonte React/TypeScript
│   ├── backend/               # Scripts e API Python (FastAPI)
│   ├── public/                # Recursos públicos (imagens, ícones, etc.)
│   ├── supabase/              # Configuração e funções do Supabase
│   └── ...
├── README.md                  # Este ficheiro
└── ...
```

## Tecnologias Utilizadas

- **Frontend**: React (com TypeScript), Material-UI (MUI), TailwindCSS, Framer Motion
- **Backend**: FastAPI (Python), Node.js (Express para microserviços), Supabase (Base de Dados, Autenticação, Armazenamento, Realtime)
- **Build e Ferramentas**: Vite

## Pré-requisitos

- Node.js (v16 ou superior)
- npm ou yarn
- Python 3.9+
- Supabase CLI (opcional, para gestão local do Supabase)

## Instalação

1. Clone o repositório:

   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd <NOME_DA_PASTA>
   ```

2. Instale as dependências do frontend:

   ```bash
   cd project
   npm install
   # ou
   yarn install
   ```

3. Configure as variáveis de ambiente no ficheiro `.env` com as credenciais do Supabase.

4. Inicie o servidor de desenvolvimento:

   ```bash
   npm run dev
   # ou
   yarn dev
   ```

5. (Opcional) Para funcionalidades backend em Python, instale as dependências:

   ```bash
   cd backend
   pip install -r requirements.txt
   ```

## Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento React.
- `npm run build`: Gera a build de produção.
- `npm run preview`: Pré-visualiza a build de produção.

## Contribuição

Contribuições são bem-vindas. Para contribuir:

1. Faça fork do repositório.
2. Crie uma branch para a sua funcionalidade ou correcção: `git checkout -b minha-feature`.
3. Faça commit das suas alterações: `git commit -m 'Adiciona nova funcionalidade'`.
4. Envie as alterações: `git push origin minha-feature`.
5. Abra um Pull Request.

## Licença

Este projecto está licenciado sob a licença MIT. Consulte o ficheiro `LICENSE` para mais informações.

---

**Nota**: Para dúvidas ou suporte, contacte o administrador do repositório.
