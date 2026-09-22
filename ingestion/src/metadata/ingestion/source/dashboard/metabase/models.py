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
Metabase Models
"""

import ast
import json
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, field_validator, model_validator

MetabaseStrId = Annotated[str, BeforeValidator(lambda x: str(x))]  # noqa: PLW0108


class MetabaseUser(BaseModel):
    """
    Metabase user model
    """

    id: MetabaseStrId
    first_name: str | None = None
    last_name: str | None = None
    common_name: str | None = None
    email: str | None = None
    is_superuser: bool | None = False
    last_edit_timestamp: str | None = Field(None, alias="timestamp")


class MetabaseDashboard(BaseModel):
    """
    Metabase dashboard model
    """

    description: str | None = None
    name: str
    id: MetabaseStrId
    collection_id: MetabaseStrId | None = None


class MetabaseCollection(BaseModel):
    """
    Metabase dashboard model
    """

    name: str
    id: MetabaseStrId


class MetabaseDashboardList(BaseModel):
    data: list[MetabaseDashboard] = []


class MetabaseCollectionList(BaseModel):
    collections: list[MetabaseCollection] = []


class Native(BaseModel):
    query: str | None = None


class DatasetQuery(BaseModel):
    model_config = {"extra": "ignore"}

    type: str | None = None
    native: Native | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_native_from_stages(cls, data):
        """
        Breaking change in metabase 0.57.0
        https://www.metabase.com/docs/latest/developers-guide/api-changelog#metabase-0570
        """
        if not isinstance(data, dict):
            return data
        if data.get("native") is not None:
            return data
        stages = data.get("stages")
        if stages:
            for stage in stages:
                if (
                    isinstance(stage, dict)
                    and stage.get("native")
                    and stage.get("lib/type", "") in ("mbql.stage/native", "mbql/query")
                ):
                    data["native"] = {"query": stage["native"]}
                    data["type"] = "native"
                    break
        return data


class MetabaseChart(BaseModel):
    """
    Metabase card model
    """

    description: str | None = None
    table_id: MetabaseStrId | None = None
    database_id: MetabaseStrId | None = None
    name: str | None = None
    dataset_query: DatasetQuery | None = None
    id: MetabaseStrId | None = None
    display: str | None = None
    dashboard_ids: list[str] = []

    @field_validator("dataset_query", mode="before")
    @classmethod
    def parse_dataset_query(cls, v):
        if v is None:
            return None

        # If it's already a dict or DatasetQuery object, return as is
        if isinstance(v, (dict, DatasetQuery)):
            return v

        # If it's a string, try multiple parsing strategies
        if isinstance(v, str):
            # Strategy 1: Try standard JSON parsing
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                pass

            # Strategy 2: Try ast.literal_eval for Python dict strings
            try:
                parsed = ast.literal_eval(v)
                if isinstance(parsed, dict):
                    return parsed
            except (ValueError, SyntaxError):
                pass

            # Strategy 3: More sophisticated quote replacement
            try:
                # Handle None values and booleans
                json_str = v.replace("'", '"').replace("None", "null").replace("True", "true").replace("False", "false")
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass

            # If all strategies fail, log and return None
            print(f"Failed to parse dataset_query string: {v[:100]}...")  # noqa: T201
            return None

        # For any other type, return as is and let Pydantic handle validation
        return v


class DashCard(BaseModel):
    card: MetabaseChart


class MetabaseDashboardDetails(BaseModel):
    """
    Metabase dashboard details model
    """

    description: str | None = None
    card_ids: list[str] = []
    name: str | None = None
    id: MetabaseStrId
    creator_id: MetabaseStrId | None = None
    collection_id: MetabaseStrId | None = None


class MetabaseDatabaseDetails(BaseModel):
    db: str | None = None


class MetabaseDatabase(BaseModel):
    """
    Metabase database model
    """

    details: MetabaseDatabaseDetails | None = None


class MetabaseTable(BaseModel):
    table_schema: str | None = Field(None, alias="schema")
    db: MetabaseDatabase | None = None
    name: str | None = None
    id: MetabaseStrId | None = None
    display_name: str | None = None
