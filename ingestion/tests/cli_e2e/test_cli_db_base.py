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
import os
import re
import subprocess
from abc import abstractmethod
from enum import Enum
from pathlib import Path
from typing import List
from unittest import TestCase

import pytest
import yaml

from metadata.config.common import load_config_file
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import UTF_8

PATH_TO_RESOURCES = os.path.dirname(os.path.realpath(__file__))

REGEX_AUX = {"log": r"\s+\[[^]]+]\s+[A-Z]+\s+[^}]+}\s+-\s+"}


class E2EType(Enum):
    """
    E2E Type Enum Class
    """

    INGEST = "ingest"
    PROFILER = "profiler"
    INGEST_FILTER_SCHEMA = "ingest-filter-schema"
    INGEST_FILTER_TABLE = "ingest-filter-table"
    INGEST_FILTER_MIX = "ingest-filter-mix"


class CliDBBase(TestCase):
    """
    CLI DB Base class
    """

    class TestSuite(TestCase):  # pylint: disable=too-many-public-methods
        """
        TestSuite class to define test structure
        """

        openmetadata: OpenMetadata
        test_file_path: str
        config_file_path: str

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
                E2EType.INGEST_FILTER_SCHEMA, {"includes": self.get_includes_schemas()}
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
                E2EType.INGEST_FILTER_SCHEMA, {"excludes": self.get_includes_schemas()}
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
                E2EType.INGEST_FILTER_TABLE, {"includes": self.get_includes_tables()}
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
                E2EType.INGEST_FILTER_TABLE, {"excludes": self.get_includes_tables()}
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
                E2EType.INGEST_FILTER_MIX,
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

        def run_command(self, command: str = "ingest") -> str:
            args = [
                "metadata",
                command,
                "-c",
                self.test_file_path,
            ]
            process_status = subprocess.Popen(args, stderr=subprocess.PIPE)
            _, stderr = process_status.communicate()
            return stderr.decode("utf-8")

        def build_config_file(
            self, test_type: E2EType = E2EType.INGEST, extra_args: dict = None
        ) -> None:
            with open(self.config_file_path, encoding=UTF_8) as config_file:
                config_yaml = yaml.safe_load(config_file)
                config_yaml = self.build_yaml(config_yaml, test_type, extra_args)
                with open(self.test_file_path, "w", encoding=UTF_8) as test_file:
                    yaml.dump(config_yaml, test_file)

        def retrieve_statuses(self, result):
            source_status: SourceStatus = self.extract_source_status(result)
            sink_status: SinkStatus = self.extract_sink_status(result)
            return sink_status, source_status

        def retrieve_table(self, table_name_fqn: str) -> Table:
            return self.openmetadata.get_by_name(entity=Table, fqn=table_name_fqn)

        def retrieve_sample_data(self, table_name_fqn: str) -> Table:
            table: Table = self.openmetadata.get_by_name(
                entity=Table, fqn=table_name_fqn
            )
            return self.openmetadata.get_sample_data(table=table)

        def retrieve_lineage(self, table_name_fqn: str) -> dict:
            return self.openmetadata.client.get(
                f"/lineage/table/name/{table_name_fqn}?upstreamDepth=3&downstreamDepth=3"
            )

        @staticmethod
        def get_workflow(connector: str) -> Workflow:
            config_file = Path(
                PATH_TO_RESOURCES + f"/database/{connector}/{connector}.yaml"
            )
            config_dict = load_config_file(config_file)
            return Workflow.create(config_dict)

        @staticmethod
        def extract_source_status(output) -> SourceStatus:
            output_clean = output.replace("\n", " ")
            output_clean = re.sub(" +", " ", output_clean)
            output_clean_ansi = re.compile(r"\x1b[^m]*m")
            output_clean = output_clean_ansi.sub(" ", output_clean)
            if re.match(".* Processor Status: .*", output_clean):
                regex = (
                    r"Source Status:%(log)s(.*?)%(log)sProcessor Status: .*" % REGEX_AUX
                )
                output_clean = re.findall(regex, output_clean.strip())
            else:
                regex = r"Source Status:%(log)s(.*?)%(log)sSink Status: .*" % REGEX_AUX
                output_clean = re.findall(regex, output_clean.strip())
            return SourceStatus.parse_obj(
                eval(output_clean[0].strip())  # pylint: disable=eval-used
            )

        @staticmethod
        def extract_sink_status(output) -> SinkStatus:
            output_clean = output.replace("\n", " ")
            output_clean = re.sub(" +", " ", output_clean)
            output_clean_ansi = re.compile(r"\x1b[^m]*m")
            output_clean = output_clean_ansi.sub("", output_clean)
            regex = r".*Sink Status:%(log)s(.*?)%(log)sWorkflow finished.*" % REGEX_AUX
            output_clean = re.findall(regex, output_clean.strip())[0].strip()
            return SinkStatus.parse_obj(eval(output_clean))  # pylint: disable=eval-used

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
        def build_yaml(config_yaml: dict, test_type: E2EType, extra_args: dict):
            """
            Build yaml as per E2EType
            """
            if test_type == E2EType.PROFILER:
                del config_yaml["source"]["sourceConfig"]["config"]
                config_yaml["source"]["sourceConfig"] = {
                    "config": {
                        "type": "Profiler",
                        "generateSampleData": True,
                        "profileSample": extra_args.get("profileSample", 1)
                        if extra_args
                        else 1,
                    }
                }
                config_yaml["processor"] = {"type": "orm-profiler", "config": {}}
            if test_type == E2EType.INGEST_FILTER_SCHEMA:
                config_yaml["source"]["sourceConfig"]["config"][
                    "schemaFilterPattern"
                ] = extra_args
            if test_type == E2EType.INGEST_FILTER_TABLE:
                config_yaml["source"]["sourceConfig"]["config"][
                    "tableFilterPattern"
                ] = extra_args
            if test_type == E2EType.INGEST_FILTER_MIX:
                config_yaml["source"]["sourceConfig"]["config"][
                    "schemaFilterPattern"
                ] = extra_args["schema"]
                config_yaml["source"]["sourceConfig"]["config"][
                    "tableFilterPattern"
                ] = extra_args["table"]
            return config_yaml
