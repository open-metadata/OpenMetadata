#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import inspect
from collections.abc import Iterable

from metadata.pii.algorithms.classifiers import ColumnClassifier, HeuristicPIIClassifier
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.algorithms.utils import get_top_classes

from .data import pii_samples  # noqa: TID252
from .data.pii_samples import LabeledData  # noqa: TID252


def get_sample_data() -> Iterable[tuple[str, LabeledData]]:
    # Add the samples you want to test
    # get all attributes of the module that ends with _data
    suffix = "_data"
    for name, obj in inspect.getmembers(pii_samples):
        if name.endswith(suffix):
            yield name, obj


def run_test_on_pii_classifier(pii_classifier: ColumnClassifier[PIITag]) -> str:
    """Apply the classifier to the data and check the results"""
    tested_datasets = 0

    for name, column_data in get_sample_data():
        predicted_scores = pii_classifier.predict_scores(
            sample_data=column_data["sample_data"],
            column_name=column_data["column_name"],
            column_data_type=column_data["column_data_type"],
        )
        expected_classes = set(column_data["pii_tags"])
        selected_classes = get_top_classes(predicted_scores, len(expected_classes), 0.0)
        predicted_classes = set(selected_classes)
        assert predicted_classes == expected_classes, (
            f"Failed on dataset {name}: {expected_classes} but got {predicted_classes} with scores {predicted_scores}"
        )
        tested_datasets += 1

    return f"PII Classifier {pii_classifier.__class__.__name__} tested with {tested_datasets} datasets."


def test_pii_heuristic_classifier(pii_test_logger):
    """Test the PII heuristic classifier"""
    heuristic_classifier = HeuristicPIIClassifier()
    results = run_test_on_pii_classifier(heuristic_classifier)
    pii_test_logger.info(results)


def test_pii_heuristic_classifier_keeps_personal_date_named_in_sample():
    """A DATE_TIME hit on a free-text column is kept when the sample names a personal date."""
    heuristic_classifier = HeuristicPIIClassifier()

    scores = heuristic_classifier.predict_scores(
        sample_data=["date of birth: 1990-04-12", "date of birth: 1985-11-03"],
        column_name="notes",
    )

    assert PIITag.DATE_TIME in scores


def test_pii_heuristic_classifier_ignores_personal_date_text_without_a_date():
    """A row naming a personal date but holding no date cannot corroborate other rows' dates."""
    heuristic_classifier = HeuristicPIIClassifier()

    scores = heuristic_classifier.predict_scores(
        sample_data=[
            "2024-03-01 job finished",
            "2024-03-02 job finished",
            "2024-03-03 job finished",
            "user updated date of birth",
        ],
        column_name="notes",
    )

    assert PIITag.DATE_TIME not in scores


def test_pii_heuristic_classifier_drops_operational_date_in_free_text():
    """A DATE_TIME hit on a free-text column without personal-date evidence is dropped."""
    heuristic_classifier = HeuristicPIIClassifier()

    scores = heuristic_classifier.predict_scores(
        sample_data=["shipped on 1990-04-12", "shipped on 1985-11-03"],
        column_name="notes",
    )

    assert PIITag.DATE_TIME not in scores
