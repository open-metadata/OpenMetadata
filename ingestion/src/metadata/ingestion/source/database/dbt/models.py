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

from typing import Any, List, Optional

from pydantic import BaseModel


class DbtFiles(BaseModel):
    dbt_catalog: Optional[dict] = None
    dbt_manifest: dict
    dbt_sources: Optional[dict] = None
    dbt_run_results: Optional[List[dict]] = None


class DbtObjects(BaseModel):
    dbt_catalog: Optional[Any] = None
    dbt_manifest: Any
    dbt_sources: Optional[Any] = None
    dbt_run_results: Optional[List[Any]] = None


class DbtFilteredModel(BaseModel):
    is_filtered: Optional[bool] = False
    message: Optional[str] = None
    model_fqn: Optional[str] = None


class DbtMetaGlossaryTier(BaseModel):
    tier: Optional[str] = None
    glossary: Optional[List[str]] = None


class DbtMeta(BaseModel):
    openmetadata: Optional[DbtMetaGlossaryTier] = None
