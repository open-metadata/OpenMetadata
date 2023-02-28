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
from collections import defaultdict
from enum import Enum, auto

import spacy

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


class TagType(Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


class SpacyEntity(Enum):
    ORG = PiiTypes.ORGANIZATION.name
    GPE = PiiTypes.LOCATION.name
    TIME = PiiTypes.DATE_TIME.name
    CARDINAL = PiiTypes.UNSUPPORTED.name
    PERSON = PiiTypes.PERSON.name
    FAC = PiiTypes.LOCATION.name
    LOC = PiiTypes.LOCATION.name


class NERScanner:
    """A scanner that uses Spacy NER for entity recognition"""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def get_spacy_to_pii_type(self, spacy_type):
        return SpacyEntity.__members__.get(spacy_type, PiiTypes.UNSUPPORTED).value

    def get_highest_score_label(self, beams, docs, entity_label):
        highest_score, label = 0, "CARDINAL"
        for _, beam in zip(docs, beams):
            entity_scores = defaultdict(float)
            for score, ents in self.nlp.entity.moves.get_beam_parses(beam):
                for start, end, label in ents:
                    entity_scores[(start, end, label)] += score
                    if score >= highest_score and label == entity_label:
                        highest_score, label = score, entity_label
        return highest_score, label

    def scan(self, text):
        """Scan the text and return an array of PiiTypes that are found"""

        logging.debug("Processing '%s'", text)
        pii_tag = f"{PII}.{TagType.NONSENSITIVE.value}"
        spacy_label: str = ""
        text = [str(row) for row in text if row is not None]
        for row in text:
            try:
                doc = self.nlp(row)
                for ent in list(doc.ents):
                    logging.debug("Found %s", ent.label_)
                    spacy_label = ent.label_
            except Exception as exc:
                logging.warning(f"Unkown error while processing {row} - {exc}")
                logging.debug(traceback.format_exc())
        beam_width = 16
        beam_density = 0.0001
        beams = None
        try:
            doc = list(self.nlp.pipe(text))
            beams = self.nlp.entity.beam_parse(
                doc, beam_width=beam_width, beam_density=beam_density
            )
        except Exception as exc:
            logging.warning(f"Unkown error while processing {text} - {exc}")

        score, label = self.get_highest_score_label(
            beams=beams, docs=doc, entity_label=spacy_label
        )
        if (
            self.get_spacy_to_pii_type(spacy_type=label)
            in ColumnNameScanner.sensitive_regex
        ):
            pii_tag = f"{PII}.{TagType.SENSITIVE.value}"

        return pii_tag, score

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
                    entity_id=table_entity.id.__root__,
                    column_name=table_entity.columns[idx].name.__root__,
                    tag_fqn=pii_tag_type,
                    is_suggested=True,
                )


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
        PiiTypes.ORGANIZATION: re.compile(
            "^.*(organiztion|org|company).*$", re.IGNORECASE
        ),
        PiiTypes.DATE_TIME: re.compile(
            "^.*(created|updated|deleted).*$", re.IGNORECASE
        ),
    }
