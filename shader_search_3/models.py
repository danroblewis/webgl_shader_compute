from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator, model_validator


class EvolutionConfigBase(BaseModel):
    name: str = Field(..., description="Human-readable name")
    description: Optional[str] = Field(None, description="Optional description of this configuration")
    grid_simulation_code: str = Field(..., description="JavaScript code for the GridSimulation subclass")
    rule_set: Dict[str, Any] = Field(default_factory=dict, description="Serializable rule set for shader generation")


class EvolutionConfigCreate(EvolutionConfigBase):
    id: Optional[str] = Field(None, description="Optional identifier; generated if omitted")


class EvolutionConfig(EvolutionConfigBase):
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
    frames: List[List[List[int]]] = Field(..., description="List of frames; each frame is a 2D grid")

    @field_validator("frames")
    @classmethod
    def validate_frames(cls, frames: List[List[List[int]]]) -> List[List[List[int]]]:
        if not frames:
            raise ValueError("At least one frame is required")
        height = len(frames[0])
        width = len(frames[0][0]) if frames[0] else 0
        for frame in frames:
            if len(frame) != height:
                raise ValueError("All frames must have the same height")
            for row in frame:
                if len(row) != width:
                    raise ValueError("All rows in frames must have the same width")
        return frames

    @model_validator(mode="after")
    def ensure_dimensions_match(self) -> "TestCaseBase":
        frame_height = len(self.frames[0])
        frame_width = len(self.frames[0][0]) if self.frames[0] else 0
        if self.height != frame_height or self.width != frame_width:
            raise ValueError("Provided width/height must match frame dimensions")
        return self


class TestCaseCreate(TestCaseBase):
    id: Optional[str] = Field(None, description="Optional identifier; generated if omitted")


class TestCase(TestCaseBase):
    id: str = Field(default_factory=lambda: str(uuid4()))


class TestCaseGroupBase(BaseModel):
    name: str
    description: Optional[str] = None


class TestCaseGroupCreate(TestCaseGroupBase):
    id: Optional[str] = Field(None, description="Optional identifier; generated if omitted")
    tests: List[TestCaseCreate] = Field(default_factory=list)


class TestCaseGroup(TestCaseGroupBase):
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
