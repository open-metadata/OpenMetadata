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
workflow_output_handler utils tests
"""
import re
from typing import Tuple
from unittest import TestCase
from unittest.mock import Mock

from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.api.bulk_sink import BulkSinkStatus
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.stage import StageStatus
from metadata.ingestion.api.status import Status
from metadata.utils.logger import Loggers
from metadata.utils.workflow_output_handler import (
    print_data_insight_status,
    print_status,
    print_test_suite_status,
)


class TestWorkflowConfig:
    loggerLevel: LogLevels


class TestConfig:
    workflowConfig: TestWorkflowConfig = TestWorkflowConfig()


class TestWorkflow:
    config: TestConfig = TestConfig()

    @staticmethod
    def result_status():
        return 0


def create_mock(status: Status) -> Tuple[Mock, Status]:
    mock = Mock()
    status.warnings = ["warning"]
    status.records = ["record"]
    status.failures = ["failure"]
    if hasattr(status, "filtered"):
        status.filtered = ["filtered"]
    mock.status = status
    mock.get_status.return_value = status
    return mock, status


def strip_ansi_codes(s: str):
    return re.sub(r"\x1b\[([0-9,A-Z]{1,2}(;[0-9]{1,2})?(;[0-9]{3})?)?[m|K]?", "", s)


class WorkflowOutputHandlerTests(TestCase):

    source, source_status = create_mock(SourceStatus())
    processor, _ = create_mock(ProcessorStatus())
    data_processor, _ = create_mock(SourceStatus())
    stage, _ = create_mock(StageStatus())
    sink, _ = create_mock(SinkStatus())
    bulk_sink, _ = create_mock(BulkSinkStatus())

    workflow = TestWorkflow()
    workflow.source = source
    workflow.status = source_status
    workflow.processor = processor
    workflow.data_processor = data_processor
    workflow.stage = stage
    workflow.sink = sink
    workflow.bulk_sink = bulk_sink

    def test_output_when_debug_is_disabled(self):
        expected_summary = """Workflow Summary:
Total processed records: 4
Total warnings: 4
Total filtered: 1
Total errors: 4
List of errors:
\t- [Source]: failure
\t- [Stage]: failure
\t- [Sink]: failure
\t- [Bulk Sink]: failure

Success %: 50.0"""
        self.workflow.config.workflowConfig.loggerLevel = LogLevels.INFO
        with self.assertLogs(Loggers.UTILS.value, level="INFO") as logger:
            print_status(self.workflow)
            output = "\n".join(
                [
                    re.sub(".*Utils:", "", strip_ansi_codes(line))
                    for line in logger.output
                ]
            )
            self.assertIn(expected_summary, output)

    def test_output_when_debug_is_enabled(self):
        expected_summary = """Statuses detailed info:
Source Status:
{'failures': ['failure'],
 'filtered': ['filtered'],
 'records': ['record'],
 'success': [],
 'warnings': ['warning']}
Stage Status:
{'failures': ['failure'], 'records': ['record'], 'warnings': ['warning']}
Sink Status:
{'failures': ['failure'], 'records': ['record'], 'warnings': ['warning']}
Bulk Sink Status:
{'failures': ['failure'], 'records': ['record'], 'warnings': ['warning']}
Workflow Summary:
Total processed records: 4
Total warnings: 4
Total filtered: 1
Total errors: 4
List of errors:
\t- [Source]: failure
\t- [Stage]: failure
\t- [Sink]: failure
\t- [Bulk Sink]: failure

Success %: 50.0"""
        self.workflow.config.workflowConfig.loggerLevel = LogLevels.DEBUG
        with self.assertLogs(Loggers.UTILS.value, level="INFO") as logger:
            print_status(self.workflow)
            output = "\n".join(
                [
                    re.sub(".*Utils:", "", strip_ansi_codes(line))
                    for line in logger.output
                ]
            )
            output = re.sub(" 'source_start_time': [\d\.]+,\n", "", output)
            self.assertIn(expected_summary, output)

    def test_output_when_debug_is_disabled_data_insight(self):
        expected_summary = """Workflow Summary:
Total processed records: 2
Total warnings: 2
Total filtered: 1
Total errors: 2
List of errors:
\t- [Sink]: failure
\t- [Processor]: failure

Success %: 50.0"""
        self.workflow.config.workflowConfig.loggerLevel = LogLevels.INFO
        with self.assertLogs(Loggers.UTILS.value, level="INFO") as logger:
            print_data_insight_status(self.workflow)
            output = "\n".join(
                [
                    re.sub(".*Utils:", "", strip_ansi_codes(line))
                    for line in logger.output
                ]
            )
            self.assertIn(expected_summary, output)

    def test_output_when_debug_is_disabled_test_suite(self):
        expected_summary = """Workflow Summary:
Total processed records: 2
Total warnings: 2
Total filtered: 1
Total errors: 2
List of errors:
\t- [Sink]: failure
\t- [Processor]: failure

Success %: 50.0
Workflow finished successfully"""
        self.workflow.config.workflowConfig.loggerLevel = LogLevels.INFO
        with self.assertLogs(Loggers.UTILS.value, level="INFO") as logger:
            print_test_suite_status(self.workflow)
            output = "\n".join(
                [
                    re.sub(".*Utils:", "", strip_ansi_codes(line))
                    for line in logger.output
                ]
            )
            self.assertIn(expected_summary, output)
