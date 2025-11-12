import pytest

from models import (
    EvolutionConfig,
    EvolutionConfigCreate,
    TestCase,
    TestCaseCreate,
)


def test_evolution_config_generates_id_when_missing():
    payload = EvolutionConfigCreate(
        name="Config A",
        description="Example",
        grid_simulation_code="class Sim extends GridSimulation {}",
        rule_set={"EMPTY": []},
    )

    config = EvolutionConfig(**payload.model_dump(exclude={"id"}))

    assert isinstance(config.id, str)
    assert config.id


def test_evolution_config_respects_explicit_id():
    payload = EvolutionConfigCreate(
        id="cfg-123",
        name="Config B",
        description=None,
        grid_simulation_code="class Sim extends GridSimulation {}",
        rule_set={},
    )

    config = EvolutionConfig(**payload.model_dump())

    assert config.id == "cfg-123"


def test_test_case_dimensions_validated():
    frames = [
        [[0, 1], [2, 3]],
        [[4, 5], [6, 7]],
    ]

    test_case = TestCase(
        name="valid",
        width=2,
        height=2,
        frames=frames,
    )

    assert test_case.width == 2
    assert len(test_case.frames) == 2


def test_test_case_raises_when_dimensions_mismatch():
    frames = [
        [[0, 1], [2, 3]],
    ]

    with pytest.raises(ValueError):
        TestCase(
            name="invalid",
            width=3,  # does not match frame width
            height=2,
            frames=frames,
        )


def test_test_case_create_allows_optional_id():
    frames = [[[0]]]

    created = TestCaseCreate(
        name="single",
        width=1,
        height=1,
        frames=frames,
    )

    assert created.id is None
