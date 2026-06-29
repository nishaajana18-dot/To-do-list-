from packages.hypothesis.src.gap_detection import GapDetector
from packages.hypothesis.src.hypothesis_generator import HypothesisGenerator


class TestGapDetection:
    def test_are_contradictory_with_negation(self):
        assert GapDetector._are_contradictory(
            "Temperature increases reaction rate",
            "Temperature does not increase reaction rate",
        )

    def test_are_not_contradictory(self):
        assert not GapDetector._are_contradictory(
            "Temperature increases reaction rate",
            "pH affects enzyme activity",
        )

    def test_contradiction_needs_common_terms(self):
        assert not GapDetector._are_contradictory(
            "A increases B",
            "A does not increase B",
        )

    def test_find_weakly_supported_no_claims(self):
        detector = GapDetector()
        result = detector._find_weakly_supported([])
        assert len(result) > 0
        assert result[0]["gap_type"] == "insufficient_evidence"

    def test_find_missing_mechanism(self):
        class MockClaim:
            def __init__(self, claim_type, confidence, text="", id="mock-id"):
                self.claim_type = claim_type
                self.confidence = confidence
                self.text = text
                self.id = id

        result_claims = [MockClaim("result", 0.8, "Result text", "r1")]
        detector = GapDetector()
        gaps = detector._find_missing_mechanisms(result_claims)
        assert len(gaps) > 0
        assert gaps[0]["gap_type"] == "missing_mechanism"


class TestHypothesisGenerator:
    def test_generate_default_when_no_gaps(self):
        class MockClaim:
            def __init__(self, claim_id, confidence, text="", source_id="src-1"):
                self.id = claim_id
                self.confidence = confidence
                self.text = text
                self.claim_type = "result"
                self.source_id = source_id

        claims = [MockClaim("c1", 0.8, "Enzyme activity increases with temperature")]
        generator = HypothesisGenerator()
        h = generator._generate_default_hypothesis(claims)
        assert h["title"] == "Exploratory hypothesis from available evidence"
        assert h["confidence_score"] == 0.25

    def test_generate_contradiction_hypothesis(self):
        class MockClaim:
            def __init__(self, claim_id, confidence, text="", source_id="src-1"):
                self.id = claim_id
                self.confidence = confidence
                self.text = text
                self.claim_type = "result"
                self.source_id = source_id

        gap = {
            "gap_type": "contradiction",
            "evidence_ids": ["c1", "c2"],
        }
        claims = [
            MockClaim("c1", 0.8, "Temperature increases activity"),
            MockClaim("c2", 0.3, "Temperature does not affect activity"),
        ]
        generator = HypothesisGenerator()
        h = generator._hypothesis_from_gap(gap, claims)
        assert h is not None
        assert h["title"] == "Resolving contradictory evidence"
