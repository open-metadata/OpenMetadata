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
MicroStrategy Models

Only the fields the connector reads are required. The REST API adds and drops optional
keys between releases (a search result carries ``description`` only when one is set), so
everything else is optional: one odd object must not fail the validation of its siblings.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict

# The quick search gives dossiers and Report Services documents the same type (55) and subtype
# (14081); only viewMedia tells them apart. A dossier has bits 30 and 29 set and bits 31 and 27
# clear, the rule MicroStrategy's own SDK (mstrio-py, ``is_dashboard``) applies.
# ADR:2026-11-05-microstrategy-charts-are-named-by-dossier-and-the-search-is-paged
DOSSIER_VIEW_MEDIA_MASK = 0xE800_0000
DOSSIER_VIEW_MEDIA = 0x6000_0000


class MstrModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class MstrOwner(MstrModel):
    """
    MSTR owner model
    """

    id: str
    name: str | None = None


class MstrProject(MstrModel):
    """
    MSTR project model
    """

    id: str
    name: str


class MstrSearchResult(MstrModel):
    """
    Mstr Search Results model
    """

    id: str
    name: str
    description: str | None = None
    owner: MstrOwner | None = None
    viewMedia: int | None = None  # noqa: N815

    @property
    def is_dossier(self) -> bool:
        """A result without viewMedia is read as a dossier, as before the field was used"""
        return self.viewMedia is None or self.viewMedia & DOSSIER_VIEW_MEDIA_MASK == DOSSIER_VIEW_MEDIA


class MstrSearchPage(MstrModel):
    totalItems: int | None = None  # noqa: N815
    result: list[dict[str, Any]] | None = None


class MstrDashboard(MstrModel):
    """
    A dossier as listed by the quick search, labelled with the project it was listed under
    """

    id: str
    name: str
    description: str | None = None
    owner: MstrOwner | None = None
    projectId: str  # noqa: N815
    projectName: str  # noqa: N815


class MstrVisualization(MstrModel):
    key: str
    name: str
    visualizationType: str | None = None  # noqa: N815


class MstrPage(MstrModel):
    key: str
    name: str | None = None
    visualizations: list[MstrVisualization] = []


class MstrChapter(MstrModel):
    key: str
    name: str | None = None
    pages: list[MstrPage] = []


class MstrAvailableObject(MstrModel):
    id: str
    name: str
    type: str
    forms: list[dict[str, Any]] | None = None


class MstrDataset(MstrModel):
    id: str
    name: str
    availableObjects: list[MstrAvailableObject] | None = None  # noqa: N815


class MstrDashboardDetails(MstrModel):
    """
    A dossier definition, joined with what the search listed about it
    """

    id: str
    name: str
    projectId: str  # noqa: N815
    projectName: str  # noqa: N815
    description: str | None = None
    owner: MstrOwner | None = None
    chapters: list[MstrChapter] = []
    datasets: list[MstrDataset] = []
    # False when the definition could not be read: the dossier is still ingested from its
    # listing, but its charts and data models are unknown for this run.
    definition_read: bool = True
    # False when the dossier's current charts could not be read from OpenMetadata: its charts
    # and dashboard are left as they are in this run.
    charts_known: bool = True
