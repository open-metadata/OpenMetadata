#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import logging
from typing import Optional

import spacy
from commonregex import CommonRegex
import re
from abc import ABC, abstractmethod
import json
from enum import Enum, auto

from metadata.config.common import ConfigModel
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.api.common import WorkflowContext, Record
from metadata.ingestion.api.processor import Processor, ProcessorStatus
from metadata.ingestion.models.ometa_table_db import OMetaDatabaseAndTable
from metadata.ingestion.ometa.auth_provider import MetadataServerConfig
from metadata.ingestion.ometa.client import REST
from metadata.utils.helpers import snake_to_camel


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


# Ref: https://stackoverflow.com/questions/24481852/serialising-an-enum-member-to-json
class PiiTypeEncoder(json.JSONEncoder):
    # pylint: disable=method-hidden
    def default(self, obj):
        if type(obj) == PiiTypes:
            return {"__enum__": str(obj)}
        return json.JSONEncoder.default(self, obj)


def as_enum(d):
    if "__enum__" in d:
        name, member = d["__enum__"].split(".")
        return getattr(PiiTypes, member)
    else:
        return d


class Scanner(ABC):
    @abstractmethod
    def scan(self, text):
        """scan the text and return array of PiiTypes that are found"""


class RegexScanner(Scanner):
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


class NERScanner(Scanner):
    """A scanner that uses Spacy NER for entity recognition"""

    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def scan(self, text):
        """Scan the text and return an array of PiiTypes that are found"""
        logging.debug("Processing '%s'", text)
        doc = self.nlp(text)
        types = set()
        for ent in doc.ents:
            logging.debug("Found %s", ent.label_)
            if ent.label_ == "PERSON":
                types.add(PiiTypes.PERSON.name)

            if ent.label_ == "GPE":
                types.add(PiiTypes.LOCATION.name)

            if ent.label_ == "DATE":
                types.add(PiiTypes.BIRTH_DATE.name)

        logging.debug("PiiTypes are %s", ",".join(str(x) for x in list(types)))
        return list(types)


class ColumnNameScanner(Scanner):
    regex = {
        PiiTypes.PERSON: re.compile(
            "^.*(firstname|fname|lastname|lname|"
            "fullname|maidenname|_name|"
            "nickname|name_suffix|name).*$",
            re.IGNORECASE,
        ),
        PiiTypes.EMAIL: re.compile("^.*(email|e-mail|mail).*$", re.IGNORECASE),
        PiiTypes.BIRTH_DATE: re.compile(
            "^.*(date_of_birth|dateofbirth|dob|"
            "birthday|date_of_death|dateofdeath).*$",
            re.IGNORECASE,
        ),
        PiiTypes.GENDER: re.compile("^.*(gender).*$", re.IGNORECASE),
        PiiTypes.NATIONALITY: re.compile("^.*(nationality).*$", re.IGNORECASE),
        PiiTypes.ADDRESS: re.compile(
            "^.*(address|city|state|county|country|" "zipcode|zip|postal|zone|borough).*$",
            re.IGNORECASE,
        ),
        PiiTypes.USER_NAME: re.compile("^.*user(id|name|).*$", re.IGNORECASE),
        PiiTypes.PASSWORD: re.compile("^.*pass.*$", re.IGNORECASE),
        PiiTypes.SSN: re.compile("^.*(ssn|social).*$", re.IGNORECASE),
        PiiTypes.PHONE: re.compile("^.*(phone).*$", re.IGNORECASE),
    }

    def scan(self, text):
        types = set()
        for pii_type in self.regex:
            if self.regex[pii_type].match(text) is not None:
                types.add(pii_type.name)

        logging.debug("PiiTypes are %s", ",".join(str(x) for x in list(types)))
        return list(types)


class PIIProcessorConfig(ConfigModel):
    filter: Optional[str] = None
    api_endpoint: Optional[str] = None
    auth_provider_type: Optional[str] = None


class PIIProcessor(Processor):
    config: PIIProcessorConfig
    metadata_config: MetadataServerConfig
    status: ProcessorStatus
    client: REST

    def __init__(self, ctx: WorkflowContext, config: PIIProcessorConfig, metadata_config: MetadataServerConfig):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = ProcessorStatus()
        self.client = REST(self.metadata_config)
        self.tags = self.__get_tags()
        self.column_scanner = ColumnNameScanner()
        self.ner_scanner = NERScanner()

    @classmethod
    def create(cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext):
        config = PIIProcessorConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def __get_tags(self) -> {}:
        user_tags = self.client.list_tags_by_category("user")
        tags_dict = {}
        for tag in user_tags:
            tags_dict[tag.name.__root__] = tag
        return tags_dict

    def process(self, table_and_db: OMetaDatabaseAndTable) -> Record:
        for column in table_and_db.table.columns:
            pii_tags = []
            pii_tags += self.column_scanner.scan(column.name.__root__)
            pii_tags += self.ner_scanner.scan(column.name.__root__)
            tag_labels = []
            for pii_tag in pii_tags:
                if snake_to_camel(pii_tag) in self.tags.keys():
                    tag_entity = self.tags[snake_to_camel(pii_tag)]
                else:
                    logging.debug("Fail to tag column {} with tag {}".format(column.name, pii_tag))
                    continue
                tag_labels.append(TagLabel(tagFQN=tag_entity.fullyQualifiedName,
                                           labelType='Automated',
                                           state='Suggested',
                                           href=tag_entity.href))
            column.tags = tag_labels

        return table_and_db

    def close(self):
        pass

    def get_status(self) -> ProcessorStatus:
        return self.status
