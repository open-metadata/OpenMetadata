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
Sample Data source ingestion
"""
import json
from collections import namedtuple
from typing import Iterable
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.ingestion.api.models import Either
from metadata.generated.schema.api.data.createDashboardDataModel import (
    CreateDashboardDataModelRequest,
)
from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.dashboardService import DashboardService
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.steps import InvalidSourceException, Source
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.constants import UTF_8
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


class SampleDataSource(Source):  # pylint: disable=too-many-instance-attributes
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
        self.service_connection = config.serviceConnection.__root__.config
        self.metadata = metadata
        self.list_policies = []
        self.store_table_fqn = []
        self.store_data_model_fqn = []
        self.store_dashboard_fqn = []

        sample_data_folder = self.service_connection.connectionOptions.__root__.get(
            "sampleDataFolder"
        )
        if not sample_data_folder:
            raise InvalidSampleDataException(
                "Cannot get sampleDataFolder from connection options"
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

        self.database_service_json = json.load(
            open(  # pylint: disable=consider-using-with
                sample_data_folder + "/datasets/service.json",
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
        self.dashboard_service = self.metadata.get_service_or_create(
            entity=DashboardService,
            config=WorkflowSource(**self.dashboard_service_json),
        )

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: CustomDatabaseConnection = config.serviceConnection.__root__.config
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

    def generate_sample_data(self):
        """
        Generate sample data for dashboard and database service,
        with lineage between them, having long names, special characters and description
        """
        for _ in range(2):
            name = self.generate_name()
            text = self.generate_text()

            self.database_service_json["name"] = name
            self.database_service_json["description"] = text

            db = self.create_database_request(name, text)
            yield Either(right=db)

            for _ in range(2):
                schema = self.create_database_schema_request(name, text, db)
                yield Either(right=schema)

                for table in self.tables["tables"]:
                    table_request = self.create_table_request(name, text, schema, table)
                    yield Either(right=table_request)

            self.dashboard_service_json["name"] = name
            self.dashboard_service_json["description"] = text

            for data_model in self.data_models["datamodels"]:
                data_model_request = self.create_dashboard_data_model_request(
                    name, text, data_model
                )
                yield Either(right=data_model_request)

    def generate_name(self):
        return f"Sample-@!3_(%t3st@)%_^{self.fake.name()}"

    def generate_text(self):
        return f"Sample-@!3_(%m@)%_^{self.fake.text()}"

    def create_database_request(self, name, text):
        db = CreateDatabaseRequest(
            name=name,
            description=text,
            service=self.database_service.fullyQualifiedName.__root__,
        )
        return db

    def create_database_schema_request(self, name, text, db):
        self.db_name = db.name.__root__
        db_fqn = fqn.build(
            self.metadata,
            entity_type=Database,
            service_name=self.database_service.name.__root__,
            database_name=db.name.__root__,
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
            service_name=self.database_service.name.__root__,
            database_name=self.db_name,
            schema_name=schema.name.__root__,
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
