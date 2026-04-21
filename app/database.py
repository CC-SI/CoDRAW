import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "lousa.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH, timeout=10)  # evita "database is locked" em concorrência
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # leituras não bloqueiam escritas
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Tabela de salas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS salas (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo      TEXT    NOT NULL UNIQUE,
            professor   TEXT    NOT NULL,
            senha       TEXT    NOT NULL,
            criada_em   DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Tabela de traços desenhados
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS tracos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sala_codigo TEXT    NOT NULL,
            usuario     TEXT    NOT NULL,
            x1          REAL    NOT NULL,
            y1          REAL    NOT NULL,
            x2          REAL    NOT NULL,
            y2          REAL    NOT NULL,
            cor         TEXT    NOT NULL DEFAULT '#000000',
            espessura   INTEGER NOT NULL DEFAULT 3,
            criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sala_codigo) REFERENCES salas(codigo)
        )
    """)

    conn.commit()
    conn.close()
    print("✅ Banco de dados inicializado.")
