from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .api.rooms import router as rooms_router
from pathlib import Path

app = FastAPI()

# API de elementos da lousa.
app.include_router(rooms_router)

@app.get("/health")
async def health_check():
    """Retorna um status simples para verificar se a API esta no ar."""
    return {"status": "ok"}

# Resolve o diretorio raiz para servir o frontend estatico pelo FastAPI.
BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
