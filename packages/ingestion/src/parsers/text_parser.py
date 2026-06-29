from pathlib import Path
from typing import Any


def parse_text(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    text = path.read_text(encoding="utf-8")

    lines = text.splitlines()
    title = lines[0] if lines else path.stem

    return {
        "text": text,
        "tables": [],
        "figure_captions": [],
        "title": title,
        "line_count": len(lines),
    }
