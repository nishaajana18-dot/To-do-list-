from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from packages.core.src.models import ExtractedClaim, Source, Gap
from packages.core.src.schemas import HypothesisStatus

logger = logging.getLogger(__name__)


class HypothesisGenerator:
    def generate(
        self,
        db: Session,
        project_id: UUID,
        gaps: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        claims = (
            db.query(ExtractedClaim)
            .join(Source)
            .filter(Source.project_id == project_id)
            .all()
        )

        if not claims:
            return []

        hypotheses = []

        for gap in gaps:
            h = self._hypothesis_from_gap(gap, claims)
            if h:
                h["project_id"] = str(project_id)
                hypotheses.append(h)

        if not hypotheses:
            h = self._generate_default_hypothesis(claims)
            if h:
                h["project_id"] = str(project_id)
                hypotheses.append(h)

        return hypotheses

    def _hypothesis_from_gap(
        self,
        gap: dict[str, Any],
        claims: list,
    ) -> dict[str, Any] | None:
        gap_type = gap.get("gap_type", "")

        if gap_type == "contradiction":
            return self._build_contradiction_hypothesis(gap, claims)
        elif gap_type == "weak_support":
            return self._build_weak_support_hypothesis(gap, claims)
        elif gap_type == "missing_mechanism":
            return self._build_mechanism_hypothesis(gap, claims)
        elif gap_type == "insufficient_evidence":
            return None

        return None

    def _build_contradiction_hypothesis(
        self, gap: dict[str, Any], claims: list
    ) -> dict[str, Any]:
        evidence_ids = gap.get("evidence_ids", [])
        related = [c for c in claims if str(c.id) in evidence_ids]

        supporting = []
        conflicting = []
        for c in related:
            item = {
                "claim_id": str(c.id),
                "text": c.text[:300],
                "confidence": c.confidence,
            }
            if c.confidence >= 0.5:
                supporting.append(item)
            else:
                conflicting.append(item)

        return {
            "id": str(uuid4()),
            "title": "Resolving contradictory evidence",
            "research_question": "What experimental conditions resolve the contradictory findings?",
            "hypothesis": "The contradiction arises from unaccounted differences in experimental conditions.",
            "mechanism": "Systematic variation of key parameters may reconcile the discrepancy.",
            "supporting_evidence": supporting or [],
            "conflicting_evidence": conflicting or [],
            "assumptions": ["All relevant variables have been identified"],
            "proposed_experiment": "Design a controlled experiment that varies the conditions identified in the contradictory claims.",
            "predicted_outcome": "One set of conditions will reproduce each claimed result, revealing the hidden parameter.",
            "falsification_criteria": "If all conditions produce the same outcome, the contradiction is not resolvable by measured parameters.",
            "confidence_score": 0.4,
            "novelty_score": 0.6,
            "testability_score": 0.7,
            "citations": [],
            "notes_for_human_review": "Generated from detected contradictions. Review evidence to verify.",
            "status": HypothesisStatus.DRAFT.value,
        }

    def _build_weak_support_hypothesis(
        self, gap: dict[str, Any], claims: list
    ) -> dict[str, Any]:
        evidence_ids = gap.get("evidence_ids", [])
        related = [c for c in claims if str(c.id) in evidence_ids]

        return {
            "id": str(uuid4()),
            "title": "Strengthening weakly supported claims",
            "research_question": "Can the weakly supported finding be replicated with improved methodology?",
            "hypothesis": "The low-confidence result is a true effect obscured by measurement noise or small sample size.",
            "mechanism": "Increased statistical power and improved measurement precision will confirm the effect.",
            "supporting_evidence": [{"claim_id": str(c.id), "text": c.text[:300]} for c in related[:3]],
            "conflicting_evidence": [],
            "assumptions": ["The original observation was not an artifact", "Improved methods will reduce noise"],
            "proposed_experiment": "Replicate the experiment with larger sample size, blinded measurement, and pre-registered analysis.",
            "predicted_outcome": "The effect will be replicated with higher confidence and narrower confidence intervals.",
            "falsification_criteria": "If the effect disappears with increased power, the original claim was likely a false positive.",
            "confidence_score": 0.3,
            "novelty_score": 0.4,
            "testability_score": 0.8,
            "citations": [],
            "notes_for_human_review": "Based on low-confidence claims. Replication is needed.",
            "status": HypothesisStatus.DRAFT.value,
        }

    def _build_mechanism_hypothesis(
        self, gap: dict[str, Any], claims: list
    ) -> dict[str, Any]:
        evidence_ids = gap.get("evidence_ids", [])
        related = [c for c in claims if str(c.id) in evidence_ids]

        return {
            "id": str(uuid4()),
            "title": "Proposed mechanism for observed results",
            "research_question": "What mechanism explains the observed results?",
            "hypothesis": "The reported results are mediated by an unmeasured intermediate variable.",
            "mechanism": "A causal pathway involving the observed variables and an unmeasured mediator.",
            "supporting_evidence": [{"claim_id": str(c.id), "text": c.text[:300]} for c in related[:3]],
            "conflicting_evidence": [],
            "assumptions": ["Observed results are valid", "A causal relationship exists"],
            "proposed_experiment": "Measure the proposed mediator while replicating the original experiment.",
            "predicted_outcome": "The mediator will show significant changes correlated with the outcome.",
            "falsification_criteria": "If the mediator does not change or does not correlate with outcome, the proposed mechanism is wrong.",
            "confidence_score": 0.35,
            "novelty_score": 0.5,
            "testability_score": 0.65,
            "citations": [],
            "notes_for_human_review": "Mechanism gap detected. Review to refine the proposed pathway.",
            "status": HypothesisStatus.DRAFT.value,
        }

    def _generate_default_hypothesis(self, claims: list) -> dict[str, Any]:
        top_claims = sorted(claims, key=lambda c: c.confidence or 0, reverse=True)[:3]
        return {
            "id": str(uuid4()),
            "title": "Exploratory hypothesis from available evidence",
            "research_question": "What pattern emerges from the available evidence?",
            "hypothesis": "The available evidence suggests an underexplored relationship worth investigating.",
            "mechanism": None,
            "supporting_evidence": [{"claim_id": str(c.id), "text": c.text[:300]} for c in top_claims],
            "conflicting_evidence": [],
            "assumptions": ["Available evidence is representative", "No major conflicting evidence was missed"],
            "proposed_experiment": "Design a study to test the relationship suggested by the highest-confidence claims.",
            "predicted_outcome": "A statistically significant relationship will be found.",
            "falsification_criteria": "If the predicted relationship does not reach significance, the hypothesis is not supported.",
            "confidence_score": 0.25,
            "novelty_score": 0.3,
            "testability_score": 0.6,
            "citations": [],
            "notes_for_human_review": "Default hypothesis generated from available evidence. More data may improve quality.",
            "status": HypothesisStatus.DRAFT.value,
        }
