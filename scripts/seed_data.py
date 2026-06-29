"""Seed the database with demo data for testing and evaluation."""

import logging
import tempfile
from pathlib import Path

from packages.core.src.config import settings
from packages.core.src.database import SessionLocal, engine, Base
from packages.core.src.models import Project, Source, ExtractedClaim
from packages.core.src.schemas import SourceType, ExtractionStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


SAMPLE_PAPER_TEXT = """
Title: Effects of temperature on Drosophila melanogaster locomotor activity

Abstract: Temperature is a critical environmental factor affecting insect behavior.
We investigated the effects of temperature on locomotor activity in Drosophila melanogaster.
Flies were exposed to temperatures of 18°C, 25°C, and 32°C for 72 hours.
We found that locomotor activity increased significantly at 32°C compared to 25°C.
At 18°C, activity was significantly reduced. These results suggest that temperature
is a key modulator of insect locomotor behavior. Our findings have implications for
understanding climate change impacts on insect populations.

Methods: Drosophila melanogaster (Oregon-R strain) were reared at 25°C on standard
cornmeal medium. Adult males aged 3-5 days were used. Locomotor activity was measured
using the Drosophila Activity Monitoring (DAM) system. Flies were individually loaded
into glass tubes and activity counts were recorded every minute for 72 hours.

Results: At 25°C, mean activity was 45.2 counts/hour (SD=12.3). At 32°C, mean activity
increased to 78.9 counts/hour (SD=15.7). At 18°C, mean activity decreased to 22.1
counts/hour (SD=8.9). The differences between all temperature conditions were
statistically significant (p<0.001, one-way ANOVA).

Discussion: The observed temperature-dependent changes in activity suggest that
Drosophila locomotor behavior is highly sensitive to environmental temperature.
This may have ecological implications for foraging and mating success under
changing climate conditions. A limitation of this study is that we only examined
short-term exposure; long-term acclimation effects remain unknown.
"""


SAMPLE_CSV_DATA = """temperature,activity_mean,activity_sd,n
18,22.1,8.9,30
25,45.2,12.3,30
32,78.9,15.7,30
"""


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing = db.query(Project).first()
        if existing:
            logger.info("Database already has data, skipping seed.")
            return

        project = Project(
            title="Temperature effects on Drosophila behavior",
            description="Investigating how temperature affects locomotor activity in fruit flies",
            branch_of_science="Biology",
            research_problem="How does environmental temperature affect insect locomotor behavior?",
            desired_outcome="Identify temperature-activity relationship and underlying mechanisms",
            experimental_constraints="Limited to Drosophila model, short-term exposures only",
            novelty_preference=0.4,
        )
        db.add(project)
        db.flush()

        source = Source(
            project_id=project.id,
            source_type=SourceType.TEXT,
            source_name="temperature_drosophila_sample.txt",
            extraction_status=ExtractionStatus.COMPLETED,
            extracted_text=SAMPLE_PAPER_TEXT,
            confidence=0.8,
        )
        db.add(source)
        db.flush()

        claims_data = [
            {"text": "Locomotor activity increased significantly at 32°C compared to 25°C in Drosophila melanogaster", "claim_type": "result", "confidence": 0.85, "variables": ["temperature", "activity"], "conditions": ["32°C", "72 hours"]},
            {"text": "At 18°C, locomotor activity was significantly reduced compared to 25°C", "claim_type": "result", "confidence": 0.85, "variables": ["temperature", "activity"], "conditions": ["18°C", "72 hours"]},
            {"text": "Temperature is a key modulator of insect locomotor behavior", "claim_type": "hypothesis", "confidence": 0.7, "variables": ["temperature"], "conditions": []},
            {"text": "Flies were exposed to temperatures of 18°C, 25°C, and 32°C for 72 hours", "claim_type": "method", "confidence": 0.9, "variables": ["temperature"], "conditions": ["18°C", "25°C", "32°C", "72 hours"]},
            {"text": "Locomotor activity was measured using the Drosophila Activity Monitoring (DAM) system", "claim_type": "method", "confidence": 0.9, "variables": ["activity"], "conditions": []},
            {"text": "A limitation is that we only examined short-term exposure; long-term acclimation effects remain unknown", "claim_type": "limitation", "confidence": 0.8, "variables": ["temperature"], "conditions": []},
        ]

        for cd in claims_data:
            claim = ExtractedClaim(
                source_id=source.id,
                text=cd["text"],
                claim_type=cd["claim_type"],
                confidence=cd["confidence"],
                variables=cd.get("variables", []),
                conditions=cd.get("conditions", []),
                methods=[],
                results=None,
                limitations=[],
                provenance={"seed": True},
            )
            db.add(claim)

        db.commit()
        logger.info("Seed data inserted successfully!")
        logger.info(f"Project ID: {project.id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
