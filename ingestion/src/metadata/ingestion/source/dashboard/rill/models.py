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
"""Models for the Rill runtime API."""

from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional  # noqa: UP035

from pydantic import BaseModel, ConfigDict, Field


class RillApiModel(BaseModel):
    """Base model for Rill's camel-cased API responses."""

    model_config = ConfigDict(populate_by_name=True)


class RillResourceName(RillApiModel):
    kind: str
    name: str


class RillResourceMeta(RillApiModel):
    name: RillResourceName
    refs: List[RillResourceName] = Field(default_factory=list)  # noqa: UP006
    tags: List[str] = Field(default_factory=list)  # noqa: UP006
    file_paths: List[str] = Field(default_factory=list, alias="filePaths")  # noqa: UP006


class RillExploreSpec(RillApiModel):
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    metrics_view: Optional[str] = Field(None, alias="metricsView")  # noqa: UP045


class RillExploreState(RillApiModel):
    valid_spec: Optional[RillExploreSpec] = Field(None, alias="validSpec")  # noqa: UP045


class RillExplore(RillApiModel):
    spec: Optional[RillExploreSpec] = None  # noqa: UP045
    state: Optional[RillExploreState] = None  # noqa: UP045

    @property
    def effective_spec(self) -> Optional[RillExploreSpec]:  # noqa: UP045
        return (self.state.valid_spec if self.state else None) or self.spec


class RillCanvasItem(RillApiModel):
    component: str
    defined_in_canvas: bool = Field(False, alias="definedInCanvas")


class RillCanvasTab(RillApiModel):
    name: str
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    rows: List[RillCanvasRow] = Field(default_factory=list)  # noqa: UP006


class RillCanvasTabGroup(RillApiModel):
    name: str
    tabs: List[RillCanvasTab] = Field(default_factory=list)  # noqa: UP006


class RillCanvasRow(RillApiModel):
    items: List[RillCanvasItem] = Field(default_factory=list)  # noqa: UP006
    tab_group: Optional[RillCanvasTabGroup] = Field(None, alias="tabGroup")  # noqa: UP045

    def iter_component_names(self) -> Iterator[str]:
        for item in self.items:
            yield item.component
        if self.tab_group:
            for tab in self.tab_group.tabs:
                for row in tab.rows:
                    yield from row.iter_component_names()


class RillCanvasSpec(RillApiModel):
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    rows: List[RillCanvasRow] = Field(default_factory=list)  # noqa: UP006

    def iter_component_names(self) -> Iterator[str]:
        for row in self.rows:
            yield from row.iter_component_names()


class RillCanvasState(RillApiModel):
    valid_spec: Optional[RillCanvasSpec] = Field(None, alias="validSpec")  # noqa: UP045


class RillCanvas(RillApiModel):
    spec: Optional[RillCanvasSpec] = None  # noqa: UP045
    state: Optional[RillCanvasState] = None  # noqa: UP045

    @property
    def effective_spec(self) -> Optional[RillCanvasSpec]:  # noqa: UP045
        return (self.state.valid_spec if self.state else None) or self.spec


class RillComponentSpec(RillApiModel):
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    renderer: Optional[str] = None  # noqa: UP045
    renderer_properties: Dict[str, Any] = Field(default_factory=dict, alias="rendererProperties")  # noqa: UP006


class RillComponentState(RillApiModel):
    valid_spec: Optional[RillComponentSpec] = Field(None, alias="validSpec")  # noqa: UP045


class RillComponent(RillApiModel):
    spec: Optional[RillComponentSpec] = None  # noqa: UP045
    state: Optional[RillComponentState] = None  # noqa: UP045

    @property
    def effective_spec(self) -> Optional[RillComponentSpec]:  # noqa: UP045
        return (self.state.valid_spec if self.state else None) or self.spec


class RillDataType(RillApiModel):
    code: Optional[str] = None  # noqa: UP045
    nullable: Optional[bool] = None  # noqa: UP045
    raw_type: Optional[str] = Field(None, alias="rawType")  # noqa: UP045


class RillMetricsViewDimension(RillApiModel):
    name: str
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    column: Optional[str] = None  # noqa: UP045
    expression: Optional[str] = None  # noqa: UP045
    data_type: Optional[RillDataType] = Field(None, alias="dataType")  # noqa: UP045


class RillMetricsViewMeasure(RillApiModel):
    name: str
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    expression: Optional[str] = None  # noqa: UP045
    data_type: Optional[RillDataType] = Field(None, alias="dataType")  # noqa: UP045


class RillMetricsViewSpec(RillApiModel):
    parent: Optional[str] = None  # noqa: UP045
    connector: Optional[str] = None  # noqa: UP045
    database: Optional[str] = None  # noqa: UP045
    database_schema: Optional[str] = Field(None, alias="databaseSchema")  # noqa: UP045
    table: Optional[str] = None  # noqa: UP045
    model: Optional[str] = None  # noqa: UP045
    display_name: Optional[str] = Field(None, alias="displayName")  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045
    time_dimension: Optional[str] = Field(None, alias="timeDimension")  # noqa: UP045
    dimensions: List[RillMetricsViewDimension] = Field(default_factory=list)  # noqa: UP006
    measures: List[RillMetricsViewMeasure] = Field(default_factory=list)  # noqa: UP006


class RillMetricsViewState(RillApiModel):
    valid_spec: Optional[RillMetricsViewSpec] = Field(None, alias="validSpec")  # noqa: UP045


class RillMetricsView(RillApiModel):
    spec: Optional[RillMetricsViewSpec] = None  # noqa: UP045
    state: Optional[RillMetricsViewState] = None  # noqa: UP045

    @property
    def effective_spec(self) -> Optional[RillMetricsViewSpec]:  # noqa: UP045
        return (self.state.valid_spec if self.state else None) or self.spec


class RillModelSpec(RillApiModel):
    input_connector: Optional[str] = Field(None, alias="inputConnector")  # noqa: UP045
    input_properties: Dict[str, Any] = Field(default_factory=dict, alias="inputProperties")  # noqa: UP006
    output_connector: Optional[str] = Field(None, alias="outputConnector")  # noqa: UP045
    output_properties: Dict[str, Any] = Field(default_factory=dict, alias="outputProperties")  # noqa: UP006


class RillModelState(RillApiModel):
    result_table: Optional[str] = Field(None, alias="resultTable")  # noqa: UP045


class RillModel(RillApiModel):
    spec: Optional[RillModelSpec] = None  # noqa: UP045
    state: Optional[RillModelState] = None  # noqa: UP045


class RillResource(RillApiModel):
    meta: RillResourceMeta
    explore: Optional[RillExplore] = None  # noqa: UP045
    canvas: Optional[RillCanvas] = None  # noqa: UP045
    component: Optional[RillComponent] = None  # noqa: UP045
    metrics_view: Optional[RillMetricsView] = Field(None, alias="metricsView")  # noqa: UP045
    model: Optional[RillModel] = None  # noqa: UP045


class RillListResourcesResponse(RillApiModel):
    resources: List[RillResource] = Field(default_factory=list)  # noqa: UP006
    next_page_token: Optional[str] = Field(None, alias="nextPageToken")  # noqa: UP045


class RillGetResourceResponse(RillApiModel):
    resource: Optional[RillResource] = None  # noqa: UP045


RillCanvasTab.model_rebuild()
RillCanvasRow.model_rebuild()
