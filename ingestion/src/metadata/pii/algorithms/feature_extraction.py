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
"""
Extraction of PII features (from text, column names, and data types) to be used
for the PII classification model.
"""
import logging
import re
from collections import defaultdict
from typing import DefaultDict, Dict, Iterable, List, Mapping, Optional, Sequence, Set

from presidio_analyzer import AnalyzerEngine

from metadata.generated.schema.entity.data.table import DataType
from metadata.pii.algorithms.presidio_patches import PresidioRecognizerResultPatcher
from metadata.pii.algorithms.tags import PIITag
from metadata.pii.scanners.ner_scanner import SUPPORTED_LANG
from metadata.utils.logger import pii_logger

logger = pii_logger()


def extract_pii_tags(
    analyzer: AnalyzerEngine,
    texts: Sequence[str],
    context: Optional[List[str]] = None,
    recognizer_result_patcher: Optional[PresidioRecognizerResultPatcher] = None,
) -> Dict[PIITag, float]:
    """
    Extract PII entities from a batch of texts.

    The results are averaged over the batch. In general, the larger the batch,
    the better the results, as some single texts might be noisy or contain
    false positives.

    Args:
        analyzer (AnalyzerEngine): The analyzer engine to use for PII detection.
        texts (Sequence[str]): A sequence of texts to analyze.
        context (Optional[List[str]]): Optional context to provide to the analyzer.
            This can be used to improve the accuracy of the PII detection.
            For example, keywords extracted from column names.
        recognizer_result_patcher (Optional[PresidioRecognizerResultPatcher]): A function
            that takes a recognizer result and returns a modified result.
    Returns:
        Mapping[PIITag, float]: A mapping of PII entity types to their average scores.
    """
    entity_scores: DefaultDict[PIITag, float] = defaultdict(float)

    if SUPPORTED_LANG not in analyzer.supported_languages:
        raise ValueError(
            f"The analyzer does not support {SUPPORTED_LANG}, which is required for this function."
        )

    for text in texts:
        results = analyzer.analyze(
            text, language=SUPPORTED_LANG, context=context, entities=PIITag.values()
        )
        if recognizer_result_patcher is not None:
            results = recognizer_result_patcher(results, text)

        for result in results:
            try:
                # This should be safe because the analyzer only considers the entities that we passed
                pii_entity = PIITag[result.entity_type]
                entity_scores[pii_entity] += result.score
            except KeyError:
                logging.error(f"Unrecognized PII entity type: {result.entity_type}.")

    # normalize the scores if the batch is not empty
    if len(texts):
        for entity in entity_scores:
            entity_scores[entity] /= len(texts)

    return entity_scores


def split_column_name(column_name: str) -> List[str]:
    """
    Split a column name into its components.
    This is used for passing column names to the analyzer as context.
    """
    # Split by common delimiters
    delimiters = ["_", "-", " ", ".", "/"]
    regex_pattern = "|".join(map(re.escape, delimiters))
    return list(re.split(regex_pattern, column_name.lower()))


def extract_pii_from_column_names(
    column_name: str, patterns: Mapping[PIITag, Iterable[re.Pattern[str]]]
) -> Set[PIITag]:
    """
    Extract PII entities from a column name using a collection of regex patterns
    for each PII type. This is used to match patterns in column names that might
    indicate the presence of PII data.

    Example: "user_email" might match the EMAIL_ADDRESS pattern, returning
    a set containing the PII tag PIITag.EMAIL_ADDRESS.
    """
    results: Set[PIITag] = set()

    for pii_type, pii_type_patterns in patterns.items():
        for pattern in pii_type_patterns:
            if pattern.match(column_name) is not None:
                results.add(pii_type)
                break  # No need to check other patterns for this PII type

    return results


def is_non_pii_datatype(dtype: DataType) -> bool:
    """
    Determine whether a column with the given data type is unlikely
    to contain PII and can be safely excluded from PII detection or scanning.
    """
    non_pii_types = {
        DataType.BOOLEAN,
        DataType.BIT,
        DataType.NULL,
        DataType.ERROR,
        DataType.FIXED,
        DataType.AGGREGATEFUNCTION,
        DataType.HLLSKETCH,
        DataType.QUANTILE_STATE,
        DataType.AGG_STATE,
        DataType.BITMAP,
        DataType.PG_LSN,
        DataType.PG_SNAPSHOT,
        DataType.TXID_SNAPSHOT,
        DataType.TSQUERY,
        DataType.TSVECTOR,
        DataType.UNKNOWN,
        DataType.LOWCARDINALITY,
        DataType.MEASURE_HIDDEN,
        DataType.MEASURE_VISIBLE,
    }
    geo_data_types = {
        DataType.GEOGRAPHY,
        DataType.GEOMETRY,
        DataType.SPATIAL,
        DataType.POINT,
        DataType.POLYGON,
    }

    excluded_data_types = non_pii_types | geo_data_types

    return dtype in excluded_data_types
