import logging
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None

    def _load_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer

                self._model = SentenceTransformer(self.model_name)
                logger.info("Loaded embedding model: %s", self.model_name)
            except ImportError:
                logger.warning("sentence-transformers not installed; using fallback embeddings")
                self._model = None

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        self._load_model()

        if self._model is not None:
            embeddings = self._model.encode(texts, show_progress_bar=False)
            return [emb.tolist() for emb in embeddings]

        return [self._fallback_embed(t) for t in texts]

    def embed_text(self, text: str) -> list[float]:
        return self.embed([text])[0]

    def _fallback_embed(self, text: str) -> list[float]:
        rng = np.random.RandomState(hash(text) % (2**31))
        return rng.randn(384).tolist()
