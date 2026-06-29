from pathlib import Path
from typing import Any

import pandas as pd


def parse_csv(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    df = pd.read_csv(path)

    return {
        "text": f"CSV file: {path.name}\nColumns: {', '.join(df.columns)}\nRows: {len(df)}",
        "tables": [df.head(100).to_dict(orient="records")],
        "figure_captions": [],
        "columns": list(df.columns),
        "row_count": len(df),
        "summary": df.describe(include="all").to_dict() if len(df) > 0 else {},
    }
