from pathlib import Path
from typing import Any

import pandas as pd


def parse_excel(file_path: str | Path) -> dict[str, Any]:
    path = Path(file_path)
    xls = pd.ExcelFile(path)

    text_parts = []
    all_tables = []

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(path, sheet_name=sheet_name)
        text_parts.append(f"Sheet: {sheet_name}\nColumns: {', '.join(df.columns)}\nRows: {len(df)}")
        all_tables.append({"sheet": sheet_name, "data": df.head(100).to_dict(orient="records")})

    return {
        "text": "\n\n".join(text_parts),
        "tables": all_tables,
        "figure_captions": [],
        "sheets": xls.sheet_names,
    }
