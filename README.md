# AI Research Assistant

From data to testable hypotheses.

## Quick Start

```bash
# Prerequisites: Python 3.11+, Docker, Docker Compose

# 1. Start the database
docker compose up -d db

# 2. Install dependencies
pip install -e ".[dev,ml]"

# 3. Seed demo data
python -m scripts.seed_data

# 4. Start the API (separate terminal)
uvicorn apps.api.src.main:app --reload

# 5. Start the UI (separate terminal)
streamlit run apps/web/src/app.py
```

Open http://localhost:8501

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy, PostgreSQL + pgvector
- **Frontend**: Streamlit
- **Ingestion**: pdfplumber, pandas, Pillow
- **Retrieval**: sentence-transformers (optional), scikit-learn
- **Infrastructure**: Docker Compose

## Project Structure

```
apps/
  api/          FastAPI backend
  web/          Streamlit UI
packages/
  core/         Shared schemas, models, database config
  ingestion/    File parsers and claim extraction
  retrieval/    Embeddings, search, and ranking
  hypothesis/   Gap detection and hypothesis generation
scripts/        Setup, seed data, evaluation
docs/           Architecture and pipeline documentation
data/           Uploads and embeddings storage
tests/          Test suite
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects | Create a project |
| GET | /api/projects | List projects |
| PATCH | /api/projects/{id} | Update project |
| POST | /api/uploads | Upload a file |
| GET | /api/uploads | List sources for a project |
| POST | /api/ingestion/{source_id} | Ingest a source |
| POST | /api/ingestion/project/{id} | Ingest all project sources |
| POST | /api/hypotheses/generate/{id} | Generate hypotheses |
| GET | /api/hypotheses | List hypotheses |
| PATCH | /api/hypotheses/{id} | Update/edit a hypothesis |

## Testing

```bash
pytest
```

## Design Principles

- **Evidence-first**: Never return a hypothesis without supporting evidence
- **Provenance**: Every claim and hypothesis links back to its source
- **Modularity**: Each package can be improved independently
- **Idempotent ingestion**: Re-running ingestion replaces claims safely
- **Conservative confidence**: Low-evidence hypotheses are flagged, not inflated
