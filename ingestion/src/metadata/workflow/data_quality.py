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
Workflow definition for the Data Quality
"""
import traceback
from typing import Optional

from metadata.data_quality.processor.test_case_runner import TestCaseRunner
from metadata.data_quality.source.test_suite import TestSuiteSource
from metadata.generated.schema.entity.services.connections.serviceConnection import (
    ServiceConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.tests.testSuite import ServiceType, TestSuite
from metadata.ingestion.api.steps import Processor, Sink
from metadata.utils import fqn
from metadata.utils.importer import import_sink_class
from metadata.utils.logger import test_suite_logger
from metadata.workflow.base import T
from metadata.workflow.ingestion import IngestionWorkflow

logger = test_suite_logger()


class TestSuiteWorkflow(IngestionWorkflow):
    """
    DAta Quality ingestion workflow implementation

    We check the source connection test when initializing
    this workflow. No need to do anything here if this does not pass
    """

    __test__ = False

    def set_steps(self):
        self.source = TestSuiteSource.create(self.config.model_dump(), self.metadata)

        test_runner_processor = self._get_test_runner_processor()
        sink = self._get_sink()

        self.steps = (test_runner_processor, sink)

    def _get_sink(self) -> Sink:
        sink_type = self.config.sink.type
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = self.config.sink.model_dump().get("config", {})
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink

    def _get_test_runner_processor(self) -> Processor:
        return TestCaseRunner.create(self.config.model_dump(), self.metadata)

    def _retrieve_service_connection_if_needed(self, service_type: ServiceType) -> None:
        """Get service object from source config `entityFullyQualifiedName`"""
        if (
            not self.config.source.serviceConnection
            and not self.metadata.config.forceEntityOverwriting
        ):
            fully_qualified_name = (
                self.config.source.sourceConfig.config.entityFullyQualifiedName.root
            )
            try:
                service_name = fqn.split(fully_qualified_name)[0]
            except IndexError as exc:
                logger.debug(traceback.format_exc())
                raise IndexError(
                    f"Could not retrieve service name from entity fully qualified name {fully_qualified_name}: {exc}"
                )
            try:
                service: DatabaseService = self.metadata.get_by_name(
                    DatabaseService, service_name
                )
                if not service:
                    raise ConnectionError(
                        f"Could not retrieve service with name `{service_name}`. "
                        "Typically caused by the `entityFullyQualifiedName` does not exists in OpenMetadata "
                        "or the JWT Token is invalid."
                    )

                self.config.source.serviceConnection = ServiceConnection(
                    service.connection
                )

            except Exception as exc:
                logger.debug(traceback.format_exc())
                logger.error(
                    f"Error getting service connection for service name [{service_name}]"
                    f" using the secrets manager provider [{self.metadata.config.secretsManagerProvider}]: {exc}"
                )
                raise exc

    def _get_ingestion_pipeline_service(self) -> Optional[T]:
        """
        Ingestion Pipelines are linked to either an EntityService (DatabaseService, MessagingService,...)
        or a Test Suite.

        Depending on the Source Config Type, we'll need to GET one or the other to create
        the Ingestion Pipeline
        """
        return self.metadata.get_by_name(
            entity=TestSuite,
            fqn=fqn.build(
                metadata=None,
                entity_type=TestSuite,
                table_fqn=self.config.source.sourceConfig.config.entityFullyQualifiedName,
            ),
        )
