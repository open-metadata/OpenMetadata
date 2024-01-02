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
Validate great expectation integration
"""

import logging
import os
from datetime import datetime, timedelta
from unittest import TestCase

from great_expectations import DataContext
from sqlalchemy import Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.workflow_output_handler import print_status

Base = declarative_base()

TEST_CASE_FQN = (
    "test_sqlite.default.main.users.name.expect_column_values_to_not_be_null"
)
SQLLITE_SHARD = "file:cachedb?mode=memory&cache=shared&check_same_thread=False"
LOGGER = logging.getLogger(__name__)

WORKFLOW_CONFIG = {
    "openMetadataServerConfig": {
        "hostPort": "http://localhost:8585/api",
        "authProvider": "openmetadata",
        "securityConfig": {
            "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        },
    }
}
INGESTION_CONFIG = {
    "source": {
        "type": "sqlite",
        "serviceName": "test_sqlite",
        "serviceConnection": {
            "config": {
                "type": "SQLite",
                "databaseMode": SQLLITE_SHARD,
                "database": "default",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        **WORKFLOW_CONFIG,
    },
}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)
    signedup = Column(DateTime)


class TestGreatExpectationIntegration(TestCase):
    """Test great expectation integration"""

    engine = create_engine(
        f"sqlite+pysqlite:///{SQLLITE_SHARD}",
    )
    session = create_and_bind_session(engine)
    server_config = OpenMetadataConnection(
        hostPort=WORKFLOW_CONFIG["openMetadataServerConfig"]["hostPort"],
        authProvider=WORKFLOW_CONFIG["openMetadataServerConfig"]["authProvider"],
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken=WORKFLOW_CONFIG["openMetadataServerConfig"]["securityConfig"][
                "jwtToken"
            ]
        ),
    )  # type: ignore
    metadata = OpenMetadata(server_config)

    @classmethod
    def setUpClass(cls):
        """Set up class by ingesting metadata"""
        try:
            User.__table__.create(bind=cls.engine)
        except Exception as exc:
            LOGGER.warning(f"Table Already exists: {exc}")

        data = [
            User(
                name="John",
                fullname="John Doe",
                nickname="johnny b goode",
                age=30,
                signedup=datetime.now() - timedelta(days=10),
            ),
            User(
                name="Jane",
                fullname="Jone Doe",
                nickname=None,
                age=31,
                signedup=datetime.now() - timedelta(days=2),
            ),
            User(
                name="Joh",
                fullname="Joh Doe",
                nickname=None,
                age=37,
                signedup=datetime.now() - timedelta(days=1),
            ),
            User(
                name="Jae",
                fullname="Jae Doe",
                nickname=None,
                age=38,
                signedup=datetime.now() - timedelta(days=1),
            ),
        ]
        cls.session.add_all(data)
        cls.session.commit()

        ingestion_workflow = MetadataWorkflow.create(INGESTION_CONFIG)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        print_status(ingestion_workflow)
        ingestion_workflow.stop()

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test_sqlite"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        User.__table__.drop(bind=cls.engine)
        cls.session.close()

    def test_great_expectation_integration(self):
        """
        Test great expectation integration
        """
        table_entity = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.default.main.users",
            fields=["testSuite"],
        )

        assert not table_entity.testSuite

        # GE config file
        ge_folder = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "great_expectations",
        )
        ometa_config = os.path.join(ge_folder, "ometa_config")
        context = DataContext(ge_folder)
        checkpoint = context.get_checkpoint("sqlite")
        # update our checkpoint file at runtime to dynamically pass the ometa config file
        checkpoint.action_list[-1].update(
            {
                "name": "ometa_ingestion",
                "action": {
                    "module_name": "metadata.great_expectations.action",
                    "class_name": "OpenMetadataValidationAction",
                    "config_file_path": ometa_config,
                    "database_service_name": "test_sqlite",
                    "database_name": "default",
                    "schema_name": "main",
                },
            }
        )
        # run the checkpoint
        checkpoint.run()

        table_entity = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.default.main.users",
            fields=["testSuite"],
        )

        assert table_entity.testSuite
        assert len(table_entity.testSuite.tests) == 1

        test_case_results = self.metadata.get_test_case_results(
            test_case_fqn=TEST_CASE_FQN,
            start_ts=get_beginning_of_day_timestamp_mill(),
            end_ts=get_end_of_day_timestamp_mill(),
        )

        assert test_case_results
