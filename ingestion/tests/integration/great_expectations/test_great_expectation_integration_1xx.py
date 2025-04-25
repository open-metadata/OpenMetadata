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
Validate great expectation integration
"""

import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta
from unittest import TestCase

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
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.workflow.metadata import MetadataWorkflow

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


class TestGreatExpectationIntegration1xx(TestCase):
    """Test great expectation integration"""

    skip_test = True

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
        ingestion_workflow.print_status()
        ingestion_workflow.stop()

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(entity=DatabaseService, fqn="test_sqlite").id.root
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
        self.install_gx_1xx()
        import great_expectations as gx

        try:
            self.assertTrue(gx.__version__.startswith("1."))
        except AssertionError as exc:
            # module versions are cached, so we need to skip the test if the version is not 1.x.x
            # e.g. we run the 0.18.x test before this one, 0.18 version will be cached and used here
            # The test will run if we run this test alone without the 0.18.x test
            self.skipTest(f"GX version is not 1.x.x: {exc}")

        from metadata.great_expectations.action1xx import (
            OpenMetadataValidationAction1xx,
        )

        table_entity = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.default.main.users",
            fields=["testSuite"],
        )

        assert not table_entity.testSuite

        # GE config file
        ge_folder = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
        )
        ometa_config = os.path.join(ge_folder, "gx/ometa_config")

        context = gx.get_context()
        conn_string = f"sqlite+pysqlite:///file:cachedb?mode=memory&cache=shared&check_same_thread=False"
        data_source = context.data_sources.add_sqlite(
            name="test_sqlite",
            connection_string=conn_string,
        )

        data_asset = data_source.add_table_asset(
            name="users", table_name="users", schema_name="main"
        )
        batch_definition = data_asset.add_batch_definition_whole_table(
            "batch definition"
        )
        batch = batch_definition.get_batch()
        suite = context.suites.add(
            gx.core.expectation_suite.ExpectationSuite(name="name")
        )
        suite.add_expectation(
            gx.expectations.ExpectColumnValuesToNotBeNull(column="name")
        )

        validation_definition = context.validation_definitions.add(
            gx.core.validation_definition.ValidationDefinition(
                name="validation definition",
                data=batch_definition,
                suite=suite,
            )
        )

        action_list = [
            OpenMetadataValidationAction1xx(
                database_service_name="test_sqlite",
                database_name="default",
                table_name="users",
                schema_name="main",
                config_file_path=ometa_config,
            )
        ]

        checkpoint = context.checkpoints.add(
            gx.checkpoint.checkpoint.Checkpoint(
                name="checkpoint",
                validation_definitions=[validation_definition],
                actions=action_list,
            )
        )
        checkpoint.run()

        table_entity = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.default.main.users",
            fields=["testSuite"],
        )

        assert table_entity.testSuite
        test_suite: TestSuite = self.metadata.get_by_id(
            entity=TestSuite, entity_id=table_entity.testSuite.id, fields=["tests"]
        )
        assert len(test_suite.tests) == 1

        test_case_results = self.metadata.get_test_case_results(
            test_case_fqn=TEST_CASE_FQN,
            start_ts=get_beginning_of_day_timestamp_mill(),
            end_ts=get_end_of_day_timestamp_mill(),
        )

        assert test_case_results

    def install_gx_1xx(self):
        """Install GX 1.x.x at runtime as we support 0.18.x and 1.x.x and setup will install 1 default version"""
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "great-expectations~=1.0"]
        )
