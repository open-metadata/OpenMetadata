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
Sample Data source ingestion
"""
import json
from collections import namedtuple
from typing import Iterable, Optional

from metadata.generated.schema.api.data.createChart import CreateChartRequest
from metadata.generated.schema.api.data.createDashboard import CreateDashboardRequest
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.dashboard import Dashboard
from metadata.generated.schema.entity.data.dashboardDataModel import DashboardDataModel
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.type.entityLineage import (
    ColumnLineage,
    EntitiesEdge,
    LineageDetails,
)
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import get_standard_chart_type
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

COLUMN_NAME = "Column"
KEY_TYPE = "Key type"
DATA_TYPE = "Data type"
COL_DESCRIPTION = "Description"
TableKey = namedtuple("TableKey", ["schema", "table_name"])


class InvalidSampleDataException(Exception):
    """
    Sample data is not valid to be ingested
    """


class ExtendedSampleDataSource(Source):  # pylint: disable=too-many-instance-attributes
    """
    Loads JSON data and prepares the required
    python objects to be sent to the Sink.
    """

    def __init__(self, config: WorkflowSource, metadata: OpenMetadata):
        import faker  # pylint: disable=import-outside-toplevel

        super().__init__()

        self.fake = faker.Faker(["en-US", "zh_CN", "ja_JP", "th_TH"])
        self.database_service_json = {}
        self.dashboard_service_json = {}
        self.config = config
        self.service_connection = config.serviceConnection.root.config
        self.metadata = metadata
        self.list_policies = []
        self.store_table_fqn = set()
        self.store_data_model_fqn = []
        self.store_dashboard_fqn = []
        self.main_glossary = None
        self.glossary_term_list = []

        sample_data_folder = self.service_connection.connectionOptions.root.get(
            "sampleDataFolder"
        )
        self.include_glossary = self.service_connection.connectionOptions.root.get(
            "includeGlossary"
        )
        self.include_lineage_stress_testing = (
            self.service_connection.connectionOptions.root.get(
                "includeLineageStressTesting"
            )
        )
        extneded_sample_data_folder = (
            self.service_connection.connectionOptions.root.get(
                "extendedSampleDataFolder"
            )
        )
        if not sample_data_folder:
            raise InvalidSampleDataException(
                "Cannot get sampleDataFolder from connection options"
            )

        if not extneded_sample_data_folder:
            raise InvalidSampleDataException(
                "Cannot get ExtendedSampleDataFolder from connection options"
            )

        self.database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/service.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.tables = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/tables.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.extended_tables = json.load(
            open(  # pylint: disable=consider-using-with
                extneded_sample_data_folder + "/datasets/upstream_edge_tables.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/service.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.charts = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/charts.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.database_service = self.metadata.get_service_or_create(
            entity=DatabaseService, config=WorkflowSource(**self.database_service_json)
        )

        self.dashboard_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/service.json",
                "r",
                encoding=UTF_8,
            )
        )

        self.data_models = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/dashboardDataModels.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.dashboards = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/dashboards/dashboards.json",
                "r",
                encoding=UTF_8,
            )
        )
        self.dashboard_service = self.metadata.get_service_or_create(
            entity=DashboardService,
            config=WorkflowSource(**self.dashboard_service_json),
        )
        self.db_name = None

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: CustomDatabaseConnection = config.serviceConnection.root.config
        if not isinstance(connection, CustomDatabaseConnection):
            raise InvalidSourceException(
                f"Expected CustomDatabaseConnection, but got {connection}"
            )
        return cls(config, metadata)

    def prepare(self):
        """Nothing to prepare"""

    def _iter(self, *_, **__) -> Iterable[Entity]:
        yield from self.generate_sample_data()

    def close(self):
        """Nothing to close"""

    def test_connection(self) -> None:
        """Custom sources don't support testing connections"""

    def create_depth_nodes(self, from_table, to_table):
        """Create Depth Nodes"""
        from_col_list = []
        for col in from_table.columns:
            from_col_list.append(col.fullyQualifiedName.root)
        to_col = to_table.columns[0].fullyQualifiedName.root
        yield Either(
            right=AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=from_table.id.root, type="table"),
                    toEntity=EntityReference(
                        id=to_table.id.root,
                        type="table",
                    ),
                    lineageDetails=LineageDetails(
                        columnsLineage=[
                            ColumnLineage(fromColumns=from_col_list, toColumn=to_col)
                        ]
                    ),
                )
            )
        )

    def generate_sample_data(
        self,
    ):  # pylint: disable=too-many-locals,too-many-statements
        """
        Generate sample data for dashboard and database service,
        with lineage between them, having long names, special characters and description
        """
        if self.include_glossary:
            yield from self.create_glossary()
            yield from self.create_glossary_term()
        if self.include_lineage_stress_testing:
            db = self.create_database_request(
                "extended_sample_data", self.generate_text()
            )
            yield Either(right=db)

            schema = self.create_database_schema_request(
                "extended_sample_database_schema", self.generate_text(), db
            )
            yield Either(right=schema)
            for table in self.extended_tables["tables"]:
                text = self.generate_text()
                table_request = self.create_table_request(
                    table["name"], text, schema, table
                )
                yield Either(right=table_request)
                downstream_node_fqn_table = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.database_service.name.root,
                    database_name=db.name.root,
                    schema_name=schema.name.root,
                    table_name=table_request.name.root,
                )
                to_table = self.metadata.get_by_name(
                    entity=Table, fqn=downstream_node_fqn_table
                )
                main_table = to_table
                self.store_table_fqn.add(downstream_node_fqn_table)

                for _ in range(40):
                    # 40 Dynamic Lineage Depths
                    name = self.generate_name()
                    table_request = self.create_table_request(name, text, schema, table)
                    yield Either(right=table_request)
                    upstream_node_fqn_table = fqn.build(
                        self.metadata,
                        entity_type=Table,
                        service_name=self.database_service.name.root,
                        database_name=db.name.root,
                        schema_name=schema.name.root,
                        table_name=table_request.name.root,
                    )
                    from_table = self.metadata.get_by_name(
                        entity=Table, fqn=upstream_node_fqn_table
                    )
                    yield from self.create_depth_nodes(
                        from_table=from_table, to_table=to_table
                    )
                    to_table = from_table
            for _ in range(40):
                name = self.generate_name()
                table_request = self.create_table_request(
                    name, text, schema, self.extended_tables["tables"][-1]
                )
                yield Either(right=table_request)
                upstream_node_fqn_table = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.database_service.name.root,
                    database_name=db.name.root,
                    schema_name=schema.name.root,
                    table_name=table_request.name.root,
                )
                from_table = self.metadata.get_by_name(
                    entity=Table, fqn=upstream_node_fqn_table
                )
                yield from self.create_depth_nodes(
                    from_table=from_table, to_table=main_table
                )

            for table in self.tables["tables"]:
                text = self.generate_text()
                table_request = self.create_table_request(
                    table["name"], text, schema, table
                )
                yield Either(right=table_request)
                table_entity_fqn = fqn.build(
                    self.metadata,
                    entity_type=Table,
                    service_name=self.database_service.name.root,
                    database_name=db.name.root,
                    schema_name=schema.name.root,
                    table_name=table_request.name.root,
                )
                from_table = self.metadata.get_by_name(
                    entity=Table, fqn=table_entity_fqn
                )

                yield from self.create_depth_nodes(
                    from_table=from_table, to_table=to_table
                )

            self.dashboard_service_json["name"] = name
            self.dashboard_service_json["description"] = text
            for chart in self.charts["charts"]:
                yield Either(
                    right=CreateChartRequest(
                        name=chart["name"],
                        displayName=chart["displayName"],
                        description=chart["description"],
                        chartType=get_standard_chart_type(chart["chartType"]),
                        sourceUrl=chart["sourceUrl"],
                        service=self.dashboard_service.fullyQualifiedName,
                    )
                )
            for data_model in self.data_models["datamodels"]:
                name = self.generate_name()
                text = self.generate_text()
                data_model_request = self.create_dashboard_data_model_request(
                    name, text, data_model
                )
                yield Either(right=data_model_request)
                data_model_entity_fqn = fqn.build(
                    self.metadata,
                    entity_type=DashboardDataModel,
                    service_name=self.dashboard_service.name.root,
                    data_model_name=data_model_request.name.root,
                )
                self.store_data_model_fqn.append(data_model_entity_fqn)

            for table_fqn in self.store_table_fqn:
                from_table = self.metadata.get_by_name(entity=Table, fqn=table_fqn)
                for dashboard_datamodel_fqn in self.store_data_model_fqn:
                    to_datamodel = self.metadata.get_by_name(
                        entity=DashboardDataModel, fqn=dashboard_datamodel_fqn
                    )

                    yield Either(
                        right=AddLineageRequest(
                            edge=EntitiesEdge(
                                fromEntity=EntityReference(
                                    id=from_table.id.root, type="table"
                                ),
                                toEntity=EntityReference(
                                    id=to_datamodel.id.root,
                                    type="dashboardDataModel",
                                ),
                                lineageDetails=LineageDetails(
                                    source=LineageSource.DashboardLineage
                                ),
                            )
                        )
                    )
                    for dashboard in self.dashboards["dashboards"]:
                        dashboard_request = CreateDashboardRequest(
                            name=dashboard["name"],
                            displayName=dashboard["displayName"],
                            description=dashboard["description"],
                            sourceUrl=dashboard["sourceUrl"],
                            charts=dashboard["charts"],
                            service=self.dashboard_service.fullyQualifiedName,
                        )
                        yield Either(right=dashboard_request)
                        dashboard_fqn = fqn.build(
                            self.metadata,
                            entity_type=Dashboard,
                            service_name=self.dashboard_service.name.root,
                            dashboard_name=dashboard_request.name.root,
                        )
                        to_dashboard = self.metadata.get_by_name(
                            entity=Dashboard, fqn=dashboard_fqn
                        )
                        yield Either(
                            right=AddLineageRequest(
                                edge=EntitiesEdge(
                                    fromEntity=EntityReference(
                                        id=to_datamodel.id.root,
                                        type="dashboardDataModel",
                                    ),
                                    toEntity=EntityReference(
                                        id=to_dashboard.id.root, type="dashboard"
                                    ),
                                    lineageDetails=LineageDetails(
                                        source=LineageSource.DashboardLineage
                                    ),
                                )
                            )
                        )

    def create_glossary(self):
        self.main_glossary = CreateGlossaryRequest(
            name="NestedGlossaryTest",
            displayName="NestedGlossaryTest",
            description="Description of test glossary",
        )
        yield Either(right=self.main_glossary)

    def create_glossary_term(self):
        """
        Create Glossary Terms
        """
        for _ in range(20):
            random_name = self.fake.first_name()
            yield Either(
                right=CreateGlossaryTermRequest(
                    glossary="NestedGlossaryTest",
                    name=random_name,
                    displayName=random_name,
                    description="Test glossary term ",
                    parent=self.glossary_term_list[-1]
                    if len(self.glossary_term_list) > 3
                    else None,
                )
            )
            if len(self.glossary_term_list) > 3 and self.glossary_term_list[-1]:
                self.glossary_term_list.append(
                    f"{self.glossary_term_list[-1]}.{random_name}"
                )
            else:
                self.glossary_term_list.append(f"NestedGlossaryTest.{random_name}")

        for _ in range(500):
            random_name = self.fake.first_name()
            yield Either(
                right=CreateGlossaryTermRequest(
                    glossary="NestedGlossaryTest",
                    name=random_name,
                    displayName=random_name,
                    description="Test glossary term 1",
                )
            )

    def generate_name(self):
        return f"Sample-@!3_(%t3st@)%_^{self.fake.name()}"

    def generate_text(self):
        return f"Sample-@!3_(%m@)%_^{self.fake.text()}"

    def create_database_request(self, name, text):
        db = CreateDatabaseRequest(
            name=name,
            description=text,
            service=self.database_service.fullyQualifiedName.root,
        )
        return db

    def create_database_schema_request(self, name, text, db):
        self.db_name = db.name.root
        db_fqn = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.database_service.name.root,
            database_name=db.name.root,
        )
        schema = CreateDatabaseSchemaRequest(
            name=name,
            description=text,
            database=db_fqn,
        )
        return schema

    def create_table_request(self, name, text, schema, table):
        dbschema_fqn = fqn.build(
            self.metadata,
            entity_type=DatabaseSchema,
            service_name=self.database_service.name.root,
            database_name=self.db_name,
            schema_name=schema.name.root,
        )
        table_request = CreateTableRequest(
            name=name,
            description=text,
            columns=table["columns"],
            databaseSchema=dbschema_fqn,
            tableConstraints=table.get("tableConstraints"),
            tableType=table["tableType"],
        )
        return table_request

    def create_dashboard_data_model_request(self, name, text, data_model):
        data_model_request = CreateDashboardDataModelRequest(
            name=name,
            description=text,
            columns=data_model["columns"],
            dataModelType=data_model["dataModelType"],
            sql=data_model["sql"],
            serviceType=data_model["serviceType"],
            service=self.dashboard_service.fullyQualifiedName,
        )
        return data_model_request
