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
Test database connectors with CLI
"""
from abc import abstractmethod
from typing import List
from unittest import TestCase

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus

from .test_cli import CliBase, E2EType


class CliDBBase(TestCase):
    """
    CLI DB Base class
    """

    class TestSuite(TestCase, CliBase):  # pylint: disable=too-many-public-methods
        """
        TestSuite class to define test structure
        """

        # 1. deploy vanilla ingestion
        @pytest.mark.order(1)
        def test_vanilla_ingestion(self) -> None:
            # build config file for ingest
            self.build_config_file(E2EType.INGEST)
            # run ingest with new tables
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        # 2. create a new table + deploy ingestion with views, sample data, and profiler
        @pytest.mark.order(2)
        def test_create_table_with_profiler(self) -> None:
            # delete table in case it exists
            self.delete_table_and_view()
            # create a table and a view
            self.create_table_and_view()
            # build config file for ingest
            self.build_config_file()
            # run ingest with new tables
            self.run_command()
            # build config file for profiler
            self.build_config_file(E2EType.PROFILER)
            # run profiler with new tables
            result = self.run_command("profile")
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_table_with_profiler(source_status, sink_status)

        # 3. delete the new table + deploy marking tables as deleted
        @pytest.mark.order(3)
        def test_delete_table_is_marked_as_deleted(self) -> None:
            # delete table created in previous test
            self.delete_table_and_view()
            # build config file for ingest
            self.build_config_file()
            # run ingest
            result = self.run_command()

            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_delete_table_is_marked_as_deleted(
                source_status, sink_status
            )

        # 4. vanilla ingestion + include schema filter pattern
        @pytest.mark.order(4)
        def test_schema_filter_includes(self) -> None:
            # build config file for ingest with filters
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_SCHEMA,
                {"includes": self.get_includes_schemas()},
            )
            # run ingest
            result = self.run_command()

            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_schemas_includes(source_status, sink_status)

        # 5. vanilla ingestion + exclude schema filter pattern
        @pytest.mark.order(5)
        def test_schema_filter_excludes(self) -> None:
            # build config file for ingest with filters
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_SCHEMA,
                {"excludes": self.get_includes_schemas()},
            )
            # run ingest
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_schemas_excludes(source_status, sink_status)

        # 6. Vanilla ingestion + include table filter pattern
        @pytest.mark.order(6)
        def test_table_filter_includes(self) -> None:
            # build config file for ingest with filters
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_TABLE, {"includes": self.get_includes_tables()}
            )
            # run ingest
            result = self.run_command()

            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_tables_includes(source_status, sink_status)

        # 7. Vanilla ingestion + include table filter pattern
        @pytest.mark.order(7)
        def test_table_filter_excludes(self) -> None:
            # build config file for ingest with filters
            self.build_config_file(
                E2EType.INGEST_DB_FILTER_TABLE, {"excludes": self.get_includes_tables()}
            )
            # run ingest
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_tables_excludes(source_status, sink_status)

        # 8. Vanilla ingestion mixing filters
        @pytest.mark.order(8)
        def test_table_filter_mix(self) -> None:
            # build config file for ingest with filters
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
            # run ingest
            result = self.run_command()
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_filtered_mix(source_status, sink_status)

        # 9. Run usage
        @pytest.mark.order(9)
        def test_usage(self) -> None:
            # to be implemented
            pass

        # 10. Run queries in the source (creates, inserts, views) and ingest metadata & Lineage
        @pytest.mark.order(10)
        def test_lineage(self) -> None:
            # to be implemented
            pass

        def retrieve_table(self, table_name_fqn: str) -> Table:
            return self.openmetadata.get_by_name(entity=Table, fqn=table_name_fqn)

        def retrieve_sample_data(self, table_name_fqn: str) -> Table:
            table: Table = self.openmetadata.get_by_name(
                entity=Table, fqn=table_name_fqn
            )
            return self.openmetadata.get_sample_data(table=table)

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
            self, source_status: SourceStatus, sink_status: SinkStatus
        ) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_table_with_profiler(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_for_delete_table_is_marked_as_deleted(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_schemas_includes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_schemas_excludes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_tables_includes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_tables_excludes(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @abstractmethod
        def assert_filtered_mix(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ):
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_includes_schemas() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_includes_tables() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def get_excludes_tables() -> List[str]:
            raise NotImplementedError()

        @staticmethod
        def get_test_type() -> str:
            return "database"
