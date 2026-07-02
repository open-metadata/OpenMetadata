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
"""Omni source module — ingests models/topics as data models, documents as
dashboards with charts, and builds lineage from warehouse tables through
topics to dashboards."""

import traceback
from collections import defaultdict
from typing import Iterable, List, Optional  # noqa: UP035

from pydantic import BaseModel

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import (
    DashboardDataModel,
    DataModelType,
)
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.dashboard.omniConnection import (
    OmniConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
    SourceUrl,
)
from metadata.generated.schema.type.entityReferenceList import EntityReferenceList
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.omni.models import (
    OmniDashboardDocument,
    OmniDocument,
    OmniField,
    OmniTopic,
)
from metadata.ingestion.source.database.column_helpers import truncate_column_name
from metadata.utils import fqn
from metadata.utils.filters import (
    filter_by_chart,
    filter_by_dashboard,
    filter_by_datamodel,
)
from metadata.utils.fqn import build_es_fqn_search_string
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Map Omni field data types to OpenMetadata column types.
OMNI_DATATYPE_MAP = {
    "string": DataType.STRING,
    "number": DataType.DOUBLE,
    "integer": DataType.INT,
    "int": DataType.INT,
    "float": DataType.FLOAT,
    "double": DataType.DOUBLE,
    "boolean": DataType.BOOLEAN,
    "date": DataType.DATE,
    "datetime": DataType.DATETIME,
    "timestamp": DataType.TIMESTAMP,
}


class OmniDashboardDetails(BaseModel):
    """Wrapper pairing a document with its expanded dashboard payload."""

    document: OmniDocument
    dashboard: OmniDashboardDocument


class OmniSource(DashboardServiceSource):
    """Omni Source Class."""

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: OmniConnection = config.serviceConnection.root.config
        if not isinstance(connection, OmniConnection):
            raise InvalidSourceException(f"Expected OmniConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.topics: List[OmniTopic] = []  # noqa: UP006
        # Maps a tile reference (view or topic name) -> list of matching topics.
        # A list, not a single value, so we can detect cross-model name collisions
        # and avoid silently misrouting lineage to the wrong model's data model.
        self._topic_index: dict = defaultdict(list)
        # Track which db-service prefixes have had table lineage emitted, so each
        # configured dbServicePrefix is attempted exactly once.
        self._datamodel_table_lineage_prefixes: set = set()

    def prepare(self):
        """Fetch models and resolve their topics once, up front."""
        for model in self.client.get_models() or []:
            for topic in self.client.get_model_topics(model) or []:
                self.topics.append(topic)
                if topic.base_view:
                    self._topic_index[topic.base_view].append(topic)
                if topic.name != topic.base_view:
                    self._topic_index[topic.name].append(topic)
        logger.info(f"Fetched {len(self.topics)} Omni topics across models")

    # -- data models (topics) ----------------------------------------------

    def list_datamodels(self) -> Iterable[OmniTopic]:
        """Producer for the bulk data model topology node."""
        if not self.source_config.includeDataModels:
            return
        for topic in self.topics:
            datamodel_name = self._datamodel_name(topic)
            if filter_by_datamodel(self.source_config.dataModelFilterPattern, datamodel_name):
                self.status.filter(datamodel_name, "Data model (Topic) filtered out.")
                continue
            yield topic

    @staticmethod
    def _datamodel_name(topic: OmniTopic) -> str:
        # Qualify by model so identically-named views/topics in different models do
        # not collide on the same data model FQN (and so lineage cannot misroute).
        return f"{topic.model_name or topic.model_id}.{topic.name}"

    def _resolve_topic(self, table_ref: Optional[str]) -> Optional[OmniTopic]:  # noqa: UP045
        """Resolve a tile's table/view reference to a single topic.

        Returns None when the reference is unknown or ambiguous across models, so we
        never attach lineage to the wrong model's data model.
        """
        if not table_ref:
            return None
        matches = self._topic_index.get(table_ref) or []
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            logger.debug(f"Ambiguous tile reference {table_ref!r} across {len(matches)} models; skipping lineage")
        return None

    def _get_columns(self, fields: List[OmniField]) -> List[Column]:  # noqa: UP006
        columns: List[Column] = []  # noqa: UP006
        for field in fields or []:
            try:
                columns.append(
                    Column(
                        name=truncate_column_name(field.name),
                        displayName=field.label or field.name,
                        dataType=OMNI_DATATYPE_MAP.get((field.data_type or "").lower(), DataType.UNKNOWN),
                        dataTypeDisplay=field.data_type or field.field_type or "Omni Field",
                        description=Markdown(field.description) if field.description else None,
                    )
                )
            except Exception as exc:  # pylint: disable=broad-except
                logger.debug(traceback.format_exc())
                logger.warning(f"Error building column {field.name}: {exc}")
        return columns

    def yield_bulk_datamodel(self, model: OmniTopic) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        try:
            datamodel_request = CreateDashboardDataModelRequest(
                name=EntityName(self._datamodel_name(model)),
                displayName=model.label or model.name,
                description=Markdown(model.description) if model.description else None,
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                dataModelType=DataModelType.OmniDataModel.value,
                serviceType=self.service_connection.type.value,
                columns=self._get_columns(model.fields),
                project=model.model_name,
            )
            yield Either(right=datamodel_request)
            self.register_record_datamodel(datamodel_request=datamodel_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name=model.name,
                    error=f"Error yielding Data Model [{model.name}]: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    # -- dashboards ---------------------------------------------------------

    def get_dashboards_list(self) -> Optional[List[OmniDocument]]:  # noqa: UP006, UP045
        dashboards = []
        for doc in self.client.get_documents() or []:
            if not doc.hasDashboard or doc.deleted:
                continue
            if filter_by_dashboard(self.source_config.dashboardFilterPattern, doc.name or doc.identifier):
                self.status.filter(doc.name or doc.identifier, "Dashboard Pattern not allowed")
                continue
            dashboards.append(doc)
        return dashboards

    def get_dashboard_name(self, dashboard: OmniDocument) -> Optional[str]:  # noqa: UP045
        return dashboard.name or dashboard.identifier

    def get_dashboard_details(self, dashboard: OmniDocument) -> Optional[OmniDashboardDetails]:  # noqa: UP045
        dashboard_doc = self.client.get_dashboard_document(dashboard.identifier)
        if not dashboard_doc:
            return None
        return OmniDashboardDetails(document=dashboard, dashboard=dashboard_doc)

    def yield_dashboard(self, dashboard_details: OmniDashboardDetails) -> Iterable[Either[CreateDashboardRequest]]:
        if not dashboard_details:
            return
        document = dashboard_details.document
        try:
            dashboard_request = CreateDashboardRequest(
                name=EntityName(document.identifier),
                displayName=document.name,
                description=Markdown(document.description) if document.description else None,
                charts=[
                    FullyQualifiedEntityName(
                        fqn.build(
                            self.metadata,
                            entity_type=Chart,
                            service_name=self.context.get().dashboard_service,
                            chart_name=chart,
                        )
                    )
                    for chart in self.context.get().charts or []
                ],
                service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                sourceUrl=SourceUrl(document.url) if document.url else None,
                owners=self.get_owner_ref(dashboard_details=dashboard_details),
            )
            yield Either(right=dashboard_request)
            self.register_record(dashboard_request=dashboard_request)
        except Exception as exc:  # pylint: disable=broad-except
            yield Either(
                left=StackTraceError(
                    name="Dashboard",
                    error=f"Error yielding dashboard for {document.identifier}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )

    def yield_dashboard_chart(self, dashboard_details: OmniDashboardDetails) -> Iterable[Either[CreateChartRequest]]:
        if not dashboard_details:
            return
        document = dashboard_details.document
        for idx, tile in enumerate(dashboard_details.dashboard.queryPresentations or []):
            try:
                chart_display = tile.name or f"Tile {idx}"
                if filter_by_chart(self.source_config.chartFilterPattern, chart_display):
                    self.status.filter(chart_display, "Chart Pattern not allowed")
                    continue
                chart_request = CreateChartRequest(
                    name=EntityName(f"{document.identifier}.{idx}"),
                    displayName=chart_display,
                    chartType=get_standard_chart_type(tile.chartType) if tile.chartType else None,
                    service=FullyQualifiedEntityName(self.context.get().dashboard_service),
                    sourceUrl=SourceUrl(document.url) if document.url else None,
                )
                yield Either(right=chart_request)
                self.register_record_chart(chart_request=chart_request)
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name="Chart",
                        error=f"Error yielding chart {idx} for {document.identifier}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    # -- lineage ------------------------------------------------------------

    def _get_table_entity(
        self,
        topic: OmniTopic,
        db_service_prefix: Optional[str] = None,  # noqa: UP045
    ) -> Optional[Table]:  # noqa: UP045
        """Resolve a topic's base view to a warehouse table entity."""
        if not topic.base_table:
            return None
        (
            prefix_service_name,
            prefix_database_name,
            prefix_schema_name,
            prefix_table_name,
        ) = self.parse_db_service_prefix(db_service_prefix)
        try:
            fqn_search_string = build_es_fqn_search_string(
                service_name=prefix_service_name or "*",
                database_name=prefix_database_name,
                schema_name=prefix_schema_name or topic.base_schema,
                table_name=prefix_table_name or topic.base_table,
            )
            return self.metadata.search_in_any_service(
                entity_type=Table,
                fqn_search_string=fqn_search_string,
            )
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Error resolving table for topic {topic.name}: {exc}")
        return None

    def _get_datamodel_entity(self, topic: OmniTopic) -> Optional[DashboardDataModel]:  # noqa: UP045
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=self.context.get().dashboard_service,
            data_model_name=self._datamodel_name(topic),
        )
        if datamodel_fqn:
            return self.metadata.get_by_name(entity=DashboardDataModel, fqn=datamodel_fqn)
        return None

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: OmniDashboardDetails,
        db_service_prefix: Optional[str] = None,  # noqa: UP045
    ) -> Iterable[Either[AddLineageRequest]]:
        """Yield warehouse-table -> topic -> dashboard lineage for this dashboard."""
        if not dashboard_details:
            return

        dashboard_fqn = fqn.build(
            self.metadata,
            entity_type=Dashboard,
            service_name=self.context.get().dashboard_service,
            dashboard_name=dashboard_details.document.identifier,
        )
        dashboard_entity = self.metadata.get_by_name(entity=Dashboard, fqn=dashboard_fqn)

        # Emit data-model -> warehouse-table lineage for every view/topic, once per
        # configured db-service prefix. Data models are persisted by now (the base
        # class flushes a Barrier before the lineage stage), so this is independent
        # of which dashboard uses them. The base class calls this method once per
        # entry in dbServicePrefixes, so we de-dupe on the prefix.
        # NOTE: this runs during dashboard lineage processing; an instance with a
        # model but zero dashboards still gets data models, but table lineage is only
        # emitted once at least one dashboard is processed.
        prefix_key = db_service_prefix or "__none__"
        if prefix_key not in self._datamodel_table_lineage_prefixes:
            self._datamodel_table_lineage_prefixes.add(prefix_key)
            for topic in self.topics:
                if not topic.base_table:
                    continue
                datamodel_entity = self._get_datamodel_entity(topic)
                table_entity = self._get_table_entity(topic, db_service_prefix)
                if datamodel_entity and table_entity:
                    lineage = self._get_add_lineage_request(to_entity=datamodel_entity, from_entity=table_entity)
                    if lineage:
                        yield lineage

        seen_topics = set()
        for tile in dashboard_details.dashboard.queryPresentations or []:
            table_ref = tile.query.table if tile.query else None
            topic = self._resolve_topic(table_ref)
            if not topic or self._datamodel_name(topic) in seen_topics:
                continue
            seen_topics.add(self._datamodel_name(topic))
            try:
                datamodel_entity = self._get_datamodel_entity(topic)
                if datamodel_entity and dashboard_entity:
                    lineage = self._get_add_lineage_request(to_entity=dashboard_entity, from_entity=datamodel_entity)
                    if lineage:
                        yield lineage
            except Exception as exc:  # pylint: disable=broad-except
                yield Either(
                    left=StackTraceError(
                        name=f"{dashboard_details.document.identifier} Lineage",
                        error=f"Error yielding lineage for topic {topic.name}: {exc}",
                        stackTrace=traceback.format_exc(),
                    )
                )

    # -- owners -------------------------------------------------------------

    def get_owner_ref(self, dashboard_details: OmniDashboardDetails) -> Optional[EntityReferenceList]:  # noqa: UP045
        try:
            if not self.source_config.includeOwners:
                return None
            owner = dashboard_details.document.owner
            if owner and owner.email:
                return self.metadata.get_reference_by_email(owner.email)
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning(f"Could not fetch owner: {exc}")
        return None
