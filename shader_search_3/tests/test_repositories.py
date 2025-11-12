from pathlib import Path

import pytest

from models import EvolutionConfigCreate, TestCaseCreate, TestCaseGroupCreate
from repositories import EvolutionConfigRepository, TestCaseGroupRepository


@pytest.fixture
def repo_paths(tmp_path: Path):
    return {
        "configs": tmp_path / "configs.json",
        "groups": tmp_path / "groups.json",
    }


@pytest.fixture
def config_repo(repo_paths):
    return EvolutionConfigRepository(repo_paths["configs"])


@pytest.fixture
def group_repo(repo_paths):
    return TestCaseGroupRepository(repo_paths["groups"])


def sample_config_payload(name="Config"):
    return EvolutionConfigCreate(
        name=name,
        description="desc",
        grid_simulation_code="class Sim extends GridSimulation {}",
        rule_set={"EMPTY": []},
    )


def sample_group_payload(name="Group"):
    return TestCaseGroupCreate(
        name=name,
        description="desc",
        tests=[
            TestCaseCreate(
                name="test",
                width=2,
                height=2,
                frames=[
                    [[0, 1], [2, 3]],
                    [[4, 5], [6, 7]],
                ],
            )
        ],
    )


def test_evolution_config_repository_crud(config_repo: EvolutionConfigRepository):
    created = config_repo.create(sample_config_payload("A"))
    assert created.id
    assert created.name == "A"

    listed = config_repo.list()
    assert len(listed) == 1

    fetched = config_repo.get(created.id)
    assert fetched is not None
    assert fetched.name == "A"

    updated = config_repo.update(created.id, sample_config_payload("B"))
    assert updated.id == created.id
    assert updated.name == "B"

    deleted = config_repo.delete(created.id)
    assert deleted is True
    assert config_repo.list() == []


def test_evolution_config_repository_delete_missing(config_repo: EvolutionConfigRepository):
    assert config_repo.delete("missing") is False


def test_test_case_group_repository_crud(group_repo: TestCaseGroupRepository):
    created = group_repo.create(sample_group_payload("Group A"))
    assert created.id
    assert len(created.tests) == 1

    listed = group_repo.list()
    assert len(listed) == 1

    fetched = group_repo.get(created.id)
    assert fetched is not None
    assert fetched.tests[0].name == "test"

    update_payload = sample_group_payload("Group B")
    updated = group_repo.update(created.id, update_payload)
    assert updated.name == "Group B"
    assert len(updated.tests) == len(update_payload.tests)

    deleted = group_repo.delete(created.id)
    assert deleted is True
    assert group_repo.list() == []


def test_test_case_group_repository_delete_missing(group_repo: TestCaseGroupRepository):
    assert group_repo.delete("missing") is False
