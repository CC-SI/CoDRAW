from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_connection

router = APIRouter()


class CriarSala(BaseModel):
    codigo: str
    professor: str
    senha: str


class EntrarSala(BaseModel):
    usuario: str


class NovoTraco(BaseModel):
    usuario: str
    x1: float
    y1: float
    x2: float
    y2: float
    cor: str = "#000000"
    espessura: int = 3
    ferramenta: str = "caneta"
    texto: str | None = None
    font: str | None = None
    font_size: int | None = None


class AcaoProtegida(BaseModel):
    senha: str


@router.post("/salas", summary="Criar uma nova sala")
def criar_sala(dados: CriarSala):
    if not dados.senha or len(dados.senha) < 4:
        raise HTTPException(status_code=400, detail="A senha deve ter pelo menos 4 caracteres.")

    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO salas (codigo, professor, senha) VALUES (?, ?, ?)",
            (dados.codigo, dados.professor, dados.senha),
        )
        conn.commit()
        return {
            "message": "Sala criada com sucesso.",
            "codigo": dados.codigo,
            "professor": dados.professor,
        }
    except Exception:
        raise HTTPException(status_code=400, detail=f"Ja existe uma sala com o codigo '{dados.codigo}'.")
    finally:
        conn.close()


@router.get("/salas/{codigo}", summary="Buscar informacoes de uma sala")
def buscar_sala(codigo: str):
    conn = get_connection()
    sala = conn.execute("SELECT * FROM salas WHERE codigo = ?", (codigo,)).fetchone()
    conn.close()

    if not sala:
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")

    return {
        "codigo": sala["codigo"],
        "professor": sala["professor"],
        "criada_em": sala["criada_em"],
    }


@router.get("/salas", summary="Listar todas as salas")
def listar_salas():
    conn = get_connection()
    salas = conn.execute(
        "SELECT codigo, professor, criada_em FROM salas ORDER BY criada_em DESC"
    ).fetchall()
    conn.close()
    return {"salas": [dict(s) for s in salas]}


@router.delete("/salas/{codigo}", summary="Deletar sala e todos os tracos")
def deletar_sala(codigo: str, dados: AcaoProtegida):
    conn = get_connection()
    sala = conn.execute("SELECT * FROM salas WHERE codigo = ?", (codigo,)).fetchone()

    if not sala:
        conn.close()
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")
    if sala["senha"] != dados.senha:
        conn.close()
        raise HTTPException(status_code=403, detail="Senha incorreta.")

    conn.execute("DELETE FROM tracos WHERE sala_codigo = ?", (codigo,))
    conn.execute("DELETE FROM salas WHERE codigo = ?", (codigo,))
    conn.commit()
    conn.close()
    return {"message": f"Sala '{codigo}' deletada com sucesso."}


@router.post("/salas/{codigo}/tracos", summary="Salvar um traco na lousa")
def salvar_traco(codigo: str, traco: NovoTraco):
    conn = get_connection()
    sala = conn.execute("SELECT * FROM salas WHERE codigo = ?", (codigo,)).fetchone()

    if not sala:
        conn.close()
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")

    cursor = conn.execute(
        """
        INSERT INTO tracos (
            sala_codigo, usuario, x1, y1, x2, y2,
            cor, espessura, ferramenta, texto, font, font_size
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            codigo,
            traco.usuario,
            traco.x1,
            traco.y1,
            traco.x2,
            traco.y2,
            traco.cor,
            traco.espessura,
            traco.ferramenta,
            traco.texto,
            traco.font,
            traco.font_size,
        ),
    )
    conn.commit()
    ultimo_id = cursor.lastrowid
    conn.close()
    return {"message": "Traco salvo.", "id": ultimo_id}


@router.get("/salas/{codigo}/tracos", summary="Buscar todos os tracos da sala")
def buscar_tracos(codigo: str, desde_id: int = 0):
    conn = get_connection()
    sala = conn.execute("SELECT * FROM salas WHERE codigo = ?", (codigo,)).fetchone()

    if not sala:
        conn.close()
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")

    tracos = conn.execute(
        "SELECT * FROM tracos WHERE sala_codigo = ? AND id > ? ORDER BY id ASC",
        (codigo, desde_id),
    ).fetchall()
    conn.close()

    return {"tracos": [dict(t) for t in tracos]}


@router.delete("/salas/{codigo}/tracos", summary="Limpar a lousa (somente professor)")
def limpar_lousa(codigo: str, dados: AcaoProtegida):
    conn = get_connection()
    sala = conn.execute("SELECT * FROM salas WHERE codigo = ?", (codigo,)).fetchone()

    if not sala:
        conn.close()
        raise HTTPException(status_code=404, detail="Sala nao encontrada.")
    if sala["senha"] != dados.senha:
        conn.close()
        raise HTTPException(status_code=403, detail="Senha incorreta.")

    conn.execute("DELETE FROM tracos WHERE sala_codigo = ?", (codigo,))
    conn.commit()
    conn.close()
    return {"message": "Lousa limpa com sucesso."}
