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
Config builder classes
"""


from copy import deepcopy

from ..e2e_types import E2EType


class BaseBuilder:
    """Base builder class to inherit by all builder classes"""

    def __init__(self, config: dict, config_args: dict) -> None:
        """Base builder

        Attributes:
            config (dict): config dict from the yaml file
        """
        self.config = deepcopy(config)
        self.config_args = deepcopy(config_args) or {}

    def build(self) -> dict:
        """build config"""
        return self.config


class ProfilerConfigBuilder(BaseBuilder):
    """Builder class for the profiler config

    Attributes:
        profilerSample (int): sample size for the profiler
    """

    # pylint: disable=invalid-name
    def __init__(self, config: dict, config_args: dict) -> None:
        super().__init__(config, config_args)
        self.profilerSample = self.config_args.get("profilerSample", 100)

    # pylint: enable=invalid-name

    def build(self) -> dict:
        """build profiler config"""
        del self.config["source"]["sourceConfig"]["config"]
        self.config["source"]["sourceConfig"] = {
            "config": {
                "type": "Profiler",
                "generateSampleData": True,
                "profileSample": self.profilerSample,
            }
        }

        if self.config_args.get("includes"):
            self.config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
                "includes": self.config_args.get("includes")
            }

        self.config["processor"] = {"type": "orm-profiler", "config": {}}
        return self.config


class SchemaConfigBuilder(BaseBuilder):
    """Builder for schema filter config"""

    def build(self) -> dict:
        self.config["source"]["sourceConfig"]["config"][
            "schemaFilterPattern"
        ] = self.config_args
        return self.config


class TableConfigBuilder(BaseBuilder):
    """Builder for table filter config"""

    def build(self) -> dict:
        self.config["source"]["sourceConfig"]["config"][
            "tableFilterPattern"
        ] = self.config_args
        return self.config


class MixConfigBuilder(BaseBuilder):
    """Builder for mix filter config (table and schema)"""

    def build(self) -> dict:
        schema_builder = SchemaConfigBuilder(self.config, self.config_args["schema"])
        config = schema_builder.build()
        table_builder = TableConfigBuilder(config, self.config_args["table"])
        return table_builder.build()


class DashboardConfigBuilder(BaseBuilder):
    """Builder for dashboard filter config"""

    def build(self) -> dict:
        self.config["source"]["sourceConfig"]["config"][
            "includeTags"
        ] = self.config_args["includeTags"]
        self.config["source"]["sourceConfig"]["config"][
            "includeDataModels"
        ] = self.config_args["includeDataModels"]
        return self.config


class DashboardMixConfigBuilder(BaseBuilder):
    """Builder for dashboard mix filter config (table and schema)"""

    def build(self) -> dict:
        self.config["source"]["sourceConfig"]["config"][
            "dashboardFilterPattern"
        ] = self.config_args["dashboards"]
        self.config["source"]["sourceConfig"]["config"][
            "chartFilterPattern"
        ] = self.config_args["charts"]
        self.config["source"]["sourceConfig"]["config"][
            "dataModelFilterPattern"
        ] = self.config_args["dataModels"]

        return self.config


class ProfilerProcessorConfigBuilder(BaseBuilder):
    """Builder for profiler processor config"""

    def build(self) -> dict:
        profiler_builder = ProfilerConfigBuilder(self.config, self.config_args)
        config = profiler_builder.build()
        processor = self.config_args.get("processor")
        if processor:
            config.update(processor)

        return config


def builder_factory(builder, config: dict, config_args: dict):
    """Factory method to return the builder class"""
    builder_classes = {
        E2EType.PROFILER.value: ProfilerConfigBuilder,
        E2EType.INGEST_DB_FILTER_SCHEMA.value: SchemaConfigBuilder,
        E2EType.INGEST_DB_FILTER_TABLE.value: TableConfigBuilder,
        E2EType.INGEST_DB_FILTER_MIX.value: MixConfigBuilder,
        E2EType.INGEST_DASHBOARD_FILTER_MIX.value: DashboardMixConfigBuilder,
        E2EType.INGEST_DASHBOARD_NOT_INCLUDING.value: DashboardConfigBuilder,
        E2EType.PROFILER_PROCESSOR.value: ProfilerProcessorConfigBuilder,
    }

    return builder_classes.get(builder, BaseBuilder)(config, config_args)
