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

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------


class PageInfo(BaseModel):
    """Cursor pagination metadata returned by Omni list endpoints."""

    hasNextPage: bool | None = False  # noqa: N815
    nextCursor: str | None = None  # noqa: N815
    pageSize: int | None = None  # noqa: N815
    totalRecords: int | None = None  # noqa: N815


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class OmniModel(BaseModel):
    """An Omni model: the semantic layer built on a single connection."""

    id: str
    name: str | None = None
    modelKind: str | None = None  # noqa: N815
    connectionId: str | None = None  # noqa: N815
    baseModelId: str | None = None  # noqa: N815


class ModelsResponse(BaseModel):
    records: list[OmniModel] | None = Field(default_factory=list)
    pageInfo: PageInfo | None = None  # noqa: N815


# ---------------------------------------------------------------------------
# Normalized topic / field domain models (built from model YAML)
# ---------------------------------------------------------------------------


class OmniField(BaseModel):
    """A dimension or measure exposed by a topic."""

    name: str
    label: str | None = None
    data_type: str | None = None
    field_type: str | None = None  # "dimension" | "measure"
    description: str | None = None


class OmniTopic(BaseModel):
    """
    A curated, queryable dataset within a model (analogous to a Looker explore).

    ``base_schema``/``base_table`` are resolved from the topic's base view
    ``sql_table_name`` and are used to build warehouse table lineage.
    """

    model_id: str
    model_name: str | None = None
    name: str
    label: str | None = None
    description: str | None = None
    base_view: str | None = None
    base_schema: str | None = None
    base_table: str | None = None
    fields: list[OmniField] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Documents (workbooks / dashboards)
# ---------------------------------------------------------------------------


class OmniOwner(BaseModel):
    id: str | None = None
    name: str | None = None
    email: str | None = None


class OmniFolder(BaseModel):
    id: str | None = None
    name: str | None = None
    path: str | None = None


class OmniDocument(BaseModel):
    """An Omni document. Documents with ``hasDashboard`` carry a dashboard."""

    identifier: str
    name: str | None = None
    description: str | None = None
    type: str | None = None
    owner: OmniOwner | None = None
    folder: OmniFolder | None = None
    connectionId: str | None = None  # noqa: N815
    scope: str | None = None
    hasDashboard: bool | None = False  # noqa: N815
    url: str | None = None
    deleted: bool | None = False
    labels: list[str] | None = Field(default_factory=list)
    updatedAt: str | None = None  # noqa: N815


class DocumentsResponse(BaseModel):
    records: list[OmniDocument] | None = Field(default_factory=list)
    pageInfo: PageInfo | None = None  # noqa: N815


# ---------------------------------------------------------------------------
# Dashboard document (tiles / charts)
# ---------------------------------------------------------------------------


class OmniQuery(BaseModel):
    """The query backing a dashboard tile."""

    table: str | None = None  # base view / topic the tile queries
    fields: list[str] | None = Field(default_factory=list)
    limit: int | None = None


class QueryPresentation(BaseModel):
    """A dashboard tile."""

    name: str | None = None
    chartType: str | None = None  # noqa: N815
    query: OmniQuery | None = None


class OmniDashboardDocument(BaseModel):
    """The expanded dashboard view of a document (tiles + the model it uses)."""

    identifier: str | None = None
    name: str | None = None
    description: str | None = None
    modelId: str | None = None  # noqa: N815
    url: str | None = None
    queryPresentations: list[QueryPresentation] = Field(default_factory=list)  # noqa: N815
