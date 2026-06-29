from pathlib import Path
from typing import Any

import pdfplumber


def parse_pdf(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    result = {
        "text": "",
        "tables": [],
        "figure_captions": [],
        "pages": [],
        "metadata": {},
    }

    with pdfplumber.open(str(path)) as pdf:
        result["metadata"] = {
            "pages": len(pdf.pages),
            "title": path.stem,
        }

        for page in pdf.pages:
            page_text = page.extract_text() or ""
            page_tables = []
            for table in page.extract_tables() or []:
                if table:
                    page_tables.append([row for row in table if any(cell for cell in row)])

            result["text"] += f"\n--- Page {page.page_number} ---\n{page_text}"
            result["tables"].extend(page_tables)
            result["pages"].append(
                {
                    "number": page.page_number,
                    "text": page_text,
                    "tables": page_tables,
                }
            )

    return result
