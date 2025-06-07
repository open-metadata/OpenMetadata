from metadata.pii.algorithms.label_extractors import ProbabilisticLabelExtractor


def test_extract_labels_single_dominant_label():
    extractor = ProbabilisticLabelExtractor(
        score_threshold=0.2, prob_threshold=0.8, k=1
    )

    scores = {
        "LabelA": 0.9,
        "LabelB": 0.1,
    }

    # After filtering: {"LabelA": 0.9}
    # Normalized: LabelA = 1.0
    # Passes probability threshold
    assert extractor.extract_labels(scores) == {"LabelA"}


def test_extract_labels_top_label_below_probability_threshold():
    extractor = ProbabilisticLabelExtractor(
        score_threshold=0.1, prob_threshold=0.9, k=1
    )

    scores = {
        "LabelA": 0.5,
        "LabelB": 0.4,
    }

    # Normalized: A ≈ 0.56, B ≈ 0.44 → neither meets prob_threshold=0.9
    assert extractor.extract_labels(scores) == set()


def test_extract_labels_equal_scores_all_pass():
    extractor = ProbabilisticLabelExtractor(
        score_threshold=0.1, prob_threshold=0.3, k=2
    )

    scores = {
        "LabelA": 0.4,
        "LabelB": 0.4,
    }

    # Normalized: each = 0.5 → both ≥ prob_threshold
    assert extractor.extract_labels(scores) == {"LabelA", "LabelB"}
