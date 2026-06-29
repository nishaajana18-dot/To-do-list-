import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from packages.core.src.database import get_db
from packages.core.src.models import Hypothesis, Project
from packages.core.src.schemas import (
    HypothesisCreate,
    HypothesisResponse,
    HypothesisUpdate,
    HypothesisStatus,
)
from packages.hypothesis.src.gap_detection import GapDetector
from packages.hypothesis.src.hypothesis_generator import HypothesisGenerator

logger = logging.getLogger(__name__)

router = APIRouter()
gap_detector = GapDetector()
hypothesis_generator = HypothesisGenerator()


@router.post("/generate/{project_id}", response_model=list[HypothesisResponse], status_code=201)
def generate_hypotheses(project_id: UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    gaps = gap_detector.detect(db, project_id)

    hypotheses_data = hypothesis_generator.generate(db, project_id, gaps)

    created = []
    for h_data in hypotheses_data:
        hypothesis = Hypothesis(
            project_id=project_id,
            title=h_data["title"],
            research_question=h_data["research_question"],
            hypothesis=h_data["hypothesis"],
            mechanism=h_data.get("mechanism"),
            supporting_evidence=h_data.get("supporting_evidence", []),
            conflicting_evidence=h_data.get("conflicting_evidence", []),
            assumptions=h_data.get("assumptions", []),
            proposed_experiment=h_data.get("proposed_experiment"),
            predicted_outcome=h_data.get("predicted_outcome"),
            falsification_criteria=h_data.get("falsification_criteria"),
            confidence_score=h_data.get("confidence_score"),
            novelty_score=h_data.get("novelty_score"),
            testability_score=h_data.get("testability_score"),
            citations=h_data.get("citations", []),
            notes_for_human_review=h_data.get("notes_for_human_review"),
            status=HypothesisStatus.DRAFT,
        )
        db.add(hypothesis)
        created.append(hypothesis)

    db.commit()
    for h in created:
        db.refresh(h)

    return created


@router.get("", response_model=list[HypothesisResponse])
def list_hypotheses(
    project_id: UUID,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Hypothesis).filter(Hypothesis.project_id == project_id)

    if status_filter:
        query = query.filter(Hypothesis.status == status_filter)

    return query.order_by(Hypothesis.confidence_score.desc().nullslast()).all()


@router.get("/{hypothesis_id}", response_model=HypothesisResponse)
def get_hypothesis(hypothesis_id: UUID, db: Session = Depends(get_db)):
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hypothesis not found")
    return hypothesis


@router.patch("/{hypothesis_id}", response_model=HypothesisResponse)
def update_hypothesis(
    hypothesis_id: UUID,
    payload: HypothesisUpdate,
    db: Session = Depends(get_db),
):
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hypothesis not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(hypothesis, key, value)

    db.commit()
    db.refresh(hypothesis)
    return hypothesis


@router.delete("/{hypothesis_id}", status_code=204)
def delete_hypothesis(hypothesis_id: UUID, db: Session = Depends(get_db)):
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hypothesis not found")

    db.delete(hypothesis)
    db.commit()
