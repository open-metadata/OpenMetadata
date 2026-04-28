#  Copyright 2025 OpenMetadata
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
QuestDB models
"""

from pydantic import BaseModel, ConfigDict, Field


class QuestDBTableRow(BaseModel):
    """One row from QuestDB's ``tables()`` function."""

    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(alias="table_name")
    partition_by: str | None = Field(alias="partitionBy", default=None)
    designated_timestamp: str | None = Field(alias="designatedTimestamp", default=None)
    table_type: str


class QuestDBColumnRow(BaseModel):
    """Columns read from QuestDB's ``table_columns()`` function."""

    column: str
    type: str
    designated: bool = False


class QuestDBViewDefinitionRow(BaseModel):
    """Result row from the view-definition lookup in ``views()``."""

    view_sql: str


class QuestDBMaterializedViewRow(BaseModel):
    """One row from QuestDB's ``materialized_views()`` function."""

    view_name: str
    base_table_name: str
    view_sql: str | None = None
