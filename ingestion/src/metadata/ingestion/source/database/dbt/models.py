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
Models required for dbt
"""

from typing import Any

from pydantic import BaseModel


class DbtFiles(BaseModel):
    dbt_catalog: dict | None = None
    dbt_manifest: dict
    dbt_sources: dict | None = None
    dbt_run_results: list[dict] | None = None


class DbtObjects(BaseModel):
    dbt_catalog: Any | None = None
    dbt_manifest: Any
    dbt_sources: Any | None = None
    dbt_run_results: list[Any] | None = None


class DbtFilteredModel(BaseModel):
    is_filtered: bool | None = False
    message: str | None = None
    model_fqn: str | None = None


class DbtMetaOpenmetadata(BaseModel):
    tier: str | None = None
    domain: str | None = None
    glossary: list[str] | None = None
    customProperties: dict[str, Any] | None = None  # noqa: N815
    tags: list[str] | None = None


class DbtMeta(BaseModel):
    openmetadata: DbtMetaOpenmetadata | None = None


class SnapshotNodeLocation(BaseModel):
    """Resolved schema and database for a dbt snapshot node after applying config overrides."""

    schema_: str
    database: str | None = None


class UpstreamNode(BaseModel):
    """An upstream dependency of a dbt node, keeping the dbt names alongside the table FQN.

    ``ref()``/``source()`` expressions carry the dbt *name*, while the FQN is built from
    the model *alias*, so both are needed to map a reference back to its table.
    """

    name: str
    qualified_name: str | None = None
    fqn: str
