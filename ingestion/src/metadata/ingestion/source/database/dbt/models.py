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

from typing import Any, Dict, List, Optional  # noqa: UP035

from pydantic import BaseModel


class DbtFiles(BaseModel):
    dbt_catalog: Optional[dict] = None  # noqa: UP045
    dbt_manifest: dict
    dbt_sources: Optional[dict] = None  # noqa: UP045
    dbt_run_results: Optional[List[dict]] = None  # noqa: UP006, UP045


class DbtObjects(BaseModel):
    dbt_catalog: Optional[Any] = None  # noqa: UP045
    dbt_manifest: Any
    dbt_sources: Optional[Any] = None  # noqa: UP045
    dbt_run_results: Optional[List[Any]] = None  # noqa: UP006, UP045


class DbtFilteredModel(BaseModel):
    is_filtered: Optional[bool] = False  # noqa: UP045
    message: Optional[str] = None  # noqa: UP045
    model_fqn: Optional[str] = None  # noqa: UP045


class DbtMetaOpenmetadata(BaseModel):
    tier: Optional[str] = None  # noqa: UP045
    domain: Optional[str] = None  # noqa: UP045
    glossary: Optional[List[str]] = None  # noqa: UP006, UP045
    customProperties: Optional[Dict[str, Any]] = None  # noqa: N815, UP006, UP045
    tags: Optional[List[str]] = None  # noqa: UP006, UP045


class DbtMeta(BaseModel):
    openmetadata: Optional[DbtMetaOpenmetadata] = None  # noqa: UP045


class SnapshotNodeLocation(BaseModel):
    """Resolved schema and database for a dbt snapshot node after applying config overrides."""

    schema_: str
    database: Optional[str] = None  # noqa: UP045
