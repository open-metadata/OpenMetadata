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
from abc import ABC, abstractmethod
from enum import Enum, auto
from typing import List, Optional

from commonregex import CommonRegex
from pydantic import BaseModel

from metadata.generated.schema.api.data.createTable import CreateTableRequest
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


class TagType(Enum):
    SENSITIVE = "Sensitive"
    NONSENSITIVE = "NonSensitive"


class ColumnPIIType(BaseModel):
    pii_types: PiiTypes
    tag_type: TagType


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


class ColumnNameScanner(Scanner):
    """
    Column Name Scanner to scan column name
    """

    sensitive_regex = {
        PiiTypes.PASSWORD: re.compile("^.*password.*$", re.IGNORECASE),
        PiiTypes.USER_NAME: re.compile("^.*user(id|name|).*$", re.IGNORECASE),
        PiiTypes.KEY: re.compile("^.*(key).*$", re.IGNORECASE),
        PiiTypes.SSN: re.compile("^.*(ssn|social).*$", re.IGNORECASE),
        PiiTypes.CREDIT_CARD: re.compile("^.*(card).*$", re.IGNORECASE),
        PiiTypes.BANKACC: re.compile("^.*(bank|acc).*$", re.IGNORECASE),
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
                column.tags.append(tag_labels)
            elif len(tag_labels) > 0:
                column.tags = tag_labels
            self.status.records.append(column.name.__root__)

    def close(self):
        pass

    def get_status(self) -> ProcessorStatus:
        return self.status
