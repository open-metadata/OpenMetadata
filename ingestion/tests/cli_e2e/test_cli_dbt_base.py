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
Test DBT with CLI
"""
import os
import subprocess
from abc import abstractmethod
from pathlib import Path
from typing import List
from unittest import TestCase

import pytest

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.testCase import TestCase as OMTestCase
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from .test_cli_db_base import CliDBBase

PATH_TO_RESOURCES = os.path.dirname(os.path.realpath(__file__))


class CliDBTBase(TestCase):
    class TestSuite(TestCase):
        openmetadata: OpenMetadata
        dbt_file_path: str
        config_file_path: str

        # 1. deploy vanilla ingestion
        @pytest.mark.order(1)
        def test_connector_ingestion(self) -> None:
            # run ingest with dbt tables
            result = self.run_command(file_path=self.config_file_path)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        # 2. deploy dbt ingestion
        @pytest.mark.order(2)
        def test_dbt_ingestion(self) -> None:
            # run the dbt ingestion
            result = self.run_command(file_path=self.dbt_file_path)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_dbt_ingestion(source_status, sink_status)

        # 3. run tests on dbt ingestion
        @pytest.mark.order(3)
        def test_entities(self) -> None:
            for table_fqn in self.fqn_dbt_tables():
                table: Table = self.openmetadata.get_by_name(
                    entity=Table, fqn=table_fqn, fields="*"
                )
                data_model = table.dataModel
                self.assertTrue(len(data_model.columns) > 0)
                self.assertIsNotNone(data_model.rawSql)
                self.assertIsNotNone(data_model.sql)
                self.assertIsNotNone(data_model.upstream)
                self.assertIsNotNone(data_model.description)
                self.assertIsNotNone(table.description)
                self.assertIsNotNone(data_model.owner)
                self.assertIsNotNone(table.owner)
                self.assertTrue(len(data_model.tags) > 0)
                self.assertTrue(len(table.tags) > 0)

        # 4. run tests on dbt test cases and test results
        @pytest.mark.order(4)
        def test_dbt_test_cases(self) -> None:
            test_suite: TestSuite = self.openmetadata.get_by_name(
                entity=TestSuite, fqn="DBT TEST SUITE"
            )

            test_case_entity_list = self.openmetadata.list_entities(
                entity=OMTestCase,
                fields=["testSuite", "entityLink", "testDefinition"],
                params={"testSuiteId": test_suite.id.__root__},
            )
            self.assertTrue(len(test_case_entity_list.entities) == 23)

        # 5. test dbt lineage
        @pytest.mark.order(5)
        def test_lineage(self) -> None:
            for table_fqn in self.fqn_dbt_tables():
                lineage = self.retrieve_lineage(table_fqn)
                self.assertTrue(len(lineage["upstreamEdges"]) >= 4)

        def run_command(self, file_path: str, command: str = "ingest") -> str:
            args = [
                "metadata",
                command,
                "-c",
                file_path,
            ]
            process_status = subprocess.run(args, capture_output=True)
            return process_status.stderr.decode("utf-8")

        @staticmethod
        def retrieve_statuses(result):
            source_status: SourceStatus = CliDBBase.TestSuite.extract_source_status(
                result
            )
            sink_status: SinkStatus = CliDBBase.TestSuite.extract_sink_status(result)
            return sink_status, source_status

        def retrieve_lineage(self, table_name_fqn: str) -> dict:
            return self.openmetadata.client.get(
                f"/lineage/table/name/{table_name_fqn}?upstreamDepth=3&downstreamDepth=3"
            )

        @staticmethod
        def get_workflow(connector: str) -> Workflow:
            config_file = Path(PATH_TO_RESOURCES + f"/dbt/{connector}/{connector}.yaml")
            config_dict = load_config_file(config_file)
            return Workflow.create(config_dict)

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
            self, source_status: SourceStatus, sink_status: SinkStatus
        ) -> None:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_dbt_ingestion(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ) -> None:
            raise NotImplementedError()
