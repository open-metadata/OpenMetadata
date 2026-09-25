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
"""Models for the Rill runtime API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

if TYPE_CHECKING:
    from collections.abc import Iterator


class RillApiModel(BaseModel):
    """Base model for Rill's camel-cased API responses."""

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="before")
    @classmethod
    def _drop_nulls(cls, data: Any) -> Any:
        # Rill's JSON gateway emits null for unset maps and lists; fall back to the field default.
        if isinstance(data, dict):
            return {key: value for key, value in data.items() if value is not None}
        return data


class RillResourceName(RillApiModel):
    kind: str
    name: str


class RillResourceMeta(RillApiModel):
    name: RillResourceName
    refs: list[RillResourceName] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    file_paths: list[str] = Field(default_factory=list, alias="filePaths")


class RillExploreSpec(RillApiModel):
    display_name: str | None = Field(None, alias="displayName")
    description: str | None = None
    metrics_view: str | None = Field(None, alias="metricsView")


class RillExploreState(RillApiModel):
    valid_spec: RillExploreSpec | None = Field(None, alias="validSpec")


class RillExplore(RillApiModel):
    spec: RillExploreSpec | None = None
    state: RillExploreState | None = None

    @property
    def effective_spec(self) -> RillExploreSpec | None:
        return (self.state.valid_spec if self.state else None) or self.spec


class RillCanvasItem(RillApiModel):
    component: str
    defined_in_canvas: bool = Field(False, alias="definedInCanvas")


class RillCanvasTab(RillApiModel):
    name: str
    display_name: str | None = Field(None, alias="displayName")
    rows: list[RillCanvasRow] = Field(default_factory=list)


class RillCanvasTabGroup(RillApiModel):
    name: str
    tabs: list[RillCanvasTab] = Field(default_factory=list)


class RillCanvasRow(RillApiModel):
    items: list[RillCanvasItem] = Field(default_factory=list)
    tab_group: RillCanvasTabGroup | None = Field(None, alias="tabGroup")

    def iter_component_names(self) -> Iterator[str]:
        for item in self.items:
            yield item.component
        if self.tab_group:
            for tab in self.tab_group.tabs:
                for row in tab.rows:
                    yield from row.iter_component_names()


class RillCanvasSpec(RillApiModel):
    display_name: str | None = Field(None, alias="displayName")
    description: str | None = None
    rows: list[RillCanvasRow] = Field(default_factory=list)

    def iter_component_names(self) -> Iterator[str]:
        for row in self.rows:
            yield from row.iter_component_names()


class RillCanvasState(RillApiModel):
    valid_spec: RillCanvasSpec | None = Field(None, alias="validSpec")


class RillCanvas(RillApiModel):
    spec: RillCanvasSpec | None = None
    state: RillCanvasState | None = None

    @property
    def effective_spec(self) -> RillCanvasSpec | None:
        return (self.state.valid_spec if self.state else None) or self.spec


class RillComponentSpec(RillApiModel):
    display_name: str | None = Field(None, alias="displayName")
    description: str | None = None
    renderer: str | None = None
    renderer_properties: dict[str, Any] = Field(default_factory=dict, alias="rendererProperties")


class RillComponentState(RillApiModel):
    valid_spec: RillComponentSpec | None = Field(None, alias="validSpec")


class RillComponent(RillApiModel):
    spec: RillComponentSpec | None = None
    state: RillComponentState | None = None

    @property
    def effective_spec(self) -> RillComponentSpec | None:
        return (self.state.valid_spec if self.state else None) or self.spec


class RillDataType(RillApiModel):
    code: str | None = None
    nullable: bool | None = None
    raw_type: str | None = Field(None, alias="rawType")


class RillMetricsViewDimension(RillApiModel):
    name: str
    display_name: str | None = Field(None, alias="displayName")
    description: str | None = None
    column: str | None = None
    expression: str | None = None
    data_type: RillDataType | None = Field(None, alias="dataType")


class RillMetricsViewMeasure(RillApiModel):
    name: str
    display_name: str | None = Field(None, alias="displayName")
    description: str | None = None
    expression: str | None = None
    data_type: RillDataType | None = Field(None, alias="dataType")


class RillMetricsViewSpec(RillApiModel):
    parent: str | None = None
    connector: str | None = None
    database: str | None = None
    database_schema: str | None = Field(None, alias="databaseSchema")
    table: str | None = None
    model: str | None = None
    display_name: str | None = Field(None, alias="displayName")
    description: str | None = None
    time_dimension: str | None = Field(None, alias="timeDimension")
    dimensions: list[RillMetricsViewDimension] = Field(default_factory=list)
    measures: list[RillMetricsViewMeasure] = Field(default_factory=list)


class RillMetricsViewState(RillApiModel):
    valid_spec: RillMetricsViewSpec | None = Field(None, alias="validSpec")


class RillMetricsView(RillApiModel):
    spec: RillMetricsViewSpec | None = None
    state: RillMetricsViewState | None = None

    @property
    def effective_spec(self) -> RillMetricsViewSpec | None:
        return (self.state.valid_spec if self.state else None) or self.spec


class RillModelSpec(RillApiModel):
    input_connector: str | None = Field(None, alias="inputConnector")
    input_properties: dict[str, Any] = Field(default_factory=dict, alias="inputProperties")
    output_connector: str | None = Field(None, alias="outputConnector")
    output_properties: dict[str, Any] = Field(default_factory=dict, alias="outputProperties")


class RillModelState(RillApiModel):
    result_table: str | None = Field(None, alias="resultTable")


class RillModel(RillApiModel):
    spec: RillModelSpec | None = None
    state: RillModelState | None = None


class RillResource(RillApiModel):
    meta: RillResourceMeta
    explore: RillExplore | None = None
    canvas: RillCanvas | None = None
    component: RillComponent | None = None
    metrics_view: RillMetricsView | None = Field(None, alias="metricsView")
    model: RillModel | None = None


class RillListResourcesResponse(RillApiModel):
    resources: list[RillResource] = Field(default_factory=list)
    next_page_token: str | None = Field(None, alias="nextPageToken")


class RillGetResourceResponse(RillApiModel):
    resource: RillResource | None = None


RillCanvasTab.model_rebuild()
RillCanvasRow.model_rebuild()
