#  Copyright 2021 Collate
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
Base source for the data quality used to instantiate a data quality runner with its interface
"""
from copy import deepcopy
from typing import Optional, cast

from sqlalchemy import MetaData

from metadata.data_quality.interface.test_suite_interface import TestSuiteInterface
from metadata.data_quality.interface.test_suite_interface_factory import (
    test_suite_interface_factory,
)
from metadata.data_quality.runner.core import DataTestsRunner
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata

NON_SQA_DATABASE_CONNECTIONS = (DatalakeConnection,)


class BaseTestSuiteRunner:
    """Base class for the data quality runner"""

    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        ometa_client: OpenMetadata,
        entity: Table,
    ):
        self._interface = None
        self.entity = entity
        self.service_conn_config = self._copy_service_config(config, self.entity.database)  # type: ignore
        self.ometa_client = ometa_client
        self.sqa_metadata = self._set_sqa_metadata()

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
        config_copy = deepcopy(
            config.source.serviceConnection.root.config  # type: ignore
        )
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

    def _set_sqa_metadata(self):
        """Set sqlalchemy metadata"""
        if not isinstance(self.service_conn_config, NON_SQA_DATABASE_CONNECTIONS):
            return MetaData()
        return None

    def create_data_quality_interface(self) -> TestSuiteInterface:
        """Create data quality interface

        Returns:
            TestSuiteInterface: a data quality interface
        """
        data_quality_interface: TestSuiteInterface = (
            test_suite_interface_factory.create(
                self.service_conn_config,
                self.ometa_client,
                self.entity,
                sqa_metadata=self.sqa_metadata,
            )
        )
        self.interface = data_quality_interface
        return data_quality_interface

    def get_data_quality_runner(self) -> DataTestsRunner:
        """Get a data quality runner

        Returns:
            DataTestsRunner: a data quality runner
        """
        return DataTestsRunner(self.create_data_quality_interface())
