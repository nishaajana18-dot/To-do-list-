import re
from typing import Any

from packages.core.src.schemas import ExtractedClaim


def extract_claims(text: str, source_id: str, page_number: int | None = None) -> list[dict[str, Any]]:
    if not text:
        return []

    claims = []
    sentences = re.split(r"(?<=\.)\s+", text.strip())

    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 40:
            continue

        claim_type = _classify_claim(sentence)
        variables = _extract_variables(sentence)
        conditions = _extract_conditions(sentence)

        claims.append(
            {
                "text": sentence,
                "claim_type": claim_type,
                "confidence": 0.5,
                "variables": variables,
                "conditions": conditions,
                "methods": [],
                "results": None,
                "limitations": [],
                "provenance": {"extraction_method": "regex", "position": text.find(sentence)},
                "page_number": page_number,
            }
        )

    return claims


def _classify_claim(text: str) -> str:
    text_lower = text.lower()

    if re.search(r"\b(we found|our results|the data show|significant|p\s*[<>=])", text_lower):
        return "result"
    if re.search(r"\b(we hypothesize|we propose|suggest that|may be due to)", text_lower):
        return "hypothesis"
    if re.search(r"\b(we used|we employed|method|approach|protocol)", text_lower):
        return "method"
    if re.search(r"\b(limitation|caveat|weakness|further research|unclear)", text_lower):
        return "limitation"
    return "general"


def _extract_variables(text: str) -> list[str]:
    common_vars = [
        "temperature", "pressure", "concentration", "volume", "mass",
        "velocity", "time", "frequency", "amplitude", "wavelength",
        "dose", "exposure", "expression", "activity", "rate",
    ]
    found = []
    text_lower = text.lower()
    for var in common_vars:
        if var in text_lower:
            found.append(var)
    return found


def _extract_conditions(text: str) -> list[str]:
    conditions = []
    pattern = r"(?:under|at|with|during)\s+([A-Za-z0-9\s]+?)(?:[,;.]|and|while|where)"
    for match in re.finditer(pattern, text):
        conditions.append(match.group(1).strip())
    return conditions
