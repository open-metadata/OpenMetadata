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

import importlib
import pathlib
import uuid
from unittest import TestCase

from metadata.config.common import ConfigurationError, load_config_file
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StepSummary,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.metadata import MetadataWorkflow


class WorkflowTest(TestCase):
    """
    Validate workflow methods
    """

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    assert metadata.health_check()

    def delete_service(self):
        service_id = str(
            self.metadata.get_by_name(
                entity=DatabaseService, fqn="local_mysql_test"
            ).id.__root__
        )

        self.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

    def test_get_200(self):
        key = "metadata.ingestion.sink.metadata_rest.MetadataRestSink"
        if key.find(".") >= 0:
            module_name, class_name = key.rsplit(".", 1)
            my_class = getattr(importlib.import_module(module_name), class_name)
            self.assertEqual((my_class is not None), True)

    def test_get_4xx(self):
        key = "metadata.ingestion.sink.MYSQL.mysqlSINK"
        try:
            if key.find(".") >= 0:
                module_name, class_name = key.rsplit(".", 1)
                getattr(importlib.import_module(module_name), class_name)
        except ModuleNotFoundError:
            self.assertRaises(ModuleNotFoundError)

    def test_title_typeClassFetch(self):
        is_file = True
        file_type = "query-parser"
        if is_file:
            replace = file_type.replace("-", "_")
        else:
            replace = "".join(
                [i.title() for i in file_type.replace("-", "_").split("_")]
            )
        self.assertEqual(replace, "query_parser")

    def test_title_typeClassFetch_4xx(self):
        is_file = False
        file_type = "query-parser"
        if is_file:
            replace = file_type.replace("-", "_")
        else:
            replace = "".join(
                [i.title() for i in file_type.replace("-", "_").split("_")]
            )
        self.assertEqual(replace, "QueryParser")

    def test_execute_200(self):
        current_dir = pathlib.Path(__file__).resolve().parent
        config_file = current_dir.joinpath("mysql_test.yaml")
        workflow_config = load_config_file(config_file)
        workflow = MetadataWorkflow.create(workflow_config)
        workflow.execute()
        workflow.stop()

        # Service is created
        self.assertIsNotNone(
            self.metadata.get_by_name(entity=DatabaseService, fqn="local_mysql_test")
        )

        # The service has an ingestion pipeline (since it has the ingestionPipelineFQN inside and the runId)
        self.assertIsNotNone(
            self.metadata.get_by_name(
                entity=IngestionPipeline, fqn=workflow_config["ingestionPipelineFQN"]
            )
        )

        # The pipeline has the right status
        pipeline_status = self.metadata.get_pipeline_status(
            workflow_config["ingestionPipelineFQN"], workflow_config["pipelineRunId"]
        )

        # We have status for the source and sink
        self.assertEqual(len(pipeline_status.status.__root__), 2)
        self.assertTrue(isinstance(pipeline_status.status.__root__[0], StepSummary))

        # Rerunning with a different Run ID still generates the correct status
        new_run_id = str(uuid.uuid4())
        workflow_config["pipelineRunId"] = new_run_id

        workflow = MetadataWorkflow.create(workflow_config)
        workflow.execute()
        workflow.stop()

        pipeline_status = self.metadata.get_pipeline_status(
            workflow_config["ingestionPipelineFQN"], new_run_id
        )

        # We have status for the source and sink
        self.assertEqual(len(pipeline_status.status.__root__), 2)
        self.assertTrue(isinstance(pipeline_status.status.__root__[0], StepSummary))

        self.delete_service()

    def test_execute_4xx(self):
        config_file = pathlib.Path("/tmp/mysql_test123")
        try:
            load_config_file(config_file)
        except ConfigurationError:
            self.assertRaises(ConfigurationError)

    def test_fail_no_service_connection_and_overwrite(self):
        current_dir = pathlib.Path(__file__).resolve().parent
        config_file = current_dir.joinpath("mysql_test.yaml")
        workflow_config = load_config_file(config_file)

        del workflow_config["source"]["serviceConnection"]
        workflow_config["workflowConfig"]["openMetadataServerConfig"][
            "forceEntityOverwriting"
        ] = True

        with self.assertRaises(AttributeError):
            MetadataWorkflow.create(workflow_config)
