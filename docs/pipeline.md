# Pipeline

## End-to-end flow

### Step 1: Intake
- User specifies branch of science, research problem, desired outcome, and constraints
- User sets novelty vs. conservatism preference
- A `Project` record is created

### Step 2: Upload
- User uploads files (PDF, CSV, Excel, TXT, MD, images)
- Each file becomes a `Source` record with status `pending`
- Files are stored in `data/uploads/{project_id}/`

### Step 3: Ingestion
- On request, each source is parsed:
  - **PDF**: Text and tables extracted via `pdfplumber`
  - **CSV/Excel**: Parsed via `pandas`
  - **Text/Markdown**: Read directly
  - **Images**: Metadata extracted via `Pillow`
- Text is split into sentences; each sentence becomes a candidate claim
- Claims are classified (result, method, hypothesis, limitation, general)
- Variables and conditions are extracted using pattern matching
- Claims are stored in `extracted_claims` table linked to the source

### Step 4: Evidence retrieval
- User can browse all evidence, filter by type and confidence
- Evidence is ranked by a weighted score (relevance, confidence, recency)

### Step 5: Gap detection
- The system analyzes claims to find:
  - **Contradictions**: Claims about the same topic with opposite polarity
  - **Weak support**: Claims with low confidence scores
  - **Missing mechanisms**: Results without methodological explanation
  - **Insufficient evidence**: Fewer than 3 claims available

### Step 6: Hypothesis generation
- Each gap produces one or more candidate hypotheses
- Each hypothesis includes:
  - Research question addressing the gap
  - Testable hypothesis statement
  - Proposed mechanism (if applicable)
  - Supporting and conflicting evidence references
  - Proposed experiment and predicted outcome
  - Falsification criteria
  - Confidence, novelty, and testability scores
- If no gaps found, a fallback exploratory hypothesis is generated

### Step 7: Review
- User views hypotheses in ranked order
- User can inspect supporting and conflicting evidence
- User can edit any field of a hypothesis
- User can change status (draft, reviewed, accepted, rejected)

## Running the pipeline

```bash
# 1. Start the database
docker compose up -d db

# 2. Seed demo data
python -m scripts.seed_data

# 3. Start the API
uvicorn apps.api.src.main:app --reload

# 4. Start the UI
streamlit run apps/web/src/app.py
```
