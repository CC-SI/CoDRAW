from collections import defaultdict

from ..schemas import Element


class BoardStore:
    """Store em memoria que organiza elementos por codigo de sala."""

    def __init__(self):
        # Estrutura: {room_code: [Element, Element, ...]}
        self.rooms = defaultdict(list)

    def list_elements(self, room_code: str) -> list[Element]:
        """Retorna a lista atual de elementos da sala."""
        return self.rooms[room_code]

    def add_element(self, room_code: str, element: Element) -> Element:
        """Adiciona um novo elemento na sala e retorna o proprio elemento."""
        self.rooms[room_code].append(element)
        return element

    def delete_element(self, room_code: str, element_id: str) -> bool:
        """Remove um elemento por id; retorna True quando encontrou o id."""
        before = len(self.rooms[room_code])
        self.rooms[room_code] = [e for e in self.rooms[room_code] if e.id != element_id]
        return len(self.rooms[room_code]) < before

    def clear_room(self, room_code: str) -> None:
        """Limpa todos os elementos armazenados para a sala."""
        self.rooms[room_code] = []
