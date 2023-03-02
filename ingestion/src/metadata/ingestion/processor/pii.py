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

from presidio_analyzer import AnalyzerEngine

from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.ingestion.ometa.ometa_api import OpenMetadata

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
    ORGANIZATION = auto()
    DATE_TIME = auto()
    PASSPORT = auto()
    LICENSE = auto()


class TagType(Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


class SpacyEntity(Enum):
    GPE = PiiTypes.LOCATION.name
    CREDIT_CARD = PiiTypes.CREDIT_CARD.name
    EMAIL_ADDRESS = PiiTypes.EMAIL.name
    IBAN_CODE = PiiTypes.BANKACC.name
    IP_ADDRESS = PiiTypes.IP_ADDRESS.name
    NRP = PiiTypes.NATIONALITY.name
    LOCATION = PiiTypes.LOCATION.name
    PHONE_NUMBER = PiiTypes.PHONE.name
    MEDICAL_LICENSE = PiiTypes.LICENSE.name
    US_DRIVER_LICENSE = PiiTypes.LICENSE.name
    DATE_TIME = PiiTypes.DATE_TIME.name
    CARDINAL = PiiTypes.UNSUPPORTED.name
    URL = PiiTypes.ADDRESS.name
    US_BANK_NUMBER = PiiTypes.BANKACC.name
    US_SSN = PiiTypes.SSN.name
    PERSON = PiiTypes.PERSON.name
    US_PASSPORT = PiiTypes.PASSPORT.name


class NERScanner:
    """A scanner that uses Spacy NER for entity recognition"""

    def __init__(self):
        self.text = ""
        self.analyzer = AnalyzerEngine()

    def get_spacy_to_pii_type(self, spacy_type):
        return SpacyEntity.__members__.get(spacy_type, PiiTypes.UNSUPPORTED).value

    def get_highest_score_label(self, labels_score):
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
        pii_tag = f"{PII}.{TagType.NONSENSITIVE.value}"
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
        if (
            self.get_spacy_to_pii_type(spacy_type=label)
            in ColumnNameScanner.sensitive_regex
        ):
            pii_tag = f"{PII}.{TagType.SENSITIVE.value}"

        return pii_tag or "", score or 0

    def process(self, table_data: TableData, table_entity: Table, client: OpenMetadata):
        len_of_rows = len(table_data.rows[0] if table_data.rows else [])
        for idx in range(len_of_rows):
            pii_tag_type = ""
            pii_found = False
            for tag in table_entity.columns[idx].tags or []:
                if PII in tag.tagFQN.__root__:
                    pii_found = True
                    continue
            if pii_found is True:
                continue
            pii_tag_type, confidence = self.scan([row[idx] for row in table_data.rows])
            if confidence >= 0.8:
                client.patch_column_tag(
                    entity_id=table_entity.id,
                    column_name=table_entity.columns[idx].name.__root__,
                    tag_fqn=pii_tag_type,
                    is_suggested=True,
                )


class ColumnNameScanner:
    """
    Column Name Scanner to scan column name
    """

    sensitive_regex = {
        PiiTypes.PERSON.name: re.compile(
            "^.*(firstname|fname|lastname|lname|"
            "fullname|maidenname|_name|"
            "nickname|name_suffix|name).*$",
            re.IGNORECASE,
        ),
        PiiTypes.PASSWORD.name: re.compile("^.*password.*$", re.IGNORECASE),
        PiiTypes.USER_NAME.name: re.compile("^.*user(id|name|).*$", re.IGNORECASE),
        PiiTypes.KEY.name: re.compile("^.*(key).*$", re.IGNORECASE),
        PiiTypes.SSN.name: re.compile("^.*(ssn|social).*$", re.IGNORECASE),
        PiiTypes.CREDIT_CARD.name: re.compile("^.*(card).*$", re.IGNORECASE),
        PiiTypes.BANKACC.name: re.compile("^.*(bank|acc|amount).*$", re.IGNORECASE),
        PiiTypes.EMAIL.name: re.compile("^.*(email|e-mail|mail).*$", re.IGNORECASE),
        PiiTypes.PASSPORT.name: re.compile("^.*(passport).*$", re.IGNORECASE),
        PiiTypes.LICENSE.name: re.compile("^.*(license).*$", re.IGNORECASE),
    }
    non_sensitive_regex = {
        PiiTypes.BIRTH_DATE.name: re.compile(
            "^.*(date_of_birth|dateofbirth|dob|"
            "birthday|date_of_death|dateofdeath).*$",
            re.IGNORECASE,
        ),
        PiiTypes.GENDER.name: re.compile("^.*(gender).*$", re.IGNORECASE),
        PiiTypes.NATIONALITY.name: re.compile("^.*(nationality).*$", re.IGNORECASE),
        PiiTypes.ADDRESS.name: re.compile(
            "^.*(address|city|state|county|country|"
            "zipcode|zip|postal|zone|borough).*$",
            re.IGNORECASE,
        ),
        PiiTypes.PHONE.name: re.compile("^.*(phone).*$", re.IGNORECASE),
        PiiTypes.ORGANIZATION: re.compile(
            "^.*(organiztion|org|company).*$", re.IGNORECASE
        ),
        PiiTypes.DATE_TIME.name: re.compile(
            "^.*(created|updated|deleted).*$", re.IGNORECASE
        ),
    }
