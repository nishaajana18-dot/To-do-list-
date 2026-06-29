from pathlib import Path
from typing import Any


def parse_image(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    from PIL import Image

    img = Image.open(str(path))
    return {
        "text": f"Image file: {path.name}",
        "tables": [],
        "figure_captions": [path.stem],
        "metadata": {
            "format": img.format,
            "size": img.size,
            "mode": img.mode,
        },
    }
