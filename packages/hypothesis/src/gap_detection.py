from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from packages.core.src.models import ExtractedClaim, Source

logger = logging.getLogger(__name__)


class GapDetector:
    def detect(self, db: Session, project_id: UUID) -> list[dict[str, Any]]:
        claims = (
            db.query(ExtractedClaim)
            .join(Source)
            .filter(Source.project_id == project_id)
            .all()
        )

        gaps = []
        gaps.extend(self._find_contradictions(claims))
        gaps.extend(self._find_weakly_supported(claims))
        gaps.extend(self._find_missing_mechanisms(claims))

        return gaps

    def _find_contradictions(self, claims: list) -> list[dict[str, Any]]:
        contradictions = []
        seen = {}

        for claim in claims:
            for other_id, other_claim in seen.items():
                if self._are_contradictory(claim.text, other_claim.text):
                    contradictions.append(
                        {
                            "gap_type": "contradiction",
                            "description": f"Contradictory claims between source '{claim.source_id}' and '{other_id}'",
                            "evidence_ids": [str(claim.id), str(other_claim.id)],
                            "severity": 0.8,
                        }
                    )
            seen[str(claim.id)] = claim

        return contradictions

    def _find_weakly_supported(self, claims: list) -> list[dict[str, Any]]:
        weak = []
        for claim in claims:
            if claim.confidence is not None and claim.confidence < 0.3:
                weak.append(
                    {
                        "gap_type": "weak_support",
                        "description": f"Claim has low confidence ({claim.confidence}): {claim.text[:200]}",
                        "evidence_ids": [str(claim.id)],
                        "severity": 0.5,
                    }
                )

        if len(claims) < 3:
            weak.append(
                {
                    "gap_type": "insufficient_evidence",
                    "description": "Very few claims extracted; more sources needed",
                    "evidence_ids": [],
                    "severity": 0.7,
                }
            )

        return weak

    def _find_missing_mechanisms(self, claims: list) -> list[dict[str, Any]]:
        result_claims = [c for c in claims if c.claim_type == "result"]
        method_claims = [c for c in claims if c.claim_type == "method"]

        gaps = []
        if result_claims and not method_claims:
            gaps.append(
                {
                    "gap_type": "missing_mechanism",
                    "description": "Results reported without methodological explanation",
                    "evidence_ids": [str(c.id) for c in result_claims[:3]],
                    "severity": 0.6,
                }
            )

        return gaps

    @staticmethod
    def _are_contradictory(text_a: str, text_b: str) -> bool:
        import re

        negation_words = ["not", "no", "never", "without", "lack", "absence", "decrease", "increase"]
        a_words = text_a.lower().split()
        b_words = text_b.lower().split()

        a_neg = any(bool(re.search(rf"\b{re.escape(w)}\b", text_a.lower())) for w in negation_words)
        b_neg = any(bool(re.search(rf"\b{re.escape(w)}\b", text_b.lower())) for w in negation_words)

        common_terms = set(a_words) & set(b_words)
        if len(common_terms) < 5:
            return False

        return a_neg != b_neg
