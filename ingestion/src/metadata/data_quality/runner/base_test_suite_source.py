#  Copyright 2025 Collate
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
Base source for the data quality used to instantiate a data quality runner with its interface
"""
from copy import deepcopy
from typing import Optional, cast

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.data_quality.runner.core import DataTestsRunner
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.models import SampleConfig
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.bigquery_utils import copy_service_config
from metadata.utils.profiler_utils import get_context_entities
from metadata.utils.service_spec.service_spec import (
    import_sampler_class,
    import_test_suite_class,
)


class BaseTestSuiteRunner:
    """Base class for the data quality runner"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        ometa_client: OpenMetadata,
        entity: Table,
    ):
        self.validator_builder_class = ValidatorBuilder
        self._interface = None
        self.entity = entity
        self.service_conn_config = self._copy_service_config(config, self.entity.database)  # type: ignore
        self._interface_type: str = self.service_conn_config.type.value.lower()

        self.source_config = TestSuitePipeline.model_validate(
            config.source.sourceConfig.config
        )
        self.ometa_client = ometa_client

    @property
    def interface(self) -> Optional[TestSuiteInterface]:
        return self._interface

    @interface.setter
    def interface(self, interface):
        self._interface = interface

    def _copy_service_config(
        self, config: OpenMetadataWorkflowConfig, database: EntityReference
    ) -> DatabaseConnection:
        """Make a copy of the service config and update the database name

        Args:
            database (_type_): a database entity

        Returns:
            DatabaseService.__config__
        """
        if isinstance(config.source.serviceConnection.root.config, BigQueryConnection):
            return copy_service_config(config, database.name)

        config_copy = deepcopy(config.source.serviceConnection.root.config)  # type: ignore
        if hasattr(
            config_copy,  # type: ignore
            "supportsDatabase",
        ):
            if hasattr(config_copy, "database"):
                config_copy.database = database.name  # type: ignore
            if hasattr(config_copy, "catalog"):
                config_copy.catalog = database.name  # type: ignore

        # we know we'll only be working with DatabaseConnection, we cast the type to satisfy type checker
        config_copy = cast(DatabaseConnection, config_copy)

        return config_copy

    def create_data_quality_interface(self) -> TestSuiteInterface:
        """Create data quality interface

        Returns:
            TestSuiteInterface: a data quality interface
        """
        schema_entity, database_entity, _ = get_context_entities(
            entity=self.entity, metadata=self.ometa_client
        )
        test_suite_class = import_test_suite_class(
            ServiceType.Database,
            source_type=self._interface_type,
            source_config_type=self.service_conn_config.type.value,
        )
        sampler_class = import_sampler_class(
            ServiceType.Database,
            source_type=self._interface_type,
            source_config_type=self.service_conn_config.type.value,
        )
        # This is shared between the sampler and DQ interfaces
        sampler_interface: SamplerInterface = sampler_class.create(
            service_connection_config=self.service_conn_config,
            ometa_client=self.ometa_client,
            entity=self.entity,
            schema_entity=schema_entity,
            database_entity=database_entity,
            default_sample_config=SampleConfig(
                profileSample=self.source_config.profileSample,
                profileSampleType=self.source_config.profileSampleType,
                samplingMethodType=self.source_config.samplingMethodType,
            ),
        )

        self.interface: TestSuiteInterface = test_suite_class.create(
            service_connection_config=self.service_conn_config,
            ometa_client=self.ometa_client,
            sampler=sampler_interface,
            table_entity=self.entity,
            validator_builder=self.validator_builder_class,
        )
        return self.interface

    def get_data_quality_runner(self) -> DataTestsRunner:
        """Get a data quality runner

        Returns:
            DataTestsRunner: a data quality runner
        """
        return DataTestsRunner(self.create_data_quality_interface())
