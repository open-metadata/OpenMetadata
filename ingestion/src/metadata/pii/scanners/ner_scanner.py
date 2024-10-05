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
import json
import logging
import traceback
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, ConfigDict

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.pii.constants import PII, SPACY_EN_MODEL
from metadata.pii.models import TagAndConfidence
from metadata.pii.ner import NEREntity
from metadata.pii.scanners.base import BaseScanner
from metadata.utils import fqn
from metadata.utils.logger import METADATA_LOGGER, pii_logger

logger = pii_logger()
SUPPORTED_LANG = "en"
PRESIDIO_LOGGER = "presidio-analyzer"


class StringAnalysis(BaseModel):
    """
    Used to store results from the sample data scans for each NER Entity
    """

    score: float
    appearances: int


class NLPEngineModel(BaseModel):
    """Required to pass the nlp_engine as {"lang_code": "en", "model_name": "en_core_web_lg"}"""

    model_config = ConfigDict(protected_namespaces=())
    lang_code: str
    model_name: str


# pylint: disable=import-outside-toplevel
class NERScanner(BaseScanner):
    """Based on https://microsoft.github.io/presidio/"""

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

        nlp_engine_model = NLPEngineModel(
            lang_code=SUPPORTED_LANG, model_name=SPACY_EN_MODEL
        )

        # Set the presidio logger to talk less about internal entities unless we are debugging
        logging.getLogger(PRESIDIO_LOGGER).setLevel(
            logging.INFO
            if logging.getLogger(METADATA_LOGGER).level == logging.DEBUG
            else logging.ERROR
        )

        self.analyzer = AnalyzerEngine(
            nlp_engine=SpacyNlpEngine(models=[nlp_engine_model.model_dump()])
        )

    @staticmethod
    def get_highest_score_label(
        entities_score: Dict[str, StringAnalysis]
    ) -> Tuple[str, float]:
        top_entity = max(
            entities_score,
            key=lambda type_: entities_score[type_].score
            * entities_score[type_].appearances
            * 0.8,
        )
        return top_entity, entities_score[top_entity].score

    def scan(self, data: List[Any]) -> Optional[TagAndConfidence]:
        """
        Scan the column's sample data rows and look for PII.

        How this works:
        1. We create a list of strings [s1, s2, ..., sn] with each sample data row for a column
        2. Then, for each s_i:
          a. Run the analyzer, which will return a list of possible recognized Entities and confidence score
             For example, the result of analyzing `123456789` gives us
               [
                 type: DATE_TIME, start: 0, end: 9, score: 0.85,
                 type: US_BANK_NUMBER, start: 0, end: 9, score: 0.05,
                 type: US_PASSPORT, start: 0, end: 9, score: 0.05,
                 type: US_DRIVER_LICENSE, start: 0, end: 9, score: 0.01
              ]
          b. Each time an `Entity` appears (e.g., DATE_TIME), we store its max score and the number of appearances
        3. After gathering all the results for each row, get the `Entity` with maximum overall score
           and number of appearances. This gets computed as "score * appearances * 0.8", which can
           be thought as the "score" times "weighted down appearances".
        4. Once we have the "top" `Entity` from that column, we assign the PII label accordingly from `NEREntity`.
        """
        logger.debug("Processing '%s'", data)

        # Initialize an empty dict for the given row list
        entities_score: Dict[str, StringAnalysis] = defaultdict(
            lambda: StringAnalysis(score=0, appearances=0)
        )

        str_sample_data_rows = [str(row) for row in data if row is not None]
        for row in str_sample_data_rows:
            try:
                self.process_data(row=row, entities_score=entities_score)
            except Exception as exc:
                logger.warning(f"Unknown error while processing {row} - {exc}")
                logger.debug(traceback.format_exc())

        if entities_score:
            label, score = self.get_highest_score_label(entities_score)
            tag_type = NEREntity.__members__.get(label)
            if not tag_type:
                return None
            return TagAndConfidence(
                tag_fqn=fqn.build(
                    metadata=None,
                    entity_type=Tag,
                    classification_name=PII,
                    tag_name=tag_type.value,
                ),
                confidence=score,
            )

        return None

    def process_data(self, row: str, entities_score: Dict[str, StringAnalysis]) -> None:
        """Process the Sample Data rows, checking if they are of JSON format as well"""
        # first, check if the data is JSON or we can work with strings
        is_json, value = self.is_json_data(row)
        if is_json and isinstance(value, dict):
            for val in value.values():
                self.process_data(row=str(val), entities_score=entities_score)
        elif is_json and isinstance(value, list):
            for val in value:
                self.process_data(row=str(val), entities_score=entities_score)
        else:
            self.scan_value(value=row, entities_score=entities_score)

    @staticmethod
    def is_json_data(value: str) -> Tuple[bool, Union[dict, list, None]]:
        """Check if the value is a JSON object that we need to process differently than strings"""
        try:
            res = json.loads(value)
            if isinstance(res, (dict, list)):
                return True, res
            return False, None
        except json.JSONDecodeError:
            return False, None

    def scan_value(self, value: str, entities_score: Dict[str, StringAnalysis]):
        """Scan the value for PII"""
        results = self.analyzer.analyze(value, language="en")
        for result in results:
            entities_score[result.entity_type] = StringAnalysis(
                score=result.score
                if result.score > entities_score[result.entity_type].score
                else entities_score[result.entity_type].score,
                appearances=entities_score[result.entity_type].appearances + 1,
            )
