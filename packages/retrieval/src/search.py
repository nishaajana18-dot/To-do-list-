from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

import numpy as np
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class SemanticSearch:
    def __init__(self, embedding_dim: int = 384):
        self.embedding_dim = embedding_dim

    def search(
        self,
        db: Session,
        query_embedding: list[float],
        project_id: UUID | None = None,
        top_k: int = 10,
    ) -> list[dict[str, Any]]:
        if not query_embedding:
            return []

        embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        if project_id:
            sql = text(
                """
                SELECT
                    ec.id,
                    ec.text,
                    ec.confidence,
                    ec.claim_type,
                    ec.variables,
                    ec.conditions,
                    s.source_name,
                    s.source_type,
                    s.id as source_id,
                    ec.created_at
                FROM extracted_claims ec
                JOIN sources s ON ec.source_id = s.id
                WHERE s.project_id = :project_id
                ORDER BY ec.created_at DESC
                LIMIT :top_k
            """
            )
            rows = db.execute(sql, {"project_id": project_id, "top_k": top_k}).fetchall()
        else:
            sql = text(
                """
                SELECT
                    ec.id,
                    ec.text,
                    ec.confidence,
                    ec.claim_type,
                    ec.variables,
                    ec.conditions,
                    s.source_name,
                    s.source_type,
                    s.id as source_id,
                    ec.created_at
                FROM extracted_claims ec
                JOIN sources s ON ec.source_id = s.id
                ORDER BY ec.created_at DESC
                LIMIT :top_k
            """
            )
            rows = db.execute(sql, {"top_k": top_k}).fetchall()

        results = []
        for row in rows:
            results.append(
                {
                    "claim_id": str(row.id),
                    "text": row.text,
                    "source_name": row.source_name,
                    "source_type": row.source_type,
                    "confidence": row.confidence,
                    "claim_type": row.claim_type,
                    "variables": row.variables or [],
                    "conditions": row.conditions or [],
                    "relevance_score": 1.0,
                }
            )

        return results
