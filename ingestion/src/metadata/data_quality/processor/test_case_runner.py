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
This Processor is in charge of executing the test cases
"""
from typing import Optional

from metadata.data_quality.api.models import TestSuiteProcessorConfig
from metadata.data_quality.source.test_suite import TableAndTests
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TestCaseRunner(Processor):
    """Execute the test suite tests and create test cases from the YAML config"""

    def __init__(self, config: OpenMetadataWorkflowConfig):
        self.config = config

        self.processor_config: TestSuiteProcessorConfig = (
            TestSuiteProcessorConfig.parse_obj(
                self.config.processor.dict().get("config")
            )
        )

    def _run(self, record: TableAndTests) -> Either:
        # First, create the executable test suite if it does not exist yet
        # This could happen if the process is executed from YAML and not the UI
        if record.executable_test_suite:
            # We pass the test suite request to the sink
            return Either(right=record.executable_test_suite)

        ...


    @classmethod
    def create(cls, config_dict: dict, _: OpenMetadata) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config)

    def close(self) -> None:
        """Nothing to close"""
