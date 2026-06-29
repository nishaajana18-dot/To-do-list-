from typing import Any


def rank_evidence(
    evidence_list: list[dict[str, Any]],
    relevance_weight: float = 0.4,
    confidence_weight: float = 0.3,
    recency_weight: float = 0.3,
) -> list[dict[str, Any]]:
    scored = []
    for item in evidence_list:
        relevance = item.get("relevance_score", 0.5)
        confidence = item.get("confidence", 0.5)
        score = (
            relevance * relevance_weight
            + confidence * confidence_weight
            + 0.5 * recency_weight
        )
        scored.append({**item, "rank_score": round(score, 4)})

    scored.sort(key=lambda x: x["rank_score"], reverse=True)
    return scored
