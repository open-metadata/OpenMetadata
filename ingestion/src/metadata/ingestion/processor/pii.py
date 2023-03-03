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
Processor util to fetch pii sensitive columns
"""
import logging
import traceback
from enum import Enum
from typing import Optional, Tuple, Union

from presidio_analyzer import AnalyzerEngine

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

PII = "PII"


class TagType(Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


class NEREntity(Enum):
    CREDIT_CARD = TagType.SENSITIVE.value
    EMAIL_ADDRESS = TagType.SENSITIVE.value
    IBAN_CODE = TagType.SENSITIVE.value
    IP_ADDRESS = TagType.SENSITIVE.value
    NRP = TagType.NONSENSITIVE.value
    LOCATION = TagType.SENSITIVE.value
    PHONE_NUMBER = TagType.SENSITIVE.value
    MEDICAL_LICENSE = TagType.SENSITIVE.value
    US_DRIVER_LICENSE = TagType.SENSITIVE.value
    DATE_TIME = TagType.NONSENSITIVE.value
    URL = TagType.SENSITIVE.value
    US_BANK_NUMBER = TagType.NONSENSITIVE.value
    US_SSN = TagType.SENSITIVE.value
    PERSON = TagType.SENSITIVE.value
    US_PASSPORT = TagType.SENSITIVE.value


class NERScanner:
    """A scanner that uses Spacy NER for entity recognition"""

    def __init__(self, metadata: OpenMetadata):
        self.metadata = metadata
        self.text = ""
        self.analyzer = AnalyzerEngine()

    def get_highest_score_label(
        self, labels_score
    ) -> Optional[Tuple[Union[float, str]]]:
        most_used_label_occurrence = 0
        label_score = None
        for label, score in labels_score.items():
            if score[0] == 1.0 and score[1] > len(self.text) * 0.8:
                return (label, score[0])
            if score[1] > most_used_label_occurrence:
                label_score = (label, score[0])
                most_used_label_occurrence = score[1]
        return label_score or (None, None)

    def scan(self, text):
        """Scan the text and return an array of PiiTypes that are found"""

        logging.debug("Processing '%s'", text)
        pii_tag_fqn = ""
        labels_score = {}
        self.text = [str(row) for row in text if row is not None]
        for row in self.text:
            try:
                results = self.analyzer.analyze(row, language="en")
                for result in results:
                    logging.debug("Found %s", result.entity_type)
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
                logging.warning(f"Unkown error while processing {row} - {exc}")
                logging.debug(traceback.format_exc())

        label, score = self.get_highest_score_label(labels_score)
        if label and score:
            label_type = NEREntity.__members__.get(
                label, TagType.NONSENSITIVE.value
            ).value
            pii_tag_fqn = fqn.build(
                self.metadata,
                entity_type=Tag,
                classification_name=PII,
                tag_name=label_type,
            )

        return pii_tag_fqn or "", score or 0

    def process(self, table_data: TableData, table_entity: Table, client: OpenMetadata):
        len_of_rows = len(table_data.rows[0]) if table_data.rows else 0
        for idx in range(len_of_rows):
            pii_found = False
            for tag in table_entity.columns[idx].tags or []:
                if PII in tag.tagFQN.__root__:
                    pii_found = True
                    continue
            if pii_found is True:
                continue
            pii_tag_fqn, confidence = self.scan([row[idx] for row in table_data.rows])
            if pii_tag_fqn and confidence >= 0.8:
                client.patch_column_tag(
                    entity_id=table_entity.id,
                    column_name=table_entity.columns[idx].name.__root__,
                    tag_fqn=pii_tag_fqn,
                    is_suggested=True,
                )
