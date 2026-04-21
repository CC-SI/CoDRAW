# CoDRAW - Versao Inicial

CoDRAW é uma lousa colaborativa em fase inicial, com backend em FastAPI e frontend estático servido pelo próprio backend.

## Requisitos

- Python 3.10+ (recomendado)
- pip
- Terminal (PowerShell, CMD ou similar)

## Instalação

1. (Opcional, recomendado) crie e ative um ambiente virtual.
2. Instale as dependências do projeto:

```bash
pip install -r requirements.txt
```

## Como rodar

Execute o backend com recarga automática:

```bash
py -m uvicorn backend.app.main:app --reload --port 8000
```

Acesse no navegador:

- App: http://127.0.0.1:8000
- Healthcheck: http://127.0.0.1:8000/health

## Funcionalidades desta versão

- Desenho livre (freehand)
- Formas: retângulo, círculo, triângulo e losango
- Seleção de elemento
- Apagar elemento selecionado
- Limpar toda a lousa

## Estrutura do projeto

- `backend/app/main.py`: inicialização da API e serviço de arquivos estticos do frontend
- `backend/app/api/rooms.py`: rotas da lousa (criar, listar, remover e limpar)
- `backend/app/schemas.py`: modelos e validações dos elementos
- `backend/app/services/board_store.py`: armazenamento em memória por sala
- `frontend/index.html`: estrutura da interface
- `frontend/script.js`: lógica de desenho, seleção e integração com API
- `frontend/style.css`: estilos da interface

## Observacoes

- Nesta versão inicial, os dados ficam em mem´pria.
- Ao reiniciar o servidor, os desenhos são perdidos.