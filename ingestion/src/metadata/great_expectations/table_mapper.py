#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Handles the TableMapper for the GX Action.
"""
import logging
from enum import Enum, auto
from typing import Dict, Optional

from pydantic import BaseModel, ValidationError

from metadata.models.base import DictModel

logger = logging.getLogger(
    "great_expectations.validation_operators.validation_operators.openmetadata"
)


class TablePart(Enum):
    DATABASE = auto()
    SCHEMA = auto()
    TABLE = auto()


class TableConfig(BaseModel):
    """
    Defines a Mapping for a GX Expectation Suite to be mapped to an OpenMetadata Table.
    """

    database_name: Optional[str]
    schema_name: Optional[str]
    table_name: Optional[str]

    @classmethod
    def default(cls):
        return TableConfig(
            database_name=None,
            schema_name=None,
            table_name=None,
        )


class TableConfigMap(DictModel[str, TableConfig]):
    @classmethod
    def parse(cls, raw: Dict[str, Dict[str, str]]):
        parsed: Dict[str, TableConfig] = {}

        for suite_name, cfg_dict in raw.items():
            try:
                parsed[suite_name] = TableConfig.model_validate(cfg_dict)
            except ValidationError as exc:
                logger.warning(
                    "Invalid TableConfig for Expectation Suite '%s':\n    %s",
                    suite_name,
                    exc.errors(),
                )
                continue
        return cls(parsed)


class TableMapper:
    """
    Handles the Table Mapping between GX Expectation Suite and OpenMetadata Table.
    """

    def __init__(
        self,
        default_database_name: Optional[str],
        default_schema_name: Optional[str],
        default_table_name: Optional[str],
        expectation_suite_table_config_map: TableConfigMap,
    ):
        self.default = TableConfig(
            database_name=default_database_name,
            schema_name=default_schema_name,
            table_name=default_table_name,
        )

        self.expectation_suite_table_config_map = expectation_suite_table_config_map

    def get_part_name(
        self, part: TablePart, expectation_suite_name: Optional[str] = None
    ):
        table_config = self.default
        if self.expectation_suite_table_config_map and expectation_suite_name:
            table_config = (
                self.expectation_suite_table_config_map.get(expectation_suite_name)
                or self.default
            )

        match part:
            case TablePart.DATABASE:
                return table_config.database_name
            case TablePart.SCHEMA:
                return table_config.schema_name
            case TablePart.TABLE:
                return table_config.table_name
