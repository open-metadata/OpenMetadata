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
from typing import Iterable, Tuple

from metadata.pii.algorithms.classifiers import ColumnClassifier, HeuristicPIIClassifier
from metadata.pii.algorithms.tags import PIITag

from .data import pii_samples
from .data.pii_samples import LabeledData


def get_sample_data() -> Iterable[Tuple[str, LabeledData]]:
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
        predicted_classes = set(predicted_scores)
        expected_classes = set(column_data["pii_tags"])
        assert (
            predicted_classes == expected_classes
        ), f"Failed on dataset {name}: {expected_classes} but got {predicted_classes} with scores {predicted_scores}"
        tested_datasets += 1

    return f"PII Classifier {pii_classifier.__class__.__name__} tested with {tested_datasets} datasets."


def test_pii_heuristic_classifier(pii_test_logger):
    """Test the PII heuristic classifier"""
    heuristic_classifier = HeuristicPIIClassifier()
    results = run_test_on_pii_classifier(heuristic_classifier)
    pii_test_logger.info(results)
