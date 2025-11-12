from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Dict, Generic, Iterable, List, Optional, Type, TypeVar
from uuid import uuid4

from pydantic import BaseModel

from models import (
    EvolutionConfig,
    EvolutionConfigCreate,
    TestCase,
    TestCaseCreate,
    TestCaseGroup,
    TestCaseGroupCreate,
)

TModel = TypeVar("TModel", bound=BaseModel)
TCreate = TypeVar("TCreate", bound=BaseModel)


class JSONRepository(Generic[TModel, TCreate]):
    """Thread-safe JSON file repository."""

    __test__ = False

    def __init__(self, file_path: Path, model_cls: Type[TModel]) -> None:
        self.file_path = file_path
        self.model_cls = model_cls
        self._lock = Lock()
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.file_path.exists():
            self.file_path.write_text("[]", encoding="utf-8")

    # Internal helpers -------------------------------------------------
    def _read(self) -> List[Dict]:
        with self._lock:
            raw = self.file_path.read_text(encoding="utf-8") or "[]"
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                data = []
        if not isinstance(data, list):
            raise ValueError("Repository root must be a list")
        return data

    def _write(self, data: Iterable[Dict]) -> None:
        with self._lock:
            serialized = json.dumps(list(data), indent=2)
            self.file_path.write_text(serialized, encoding="utf-8")

    def _find_index(self, items: List[Dict], item_id: str) -> Optional[int]:
        for idx, item in enumerate(items):
            if item.get("id") == item_id:
                return idx
        return None

    # CRUD -------------------------------------------------------------
    def list(self) -> List[TModel]:
        return [self.model_cls.model_validate(item) for item in self._read()]

    def get(self, item_id: str) -> Optional[TModel]:
        for item in self._read():
            if item.get("id") == item_id:
                return self.model_cls.model_validate(item)
        return None

    def delete(self, item_id: str) -> bool:
        items = self._read()
        idx = self._find_index(items, item_id)
        if idx is None:
            return False
        items.pop(idx)
        self._write(items)
        return True


class EvolutionConfigRepository(JSONRepository[EvolutionConfig, EvolutionConfigCreate]):
    __test__ = False

    def __init__(self, file_path: Path) -> None:
        super().__init__(file_path, EvolutionConfig)

    def create(self, payload: EvolutionConfigCreate) -> EvolutionConfig:
        config = EvolutionConfig(id=payload.id or str(uuid4()), **payload.model_dump(exclude={"id"}))
        items = self._read()
        items.append(config.model_dump())
        self._write(items)
        return config

    def update(self, config_id: str, payload: EvolutionConfigCreate) -> EvolutionConfig:
        items = self._read()
        idx = self._find_index(items, config_id)
        if idx is None:
            raise KeyError(config_id)
        updated = EvolutionConfig(id=config_id, **payload.model_dump(exclude={"id"}))
        items[idx] = updated.model_dump()
        self._write(items)
        return updated


class TestCaseGroupRepository(JSONRepository[TestCaseGroup, TestCaseGroupCreate]):
    __test__ = False

    def __init__(self, file_path: Path) -> None:
        super().__init__(file_path, TestCaseGroup)

    def _materialize_tests(self, tests: List[TestCaseCreate]) -> List[TestCase]:
        materialized: List[TestCase] = []
        for test in tests:
            test_id = test.id or str(uuid4())
            materialized.append(TestCase(id=test_id, **test.model_dump(exclude={"id"})))
        return materialized

    def create(self, payload: TestCaseGroupCreate) -> TestCaseGroup:
        tests = self._materialize_tests(payload.tests)
        group = TestCaseGroup(id=payload.id or str(uuid4()), tests=tests, **payload.model_dump(exclude={"id", "tests"}))
        items = self._read()
        items.append(group.model_dump())
        self._write(items)
        return group

    def update(self, group_id: str, payload: TestCaseGroupCreate) -> TestCaseGroup:
        items = self._read()
        idx = self._find_index(items, group_id)
        if idx is None:
            raise KeyError(group_id)
        tests = self._materialize_tests(payload.tests)
        updated = TestCaseGroup(id=group_id, tests=tests, **payload.model_dump(exclude={"id", "tests"}))
        items[idx] = updated.model_dump()
        self._write(items)
        return updated
