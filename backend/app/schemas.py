from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


# Tipos de elementos suportados pela lousa.
class ElementType(str, Enum):
    """Enum com os tipos de elementos aceitos no payload."""
    freehand = "freehand"
    rectangle = "rectangle"
    circle = "circle"
    triangle = "triangle"
    diamond = "diamond"


class Point(BaseModel):
    """Ponto 2D em coordenadas normalizadas (0..1)."""
    x: float
    y: float


class FreehandGeometry(BaseModel):
    """Geometria de traço livre com lista de pontos."""
    points: list[Point] = Field(min_length=2)


class RectangleGeometry(BaseModel):
    """Geometria de retangulo baseada em canto superior esquerdo."""
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class CircleGeometry(BaseModel):
    """Geometria de circulo baseada em centro e raio."""
    cx: float
    cy: float
    radius: float = Field(gt=0)


class TriangleGeometry(BaseModel):
    """Geometria de triangulo por tres vertices."""
    p1: Point
    p2: Point
    p3: Point


class DiamondGeometry(BaseModel):
    """Geometria de losango por centro, largura e altura."""
    cx: float
    cy: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class ElementCreate(BaseModel):
    """Payload de criacao de elemento desenhavel na lousa."""
    type: ElementType
    stroke_color: str
    stroke_width: float = Field(gt=0)
    fill_color: str | None = None
    geometry: dict[str, Any]

    @model_validator(mode="after")
    def validate_geometry(self):
        """Valida e normaliza geometry de acordo com o tipo do elemento."""
        # Valida o payload de geometry de acordo com o tipo recebido.
        if self.type == ElementType.freehand:
            parsed = FreehandGeometry.model_validate(self.geometry)
        elif self.type == ElementType.rectangle:
            parsed = RectangleGeometry.model_validate(self.geometry)
        elif self.type == ElementType.circle:
            parsed = CircleGeometry.model_validate(self.geometry)
        elif self.type == ElementType.triangle:
            parsed = TriangleGeometry.model_validate(self.geometry)
        elif self.type == ElementType.diamond:
            parsed = DiamondGeometry.model_validate(self.geometry)
        else:
            raise ValueError("Tipo de elemento invalido")

        self.geometry = parsed.model_dump()
        return self


class Element(ElementCreate):
    """Elemento persistido no store com identificador unico."""
    id: str
