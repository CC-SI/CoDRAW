from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.database import init_db
from app.routes import router

app = FastAPI(
    title="CoDRAW - Lousa Digital",
    description="Backend simples para lousa digital colaborativa",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa o banco ao subir o servidor.
init_db()

# Endpoints principais da API.
app.include_router(router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

# Servir frontend diretamente na raiz da aplicacao.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
