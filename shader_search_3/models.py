from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class EvolutionConfigBase(BaseModel):
    __test__ = False

    name: str = Field(..., description="Human-readable name")
    description: Optional[str] = Field(None, description="Optional description of this configuration")
    grid_simulation_code: str = Field(..., description="JavaScript code for the GridSimulation subclass")
    rule_set: Dict[str, Any] = Field(default_factory=dict, description="Serializable rule set for shader generation")


class EvolutionConfigCreate(EvolutionConfigBase):
    __test__ = False

    id: Optional[str] = Field(None, description="Optional identifier; generated if omitted")


class EvolutionConfig(EvolutionConfigBase):
    __test__ = False

    id: str = Field(default_factory=lambda: str(uuid4()))

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": "cfg-123",
                "name": "Sand baseline",
                "description": "Baseline sand simulation config",
                "grid_simulation_code": "class SandSimulation extends GridSimulation { /* ... */ }",
                "rule_set": {"EMPTY": [], "SAND": []}
            }
        }
    }


class TestCaseBase(BaseModel):
    name: str = Field(..., description="Test case name")
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)
    frames: List[List[List[List[float]]]] = Field(..., description="List of frames; each frame is a 2D grid of RGBA vectors")

    @field_validator("frames", mode="before")
    @classmethod
    def normalize_frames(cls, frames: List[List[List[Any]]]) -> List[List[List[float]]]:
        if not frames:
            raise ValueError("At least one frame is required")

        normalized: List[List[List[float]]] = []
        for frame in frames:
            normalized_frame: List[List[float]] = []
            for row in frame:
                normalized_row: List[float] = []
                for cell in row:
                    if isinstance(cell, (list, tuple)):
                        vec = [float(x) for x in cell[:4]]
                        while len(vec) < 4:
                            vec.append(0.0)
                    else:
                        value = float(cell)
                        vec = [value, 0.0, 0.0, 0.0]
                    normalized_row.append(vec)
                normalized_frame.append(normalized_row)
            normalized.append(normalized_frame)
        return normalized

    @model_validator(mode="after")
    def ensure_dimensions_match(self) -> "TestCaseBase":
        frame_height = len(self.frames[0])
        frame_width = len(self.frames[0][0]) if self.frames[0] else 0
        if self.height != frame_height or self.width != frame_width:
            raise ValueError("Provided width/height must match frame dimensions")
        for frame in self.frames:
            if len(frame) != frame_height:
                raise ValueError("All frames must have the same height")
            for row in frame:
                if len(row) != frame_width:
                    raise ValueError("All rows in frames must have the same width")
                for cell in row:
                    if len(cell) != 4:
                        raise ValueError("Each cell must contain 4 values (RGBA)")
        return self


class TestCaseCreate(TestCaseBase):
    __test__ = False

    id: Optional[str] = Field(None, description="Optional identifier; generated if omitted")


class TestCase(TestCaseBase):
    __test__ = False

    id: str = Field(default_factory=lambda: str(uuid4()))


class TestCaseGroupBase(BaseModel):
    __test__ = False

    name: str
    description: Optional[str] = None


class TestCaseGroupCreate(TestCaseGroupBase):
    __test__ = False

    id: Optional[str] = Field(None, description="Optional identifier; generated if omitted")
    tests: List[TestCaseCreate] = Field(default_factory=list)


class TestCaseGroup(TestCaseGroupBase):
    __test__ = False

    id: str = Field(default_factory=lambda: str(uuid4()))
    tests: List[TestCase] = Field(default_factory=list)


__all__ = [
    "EvolutionConfig",
    "EvolutionConfigCreate",
    "EvolutionConfigBase",
    "TestCase",
    "TestCaseCreate",
    "TestCaseBase",
    "TestCaseGroup",
    "TestCaseGroupCreate",
    "TestCaseGroupBase",
]
