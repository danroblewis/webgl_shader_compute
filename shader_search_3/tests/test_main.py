from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import main
from models import EvolutionConfigCreate, TestCaseCreate, TestCaseGroupCreate
from repositories import EvolutionConfigRepository, TestCaseGroupRepository


@pytest.fixture
def client(tmp_path: Path, monkeypatch) -> TestClient:
    config_repo = EvolutionConfigRepository(tmp_path / "configs.json")
    group_repo = TestCaseGroupRepository(tmp_path / "groups.json")

    monkeypatch.setattr(main, "CONFIG_REPO", config_repo)
    monkeypatch.setattr(main, "TEST_GROUP_REPO", group_repo)

    return TestClient(main.app)


def test_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")
    body = response.text
    assert "<!DOCTYPE html>" in body
    assert "Shader Search 3" in body


def test_evolution_config_endpoints(client: TestClient):
    payload = EvolutionConfigCreate(
        name="Config",
        description="desc",
        grid_simulation_code="class Sim extends GridSimulation {}",
        rule_set={},
    )

    created = client.post("/api/evolution-configs", json=payload.model_dump()).json()
    config_id = created["id"]
    assert created["name"] == "Config"

    listed = client.get("/api/evolution-configs").json()
    assert len(listed) == 1

    fetched = client.get(f"/api/evolution-configs/{config_id}").json()
    assert fetched["id"] == config_id

    update_payload = payload.model_copy(update={"name": "Updated"})
    updated = client.put(
        f"/api/evolution-configs/{config_id}",
        json=update_payload.model_dump(),
    ).json()
    assert updated["name"] == "Updated"

    delete_response = client.delete(f"/api/evolution-configs/{config_id}")
    assert delete_response.status_code == 204
    remaining = client.get("/api/evolution-configs").json()
    assert remaining == []


def test_test_case_group_endpoints(client: TestClient):
    group_payload = TestCaseGroupCreate(
        name="Group",
        description="desc",
        tests=[
            TestCaseCreate(
                name="Test",
                width=2,
                height=2,
                frames=[
                    [[0, 1], [2, 3]],
                    [[4, 5], [6, 7]],
                ],
            )
        ],
    )

    created = client.post(
        "/api/test-case-groups",
        json=group_payload.model_dump(),
    ).json()
    group_id = created["id"]
    assert created["name"] == "Group"
    assert len(created["tests"]) == 1

    listed = client.get("/api/test-case-groups").json()
    assert len(listed) == 1

    fetched = client.get(f"/api/test-case-groups/{group_id}").json()
    assert fetched["id"] == group_id

    update_payload = group_payload.model_copy(update={"name": "Updated"})
    updated = client.put(
        f"/api/test-case-groups/{group_id}",
        json=update_payload.model_dump(),
    ).json()
    assert updated["name"] == "Updated"

    delete_response = client.delete(f"/api/test-case-groups/{group_id}")
    assert delete_response.status_code == 204
    remaining = client.get("/api/test-case-groups").json()
    assert remaining == []
