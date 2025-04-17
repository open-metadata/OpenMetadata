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
Config builder classes
"""


from copy import deepcopy

from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuiteConfigType,
)

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
                "profileSample": self.profilerSample,
            }
        }

        if self.config_args.get("includes"):
            self.config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
                "includes": self.config_args.get("includes")
            }
            self.config["source"]["sourceConfig"]["config"]["includeViews"] = True

        self.config["processor"] = {"type": "orm-profiler", "config": {}}
        return self.config


class LineageConfigBuilder(BaseBuilder):
    """Builder class for the Lineage config"""

    # pylint: disable=invalid-name
    def __init__(self, config: dict, config_args: dict) -> None:
        super().__init__(config, config_args)
        self.resultLimit = self.config_args.get("resultLimit", 1000)
        self.queryLogDuration = self.config_args.get("queryLogDuration", 1)

    # pylint: enable=invalid-name
    def build(self) -> dict:
        """build lineage config"""
        self.config["source"]["type"] = self.config_args["source"]
        self.config["source"]["sourceConfig"] = {
            "config": {
                "type": "DatabaseLineage",
                "queryLogDuration": 1,
                "resultLimit": 10000,
                "processQueryLineage": False,
                "processStoredProcedureLineage": False,
            }
        }
        return self.config


class AutoClassificationConfigBuilder(BaseBuilder):
    """Builder class for the AutoClassification config"""

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
                "type": "AutoClassification",
                "storeSampleData": True,
                "enableAutoClassification": False,
            }
        }

        if self.config_args.get("includes"):
            self.config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
                "includes": self.config_args.get("includes")
            }

        self.config["processor"] = {"type": "orm-profiler", "config": {}}
        return self.config


class DataQualityConfigBuilder(BaseBuilder):
    """Builder class for the data quality config"""

    # pylint: disable=invalid-name
    def __init__(self, config: dict, config_args: dict) -> None:
        super().__init__(config, config_args)
        self.test_case_defintions = self.config_args.get("test_case_definitions", [])
        self.entity_fqn = self.config_args.get("entity_fqn", [])

    # pylint: enable=invalid-name

    def build(self) -> dict:
        """build profiler config"""
        self.config["source"]["sourceConfig"]["config"] = {
            "type": TestSuiteConfigType.TestSuite.value,
            "entityFullyQualifiedName": self.entity_fqn,
        }

        self.config["source"]["sourceConfig"]["config"]["serviceConnections"] = [
            {
                "serviceName": self.config["source"]["serviceName"],
                "serviceConnection": self.config["source"]["serviceConnection"],
            }
        ]

        del self.config["source"]["serviceConnection"]

        self.config["processor"] = {
            "type": "orm-test-runner",
            "config": {"testCases": self.test_case_defintions},
        }
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
        E2EType.LINEAGE.value: LineageConfigBuilder,
        E2EType.DATA_QUALITY.value: DataQualityConfigBuilder,
        E2EType.INGEST_DB_FILTER_SCHEMA.value: SchemaConfigBuilder,
        E2EType.INGEST_DB_FILTER_TABLE.value: TableConfigBuilder,
        E2EType.INGEST_DB_FILTER_MIX.value: MixConfigBuilder,
        E2EType.INGEST_DASHBOARD_FILTER_MIX.value: DashboardMixConfigBuilder,
        E2EType.INGEST_DASHBOARD_NOT_INCLUDING.value: DashboardConfigBuilder,
        E2EType.PROFILER_PROCESSOR.value: ProfilerProcessorConfigBuilder,
        E2EType.AUTO_CLASSIFICATION.value: AutoClassificationConfigBuilder,
    }

    return builder_classes.get(builder, BaseBuilder)(config, config_args)
