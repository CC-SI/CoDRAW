from uuid import uuid4

from fastapi import APIRouter, HTTPException

from ..schemas import Element, ElementCreate
from ..services.board_store import BoardStore

router = APIRouter(prefix="/rooms", tags=["rooms"])
# Store em memoria por sala (sem persistencia em banco nesta fase).
store = BoardStore()


@router.post("/{room_code}/elements", response_model=Element)
def create_element(room_code: str, payload: ElementCreate):
    """Cria um elemento na sala informada e retorna o elemento com id."""
    element = Element(id=str(uuid4()), **payload.model_dump())
    return store.add_element(room_code, element)


@router.get("/{room_code}/elements", response_model=list[Element])
def list_elements(room_code: str):
    """Lista todos os elementos salvos para a sala informada."""
    return store.list_elements(room_code)


@router.delete("/{room_code}/elements/{element_id}")
def delete_element(room_code: str, element_id: str):
    """Remove um elemento especifico da sala pelo id."""
    ok = store.delete_element(room_code, element_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Elemento nao encontrado")
    return {"ok": True}


@router.delete("/{room_code}/elements")
def clear_room(room_code: str):
    """Remove todos os elementos de uma sala."""
    store.clear_room(room_code)
    return {"ok": True}
