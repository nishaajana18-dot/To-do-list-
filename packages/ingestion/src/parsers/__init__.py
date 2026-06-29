from pathlib import Path
from typing import Any

from packages.ingestion.src.parsers.pdf_parser import parse_pdf
from packages.ingestion.src.parsers.csv_parser import parse_csv
from packages.ingestion.src.parsers.text_parser import parse_text
from packages.ingestion.src.parsers.image_parser import parse_image
from packages.ingestion.src.parsers.excel_parser import parse_excel


def parse_file(file_path: str | Path, source_type: str) -> dict[str, Any]:
    parsers = {
        "pdf": parse_pdf,
        "csv": parse_csv,
        "excel": parse_excel,
        "text": parse_text,
        "image": parse_image,
        "simulation": parse_text,
    }
    parser = parsers.get(source_type, parse_text)
    return parser(file_path)
