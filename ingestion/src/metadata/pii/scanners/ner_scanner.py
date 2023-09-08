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
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.pii.constants import PII, SPACY_EN_MODEL
from metadata.pii.models import TagAndConfidence, TagType
from metadata.pii.ner import NEREntity
from metadata.utils import fqn
from metadata.utils.logger import pii_logger

logger = pii_logger()


class StringAnalysis(BaseModel):
    """
    Used to store results from the sample data scans for each NER Entity
    """

    score: float
    appearances: int


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
        entities_score: Dict[str, StringAnalysis]
    ) -> Tuple[str, float]:
        top_entity = max(
            entities_score,
            key=lambda type_: entities_score[type_].score
            * entities_score[type_].appearances
            * 0.8,
        )
        return top_entity, entities_score[top_entity].score

    def scan(self, sample_data_rows: List[Any]) -> Optional[TagAndConfidence]:
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
        logger.debug("Processing '%s'", sample_data_rows)

        # Initialize an empty dict for the given row list
        entities_score: Dict[str, StringAnalysis] = defaultdict(
            lambda: StringAnalysis(score=0, appearances=0)
        )

        str_sample_data_rows = [str(row) for row in sample_data_rows if row is not None]
        for row in str_sample_data_rows:
            try:
                results = self.analyzer.analyze(row, language="en")
                for result in results:
                    entities_score[result.entity_type] = StringAnalysis(
                        score=result.score
                        if result.score > entities_score[result.entity_type].score
                        else entities_score[result.entity_type].score,
                        appearances=entities_score[result.entity_type].appearances + 1,
                    )
            except Exception as exc:
                logger.warning(f"Unknown error while processing {row} - {exc}")
                logger.debug(traceback.format_exc())

        if entities_score:
            label, score = self.get_highest_score_label(entities_score)
            tag_type = NEREntity.__members__.get(label, TagType.NONSENSITIVE).value
            return TagAndConfidence(
                tag_fqn=fqn.build(
                    metadata=None,
                    entity_type=Tag,
                    classification_name=PII,
                    tag_name=tag_type,
                ),
                confidence=score,
            )

        return None
