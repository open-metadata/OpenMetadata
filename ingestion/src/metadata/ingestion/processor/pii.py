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
from typing import List, Optional

import spacy
from commonregex import CommonRegex
from pydantic import BaseModel

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata, OpenMetadataConnection

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


class NERScanner:
    """A scanner that uses Spacy NER for entity recognition"""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def get_spacy_to_pii_type(self, spacy_type):
        spacy_to_pii = {
            "ORG": PiiTypes.ORGANIZATION.value,
            "GPE": PiiTypes.LOCATION.value,
            "TIME": PiiTypes.DATE_TIME.value,
            "CARDINAL": PiiTypes.UNSUPPORTED.value,
            "PERSON": PiiTypes.PERSON.value,
            "FAC": PiiTypes.LOCATION.value,
            "LOC": PiiTypes.LOCATION.value,
        }

        return spacy_to_pii.get(spacy_type, PiiTypes.UNSUPPORTED.value)

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
        spacy_label: str
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
            for tag in table_entity.columns[idx].tags or []:
                if PII in tag.tagFQN.__root__:
                    idx += 1
                    continue
            pii_tag_type, confidence = self.scan([row[idx] for row in table_data.rows])
            if confidence >= 0.8:
                client.patch_column_tag(
                    entity_id=table_entity.id,
                    column_name=table_entity.columns[idx].name.__root__,
                    tag_fqn=pii_tag_type,
                    is_suggested=True,
                )


class ColumnPIIType(BaseModel):
    pii_types: PiiTypes
    tag_type: TagType


class RegexScanner:
    """A scanner that uses commmon regular expressions to find PII"""

    def scan(self, text):
        """Scan the text and return an array of PiiTypes that are found"""
        regex_result = CommonRegex(text)
        types = []
        if regex_result.phones:  # pylint: disable=no-member
            types.append(PiiTypes.PHONE.name)
        if regex_result.emails:  # pylint: disable=no-member
            types.append(PiiTypes.EMAIL.name)
        if regex_result.credit_cards:  # pylint: disable=no-member
            types.append(PiiTypes.CREDIT_CARD.name)
        if regex_result.street_addresses:  # pylint: disable=no-member
            types.append(PiiTypes.ADDRESS.name)

        return types


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

    def scan(self, text) -> Optional[List[ColumnPIIType]]:
        types = set()
        for pii_type_keys, pii_type_pattern in self.sensitive_regex.items():
            if pii_type_pattern.match(text) is not None:
                return ColumnPIIType(
                    pii_types=pii_type_keys, tag_type=TagType.SENSITIVE.value
                )

        for pii_type_keys, pii_type_pattern in self.non_sensitive_regex.items():
            if pii_type_pattern.match(text) is not None:
                return ColumnPIIType(
                    pii_types=pii_type_keys, tag_type=TagType.NONSENSITIVE.value
                )

        logging.debug("PiiTypes are %s", ",".join(str(x) for x in list(types)))
        return None


class PiiProcessor(Processor):
    """
    Processor class to process columns of table
    """

    metadata_config: OpenMetadata
    status: ProcessorStatus
    metadata: OpenMetadata

    def __init__(self, metadata_config: OpenMetadata):
        super().__init__()
        self.metadata = metadata_config
        self.status = ProcessorStatus()
        self.column_scanner = ColumnNameScanner()

    @classmethod
    def create(cls, config_dict: dict):  # pylint: disable=arguments-differ
        metadata_config = OpenMetadataConnection.parse_obj(config_dict)
        return cls(metadata_config)

    def process(  # pylint: disable=arguments-differ
        self, table_request: CreateTableRequest
    ) -> Optional[CreateTableRequest]:
        for column in table_request.columns:
            pii_tags = []
            pii_tags: ColumnPIIType = self.column_scanner.scan(column.name.__root__)
            tag_labels = []
            if pii_tags:
                tag_labels.append(
                    TagLabel(
                        tagFQN=f"{PII}.{pii_tags.tag_type.value}",
                        labelType=LabelType.Automated.value,
                        state=State.Suggested.value,
                        source=TagSource.Tag.value,
                    )
                )
            if len(tag_labels) > 0 and column.tags:
                column.tags.extend(tag_labels)
            elif len(tag_labels) > 0:
                column.tags = tag_labels
            self.status.records.append(column.name.__root__)

    def close(self):
        pass

    def get_status(self) -> ProcessorStatus:
        return self.status
