#  Copyright 2022 Collate
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
Test database connectors which extend from `CommonDbSourceService` with CLI
"""
from abc import ABC, abstractmethod
from pathlib import Path

from sqlalchemy.engine import Engine

from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.workflow import Workflow

from .test_cli_db_base import PATH_TO_RESOURCES, CliDBBase


class CliCommonDB:
    class TestSuite(CliDBBase.TestSuite, ABC):
        engine: Engine

        @classmethod
        def setUpClass(cls) -> None:
            connector = cls.get_connector_name()
            workflow: Workflow = cls.get_workflow(connector)
            cls.engine = workflow.source.engine
            cls.openmetadata = workflow.source.metadata
            cls.config_file_path = str(
                Path(PATH_TO_RESOURCES + f"/database/{connector}/{connector}.yaml")
            )
            cls.test_file_path = str(
                Path(PATH_TO_RESOURCES + f"/database/{connector}/test.yaml")
            )

        def tearDown(self) -> None:
            self.engine.dispose()

        def assert_for_vanilla_ingestion(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ) -> None:
            self.assertTrue(len(source_status.failures) == 0)
            self.assertTrue(len(source_status.warnings) == 0)
            self.assertTrue(len(source_status.filtered) == 0)
            self.assertTrue(len(source_status.records) >= self.expected_tables())
            self.assertTrue(len(sink_status.failures) == 0)
            self.assertTrue(len(sink_status.warnings) == 0)
            self.assertTrue(len(sink_status.records) > self.expected_tables())

        def assert_for_table_with_profiler(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertTrue(len(source_status.failures) == 0)
            self.assertTrue(len(source_status.records) > self.expected_tables())
            self.assertTrue(len(sink_status.failures) == 0)
            self.assertTrue(len(sink_status.records) > self.expected_tables())
            sample_data = self.retrieve_sample_data(self.fqn_created_table()).sampleData
            lineage = self.retrieve_lineage(self.fqn_created_table())
            self.assertTrue(len(sample_data.rows) == self.inserted_rows_count())
            self.assertTrue(
                len(lineage["downstreamEdges"][0]["lineageDetails"]["columnsLineage"])
                == self.view_column_lineage_count()
            )

        def assert_for_delete_table_is_marked_as_deleted(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertEqual(self.retrieve_table(self.fqn_created_table()), None)

        def assert_filtered_schemas_includes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertTrue((len(source_status.failures) == 0))
            self.assertTrue(
                (
                    len(source_status.filtered)
                    == self.expected_filtered_schema_includes()
                )
            )

        def assert_filtered_schemas_excludes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertTrue((len(source_status.failures) == 0))
            self.assertTrue(
                (
                    len(source_status.filtered)
                    == self.expected_filtered_schema_excludes()
                )
            )

        def assert_filtered_tables_includes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertTrue((len(source_status.failures) == 0))
            self.assertTrue(
                (len(source_status.filtered) == self.expected_filtered_table_includes())
            )

        def assert_filtered_tables_excludes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertTrue((len(source_status.failures) == 0))
            self.assertTrue(
                (len(source_status.filtered) == self.expected_filtered_table_excludes())
            )

        def assert_filtered_mix(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            self.assertTrue((len(source_status.failures) == 0))
            self.assertTrue(
                (len(source_status.filtered) == self.expected_filtered_mix())
            )

        @staticmethod
        @abstractmethod
        def expected_tables() -> int:
            raise NotImplementedError()

        @abstractmethod
        def inserted_rows_count(self) -> int:
            raise NotImplementedError()

        @abstractmethod
        def view_column_lineage_count(self) -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def fqn_created_table() -> str:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_schema_includes() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_schema_excludes() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_table_includes() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_table_excludes() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_filtered_mix() -> int:
            raise NotImplementedError()
