#  Copyright 2022 Collate
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
Test database connectors which extend from `CommonDbSourceService` with CLI
"""
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from sqlalchemy.engine import Engine

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.status import Status
from metadata.workflow.metadata import MetadataWorkflow

from ..base.test_cli import PATH_TO_RESOURCES
from ..base.test_cli_db import CliDBBase


class CliCommonDB:
    class TestSuite(CliDBBase.TestSuite, ABC):
        engine: Engine

        @classmethod
        def setUpClass(cls) -> None:
            connector = cls.get_connector_name()
            workflow: MetadataWorkflow = cls.get_workflow(
                connector, cls.get_test_type()
            )
            cls.engine = workflow.source.engine
            cls.openmetadata = workflow.source.metadata
            cls.config_file_path = str(
                Path(PATH_TO_RESOURCES + f"/database/{connector}/{connector}.yaml")
            )
            cls.test_file_path = str(
                Path(PATH_TO_RESOURCES + f"/database/{connector}/test.yaml")
            )

        @classmethod
        def tearDownClass(cls):
            workflow = OpenMetadataWorkflowConfig.model_validate(
                load_config_file(Path(cls.config_file_path))
            )
            db_service: DatabaseService = cls.openmetadata.get_by_name(
                DatabaseService, workflow.source.serviceName
            )
            if db_service and os.getenv("E2E_CLEAN_DB", "false") == "true":
                cls.openmetadata.delete(
                    DatabaseService, db_service.id, hard_delete=True, recursive=True
                )

        def tearDown(self) -> None:
            self.engine.dispose()

        def assert_for_vanilla_ingestion(
            self, source_status: Status, sink_status: Status
        ) -> None:
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(source_status.warnings), 0)
            self.assertEqual(len(source_status.filtered), 0)
            self.assertGreaterEqual(
                (len(source_status.records) + len(source_status.updated_records)),
                self.expected_tables(),
            )
            self.assertEqual(len(sink_status.failures), 0)
            self.assertEqual(len(sink_status.warnings), 0)
            self.assertGreater(
                (len(sink_status.records) + len(sink_status.updated_records)),
                self.expected_tables(),
            )

        def assert_for_table_with_profiler(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                (len(source_status.records) + len(source_status.updated_records)),
                self.expected_profiled_tables(),
            )
            self.assertEqual(len(sink_status.failures), 0)
            self.assertGreaterEqual(
                (len(sink_status.records) + len(sink_status.updated_records)),
                self.expected_profiled_tables(),
            )
            # Since we removed view lineage from metadata workflow as part
            # of https://github.com/open-metadata/OpenMetadata/pull/18558
            # we need to introduce Lineage E2E base and add view lineage check there.

        def assert_for_test_lineage(self, source_status: Status, sink_status: Status):
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(source_status.warnings), 0)
            self.assertEqual(len(sink_status.failures), 0)
            self.assertEqual(len(sink_status.warnings), 0)
            self.assertGreaterEqual(len(sink_status.records), 0)
            lineage_data = self.retrieve_lineage(self.fqn_created_table())
            retrieved_view_column_lineage_count = len(
                lineage_data["downstreamEdges"][0]["lineageDetails"]["columnsLineage"]
            )
            self.assertEqual(
                retrieved_view_column_lineage_count, self.view_column_lineage_count()
            )

            retrieved_lineage_node = lineage_data["nodes"][0]["fullyQualifiedName"]
            self.assertEqual(retrieved_lineage_node, self.expected_lineage_node())

        def assert_auto_classification_sample_data(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                (len(source_status.records) + len(source_status.updated_records)),
                self.expected_profiled_tables(),
            )
            sample_data = self.retrieve_sample_data(self.fqn_created_table()).sampleData
            self.assertEqual(len(sample_data.rows), self.expected_sample_size())

        def assert_for_table_with_profiler_time_partition(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertEqual(len(sink_status.failures), 0)
            profile = self.retrieve_profile(self.fqn_created_table())
            expected_profiler_time_partition_results = (
                self.get_profiler_time_partition_results()
            )
            if expected_profiler_time_partition_results:
                table_profile = profile.profile.model_dump()
                for key in expected_profiler_time_partition_results["table_profile"]:
                    self.assertEqual(
                        table_profile[key],
                        expected_profiler_time_partition_results["table_profile"][key],
                    )

                for column in profile.columns:
                    expected_column_profile = next(
                        (
                            profile.get(column.name.root)
                            for profile in expected_profiler_time_partition_results[
                                "column_profile"
                            ]
                            if profile.get(column.name.root)
                        ),
                        None,
                    )
                    if expected_column_profile:
                        column_profile = column.profile.model_dump()
                        for key in expected_column_profile:  # type: ignore
                            if key == "nonParametricSkew":
                                self.assertEqual(
                                    column_profile[key].__round__(10),
                                    expected_column_profile[key].__round__(10),
                                )
                                continue
                            self.assertEqual(
                                column_profile[key], expected_column_profile[key]
                            )

        def assert_for_delete_table_is_marked_as_deleted(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(self.retrieve_table(self.fqn_deleted_table()), None)

        def assert_filtered_schemas_includes(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                len(source_status.filtered), self.expected_filtered_schema_includes()
            )

        def assert_filtered_schemas_excludes(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                len(source_status.filtered), self.expected_filtered_schema_excludes()
            )

        def assert_filtered_tables_includes(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                len(source_status.filtered), self.expected_filtered_table_includes()
            )

        def assert_filtered_tables_excludes(
            self, source_status: Status, sink_status: Status
        ):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                len(source_status.filtered), self.expected_filtered_table_excludes()
            )

        def assert_filtered_mix(self, source_status: Status, sink_status: Status):
            self.assertEqual(len(source_status.failures), 0)
            self.assertGreaterEqual(
                len(source_status.filtered), self.expected_filtered_mix()
            )

        @staticmethod
        @abstractmethod
        def expected_tables() -> int:
            raise NotImplementedError()

        @abstractmethod
        def expected_sample_size(self) -> int:
            raise NotImplementedError()

        @abstractmethod
        def view_column_lineage_count(self) -> int:
            raise NotImplementedError()

        @abstractmethod
        def expected_lineage_node(self) -> str:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def fqn_created_table() -> str:
            raise NotImplementedError()

        @staticmethod
        def _fqn_deleted_table() -> Optional[str]:
            return None

        @staticmethod
        def _expected_profiled_tables() -> int:
            return None

        def fqn_deleted_table(self) -> str:
            if self._fqn_deleted_table() is None:
                return self.fqn_created_table()
            return self._fqn_deleted_table()  # type: ignore

        def expected_profiled_tables(self) -> int:
            if self._expected_profiled_tables() is None:
                return self.expected_tables()
            return self._expected_profiled_tables()

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
