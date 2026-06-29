from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Generator, Any

import pytest


@pytest.fixture
def sample_pdf_text() -> str:
    return """Title: Temperature effects on enzyme kinetics

Abstract: We studied the effect of temperature on the reaction rate of alkaline phosphatase.
The enzyme showed maximum activity at 37°C. At 50°C, activity decreased by 60%.
These results demonstrate that alkaline phosphatase is mesophilic.

Methods: Alkaline phosphatase from bovine intestinal mucosa was used. Activity was measured
using p-nitrophenyl phosphate as substrate at pH 9.8. Temperature was varied from 20°C to 60°C.

Results: Maximum velocity was observed at 37°C with a Km of 0.5 mM.
The activation energy was calculated as 45 kJ/mol using the Arrhenius equation.
"""


@pytest.fixture
def sample_csv_content() -> str:
    return "temperature,activity,se\n20,15.2,2.1\n25,28.7,3.2\n30,45.1,4.1\n37,62.3,5.2\n45,48.9,4.8\n50,24.5,3.5\n"


@pytest.fixture
def temp_csv_file(sample_csv_content: str) -> Generator[Path, None, None]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as f:
        f.write(sample_csv_content)
        tmp_path = Path(f.name)
    yield tmp_path
    tmp_path.unlink(missing_ok=True)


@pytest.fixture
def temp_text_file(sample_pdf_text: str) -> Generator[Path, None, None]:
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
        f.write(sample_pdf_text)
        tmp_path = Path(f.name)
    yield tmp_path
    tmp_path.unlink(missing_ok=True)
