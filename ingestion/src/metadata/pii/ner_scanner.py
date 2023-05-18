#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
NER Scanner based on Presidio.

Supported Entities https://microsoft.github.io/presidio/supported_entities/
"""
import traceback
from enum import Enum
from typing import Any, List, Optional, Tuple

from metadata.pii import SPACY_EN_MODEL
from metadata.pii.models import TagAndConfidence, TagType
from metadata.utils.logger import pii_logger

logger = pii_logger()


class NEREntity(Enum):
    CREDIT_CARD = TagType.SENSITIVE.value
    EMAIL_ADDRESS = TagType.SENSITIVE.value
    IBAN_CODE = TagType.SENSITIVE.value
    IP_ADDRESS = TagType.SENSITIVE.value
    NRP = TagType.NONSENSITIVE.value
    LOCATION = TagType.NONSENSITIVE.value
    PHONE_NUMBER = TagType.NONSENSITIVE.value
    MEDICAL_LICENSE = TagType.SENSITIVE.value
    US_DRIVER_LICENSE = TagType.SENSITIVE.value
    DATE_TIME = TagType.NONSENSITIVE.value
    URL = TagType.NONSENSITIVE.value
    US_BANK_NUMBER = TagType.SENSITIVE.value
    US_SSN = TagType.SENSITIVE.value
    PERSON = TagType.SENSITIVE.value
    US_PASSPORT = TagType.SENSITIVE.value


# pylint: disable=import-outside-toplevel
class NERScanner:
    """
    Based on https://microsoft.github.io/presidio/
    """

    def __init__(self):
        import spacy
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine.spacy_nlp_engine import SpacyNlpEngine

        try:
            spacy.load(SPACY_EN_MODEL)
        except OSError:
            logger.warning("Downloading en_core_web_md language model for the spaCy")
            from spacy.cli import download

            download(SPACY_EN_MODEL)
            spacy.load(SPACY_EN_MODEL)

        self.analyzer = AnalyzerEngine(
            nlp_engine=SpacyNlpEngine(models={"en": SPACY_EN_MODEL})
        )

    @staticmethod
    def get_highest_score_label(
        labels_score, str_sample_data_rows: List[str]
    ) -> Tuple[Optional[str], Optional[float]]:
        most_used_label_occurrence = 0
        label_score = None
        for label, score in labels_score.items():
            if score[0] == 1.0 and score[1] > len(str_sample_data_rows) * 0.8:
                return (label, score[0])
            if score[1] > most_used_label_occurrence:
                label_score = (label, score[0])
                most_used_label_occurrence = score[1]
        return label_score or (None, None)

    def scan(self, sample_data_rows: List[Any]) -> Optional[TagAndConfidence]:
        """
        Scan the column's sample data rows and look for PII
        """
        logger.debug("Processing '%s'", sample_data_rows)
        labels_score = {}
        str_sample_data_rows = [str(row) for row in sample_data_rows if row is not None]
        for row in str_sample_data_rows:
            try:
                results = self.analyzer.analyze(row, language="en")
                for result in results:
                    logger.debug("Found %s", result.entity_type)
                    tag = result.entity_type
                    if tag in labels_score:
                        labels_score[tag] = (
                            result.score
                            if result.score > labels_score[tag][0]
                            else labels_score[tag][0],
                            labels_score[tag][1] + 1,
                        )
                    else:
                        labels_score[tag] = (result.score, 1)
            except Exception as exc:
                logger.warning(f"Unknown error while processing {row} - {exc}")
                logger.debug(traceback.format_exc())

        label, score = self.get_highest_score_label(labels_score, str_sample_data_rows)
        if label and score:
            tag_type = NEREntity.__members__.get(label, TagType.NONSENSITIVE).value
            return TagAndConfidence(tag=tag_type, confidence=score)

        return None
