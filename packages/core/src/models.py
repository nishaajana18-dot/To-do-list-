import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from packages.core.src.database import Base
from packages.core.src.schemas import SourceType, ExtractionStatus, HypothesisStatus


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    branch_of_science = Column(String(200), nullable=True)
    research_problem = Column(Text, nullable=True)
    desired_outcome = Column(Text, nullable=True)
    experimental_constraints = Column(Text, nullable=True)
    novelty_preference = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    sources = relationship("Source", back_populates="project", cascade="all, delete-orphan")
    hypotheses = relationship("Hypothesis", back_populates="project", cascade="all, delete-orphan")
    gaps = relationship("Gap", back_populates="project", cascade="all, delete-orphan")


class Source(Base):
    __tablename__ = "sources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_type = Column(SAEnum(SourceType), nullable=False)
    source_name = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=True)
    extraction_status = Column(SAEnum(ExtractionStatus), default=ExtractionStatus.PENDING, nullable=False)
    upload_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    extracted_text = Column(Text, nullable=True)
    tables = Column(JSON, nullable=True)
    figure_captions = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    citations = Column(JSON, nullable=True)

    project = relationship("Project", back_populates="sources")
    claims = relationship("ExtractedClaim", back_populates="source", cascade="all, delete-orphan")


class ExtractedClaim(Base):
    __tablename__ = "extracted_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(UUID(as_uuid=True), ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    claim_type = Column(String(100), default="general", nullable=False)
    confidence = Column(Float, default=0.5, nullable=False)
    variables = Column(JSON, default=list, nullable=True)
    conditions = Column(JSON, default=list, nullable=True)
    methods = Column(JSON, default=list, nullable=True)
    results = Column(Text, nullable=True)
    limitations = Column(JSON, default=list, nullable=True)
    provenance = Column(JSON, default=dict, nullable=True)
    page_number = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    source = relationship("Source", back_populates="claims")


class Gap(Base):
    __tablename__ = "gaps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    gap_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    evidence_ids = Column(JSON, default=list, nullable=True)
    severity = Column(Float, default=0.5, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="gaps")


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    research_question = Column(Text, nullable=False)
    hypothesis = Column(Text, nullable=False)
    mechanism = Column(Text, nullable=True)
    supporting_evidence = Column(JSON, default=list, nullable=True)
    conflicting_evidence = Column(JSON, default=list, nullable=True)
    assumptions = Column(JSON, default=list, nullable=True)
    proposed_experiment = Column(Text, nullable=True)
    predicted_outcome = Column(Text, nullable=True)
    falsification_criteria = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    novelty_score = Column(Float, nullable=True)
    testability_score = Column(Float, nullable=True)
    citations = Column(JSON, default=list, nullable=True)
    notes_for_human_review = Column(Text, nullable=True)
    status = Column(SAEnum(HypothesisStatus), default=HypothesisStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    project = relationship("Project", back_populates="hypotheses")
