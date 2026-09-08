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
"""Omni source module -- ingests models/topics as data models, documents as
dashboards with charts, and builds lineage from warehouse tables through
topics to dashboards."""

import traceback
from collections import defaultdict
from collections.abc import Iterable

from cachetools import LRUCache
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
from metadata.ingestion.models.barrier import Barrier
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.omni.client import canonical_ref
from metadata.ingestion.source.dashboard.omni.models import (
    OmniDashboardDocument,
    OmniDocument,
    OmniField,
    OmniTopic,
    QueryPresentation,
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

# Project name for documents that don't live in a folder. Must be non-null so the
# base class does not filter folderless dashboards out via projectFilterPattern.
DEFAULT_PROJECT = "default"

# Bound the data model entity cache so it cannot grow unbounded on large catalogs.
DATAMODEL_CACHE_SIZE = 1000

# Marker the bulk data-model producer appends after all topics so the processor
# can emit data-model -> table lineage once every data model has been written,
# independent of whether the instance has any dashboards.
_DATAMODEL_LINEAGE_SENTINEL = object()

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


def _fold_display_name(name: str | None) -> str:
    """Fold a user display name for matching between the two Omni directories."""
    return (name or "").strip().casefold()


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
        pipeline_name: str | None = None,
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: OmniConnection = config.serviceConnection.root.config  # pyright: ignore[reportAssignmentType,reportOptionalMemberAccess]
        if not isinstance(connection, OmniConnection):
            raise InvalidSourceException(f"Expected OmniConnection, but got {connection}")
        return cls(config, metadata)

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        super().__init__(config, metadata)
        self.topics: list[OmniTopic] = []
        # Maps a tile reference -> list of matching topics. A list, not a single
        # value, so we can detect cross-model name collisions and avoid silently
        # misrouting lineage to the wrong model's data model. The two indexes are
        # kept apart so a reference that names a data model outright wins over one
        # that only matches another data model's base view.
        self._topic_name_index: dict = defaultdict(list)
        self._topic_alias_index: dict = defaultdict(list)
        # Owner email by folded display name, and the resolved owner references.
        self._owner_email_by_name: dict = {}
        self._owner_ref_cache: dict = {}
        # Track which db-service prefixes have had table lineage emitted, so each
        # configured dbServicePrefix is attempted exactly once.
        self._datamodel_table_lineage_prefixes: set = set()
        # Bounded cache of resolved data model entities (negative caching included).
        self._datamodel_cache: LRUCache = LRUCache(maxsize=DATAMODEL_CACHE_SIZE)

    def prepare(self):
        """Fetch models and resolve their topics once, up front.

        The data-model filter pattern is applied here, once, so a filtered-out
        topic is absent everywhere downstream (bulk data models, the lineage
        index and lineage emission) rather than being filtered inconsistently.
        """
        for model in self.client.get_models() or []:
            for topic in self.client.get_model_topics(model) or []:
                datamodel_name = self._datamodel_name(topic)
                if filter_by_datamodel(self.source_config.dataModelFilterPattern, datamodel_name):
                    self.status.filter(datamodel_name, "Data model (Topic) filtered out.")
                    continue
                self.topics.append(topic)
                for key in self._topic_name_keys(topic):
                    self._topic_name_index[key].append(topic)
                for key in self._topic_alias_keys(topic):
                    self._topic_alias_index[key].append(topic)
        logger.info("Fetched %d Omni topics across models", len(self.topics))
        if self.source_config.includeOwners:
            self._load_owner_emails()

    @classmethod
    def _topic_name_keys(cls, topic: OmniTopic) -> set[str]:
        """Reference keys that name this topic/view itself.

        Includes the bare name and, when the base schema is known, the
        schema-qualified form (``schema.name``). Indexing the qualified form lets a
        qualified reference resolve to the correct schema's topic instead of being
        stripped to a bare leaf that could match an unrelated model/schema.
        """
        keys = {canonical_ref(topic.name)}
        if topic.base_schema:
            keys.add(canonical_ref(f"{topic.base_schema}.{topic.name}"))
        return keys

    @classmethod
    def _topic_alias_keys(cls, topic: OmniTopic) -> set[str]:
        """Reference keys that point at this topic's base view rather than itself.

        A curated topic and the physical view it sits on are both ingested as data
        models, so a reference naming that view must not be treated as ambiguous
        between the two -- it belongs to the view.
        """
        if not topic.base_view:
            return set()
        keys = {canonical_ref(topic.base_view)}
        if topic.base_schema:
            keys.add(canonical_ref(f"{topic.base_schema}.{topic.base_view}"))
        return keys - cls._topic_name_keys(topic)

    # -- data models (topics) ----------------------------------------------

    def list_datamodels(self) -> Iterable:
        """Producer for the bulk data model topology node."""
        if not self.source_config.includeDataModels:
            return
        # Topics are already filtered in prepare(); emit them all, then a sentinel
        # so the processor can draw table lineage once they are persisted (even when
        # the instance has no dashboards).
        yield from self.topics
        yield _DATAMODEL_LINEAGE_SENTINEL

    @staticmethod
    def _datamodel_name(topic: OmniTopic) -> str:
        # Qualify by model so identically-named views/topics in different models do
        # not collide on the same data model FQN (and so lineage cannot misroute).
        return f"{topic.model_name or topic.model_id}.{topic.name}"

    def _resolve_topic(self, table_ref: str | None) -> OmniTopic | None:
        """Resolve a tile's table/view reference to a single topic.

        Returns None when the reference is unknown or ambiguous across models, so we
        never attach lineage to the wrong model's data model.
        """
        if not table_ref:
            return None
        # Both bare and schema-qualified forms are indexed in prepare(), so a
        # qualified reference matches the correct schema's topic. We deliberately do
        # NOT strip a qualifier down to its bare leaf: that could match an unrelated
        # topic and misroute lineage, so an unmatched qualified reference is left
        # unresolved instead.
        key = canonical_ref(table_ref)
        for index in (self._topic_name_index, self._topic_alias_index):
            matches: list[OmniTopic] = index.get(key) or []
            if len(matches) == 1:
                return matches[0]
            if len(matches) > 1:
                logger.warning(
                    "Ambiguous tile reference %r across %d models; skipping lineage",
                    table_ref,
                    len(matches),
                )
                return None
        return None

    def _get_columns(self, fields: list[OmniField]) -> list[Column]:
        columns: list[Column] = []
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
                logger.warning("Error building column %s: %s", field.name, exc)
        return columns

    def yield_bulk_datamodel(self, model) -> Iterable[Either]:
        # The producer appends a sentinel after all topics: once we see it, every
        # data model has been yielded, so we flush and draw table lineage. This
        # makes table lineage independent of whether any dashboard exists.
        if model is _DATAMODEL_LINEAGE_SENTINEL:
            yield from self._yield_bulk_datamodel_lineage()
            return
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

    def _yield_bulk_datamodel_lineage(self) -> Iterable[Either]:
        """Flush the written data models, then draw their warehouse-table lineage.

        Runs in the bulk data-model stage (before any dashboard is processed), so
        table lineage is emitted even for models/topics that no dashboard uses.
        """
        # Persist the data models buffered by this stage before resolving them.
        yield Either(right=Barrier(reason="omni_datamodel_lineage_flush"))
        for db_service_prefix in self.get_db_service_prefixes() or [None]:
            for lineage in self._yield_datamodel_table_lineage(db_service_prefix) or []:
                yield from self.yield_lineage_request(lineage)

    def _yield_datamodel_table_lineage(
        self, db_service_prefix: str | None = None
    ) -> Iterable[Either[AddLineageRequest]]:
        """Yield warehouse-table -> data-model lineage for every topic that resolves
        to a physical table, once per configured db-service prefix."""
        prefix_key = db_service_prefix or "__none__"
        if prefix_key in self._datamodel_table_lineage_prefixes:
            return
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

    # -- dashboards ---------------------------------------------------------

    def get_dashboards_list(self) -> list[OmniDocument] | None:
        dashboards = []
        for doc in self.client.get_documents() or []:
            if not doc.hasDashboard or doc.deleted:
                continue
            if filter_by_dashboard(self.source_config.dashboardFilterPattern, doc.name or doc.identifier):
                self.status.filter(doc.name or doc.identifier, "Dashboard Pattern not allowed")
                continue
            dashboards.append(doc)
        return dashboards

    def get_dashboard_name(self, dashboard: OmniDocument) -> str | None:
        return dashboard.name or dashboard.identifier

    def get_project_name(self, dashboard_details: OmniDashboardDetails) -> str | None:
        """Project = the Omni folder the document lives in.

        Returns a non-null value even for folderless documents: the base
        ``DashboardServiceSource`` filters out a dashboard whenever a (possibly
        empty) ``projectFilterPattern`` is set and the project name is null, which
        would silently drop every folderless dashboard.
        """
        folder = dashboard_details.document.folder if dashboard_details and dashboard_details.document else None
        if folder and (folder.path or folder.name):
            return folder.path or folder.name
        return DEFAULT_PROJECT

    def get_dashboard_details(self, dashboard: OmniDocument) -> OmniDashboardDetails | None:
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
        owners = self.get_owner_ref(dashboard_details=dashboard_details)
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
                    owners=owners,
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
        db_service_prefix: str | None = None,
    ) -> Table | None:
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
            logger.warning("Error resolving table for topic %s: %s", topic.name, exc)
        return None

    def _get_datamodel_entity(self, topic: OmniTopic) -> DashboardDataModel | None:
        """Resolve (and cache) the persisted data model entity for a topic."""
        key = self._datamodel_name(topic)
        if key not in self._datamodel_cache:
            datamodel_fqn = fqn.build(
                self.metadata,
                entity_type=DashboardDataModel,
                service_name=self.context.get().dashboard_service,
                data_model_name=key,
            )
            self._datamodel_cache[key] = (
                self.metadata.get_by_name(entity=DashboardDataModel, fqn=datamodel_fqn) if datamodel_fqn else None
            )
        return self._datamodel_cache[key]

    def yield_dashboard_lineage_details(
        self,
        dashboard_details: OmniDashboardDetails,
        db_service_prefix: str | None = None,
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

        # Data-model -> warehouse-table lineage is emitted from the bulk data-model
        # stage (see ``_yield_bulk_datamodel_lineage``) so it does not depend on a
        # dashboard being present. Here we only draw dashboard <- data-model edges
        # for the tiles of this dashboard.
        seen_topics = set()
        for tile in dashboard_details.dashboard.queryPresentations or []:
            for topic in self._tile_topics(tile):
                if self._datamodel_name(topic) in seen_topics:
                    continue
                seen_topics.add(self._datamodel_name(topic))
                try:
                    datamodel_entity = self._get_datamodel_entity(topic)
                    if datamodel_entity and dashboard_entity:
                        lineage = self._get_add_lineage_request(
                            to_entity=dashboard_entity, from_entity=datamodel_entity
                        )
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

    def _tile_topics(self, tile: QueryPresentation) -> Iterable[OmniTopic]:
        """Resolve every data model a tile reads.

        A tile's ``query.table`` can name a workbook-local query view that is absent
        from the shared model, while the tile's field references
        (``<schema>__<view>.<field>``) still name real views. Reading both keeps a
        dashboard connected to the views it queries through joins, as the Looker
        connector does when it walks an explore's joins.
        """
        if not tile.query:
            return
        refs = [tile.query.table]
        refs.extend(field.split(".")[0] for field in tile.query.fields or [] if "." in field)
        # Distinct references can resolve to the same data model (a bare view name
        # and its schema-qualified handle), so dedupe on what they resolve to.
        seen: set[str] = set()
        for ref in refs:
            topic = self._resolve_topic(ref) if ref else None
            if not topic or self._datamodel_name(topic) in seen:
                continue
            seen.add(self._datamodel_name(topic))
            yield topic

    # -- owners -------------------------------------------------------------

    def _load_owner_emails(self) -> None:
        """Index user emails by display name, dropping names shared by several users.

        The document payload identifies an owner by ``id`` and ``name`` only, and
        that ``id`` is not the SCIM user id, so the display name is the only key
        the two directories share.
        """
        emails: dict[str, str | None] = {}
        for user in self.client.get_users() or []:
            name = _fold_display_name(user.displayName)
            email = user.primary_email
            if not name or not email:
                continue
            if name in emails and emails[name] != email:
                emails[name] = None
                logger.debug("Omni display name %r maps to several users; ignoring it", user.displayName)
                continue
            emails[name] = email
        self._owner_email_by_name = {name: email for name, email in emails.items() if email}
        logger.info("Resolved %d Omni owner emails", len(self._owner_email_by_name))

    def get_owner_ref(self, dashboard_details: OmniDashboardDetails) -> EntityReferenceList | None:
        try:
            if not self.source_config.includeOwners or not dashboard_details:
                return None
            owner = dashboard_details.document.owner
            if not owner:
                return None
            email = self._owner_email_by_name.get(_fold_display_name(owner.name))
            if not email:
                logger.debug("No email found for Omni owner %r", owner.name)
                return None
            if email not in self._owner_ref_cache:
                self._owner_ref_cache[email] = self.metadata.get_reference_by_email(email)
            return self._owner_ref_cache[email]
        except Exception as exc:  # pylint: disable=broad-except
            logger.debug(traceback.format_exc())
            logger.warning("Could not fetch owner: %s", exc)
        return None
