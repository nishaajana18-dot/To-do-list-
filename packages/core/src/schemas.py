from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class SourceType(str, Enum):
    PDF = "pdf"
    CSV = "csv"
    EXCEL = "excel"
    TEXT = "text"
    IMAGE = "image"
    SIMULATION = "simulation"
    MANUAL = "manual"


class ExtractionStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class HypothesisStatus(str, Enum):
    DRAFT = "draft"
    REVIEWED = "reviewed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    branch_of_science: Optional[str] = None
    research_problem: Optional[str] = None
    desired_outcome: Optional[str] = None
    experimental_constraints: Optional[str] = None
    novelty_preference: Optional[float] = Field(None, ge=0.0, le=1.0)


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    branch_of_science: Optional[str] = None
    research_problem: Optional[str] = None
    desired_outcome: Optional[str] = None
    experimental_constraints: Optional[str] = None
    novelty_preference: Optional[float] = Field(None, ge=0.0, le=1.0)


class ProjectResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    branch_of_science: Optional[str] = None
    research_problem: Optional[str] = None
    desired_outcome: Optional[str] = None
    experimental_constraints: Optional[str] = None
    novelty_preference: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SourceCreate(BaseModel):
    project_id: UUID
    source_type: SourceType
    source_name: str
    file_path: Optional[str] = None


class SourceResponse(BaseModel):
    id: UUID
    project_id: UUID
    source_type: SourceType
    source_name: str
    file_path: Optional[str] = None
    extraction_status: ExtractionStatus
    upload_timestamp: datetime
    extracted_text: Optional[str] = None
    tables: Optional[list[dict[str, Any]]] = None
    figure_captions: Optional[list[str]] = None
    confidence: Optional[float] = None
    citations: Optional[list[str]] = None

    model_config = {"from_attributes": True}


class ExtractedClaim(BaseModel):
    id: Optional[UUID] = None
    source_id: UUID
    text: str
    claim_type: str = "general"
    confidence: float = 0.5
    variables: list[str] = []
    conditions: list[str] = []
    methods: list[str] = []
    results: Optional[str] = None
    limitations: list[str] = []
    provenance: dict[str, Any] = {}
    page_number: Optional[int] = None


class ExtractedClaimResponse(BaseModel):
    id: UUID
    source_id: UUID
    text: str
    claim_type: str
    confidence: float
    variables: list[str]
    conditions: list[str]
    methods: list[str]
    results: Optional[str] = None
    limitations: list[str]
    provenance: dict[str, Any]
    page_number: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EvidenceItem(BaseModel):
    claim_id: UUID
    text: str
    source_name: str
    source_type: SourceType
    confidence: float
    citation: Optional[str] = None
    relevance_score: Optional[float] = None


class Gap(BaseModel):
    id: Optional[UUID] = None
    project_id: UUID
    gap_type: str
    description: str
    evidence_ids: list[UUID] = []
    severity: float = 0.5


class HypothesisCreate(BaseModel):
    project_id: UUID
    title: str
    research_question: str
    hypothesis: str
    mechanism: Optional[str] = None
    supporting_evidence: list[dict[str, Any]] = []
    conflicting_evidence: list[dict[str, Any]] = []
    assumptions: list[str] = []
    proposed_experiment: Optional[str] = None
    predicted_outcome: Optional[str] = None
    falsification_criteria: Optional[str] = None
    citations: list[str] = []


class HypothesisUpdate(BaseModel):
    title: Optional[str] = None
    research_question: Optional[str] = None
    hypothesis: Optional[str] = None
    mechanism: Optional[str] = None
    supporting_evidence: Optional[list[dict[str, Any]]] = None
    conflicting_evidence: Optional[list[dict[str, Any]]] = None
    assumptions: Optional[list[str]] = None
    proposed_experiment: Optional[str] = None
    predicted_outcome: Optional[str] = None
    falsification_criteria: Optional[str] = None
    notes_for_human_review: Optional[str] = None
    status: Optional[HypothesisStatus] = None


class HypothesisResponse(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    research_question: str
    hypothesis: str
    mechanism: Optional[str] = None
    supporting_evidence: list[dict[str, Any]]
    conflicting_evidence: list[dict[str, Any]]
    assumptions: list[str]
    proposed_experiment: Optional[str] = None
    predicted_outcome: Optional[str] = None
    falsification_criteria: Optional[str] = None
    confidence_score: Optional[float] = None
    novelty_score: Optional[float] = None
    testability_score: Optional[float] = None
    citations: list[str]
    notes_for_human_review: Optional[str] = None
    status: HypothesisStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
