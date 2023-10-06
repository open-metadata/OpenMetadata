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
from metadata.data_quality.processor.test_case_runner import TestCaseRunner
from metadata.data_quality.source.test_suite import TestSuiteSource
from metadata.ingestion.api.processor import Processor
from metadata.ingestion.api.sink import Sink
from metadata.utils.importer import import_sink_class
from metadata.utils.logger import test_suite_logger
from metadata.workflow.base import BaseWorkflow

logger = test_suite_logger()


class TestSuiteWorkflow(BaseWorkflow):
    """
    DAta Quality ingestion workflow implementation

    We check the source connection test when initializing
    this workflow. No need to do anything here if this does not pass
    """

    def set_steps(self):
        self.source = TestSuiteSource.create(self.config.dict(), self.metadata)

        test_runner_processor = self._get_test_runner_processor()
        sink = self._get_sink()

        self.steps = (test_runner_processor, sink)

    def _get_sink(self) -> Sink:
        sink_type = self.config.sink.type
        sink_class = import_sink_class(sink_type=sink_type)
        sink_config = self.config.sink.dict().get("config", {})
        sink: Sink = sink_class.create(sink_config, self.metadata)
        logger.debug(f"Sink type:{self.config.sink.type}, {sink_class} configured")

        return sink

    def _get_test_runner_processor(self) -> Processor:
        return TestCaseRunner.create(self.config.dict(), self.metadata)
