# CoDRAW - Versão Inicial (API em app/)

CoDRAW é uma lousa digital colaborativa em fase inicial, com backend em FastAPI e frontend estático servido na raiz da aplicação.

## Requisitos

- Python 3.10+
- pip

## Instalação

1. (Opcional) crie e ative um ambiente virtual.
2. Instale as dependencias:

```bash
pip install -r requirements.txt
```

## Como rodar

Use este comando na raiz do projeto:

```bash
py -m uvicorn app.main:app --reload --port 8000
```

## Acessos

- App (frontend): http://127.0.0.1:8000
- Healthcheck: http://127.0.0.1:8000/health
- Documentacao Swagger: http://127.0.0.1:8000/docs

## Tecnologias utilizadas

- Python
- FastAPI
- Uvicorn (ASGI)
- SQLite
- HTML, CSS e JavaScript (Canvas API)

## Endpoints principais

- `POST /api/salas` cria sala
- `GET /api/salas/{codigo}` busca sala
- `GET /api/salas/{codigo}/tracos` lista traços
- `POST /api/salas/{codigo}/tracos` salva traço
- `DELETE /api/salas/{codigo}/tracos` limpa lousa (com senha)

## Sala de teste

Para facilitar os testes de entrada em sala existente, use:

- Código da sala: `sala-teste`

Passos:
1. Abra `http://127.0.0.1:8000`
2. Informe `sala-teste` no campo de código da sala
3. Informe seu nome
4. Clique em **Entrar na sala**

## Estrutura

- `app/main.py`: inicializacao da API
- `app/routes.py`: rotas da aplicação
- `app/database.py`: conexão e schema SQLite
- `frontend/index.html`: interface
- `frontend/script.js`: lógica do canvas e integração com API
- `frontend/style.css`: estilos

## Observação

Os dados ficam em `app/lousa.db` (SQLite).
