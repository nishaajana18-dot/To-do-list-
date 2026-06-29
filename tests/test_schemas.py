from uuid import uuid4

import pytest
from pydantic import ValidationError

from packages.core.src.schemas import (
    ProjectCreate,
    ProjectUpdate,
    SourceCreate,
    HypothesisCreate,
    HypothesisUpdate,
    ExtractedClaim,
    SourceType,
    HypothesisStatus,
    ExtractionStatus,
)


class TestProjectCreate:
    def test_valid_project(self):
        p = ProjectCreate(title="Test project")
        assert p.title == "Test project"
        assert p.novelty_preference is None

    def test_empty_title_fails(self):
        with pytest.raises(ValidationError):
            ProjectCreate(title="")

    def test_with_all_fields(self):
        p = ProjectCreate(
            title="Full project",
            branch_of_science="Biology",
            research_problem="Test problem",
            novelty_preference=0.7,
        )
        assert p.novelty_preference == 0.7

    def test_invalid_novelty(self):
        with pytest.raises(ValidationError):
            ProjectCreate(title="Bad", novelty_preference=1.5)


class TestSourceCreate:
    def test_valid_source(self):
        s = SourceCreate(
            project_id=uuid4(),
            source_type=SourceType.PDF,
            source_name="paper.pdf",
        )
        assert s.source_type == SourceType.PDF

    def test_invalid_source_type(self):
        with pytest.raises(ValidationError):
            SourceCreate(
                project_id=uuid4(),
                source_type="invalid",
                source_name="test.txt",
            )


class TestExtractedClaim:
    def test_valid_claim(self):
        c = ExtractedClaim(
            source_id=uuid4(),
            text="Enzyme activity increased with temperature",
            claim_type="result",
            confidence=0.8,
        )
        assert c.confidence == 0.8

    def test_default_values(self):
        c = ExtractedClaim(
            source_id=uuid4(),
            text="A claim",
        )
        assert c.confidence == 0.5
        assert c.variables == []


class TestHypothesisCreate:
    def test_valid_hypothesis(self):
        h = HypothesisCreate(
            project_id=uuid4(),
            title="Test hypothesis",
            research_question="What is the effect?",
            hypothesis="There is an effect",
        )
        assert h.title == "Test hypothesis"

    def test_missing_required(self):
        with pytest.raises(ValidationError):
            HypothesisCreate(project_id=uuid4(), title="Incomplete")


class TestHypothesisUpdate:
    def test_partial_update(self):
        u = HypothesisUpdate(title="New title", status=HypothesisStatus.REVIEWED)
        assert u.title == "New title"
        assert u.status == HypothesisStatus.REVIEWED

    def test_empty_update(self):
        u = HypothesisUpdate()
        assert u.model_dump(exclude_unset=True) == {}
