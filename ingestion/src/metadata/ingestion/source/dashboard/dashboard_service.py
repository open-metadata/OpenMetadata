#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Base class for ingesting dashboard services
"""
import traceback
from abc import ABC, abstractmethod
from typing import Any, Iterable, List, Optional, Set, Union

from pydantic import BaseModel

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.api.services.createDashboardService import (
    CreateDashboardServiceRequest,
)
from metadata.generated.schema.entity.data.chart import Chart
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.dashboardService import (
    DashboardConnection,
    DashboardService,
)
from metadata.generated.schema.entity.teams.user import User
from metadata.generated.schema.metadataIngestion.dashboardServiceMetadataPipeline import (
    DashboardServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.usageRequest import UsageRequest
from metadata.ingestion.api.delete import delete_entity_from_source
from metadata.ingestion.api.models import Either, Entity
from metadata.ingestion.api.steps import Source
from metadata.ingestion.api.topology_runner import C, TopologyRunnerMixin
from metadata.ingestion.models.delete_entity import DeleteEntity
from metadata.ingestion.models.ometa_classification import OMetaTagAndClassification
from metadata.ingestion.models.patch_request import PatchRequest
from metadata.ingestion.models.topology import (
    NodeStage,
    ServiceTopology,
    TopologyNode,
    create_source_context,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_connection, get_test_connection_fn
from metadata.utils import fqn
from metadata.utils.filters import filter_by_dashboard, filter_by_project
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

LINEAGE_MAP = {
    Dashboard: "dashboard",
    Table: "table",
    DashboardDataModel: "dashboardDataModel",
    Chart: "chart",
}


class DashboardUsage(BaseModel):
    """
    Wrapper to handle type at the sink
    """

    dashboard: Dashboard
    usage: UsageRequest


class DashboardServiceTopology(ServiceTopology):
    """
    Defines the hierarchy in Dashboard Services.
    service -> data models -> dashboard -> charts.

    We could have a topology validator. We can only consume
    data that has been produced by any parent node.
    """

    root = TopologyNode(
        producer="get_services",
        stages=[
            NodeStage(
                type_=DashboardService,
                context="dashboard_service",
                processor="yield_create_request_dashboard_service",
                overwrite=False,
                must_return=True,
                cache_entities=True,
            ),
            NodeStage(
                type_=OMetaTagAndClassification,
                processor="yield_tag",
                nullable=True,
            ),
        ],
        children=["bulk_data_model", "dashboard"],
        post_process=["mark_dashboards_as_deleted", "mark_datamodels_as_deleted"],
    )
    # Dashboard Services have very different approaches when
    # when dealing with data models. Tableau has the models
    # tightly coupled with dashboards, while Looker
    # handles them as independent entities.
    # When configuring a new source, we will either implement
    # the yield_bulk_datamodel or yield_datamodel functions.
    bulk_data_model = TopologyNode(
        producer="list_datamodels",
        stages=[
            NodeStage(
                type_=DashboardDataModel,
                processor="yield_bulk_datamodel",
                consumer=["dashboard_service"],
                nullable=True,
                use_cache=True,
            )
        ],
    )
    dashboard = TopologyNode(
        producer="get_dashboard",
        stages=[
            NodeStage(
                type_=Chart,
                context="charts",
                processor="yield_dashboard_chart",
                consumer=["dashboard_service"],
                nullable=True,
                cache_all=True,
                clear_cache=True,
                use_cache=True,
            ),
            NodeStage(
                type_=DashboardDataModel,
                context="dataModels",
                processor="yield_datamodel",
                consumer=["dashboard_service"],
                nullable=True,
                cache_all=True,
                clear_cache=True,
                use_cache=True,
            ),
            NodeStage(
                type_=Dashboard,
                context="dashboard",
                processor="yield_dashboard",
                consumer=["dashboard_service"],
                use_cache=True,
            ),
            NodeStage(
                type_=User,
                context="owner",
                processor="process_owner",
                consumer=["dashboard_service"],
            ),
            NodeStage(
                type_=AddLineageRequest,
                processor="yield_dashboard_lineage",
                consumer=["dashboard_service"],
                nullable=True,
            ),
            NodeStage(
                type_=UsageRequest,
                processor="yield_dashboard_usage",
                consumer=["dashboard_service"],
                nullable=True,
            ),
        ],
    )


# pylint: disable=too-many-public-methods
class DashboardServiceSource(TopologyRunnerMixin, Source, ABC):
    """
    Base class for Database Services.
    It implements the topology and context.
    """

    source_config: DashboardServiceMetadataPipeline
    config: WorkflowSource
    metadata: OpenMetadata
    # Big union of types we want to fetch dynamically
    service_connection: DashboardConnection.__fields__["config"].type_

    topology = DashboardServiceTopology()
    context = create_source_context(topology)
    dashboard_source_state: Set = set()
    datamodel_source_state: Set = set()

    def __init__(
        self,
        config: WorkflowSource,
        metadata: OpenMetadata,
    ):
        super().__init__()
        self.config = config
        self.metadata = metadata
        self.service_connection = self.config.serviceConnection.__root__.config
        self.source_config: DashboardServiceMetadataPipeline = (
            self.config.sourceConfig.config
        )
        self.client = get_connection(self.service_connection)

        # Flag the connection for the test connection
        self.connection_obj = self.client
        self.test_connection()

    @abstractmethod
    def yield_dashboard(
        self, dashboard_details: Any
    ) -> Iterable[Either[CreateDashboardRequest]]:
        """
        Method to Get Dashboard Entity
        """

    @abstractmethod
    def yield_dashboard_lineage_details(
        self, dashboard_details: Any, db_service_name: str
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Get lineage between dashboard and data sources
        """

    @abstractmethod
    def yield_dashboard_chart(
        self, dashboard_details: Any
    ) -> Iterable[Either[CreateChartRequest]]:
        """
        Method to fetch charts linked to dashboard
        """

    @abstractmethod
    def get_dashboards_list(self) -> Optional[List[Any]]:
        """
        Get List of all dashboards
        """

    @abstractmethod
    def get_dashboard_name(self, dashboard: Any) -> str:
        """
        Get Dashboard Name from each element coming from `get_dashboards_list`
        """

    @abstractmethod
    def get_dashboard_details(self, dashboard: Any) -> Any:
        """
        Get Dashboard Details
        """

    def list_datamodels(self) -> Iterable[Any]:
        """
        Optional Node producer for processing datamodels in bulk
        before the dashboards
        """
        return []

    def yield_datamodel(self, _) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to fetch DataModel linked to Dashboard
        """

    def yield_bulk_datamodel(
        self, _
    ) -> Iterable[Either[CreateDashboardDataModelRequest]]:
        """
        Method to fetch DataModels in bulk
        """

    def yield_datamodel_dashboard_lineage(
        self,
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Returns:
            Lineage request between Data Models and Dashboards
        """
        if hasattr(self.context, "dataModels") and self.context.dataModels:
            for datamodel in self.context.dataModels:
                try:
                    datamodel_fqn = fqn.build(
                        metadata=self.metadata,
                        entity_type=DashboardDataModel,
                        service_name=self.context.dashboard_service,
                        data_model_name=datamodel,
                    )
                    datamodel_entity = self.metadata.get_by_name(
                        entity=DashboardDataModel, fqn=datamodel_fqn
                    )

                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.context.dashboard_service,
                        dashboard_name=self.context.dashboard,
                    )
                    dashboard_entity = self.metadata.get_by_name(
                        entity=Dashboard, fqn=dashboard_fqn
                    )
                    yield self._get_add_lineage_request(
                        to_entity=dashboard_entity, from_entity=datamodel_entity
                    )
                except Exception as err:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error to yield dashboard lineage details for data model name [{datamodel.name}]: {err}"
                    )

    def yield_dashboard_lineage(
        self, dashboard_details: Any
    ) -> Iterable[Either[AddLineageRequest]]:
        """
        Yields lineage if config is enabled.

        We will look for the data in all the services
        we have informed.
        """
        yield from self.yield_datamodel_dashboard_lineage() or []

        for db_service_name in self.source_config.dbServiceNames or []:
            yield from self.yield_dashboard_lineage_details(
                dashboard_details, db_service_name
            ) or []

    def yield_tag(self, *args, **kwargs) -> Iterable[Either[OMetaTagAndClassification]]:
        """
        Method to fetch dashboard tags
        """

    def yield_dashboard_usage(self, *args, **kwargs) -> Iterable[DashboardUsage]:
        """
        Method to pick up dashboard usage data
        """

    def close(self):
        self.metadata.close()

    def get_services(self) -> Iterable[WorkflowSource]:
        yield self.config

    def yield_create_request_dashboard_service(
        self, config: WorkflowSource
    ) -> Iterable[Either[CreateDashboardServiceRequest]]:
        yield Either(
            right=self.metadata.get_create_service_from_source(
                entity=DashboardService, config=config
            )
        )

    def mark_dashboards_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """
        Method to mark the dashboards as deleted
        """
        if self.source_config.markDeletedDashboards:
            logger.info("Mark Deleted Dashboards set to True")
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=Dashboard,
                entity_source_state=self.dashboard_source_state,
                mark_deleted_entity=self.source_config.markDeletedDashboards,
                params={"service": self.context.dashboard_service},
            )

    def mark_datamodels_as_deleted(self) -> Iterable[Either[DeleteEntity]]:
        """
        Method to mark the datamodels as deleted
        """
        if self.source_config.markDeletedDataModels:
            logger.info("Mark Deleted Datamodels set to True")
            yield from delete_entity_from_source(
                metadata=self.metadata,
                entity_type=DashboardDataModel,
                entity_source_state=self.datamodel_source_state,
                mark_deleted_entity=self.source_config.markDeletedDataModels,
                params={"service": self.context.dashboard_service},
            )

    def process_owner(self, dashboard_details):
        """
        Method to process the dashboard onwers
        """
        try:
            if self.source_config.includeOwners:
                owner = self.get_owner_details(  # pylint: disable=assignment-from-none
                    dashboard_details=dashboard_details
                )
                if owner:
                    dashboard_fqn = fqn.build(
                        self.metadata,
                        entity_type=Dashboard,
                        service_name=self.context.dashboard_service,
                        dashboard_name=self.context.dashboard,
                    )
                    dashboard_entity = self.metadata.get_by_name(
                        entity=Dashboard, fqn=dashboard_fqn
                    )
                    self.metadata.patch_owner(
                        entity=Dashboard,
                        source=dashboard_entity,
                        owner=owner,
                        force=False,
                    )
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error processing owner for {dashboard_details}: {exc}")

    def register_record(self, dashboard_request: CreateDashboardRequest) -> None:
        """
        Mark the dashboard record as scanned and update the dashboard_source_state
        """
        dashboard_fqn = fqn.build(
            self.metadata,
            entity_type=Dashboard,
            service_name=dashboard_request.service.__root__,
            dashboard_name=dashboard_request.name.__root__,
        )

        self.dashboard_source_state.add(dashboard_fqn)

    def register_record_datamodel(
        self, datamodel_requst: CreateDashboardDataModelRequest
    ) -> None:
        """
        Mark the datamodel record as scanned and update the datamodel_source_state
        """
        datamodel_fqn = fqn.build(
            self.metadata,
            entity_type=DashboardDataModel,
            service_name=datamodel_requst.service.__root__,
            data_model_name=datamodel_requst.name.__root__,
        )

        self.datamodel_source_state.add(datamodel_fqn)

    def get_owner_details(  # pylint: disable=useless-return
        self, dashboard_details  # pylint: disable=unused-argument
    ) -> Optional[EntityReference]:
        """Get dashboard owner

        Args:
            dashboard_details:
        Returns:
            Optional[EntityReference]
        """
        logger.debug(
            f"Processing ownership is not supported for {self.service_connection.type.name}"
        )
        return None

    @staticmethod
    def _get_add_lineage_request(
        to_entity: Union[Dashboard, DashboardDataModel],
        from_entity: Union[Table, DashboardDataModel, Dashboard],
    ) -> Optional[Either[AddLineageRequest]]:
        if from_entity and to_entity:
            return Either(
                right=AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(
                            id=from_entity.id.__root__,
                            type=LINEAGE_MAP[type(from_entity)],
                        ),
                        toEntity=EntityReference(
                            id=to_entity.id.__root__,
                            type=LINEAGE_MAP[type(to_entity)],
                        ),
                        lineageDetails=LineageDetails(
                            source=LineageSource.DashboardLineage
                        ),
                    )
                )
            )

        return None

    def get_dashboard(self) -> Any:
        """
        Method to iterate through dashboard lists filter dashboards & yield dashboard details
        """
        for dashboard in self.get_dashboards_list():
            dashboard_name = self.get_dashboard_name(dashboard)
            if filter_by_dashboard(
                self.source_config.dashboardFilterPattern,
                dashboard_name,
            ):
                self.status.filter(
                    dashboard_name,
                    "Dashboard Filtered Out",
                )
                continue

            try:
                dashboard_details = self.get_dashboard_details(dashboard)
                self.context.project_name = (  # pylint: disable=assignment-from-none
                    self.get_project_name(dashboard_details=dashboard_details)
                )
                if self.context.project_name and filter_by_project(
                    self.source_config.projectFilterPattern,
                    self.context.project_name,
                ):
                    self.status.filter(
                        self.context.project_name,
                        "Project / Workspace Filtered Out",
                    )
                    continue
            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.warning(
                    f"Cannot extract dashboard details from {dashboard}: {exc}"
                )
                continue

            yield dashboard_details

    def test_connection(self) -> None:
        test_connection_fn = get_test_connection_fn(self.service_connection)
        test_connection_fn(self.metadata, self.connection_obj, self.service_connection)

    def prepare(self):
        """By default, nothing to prepare"""

    def fqn_from_context(self, stage: NodeStage, entity_name: C) -> str:
        """
        We are overriding this method since CreateDashboardDataModelRequest needs to add an extra value to the context
        names.

        Read the context
        :param stage: Topology node being processed
        :param entity_request: Request sent to the sink
        :return: Entity FQN derived from context
        """
        context_names = [
            self.context.__dict__[dependency]
            for dependency in stage.consumer or []  # root nodes do not have consumers
        ]

        if isinstance(stage.type_, DashboardDataModel):
            context_names.append("model")

        return fqn._build(  # pylint: disable=protected-access
            *context_names, entity_name
        )

    def check_database_schema_name(self, database_schema_name: str):

        """
        Check if the input database schema name is equal to "<default>" and return the input name if it is not.

        Args:
        - database_schema_name (str): A string representing the name of the database schema to be checked.

        Returns:
        - None: If the input database schema name is equal to "<default>".
        - database_schema_name (str): If the input database schema name is not equal to "<default>".
        """
        if database_schema_name == "<default>":
            return None

        return database_schema_name

    def get_project_name(  # pylint: disable=unused-argument, useless-return
        self, dashboard_details: Any
    ) -> Optional[str]:
        """
        Get the project / workspace / folder / collection name of the dashboard
        """
        logger.debug(
            f"Projects are not supported for {self.service_connection.type.name}"
        )
        return None

    def create_patch_request(
        self, original_entity: Entity, create_request: C
    ) -> PatchRequest:
        """
        Method to get the PatchRequest object
        To be overridden by the process if any custom logic is to be applied
        """
        patch_request = PatchRequest(
            original_entity=original_entity,
            new_entity=original_entity.copy(update=create_request.__dict__),
        )
        if isinstance(original_entity, Dashboard):
            # For patch the charts need to be entity ref instead of fqn
            charts_entity_ref_list = []
            for chart_fqn in create_request.charts or []:
                chart_entity = self.metadata.get_by_name(entity=Chart, fqn=chart_fqn)
                if chart_entity:
                    charts_entity_ref_list.append(
                        EntityReference(
                            id=chart_entity.id.__root__,
                            type=LINEAGE_MAP[type(chart_entity)],
                        )
                    )
            patch_request.new_entity.charts = charts_entity_ref_list

            # For patch the datamodels need to be entity ref instead of fqn
            datamodel_entity_ref_list = []
            for datamodel_fqn in create_request.dataModels or []:
                datamodel_entity = self.metadata.get_by_name(
                    entity=DashboardDataModel, fqn=datamodel_fqn
                )
                if datamodel_entity:
                    datamodel_entity_ref_list.append(
                        EntityReference(
                            id=datamodel_entity.id.__root__,
                            type=LINEAGE_MAP[type(datamodel_entity)],
                        )
                    )
            patch_request.new_entity.dataModels = datamodel_entity_ref_list
        return patch_request
