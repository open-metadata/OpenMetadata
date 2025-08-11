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
Test DBT with CLI
"""
from abc import abstractmethod
from typing import List
from unittest import TestCase

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.testDefinition import TestDefinition, TestPlatform
from metadata.ingestion.api.status import Status

from .test_cli import CliBase


class CliDBTBase(TestCase):
    class TestSuite(TestCase, CliBase):
        dbt_file_path: str

        # 1. deploy vanilla ingestion
        @pytest.mark.order(1)
        def test_connector_ingestion(self) -> None:
            # run ingest with dbt tables
            result = self.run_command(test_file_path=self.config_file_path)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        # 2. deploy dbt ingestion
        @pytest.mark.order(2)
        def test_dbt_ingestion(self) -> None:
            # run the dbt ingestion
            result = self.run_command(test_file_path=self.dbt_file_path)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_dbt_ingestion(source_status, sink_status)

        # 3. run tests on dbt ingestion
        @pytest.mark.order(3)
        def test_entities(self) -> None:
            for table_fqn in self.fqn_dbt_tables():
                table: Table = self.openmetadata.get_by_name(
                    entity=Table, fqn=table_fqn, fields=["*"]
                )
                data_model = table.dataModel
                self.assertTrue(len(data_model.columns) > 0)
                self.assertIsNotNone(data_model.rawSql)
                self.assertIsNotNone(data_model.sql)
                self.assertIsNotNone(data_model.upstream)
                self.assertIsNotNone(data_model.description)
                self.assertIsNotNone(table.description)
                self.assertIsNotNone(data_model.owners)
                self.assertIsNotNone(table.owners)
                self.assertTrue(len(data_model.tags) > 0)
                self.assertTrue(len(table.tags) > 0)

        # 4. run tests on dbt test cases and test results
        @pytest.mark.order(4)
        def test_dbt_test_cases(self) -> None:
            test_case_entity_list = self.openmetadata.list_entities(
                entity=TestDefinition,
                params={"testPlatform": TestPlatform.DBT.value},
            )
            self.assertTrue(len(test_case_entity_list.entities) == 26)

        # 5. test dbt lineage
        @pytest.mark.order(5)
        def test_lineage(self) -> None:
            for table_fqn in self.fqn_dbt_tables():
                lineage = self.retrieve_lineage(table_fqn)
                self.assertTrue(len(lineage["upstreamEdges"]) >= 4)

        @staticmethod
        def get_test_type() -> str:
            return "dbt"

        @staticmethod
        @abstractmethod
        def get_connector_name() -> str:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_tables() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def expected_records() -> int:
            raise NotImplementedError()

        @staticmethod
        @abstractmethod
        def fqn_dbt_tables() -> List[str]:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_vanilla_ingestion(
            self, source_status: Status, sink_status: Status
        ) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_dbt_ingestion(
            self, source_status: Status, sink_status: Status
        ) -> None:
            raise NotImplementedError()
