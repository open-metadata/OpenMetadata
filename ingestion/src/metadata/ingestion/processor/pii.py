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
import re
import traceback
from enum import Enum, auto
from typing import Optional, Tuple

from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn

PII = "PII"


class PiiTypes(Enum):
    """PiiTypes enumerates the different types of PII data"""

    NONE = auto()
    UNSUPPORTED = auto()
    PHONE = auto()
    EMAIL = auto()
    CREDIT_CARD = auto()
    ADDRESS = auto()
    ADDRESS_LOCATION = auto()
    PERSON = auto()
    LOCATION = auto()
    BIRTH_DATE = auto()
    GENDER = auto()
    NATIONALITY = auto()
    IP_ADDRESS = auto()
    SSN = auto()
    USER_NAME = auto()
    PASSWORD = auto()
    ETHNICITY = auto()
    TAX_ID = auto()
    KEY = auto()
    BANKACC = auto()


class TagType(Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


class ColumnNameScanner:
    """
    Column Name Scanner to scan column name
    """

    sensitive_regex = {
        PiiTypes.PASSWORD: re.compile("^.*password.*$", re.IGNORECASE),
        PiiTypes.USER_NAME: re.compile("^.*user(id|name|).*$", re.IGNORECASE),
        PiiTypes.KEY: re.compile("^.*(key).*$", re.IGNORECASE),
        PiiTypes.SSN: re.compile("^.*(ssn|social).*$", re.IGNORECASE),
        PiiTypes.CREDIT_CARD: re.compile("^.*(card).*$", re.IGNORECASE),
        PiiTypes.BANKACC: re.compile("^.*(bank|acc|amount).*$", re.IGNORECASE),
        PiiTypes.EMAIL: re.compile("^.*(email|e-mail|mail).*$", re.IGNORECASE),
    }
    non_sensitive_regex = {
        PiiTypes.PERSON: re.compile(
            "^.*(firstname|fname|lastname|lname|"
            "fullname|maidenname|_name|"
            "nickname|name_suffix|name).*$",
            re.IGNORECASE,
        ),
        PiiTypes.BIRTH_DATE: re.compile(
            "^.*(date_of_birth|dateofbirth|dob|"
            "birthday|date_of_death|dateofdeath).*$",
            re.IGNORECASE,
        ),
        PiiTypes.GENDER: re.compile("^.*(gender).*$", re.IGNORECASE),
        PiiTypes.NATIONALITY: re.compile("^.*(nationality).*$", re.IGNORECASE),
        PiiTypes.ADDRESS: re.compile(
            "^.*(address|city|state|county|country|"
            "zipcode|zip|postal|zone|borough).*$",
            re.IGNORECASE,
        ),
        PiiTypes.PHONE: re.compile("^.*(phone).*$", re.IGNORECASE),
    }


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
    US_BANK_NUMBER = TagType.SENSITIVE.value
    US_SSN = TagType.SENSITIVE.value
    PERSON = TagType.SENSITIVE.value
    US_PASSPORT = TagType.SENSITIVE.value


class NERScanner:
    """A scanner that uses Spacy NER for entity recognition"""

    def __init__(self, metadata: OpenMetadata):
        from presidio_analyzer import (  # pylint: disable=import-outside-toplevel
            AnalyzerEngine,
        )
        from presidio_analyzer.nlp_engine.spacy_nlp_engine import (  # pylint: disable=import-outside-toplevel
            SpacyNlpEngine,
        )

        self.metadata = metadata
        self.text = ""
        self.analyzer = AnalyzerEngine(
            nlp_engine=SpacyNlpEngine(models={"en": "en_core_web_md"})
        )

    def get_highest_score_label(
        self, labels_score
    ) -> Tuple[Optional[float], Optional[str]]:
        most_used_label_occurrence = 0
        label_score = None
        for label, score in labels_score.items():
            if score[0] == 1.0 and score[1] > len(self.text) * 0.8:
                return (label, score[0])
            if score[1] > most_used_label_occurrence:
                label_score = (label, score[0])
                most_used_label_occurrence = score[1]
        return label_score or (None, None)

    def column_name_scan(self, column_name: str):
        for _, pii_type_pattern in ColumnNameScanner.sensitive_regex.items():
            if pii_type_pattern.match(column_name) is not None:
                return TagType.SENSITIVE.value, 1

        for _, pii_type_pattern in ColumnNameScanner.non_sensitive_regex.items():
            if pii_type_pattern.match(column_name) is not None:
                return TagType.NONSENSITIVE.value, 1

        return None

    def scan(self, text) -> Tuple[str, float]:
        """Scan the text and return an pii tag fqn and confidence/score"""

        logging.debug("Processing '%s'", text)
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
            tag_type = NEREntity.__members__.get(
                label, TagType.NONSENSITIVE.value
            ).value
            return tag_type, score

        return "", 0

    def process(
        self,
        table_data: TableData,
        table_entity: Table,
        client: OpenMetadata,
        thresold_confidence: float,
    ):
        """
        process function to start processing sample data
        """
        len_of_rows = len(table_data.rows[0]) if table_data.rows else 0
        for idx in range(len_of_rows):
            pii_found = False
            for tag in table_entity.columns[idx].tags or []:
                if PII in tag.tagFQN.__root__:
                    pii_found = True
                    continue
            if pii_found is True:
                continue
            tag_type, confidence = self.column_name_scan(
                table_data.columns[idx].__root__
            ) or self.scan([row[idx] for row in table_data.rows])
            if tag_type and confidence >= thresold_confidence / 100:
                tag_fqn = fqn.build(
                    self.metadata,
                    entity_type=Tag,
                    classification_name=PII,
                    tag_name=tag_type,
                )
                client.patch_column_tag(
                    entity_id=table_entity.id,
                    column_name=table_entity.columns[idx].name.__root__,
                    tag_fqn=tag_fqn,
                    is_suggested=True,
                )
