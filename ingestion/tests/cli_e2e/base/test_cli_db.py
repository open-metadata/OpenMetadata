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
Test database connectors with CLI
"""
from abc import abstractmethod
from datetime import datetime
from typing import List, Optional, Tuple
from unittest import TestCase

import pytest
from pydantic import TypeAdapter

from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.entity.data.table import SystemProfile, Table
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase as OMTestCase
from metadata.ingestion.api.status import Status

from .e2e_types import E2EType
from .test_cli import CliBase


class CliDBBase(TestCase):
    """
    CLI DB Base class
    """

    class TestSuite(TestCase, CliBase):  # pylint: disable=too-many-public-methods
        """
        TestSuite class to define test structure
        """

        @pytest.mark.order(1)
        def test_vanilla_ingestion(self) -> None:
            """1. Deploy vanilla ingestion"""
            # build config file for ingest
            self.build_config_file(E2EType.INGEST)
            # run ingest with new tables
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        @pytest.mark.order(2)
        def test_create_table_with_profiler(self) -> None:
            """2. create a new table + deploy ingestion with views, and profiler.

            We will perform the following steps:
                1. delete table in case it exists
                2. create a table and a view
                3. build config file for ingest
                4. run ingest with new tables `self.run_command()` defaults to `ingestion`
                5. build config file for profiler
                6. run profiler with new tables
            """
            self.delete_table_and_view()
            self.create_table_and_view()
            self.build_config_file()
            self.run_command()
            self.build_config_file(
                E2EType.PROFILER, {"includes": self.get_includes_schemas()}
            )
            result = self.run_command("profile")
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_table_with_profiler(source_status, sink_status)
            self.system_profile_assertions()

        @pytest.mark.order(3)
        def test_auto_classify_data(self) -> None:
            """2. Run the auto classification workflow and validate the sample data

            We will perform the following steps:
                1. build config file for ingest
                2. run ingest with new tables `self.run_command()` defaults to `ingestion`
                3. build config file for auto classification
                4. run auto classification
            """
            self.delete_table_and_view()
            self.create_table_and_view()
            self.build_config_file()
            self.run_command()
            self.build_config_file(
                E2EType.AUTO_CLASSIFICATION, {"includes": self.get_includes_schemas()}
            )
            result = self.run_command("classify")
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_auto_classification_sample_data(source_status, sink_status)

        @pytest.mark.order(4)
        def test_delete_table_is_marked_as_deleted(self) -> None:
            """3. delete the new table + deploy marking tables as deleted

            We will perform the following steps:
                1. delete table created in previous test
                2. build config file for ingest
                3. run ingest `self.run_command()` defaults to `ingestion`
            """
            self.delete_table_and_view()
            self.build_config_file()
            result = self.run_command()

            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_delete_table_is_marked_as_deleted(
                source_status, sink_status
            )

        @pytest.mark.order(5)
        def test_schema_filter_includes(self) -> None:
            """4. vanilla ingestion + include schema filter pattern

            We will perform the following steps:
                1. build config file for ingest with filters
                2. run ingest `self.run_command()` defaults to `ingestion`
            """
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_SCHEMA,
                {"includes": self.get_includes_schemas()},
            )
            result = self.run_command()

            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_schemas_includes(source_status, sink_status)

        @pytest.mark.order(6)
        def test_schema_filter_excludes(self) -> None:
            """5. vanilla ingestion + exclude schema filter pattern

            We will perform the following steps:
                1. build config file for ingest with filters
                2. run ingest `self.run_command()` defaults to `ingestion`
            """
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_SCHEMA,
                {"excludes": self.get_excludes_schemas()},
            )
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_schemas_excludes(source_status, sink_status)

        @pytest.mark.order(7)
        def test_table_filter_includes(self) -> None:
            """6. Vanilla ingestion + include table filter pattern

            We will perform the following steps:
                1. build config file for ingest with filters
                2. run ingest `self.run_command()` defaults to `ingestion`
            """
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_TABLE, {"includes": self.get_includes_tables()}
            )
            result = self.run_command()

            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_tables_includes(source_status, sink_status)

        @pytest.mark.order(8)
        def test_table_filter_excludes(self) -> None:
            """7. Vanilla ingestion + exclude table filter pattern

            We will perform the following steps:
                1. build config file for ingest with filters
                2. run ingest `self.run_command()` defaults to `ingestion`
            """
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_TABLE, {"excludes": self.get_includes_tables()}
            )
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_tables_excludes(source_status, sink_status)

        @pytest.mark.order(9)
        def test_table_filter_mix(self) -> None:
            """8. Vanilla ingestion + include schema filter pattern + exclude table filter pattern

            We will perform the following steps:
                1. build config file for ingest with filters
                2. run ingest `self.run_command()` defaults to `ingestion`
            """
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_MIX,
                {
                    "schema": {"includes": self.get_includes_schemas()},
                    "table": {
                        "includes": self.get_includes_tables(),
                        "excludes": self.get_excludes_tables(),
                    },
                },
            )
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_mix(source_status, sink_status)

        @pytest.mark.order(10)
        def test_usage(self) -> None:
            """9. Run queries in the source (creates, inserts, views) and ingest metadata & Lineage

            This test will need to be implemented on the database specific test classes
            """

        @pytest.mark.order(11)
        def test_lineage(self) -> None:
            """10. Run queries in the source (creates, inserts, views) and ingest metadata & Lineage

            This test will need to be implemented on the database specific test classes
            """
            self.delete_table_and_view()
            self.create_table_and_view()
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_SCHEMA,
                {"includes": self.get_includes_schemas()},
            )
            service_type = self.get_connector_name()
            if hasattr(self, "get_service_type"):
                service_type = self.get_service_type()

            self.run_command()
            self.build_config_file(
                E2EType.LINEAGE,
                {"source": f"{service_type}-lineage"},
            )
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_test_lineage(source_status, sink_status)

        @pytest.mark.order(12)
        def test_profiler_with_time_partition(self) -> None:
            """11. Test time partitioning for the profiler"""
            time_partition = self.get_profiler_time_partition()
            if not time_partition:
                pytest.skip("Profiler time partition not configured. Skipping test.")
            if time_partition:
                processor_config = self.get_profiler_processor_config(time_partition)
                self.build_config_file(
                    E2EType.PROFILER_PROCESSOR,
                    {
                        "processor": processor_config,
                        "includes": self.get_includes_schemas(),
                    },
                )
                result = self.run_command("profile")
                sink_status, source_status = self.retrieve_statuses(result)
                self.assert_for_table_with_profiler_time_partition(
                    source_status,
                    sink_status,
                )

        @pytest.mark.order(13)
        def test_data_quality(self) -> None:
            """12. Test data quality for the connector"""
            if self.get_data_quality_table() is None:
                return
            self.delete_table_and_view()
            self.create_table_and_view()
            self.build_config_file()
            self.run_command()
            self.add_table_profile_config()
            table: Table = self.openmetadata.get_by_name(
                Table, self.get_data_quality_table(), nullable=False
            )
            test_case_definitions = self.get_test_case_definitions()
            self.build_config_file(
                E2EType.DATA_QUALITY,
                {
                    "entity_fqn": table.fullyQualifiedName.root,
                    "test_case_definitions": TypeAdapter(
                        List[TestCaseDefinition]
                    ).dump_python(test_case_definitions),
                },
            )
            result = self.run_command("test")
            try:
                sink_status, source_status = self.retrieve_statuses(result)
                self.assert_status_for_data_quality(source_status, sink_status)
                test_case_entities = [
                    self.openmetadata.get_by_name(
                        OMTestCase,
                        ".".join([table.fullyQualifiedName.root, tcd.name]),
                        fields=["*"],
                        nullable=False,
                    )
                    for tcd in test_case_definitions
                ]
                expected = self.get_expected_test_case_results()
                try:
                    for test_case, expected in zip(test_case_entities, expected):
                        assert_equal_pydantic_objects(
                            expected.model_copy(
                                update={"timestamp": test_case.testCaseResult.timestamp}
                            ),
                            test_case.testCaseResult,
                        )
                finally:
                    for tc in test_case_entities:
                        self.openmetadata.delete(
                            OMTestCase, tc.id, recursive=True, hard_delete=True
                        )
            except AssertionError:
                print(result)
                raise

        def retrieve_table(self, table_name_fqn: str) -> Table:
            return self.openmetadata.get_by_name(entity=Table, fqn=table_name_fqn)

        def retrieve_sample_data(self, table_name_fqn: str) -> Table:
            table: Table = self.openmetadata.get_by_name(
                entity=Table, fqn=table_name_fqn
            )
            return self.openmetadata.get_sample_data(table=table)

        def retrieve_profile(self, table_fqn: str) -> Table:
            table: Table = self.openmetadata.get_latest_table_profile(fqn=table_fqn)

            return table

        def retrieve_lineage(self, entity_fqn: str) -> dict:
            return self.openmetadata.client.get(
                f"/lineage/table/name/{entity_fqn}?upstreamDepth=3&downstreamDepth=3"
            )

        @staticmethod
        @abstractmethod
        def get_connector_name() -> str:
            raise NotImplementedError()

        @abstractmethod
        def create_table_and_view(self) -> None:
            raise NotImplementedError()

        @abstractmethod
        def delete_table_and_view(self) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_vanilla_ingestion(
            self, source_status: Status, sink_status: Status
        ) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_test_lineage(
            self, source_status: Status, sink_status: Status
        ) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_table_with_profiler(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_auto_classification_sample_data(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_for_table_with_profiler_time_partition(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_for_delete_table_is_marked_as_deleted(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_schemas_includes(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_schemas_excludes(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_tables_includes(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_tables_excludes(
            self, source_status: Status, sink_status: Status
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_mix(self, source_status: Status, sink_status: Status):
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_includes_schemas() -> List[str]:
            raise NotImplementedError()

        @classmethod
        def get_excludes_schemas(cls) -> List[str]:
            return cls.get_includes_schemas()

        @staticmethod
        @abstractmethod
        def get_includes_tables() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_excludes_tables() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        def get_profiler_time_partition() -> Optional[dict]:
            return None

        @staticmethod
        def get_profiler_time_partition_results() -> Optional[dict]:
            return None

        @staticmethod
        def delete_queries() -> Optional[List[str]]:
            return None

        @staticmethod
        def update_queries() -> Optional[List[str]]:
            return None

        @staticmethod
        def delete_table_rows() -> None:
            return None

        @staticmethod
        def update_table_row() -> None:
            return None

        @staticmethod
        def get_test_type() -> str:
            return "database"

        def get_profiler_processor_config(self, config: dict) -> dict:
            return {
                "processor": {
                    "type": "orm-profiler",
                    "config": {"tableConfig": [config]},
                }
            }

        def get_data_quality_table(self):
            return None

        def get_test_case_definitions(self) -> List[TestCaseDefinition]:
            pass

        def get_expected_test_case_results(self) -> List[TestCaseResult]:
            pass

        def assert_status_for_data_quality(self, source_status, sink_status):
            pass

        def system_profile_assertions(self):
            cases = self.get_system_profile_cases()
            for table_fqn, expected_profile in cases:
                actual_profiles = self.openmetadata.get_profile_data(
                    table_fqn,
                    start_ts=int((datetime.now().timestamp() - 600) * 1000),
                    end_ts=int(datetime.now().timestamp() * 1000),
                    profile_type=SystemProfile,
                ).entities
                actual_profiles = sorted(
                    actual_profiles,
                    key=lambda x: (-x.timestamp.root, x.operation.value),
                )
                expected_profile = sorted(
                    expected_profile,
                    key=lambda x: (-x.timestamp.root, x.operation.value),
                )
                assert len(actual_profiles) >= len(expected_profile)
                for expected, actual in zip(expected_profile, actual_profiles):
                    try:
                        assert_equal_pydantic_objects(
                            expected.model_copy(update={"timestamp": actual.timestamp}),
                            actual,
                        )
                    except AssertionError as e:
                        raise AssertionError(
                            f"System metrics profile did not return exepcted results for table: {table_fqn}"
                        ) from e

        def get_system_profile_cases(self) -> List[Tuple[str, List[SystemProfile]]]:
            """Return a list of tuples with the table fqn and the expected system profile"""
            return []

        def add_table_profile_config(self):
            pass
