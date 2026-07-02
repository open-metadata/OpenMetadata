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
Omni API models.

Two layers of models:
- Raw API payload models (``OmniModel``, ``OmniDocument``, ``OmniDashboardDocument``)
  that mirror the JSON returned by the Omni REST API.
- Normalized domain models (``OmniTopic``, ``OmniField``) that the source builds
  from the model YAML so that ``metadata.py`` never has to deal with the raw,
  loosely-typed YAML structure.
"""

from typing import List, Optional  # noqa: UP035

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class PageInfo(BaseModel):
    """Cursor pagination metadata returned by Omni list endpoints."""

    hasNextPage: Optional[bool] = False  # noqa: N815, UP045
    nextCursor: Optional[str] = None  # noqa: N815, UP045
    pageSize: Optional[int] = None  # noqa: N815, UP045
    totalRecords: Optional[int] = None  # noqa: N815, UP045


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class OmniModel(BaseModel):
    """An Omni model: the semantic layer built on a single connection."""

    id: str
    name: Optional[str] = None  # noqa: UP045
    modelKind: Optional[str] = None  # noqa: N815, UP045
    connectionId: Optional[str] = None  # noqa: N815, UP045
    baseModelId: Optional[str] = None  # noqa: N815, UP045


class ModelsResponse(BaseModel):
    records: Optional[List[OmniModel]] = Field(default_factory=list)  # noqa: UP006, UP045
    pageInfo: Optional[PageInfo] = None  # noqa: N815, UP045


# ---------------------------------------------------------------------------
# Normalized topic / field domain models (built from model YAML)
# ---------------------------------------------------------------------------


class OmniField(BaseModel):
    """A dimension or measure exposed by a topic."""

    name: str
    label: Optional[str] = None  # noqa: UP045
    data_type: Optional[str] = None  # noqa: UP045
    field_type: Optional[str] = None  # "dimension" | "measure"  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045


class OmniTopic(BaseModel):
    """
    A curated, queryable dataset within a model (analogous to a Looker explore).

    ``base_schema``/``base_table`` are resolved from the topic's base view
    ``sql_table_name`` and are used to build warehouse table lineage.
    """

    model_id: str
    model_name: Optional[str] = None  # noqa: UP045
    name: str
    label: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    base_view: Optional[str] = None  # noqa: UP045
    base_schema: Optional[str] = None  # noqa: UP045
    base_table: Optional[str] = None  # noqa: UP045
    fields: List[OmniField] = Field(default_factory=list)  # noqa: UP006


# ---------------------------------------------------------------------------
# Documents (workbooks / dashboards)
# ---------------------------------------------------------------------------


class OmniOwner(BaseModel):
    id: Optional[str] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    email: Optional[str] = None  # noqa: UP045


class OmniFolder(BaseModel):
    id: Optional[str] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    path: Optional[str] = None  # noqa: UP045


class OmniDocument(BaseModel):
    """An Omni document. Documents with ``hasDashboard`` carry a dashboard."""

    identifier: str
    name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    type: Optional[str] = None  # noqa: UP045
    owner: Optional[OmniOwner] = None  # noqa: UP045
    folder: Optional[OmniFolder] = None  # noqa: UP045
    connectionId: Optional[str] = None  # noqa: N815, UP045
    scope: Optional[str] = None  # noqa: UP045
    hasDashboard: Optional[bool] = False  # noqa: N815, UP045
    url: Optional[str] = None  # noqa: UP045
    deleted: Optional[bool] = False  # noqa: UP045
    labels: Optional[List[str]] = Field(default_factory=list)  # noqa: UP006, UP045
    updatedAt: Optional[str] = None  # noqa: N815, UP045


class DocumentsResponse(BaseModel):
    records: Optional[List[OmniDocument]] = Field(default_factory=list)  # noqa: UP006, UP045
    pageInfo: Optional[PageInfo] = None  # noqa: N815, UP045


# ---------------------------------------------------------------------------
# Dashboard document (tiles / charts)
# ---------------------------------------------------------------------------


class OmniQuery(BaseModel):
    """The query backing a dashboard tile."""

    table: Optional[str] = None  # base view / topic the tile queries  # noqa: UP045
    fields: Optional[List[str]] = Field(default_factory=list)  # noqa: UP006, UP045
    limit: Optional[int] = None  # noqa: UP045


class QueryPresentation(BaseModel):
    """A dashboard tile."""

    name: Optional[str] = None  # noqa: UP045
    chartType: Optional[str] = None  # noqa: N815, UP045
    query: Optional[OmniQuery] = None  # noqa: UP045


class OmniDashboardDocument(BaseModel):
    """The expanded dashboard view of a document (tiles + the model it uses)."""

    identifier: Optional[str] = None  # noqa: UP045
    name: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    modelId: Optional[str] = None  # noqa: N815, UP045
    url: Optional[str] = None  # noqa: UP045
    queryPresentations: List[QueryPresentation] = Field(default_factory=list)  # noqa: N815, UP006
