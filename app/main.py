from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routes import router

app = FastAPI(
    title="CoDRAW — Lousa Digital",
    description="Backend simples para lousa digital colaborativa",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa o banco ao subir o servidor
init_db()

app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"message": "CoDRAW API rodando!", "docs": "/docs"}
