"""
Shader Search 3 - FastAPI Backend
GPU-accelerated cellular automata shader evolution
"""

from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException, Response, status

from models import (
    EvolutionConfig,
    EvolutionConfigCreate,
    TestCaseGroup,
    TestCaseGroupCreate,
)
from repositories import EvolutionConfigRepository, TestCaseGroupRepository

app = FastAPI(title="Shader Search 3", version="3.0.0")

DATA_DIR = Path(__file__).resolve().parent / "data"
CONFIG_REPO = EvolutionConfigRepository(DATA_DIR / "evolution_configs.json")
TEST_GROUP_REPO = TestCaseGroupRepository(DATA_DIR / "test_case_groups.json")


@app.get("/")
async def root():
    """Basic welcome endpoint."""
    return {
        "message": "Shader Search 3 API",
        "version": app.version,
        "docs": "/docs",
        "resources": {
            "evolution_configs": "/api/evolution-configs",
            "test_case_groups": "/api/test-case-groups",
        },
    }


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "ok", "version": app.version}


# Evolution configurations ----------------------------------------------------


@app.get("/api/evolution-configs", response_model=List[EvolutionConfig])
async def list_evolution_configs() -> List[EvolutionConfig]:
    return CONFIG_REPO.list()


@app.post(
    "/api/evolution-configs",
    response_model=EvolutionConfig,
    status_code=status.HTTP_201_CREATED,
)
async def create_evolution_config(payload: EvolutionConfigCreate) -> EvolutionConfig:
    return CONFIG_REPO.create(payload)


@app.get("/api/evolution-configs/{config_id}", response_model=EvolutionConfig)
async def get_evolution_config(config_id: str) -> EvolutionConfig:
    config = CONFIG_REPO.get(config_id)
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    return config


@app.put("/api/evolution-configs/{config_id}", response_model=EvolutionConfig)
async def update_evolution_config(config_id: str, payload: EvolutionConfigCreate) -> EvolutionConfig:
    try:
        return CONFIG_REPO.update(config_id, payload)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found") from None


@app.delete("/api/evolution-configs/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evolution_config(config_id: str) -> Response:
    deleted = CONFIG_REPO.delete(config_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Test case groups -----------------------------------------------------------


@app.get("/api/test-case-groups", response_model=List[TestCaseGroup])
async def list_test_case_groups() -> List[TestCaseGroup]:
    return TEST_GROUP_REPO.list()


@app.post(
    "/api/test-case-groups",
    response_model=TestCaseGroup,
    status_code=status.HTTP_201_CREATED,
)
async def create_test_case_group(payload: TestCaseGroupCreate) -> TestCaseGroup:
    return TEST_GROUP_REPO.create(payload)


@app.get("/api/test-case-groups/{group_id}", response_model=TestCaseGroup)
async def get_test_case_group(group_id: str) -> TestCaseGroup:
    group = TEST_GROUP_REPO.get(group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case group not found")
    return group


@app.put("/api/test-case-groups/{group_id}", response_model=TestCaseGroup)
async def update_test_case_group(group_id: str, payload: TestCaseGroupCreate) -> TestCaseGroup:
    try:
        return TEST_GROUP_REPO.update(group_id, payload)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case group not found") from None


@app.delete("/api/test-case-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_case_group(group_id: str) -> Response:
    deleted = TEST_GROUP_REPO.delete(group_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case group not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

