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
Tests for StatusWarningHandler and its integration with Step.
"""
import logging
from unittest import TestCase

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.ingestion.api.status import Status
from metadata.ingestion.api.step import Step
from metadata.utils.logger import StatusWarningHandler, ingestion_logger


def _make_record(module: str, level: int, message: str) -> logging.LogRecord:
    record = logging.LogRecord(
        name="metadata.Ingestion",
        level=level,
        pathname="",
        lineno=0,
        msg=message,
        args=(),
        exc_info=None,
    )
    record.module = module
    return record


class _ConcreteStep(Step):
    @classmethod
    def create(cls, config_dict, metadata, pipeline_name=None):
        return cls()

    @property
    def name(self):
        return "TestStep"

    def close(self):
        pass


class TestStatusWarningHandler(TestCase):
    """Unit tests for StatusWarningHandler in isolation."""

    def setUp(self):
        self.status = Status()
        self.handler = StatusWarningHandler(self.status)

    def test_warning_record_increments_status(self):
        record = _make_record("sql_column_handler", logging.WARNING, "Unknown type tid")
        self.handler.emit(record)

        assert len(self.status.warnings) == 1
        assert self.status.warnings[0] == {"sql_column_handler": "Unknown type tid"}

    def test_debug_record_is_ignored(self):
        record = _make_record("sql_column_handler", logging.DEBUG, "some debug info")
        self.handler.emit(record)

        assert len(self.status.warnings) == 0

    def test_status_module_is_skipped(self):
        record = _make_record("status", logging.WARNING, "error from Status.failed()")
        self.handler.emit(record)

        assert len(self.status.warnings) == 0

    def test_step_module_is_skipped(self):
        record = _make_record("step", logging.WARNING, "error from Step.run()")
        self.handler.emit(record)

        assert len(self.status.warnings) == 0

    def test_multiple_warnings_all_counted(self):
        modules = ["sql_column_handler", "postgres_metadata", "common_db_source"]
        for module in modules:
            self.handler.emit(
                _make_record(module, logging.WARNING, f"warning from {module}")
            )

        assert len(self.status.warnings) == 3


class TestStepHandlerAttachment(TestCase):
    """Integration tests verifying the handler is wired into the Step run() lifecycle."""

    def setUp(self):
        self._log = ingestion_logger()
        self._original_handlers = self._log.handlers[:]
        self.step = _ConcreteStep()

    def tearDown(self):
        self._log.handlers = self._original_handlers

    def test_warning_inside_run_scope_populates_status(self):
        self.step._activate_handler()
        try:
            ingestion_logger().warning(
                "Unexpected exception processing column [bad_col]: Invalid name"
            )
        finally:
            self.step._deactivate_handler()

        assert len(self.step.status.warnings) == 1
        warning = self.step.status.warnings[0]
        assert "Unexpected exception processing column" in list(warning.values())[0]

    def test_warning_outside_run_scope_does_not_populate_status(self):
        ingestion_logger().warning("warning emitted before run() starts")

        assert len(self.step.status.warnings) == 0

    def test_status_failed_does_not_increment_warning_count(self):
        self.step._activate_handler()
        try:
            self.step.status.failed(
                StackTraceError(
                    name="some_entity", error="something went wrong", stackTrace="tb"
                )
            )
        finally:
            self.step._deactivate_handler()

        assert len(self.step.status.warnings) == 0
        assert len(self.step.status.failures) == 1
