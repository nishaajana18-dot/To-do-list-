from pathlib import Path

import pytest

from packages.ingestion.src.parsers import parse_file
from packages.ingestion.src.claim_extractor import extract_claims


class TestParsers:
    def test_parse_text_file(self, temp_text_file: Path):
        result = parse_file(temp_text_file, "text")
        assert "Temperature" in result["text"]
        assert "tables" in result
        assert "figure_captions" in result

    def test_parse_csv_file(self, temp_csv_file: Path):
        result = parse_file(temp_csv_file, "csv")
        assert "temperature" in result["text"].lower()
        assert len(result["tables"]) > 0
        assert "columns" in result

    def test_parse_unknown_type_uses_text(self, temp_text_file: Path):
        result = parse_file(temp_text_file, "unknown")
        assert "Temperature" in result["text"]

    def test_parse_nonexistent_file(self):
        with pytest.raises(FileNotFoundError):
            parse_file("/nonexistent/file.pdf", "pdf")


class TestClaimExtractor:
    def test_extract_from_text(self, sample_pdf_text: str):
        claims = extract_claims(sample_pdf_text, "source-123")
        assert len(claims) > 0
        for claim in claims:
            assert "text" in claim
            assert "claim_type" in claim
            assert "confidence" in claim
            assert "source_id" not in claim

    def test_extract_from_empty_text(self):
        claims = extract_claims("", "source-123")
        assert claims == []

    def test_extract_from_short_text(self):
        claims = extract_claims("Hello world.", "source-123")
        assert claims == []

    def test_claim_type_classification(self):
        result_text = "We found that temperature significantly increased activity (p<0.05)."
        claims = extract_claims(result_text, "source-1")
        assert any(c["claim_type"] == "result" for c in claims)

    def test_variable_extraction(self):
        text = "Temperature and pressure were measured during the experiment."
        claims = extract_claims(text, "source-1")
        vars_found = set()
        for c in claims:
            vars_found.update(c["variables"])
        assert "temperature" in vars_found
