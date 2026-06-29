from packages.retrieval.src.ranking import rank_evidence


class TestRanking:
    def test_rank_evidence_orders_by_score(self):
        evidence = [
            {"relevance_score": 0.9, "confidence": 0.8},
            {"relevance_score": 0.5, "confidence": 0.5},
            {"relevance_score": 0.1, "confidence": 0.1},
        ]
        ranked = rank_evidence(evidence)
        assert ranked[0]["rank_score"] >= ranked[1]["rank_score"] >= ranked[2]["rank_score"]

    def test_rank_evidence_empty(self):
        ranked = rank_evidence([])
        assert ranked == []

    def test_rank_score_keys_present(self):
        evidence = [{"relevance_score": 0.7, "confidence": 0.6}]
        ranked = rank_evidence(evidence)
        assert "rank_score" in ranked[0]
        assert isinstance(ranked[0]["rank_score"], float)
