# Architecture

## Overview

The AI Research Assistant is a modular system that guides users from data to testable hypotheses. It follows a package-based architecture with clear separation of concerns.

```
┌─────────────────────────────────────────────────────┐
│                    Streamlit UI                      │
│  (apps/web)  Intake | Uploads | Evidence | Review    │
└────────────────────────┬────────────────────────────┘
                         │ HTTP (httpx)
┌────────────────────────▼────────────────────────────┐
│                   FastAPI API                        │
│  (apps/api)  Projects | Uploads | Ingestion | Hyp.  │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  Packages Layer                      │
│                                                      │
│  packages/core     - Schemas, Models, DB config     │
│  packages/ingestion - Parsers, Claim extraction      │
│  packages/retrieval  - Embeddings, Search, Ranking   │
│  packages/hypothesis - Gap detection, Hypothesis gen │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                   PostgreSQL + pgvector              │
│                   File Store (uploads)               │
└─────────────────────────────────────────────────────┘
```

## Design Decisions

### Package-based monorepo
Each package has a single responsibility and can be developed, tested, and improved independently. The `core` package holds shared schemas and models to avoid circular imports.

### Background ingestion
File parsing and claim extraction run as background tasks so the API remains responsive. The ingestion pipeline is idempotent – re-running will replace claims.

### Claims as atomic evidence units
Rather than storing full documents as evidence, we extract atomic claims. Each claim has a type, confidence, variables, conditions, and provenance pointers. This makes it straightforward to compare, rank, and cite.

### Gap-driven hypothesis generation
Rather than generating hypotheses from nothing, the system first identifies gaps (contradictions, weak support, missing mechanisms) and generates hypotheses that address those gaps. If no gaps are found, a default exploratory hypothesis is created.

### Provenance tracking
Every extracted claim retains a pointer to its source document, page number, and extraction method. Every hypothesis links back to the claims it is based on. This makes the system auditable.

## Data Flow

1. User creates a project and fills out the intake form
2. User uploads files (PDF, CSV, Excel, text, images)
3. Files are parsed; text, tables, and figure captions are extracted
4. Claims are extracted from the text using heuristics
5. The system searches for gaps and contradictions across claims
6. Hypotheses are generated from detected gaps
7. User reviews, edits, and accepts/rejects hypotheses
