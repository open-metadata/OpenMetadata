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
import re
from abc import abstractmethod
from contextlib import redirect_stdout
from enum import Enum
from io import StringIO
from pathlib import Path
from typing import List
from unittest import TestCase

import pytest
import yaml

from metadata.cmd import metadata
from metadata.config.common import load_config_file
from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.api.sink import SinkStatus
from metadata.ingestion.api.source import SourceStatus
from metadata.ingestion.api.workflow import Workflow
from metadata.ingestion.ometa.ometa_api import OpenMetadata

PATH_TO_RESOURCES = os.path.dirname(os.path.realpath(__file__))


class CliDBTBase(TestCase):
    class TestSuite(TestCase):
        catcher = StringIO()
        openmetadata: OpenMetadata
        test_file_path: str
        config_file_path: str

        # 1. deploy vanilla ingestion
        @pytest.mark.order(1)
        def test_connector_ingestion(self) -> None:
            # build config file for ingest
            self.build_config_file()
            # run ingest with new tables
            self.run_command()
            result = self.catcher.getvalue()
            self.catcher.truncate(0)
            sink_status, source_status = self.retrieve_statuses(result)
            self.assert_for_vanilla_ingestion(source_status, sink_status)

        def run_command(self, command: str = "ingest"):
            args = [
                command,
                "-c",
                self.test_file_path,
            ]
            with redirect_stdout(self.catcher):
                with self.assertRaises(SystemExit):
                    metadata(args)

        def build_config_file(
            self, extra_args: dict = None
        ) -> None:
            with open(self.config_file_path) as f:
                config_yaml = yaml.safe_load(f)
                # config_yaml = self.build_yaml(config_yaml, extra_args)
                with open(self.test_file_path, "w") as w:
                    yaml.dump(config_yaml, w)

        def retrieve_statuses(self, result):
            source_status: SourceStatus = self.extract_source_status(result)
            sink_status: SinkStatus = self.extract_sink_status(result)
            return sink_status, source_status

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
                output_clean = re.findall(
                    "Source Status: (.*?) Processor Status: .*", output_clean.strip()
                )
            else:
                output_clean = re.findall(
                    "Source Status: (.*?) Sink Status: .*", output_clean.strip()
                )
            return SourceStatus.parse_obj(eval(output_clean[0].strip()))

        @staticmethod
        def extract_sink_status(output) -> SinkStatus:
            output_clean = output.replace("\n", " ")
            output_clean = re.sub(" +", " ", output_clean)
            output_clean_ansi = re.compile(r"\x1b[^m]*m")
            output_clean = output_clean_ansi.sub("", output_clean)
            output_clean = re.findall(
                ".* Sink Status: (.*?) Workflow finished.*", output_clean.strip()
            )[0].strip()
            return SinkStatus.parse_obj(eval(output_clean))

        @staticmethod
        @abstractmethod
        def get_connector_name() -> str:
            raise NotImplementedError()

        @abstractmethod
        def assert_for_vanilla_ingestion(
            self, source_status: SourceStatus, sink_status: SinkStatus
        ) -> None:
            raise NotImplementedError()

        # @staticmethod
        # def build_yaml(config_yaml: dict, test_type: E2EType, extra_args: dict):
        #     if test_type == E2EType.PROFILER:
        #         del config_yaml["source"]["sourceConfig"]["config"]
        #         config_yaml["source"]["sourceConfig"] = {
        #             "config": {"type": "Profiler", "generateSampleData": True}
        #         }
        #         config_yaml["processor"] = {"type": "orm-profiler", "config": {}}
        #     if test_type == E2EType.INGEST_FILTER_SCHEMA:
        #         config_yaml["source"]["sourceConfig"]["config"][
        #             "schemaFilterPattern"
        #         ] = extra_args
        #     if test_type == E2EType.INGEST_FILTER_TABLE:
        #         config_yaml["source"]["sourceConfig"]["config"][
        #             "tableFilterPattern"
        #         ] = extra_args
        #     if test_type == E2EType.INGEST_FILTER_MIX:
        #         config_yaml["source"]["sourceConfig"]["config"][
        #             "schemaFilterPattern"
        #         ] = extra_args["schema"]
        #         config_yaml["source"]["sourceConfig"]["config"][
        #             "tableFilterPattern"
        #         ] = extra_args["table"]
        #     return config_yaml
