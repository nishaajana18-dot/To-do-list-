import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from packages.core.src.config import settings
from packages.core.src.database import engine, Base
from apps.api.src.routes import projects, uploads, ingestion, retrieval, hypotheses

logging.basicConfig(level=getattr(logging, settings.log_level.upper()))

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created")
    yield


app = FastAPI(
    title="AI Research Assistant API",
    description="Helps researchers go from data to testable hypotheses",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(uploads.router, prefix="/api/uploads", tags=["uploads"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["ingestion"])
app.include_router(retrieval.router, prefix="/api/retrieval", tags=["retrieval"])
app.include_router(hypotheses.router, prefix="/api/hypotheses", tags=["hypotheses"])


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
