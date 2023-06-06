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
import random
import re
import string
from typing import Tuple
from unittest import TestCase
from unittest.mock import Mock

from metadata.generated.schema.metadataIngestion.workflow import LogLevels
from metadata.ingestion.api.bulk_sink import BulkSinkStatus
from metadata.ingestion.api.processor import ProcessorStatus
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.stage import StageStatus
from metadata.ingestion.api.status import StackTraceError, Status
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
    status.failures = [
        StackTraceError(name="name", error="error", stack_trace="stack_trace")
    ]
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
        expected_summary = """List of failures:

+-----------+---------------+-----------+---------------+
| From      | Entity Name   | Message   | Stack Trace   |
+===========+===============+===========+===============+
| Source    | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Stage     | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Sink      | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Bulk Sink | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
Workflow Summary:
Total processed records: 4
Total warnings: 4
Total filtered: 1
Total errors: 4
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
{'failures': [StackTraceError(name='name', error='error', stack_trace='stack_trace')],
 'filtered': ['filtered'],
 'records': ['record'],
 'success': [],
 'warnings': ['warning']}
Stage Status:
{'failures': [StackTraceError(name='name', error='error', stack_trace='stack_trace')], 'records': ['record'], 'warnings': ['warning']}
Sink Status:
{'failures': [StackTraceError(name='name', error='error', stack_trace='stack_trace')], 'records': ['record'], 'warnings': ['warning']}
Bulk Sink Status:
{'failures': [StackTraceError(name='name', error='error', stack_trace='stack_trace')], 'records': ['record'], 'warnings': ['warning']}
Processor Status:
{'failures': [StackTraceError(name='name', error='error', stack_trace='stack_trace')], 'records': ['record'], 'warnings': ['warning']}
List of failures:

+-----------+---------------+-----------+---------------+
| From      | Entity Name   | Message   | Stack Trace   |
+===========+===============+===========+===============+
| Source    | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Stage     | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Sink      | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Bulk Sink | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
Workflow Summary:
Total processed records: 4
Total warnings: 4
Total filtered: 1
Total errors: 4
Success %: 50.0
"""
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
        expected_summary = """List of failures:

+-----------+---------------+-----------+---------------+
| From      | Entity Name   | Message   | Stack Trace   |
+===========+===============+===========+===============+
| Sink      | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Processor | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
Workflow Summary:
Total processed records: 2
Total warnings: 2
Total filtered: 1
Total errors: 2
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
        expected_summary = """List of failures:

+-----------+---------------+-----------+---------------+
| From      | Entity Name   | Message   | Stack Trace   |
+===========+===============+===========+===============+
| Sink      | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
| Processor | name          | error     | stack_trace   |
+-----------+---------------+-----------+---------------+
Workflow Summary:
Total processed records: 2
Total warnings: 2
Total filtered: 1
Total errors: 2
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

    def test_long_output_message(self):
        workflow = TestWorkflow()
        workflow.config.workflowConfig.loggerLevel = LogLevels.INFO
        source, source_status = create_mock(SourceStatus())
        source_status.failures = []
        long_line = "".join(
            random.choice(string.ascii_uppercase + string.digits) for _ in range(500)
        )
        long_stack_trace = "\n".join([long_line for _ in range(50)])
        for i in range(102):
            source_status.failures.append(
                StackTraceError(
                    name=f"name {i}", error=long_line, stack_trace=long_stack_trace
                )
            )
        workflow.status = source_status
        with self.assertLogs(Loggers.UTILS.value, level="INFO") as logger:
            print_test_suite_status(workflow)
            output = "\n".join([strip_ansi_codes(line) for line in logger.output])
            self.assertIn("Showing only the first 100 failures:", output)
            self.assertEqual(output.count(long_line), 5100)

    def test_empty_workflow_display_nothing(self):
        expected_summary = """INFO:metadata.Utils:Workflow Summary:
INFO:metadata.Utils:Total processed records: 0
INFO:metadata.Utils:Total warnings: 0
INFO:metadata.Utils:Total filtered: 0
INFO:metadata.Utils:Total errors: 0
INFO:metadata.Utils:Success %: 100.0
INFO:metadata.Utils:Workflow finished successfully"""
        workflow = TestWorkflow()
        workflow.status = SourceStatus()
        with self.assertLogs(Loggers.UTILS.value, level="INFO") as logger:
            print_test_suite_status(workflow)
            output = "\n".join([strip_ansi_codes(line) for line in logger.output])
            self.assertEqual(expected_summary, output)
