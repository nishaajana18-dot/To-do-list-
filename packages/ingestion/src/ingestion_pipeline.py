import json
import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from packages.core.src.schemas import SourceType, ExtractionStatus
from packages.ingestion.src.parsers import parse_file
from packages.ingestion.src.claim_extractor import extract_claims

logger = logging.getLogger(__name__)


class IngestionPipeline:
    def __init__(self, upload_dir: str):
        self.upload_dir = Path(upload_dir)

    def process_file(
        self,
        source_id: UUID,
        file_path: str,
        source_type: str,
    ) -> dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        parsed = parse_file(file_path, source_type)
        text = parsed.get("text", "")
        tables = parsed.get("tables", [])
        figure_captions = parsed.get("figure_captions", [])

        claims = extract_claims(
            text=text,
            source_id=str(source_id),
            page_number=None,
        )

        for claim in claims:
            claim["source_id"] = str(source_id)

        return {
            "extracted_text": text,
            "tables": tables if tables else None,
            "figure_captions": figure_captions if figure_captions else None,
            "claims": claims,
            "extraction_status": ExtractionStatus.COMPLETED.value,
        }
