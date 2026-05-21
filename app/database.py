import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "lousa.db")


def get_connection():
    """Retorna conexao SQLite com row_factory para dict-like rows."""
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    """Adiciona coluna se ela ainda nao existir."""
    columns = conn.execute(f"PRAGMA table_info({table})").fetchall()
    existing = {c[1] for c in columns}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db():
    """Cria tabelas necessarias e aplica migracoes leves."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS salas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT NOT NULL UNIQUE,
            professor TEXT NOT NULL,
            senha TEXT NOT NULL,
            criada_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS tracos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sala_codigo TEXT NOT NULL,
            usuario TEXT NOT NULL,
            x1 REAL NOT NULL,
            y1 REAL NOT NULL,
            x2 REAL NOT NULL,
            y2 REAL NOT NULL,
            cor TEXT NOT NULL DEFAULT '#000000',
            espessura INTEGER NOT NULL DEFAULT 3,
            ferramenta TEXT NOT NULL DEFAULT 'caneta',
            texto TEXT,
            font TEXT,
            font_size INTEGER,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sala_codigo) REFERENCES salas(codigo)
        )
        """
    )

    # Migracao para bases antigas ja existentes.
    _ensure_column(conn, "tracos", "ferramenta", "ferramenta TEXT NOT NULL DEFAULT 'caneta'")
    _ensure_column(conn, "tracos", "texto", "texto TEXT")
    _ensure_column(conn, "tracos", "font", "font TEXT")
    _ensure_column(conn, "tracos", "font_size", "font_size INTEGER")

    conn.commit()
    conn.close()
