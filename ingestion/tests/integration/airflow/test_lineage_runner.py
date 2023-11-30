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
Test lineage parser to get inlets and outlets information
"""
from datetime import datetime
from unittest import TestCase
from unittest.mock import patch

from airflow import DAG
from airflow.operators.bash import BashOperator

from airflow_provider_openmetadata.lineage.runner import AirflowLineageRunner
from metadata.generated.schema.entity.services.pipelineService import PipelineService

from metadata.generated.schema.api.data.createTable import CreateTableRequest

from metadata.generated.schema.api.data.createDatabaseSchema import CreateDatabaseSchemaRequest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest

from metadata.generated.schema.entity.services.connections.database.common.basicAuth import BasicAuth

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import MysqlConnection

from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest

from metadata.generated.schema.entity.data.table import Table, Column, DataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType, DatabaseConnection, \
    DatabaseService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import OpenMetadataJWTClientConfig
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.airflow.lineage_parser import OMEntity, get_xlets_from_dag

SLEEP = "sleep 1"
PIPELINE_SERVICE_NAME = "test-lineage-runner"
DB_SERVICE_NAME = "test-service-lineage-runner"
OM_JWT = "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"


class TestAirflowLineageRuner(TestCase):
    """
    Validate AirflowLineageRunner
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=OM_JWT),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    service = CreateDatabaseServiceRequest(
        name=DB_SERVICE_NAME,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="username",
                authType=BasicAuth(password="password"),
                hostPort="http://localhost:1234",
            )
        ),
    )
    service_type = "databaseService"

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare ingredients: Table Entity + DAG
        """

        service_entity = cls.metadata.create_or_update(data=cls.service)

        create_db = CreateDatabaseRequest(
            name="test-db",
            service=service_entity.fullyQualifiedName,
        )

        create_db_entity = cls.metadata.create_or_update(data=create_db)

        create_schema = CreateDatabaseSchemaRequest(
            name="test-schema",
            database=create_db_entity.fullyQualifiedName,
        )

        create_schema_entity = cls.metadata.create_or_update(data=create_schema)

        create_inlet = CreateTableRequest(
            name="lineage-test-inlet",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        create_inlet_2 = CreateTableRequest(
            name="lineage-test-inlet2",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        create_outlet = CreateTableRequest(
            name="lineage-test-outlet",
            databaseSchema=create_schema_entity.fullyQualifiedName,
            columns=[Column(name="id", dataType=DataType.BIGINT)],
        )

        cls.metadata.create_or_update(data=create_inlet)
        cls.metadata.create_or_update(data=create_inlet_2)
        cls.table_outlet = cls.metadata.create_or_update(data=create_outlet)

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn=DB_SERVICE_NAME
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        # Service ID created from the Airflow Lineage Operator in the
        # example DAG
        pipeline_service_id = str(
            cls.metadata.get_by_name(
                entity=PipelineService, fqn=PIPELINE_SERVICE_NAME
            ).id.__root__
        )

        cls.metadata.delete(
            entity=PipelineService,
            entity_id=pipeline_service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_lineage_runner(self):

        with DAG("test_runner", start_date=datetime(2021, 1, 1)) as dag:
            BashOperator(
                task_id="print_date",
                bash_command="date",
                inlets=[
                    OMEntity(entity=Table, fqn="test-service-lineage-runner.test-db.test-schema.lineage-test-inlet"),
                    OMEntity(entity=Table, fqn="test-service-lineage-runner.test-db.test-schema.lineage-test-inlet2"),
                ],
            )

            BashOperator(
                task_id="sleep",
                bash_command=SLEEP,
                outlets=[
                    OMEntity(entity=Table, fqn="test-service-lineage-runner.test-db.test-schema.lineage-test-outlet")
                ],
            )

        # skip the statuses since they require getting data from airflow's db
        with patch.object(AirflowLineageRunner, "add_all_pipeline_status", return_value=None):
            runner = AirflowLineageRunner(
                metadata=self.metadata,
                service_name=PIPELINE_SERVICE_NAME,
                dag=dag,
                xlets=get_xlets_from_dag(dag),
                only_keep_dag_lineage=True,
            )

            runner.execute()
