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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""

from abc import ABC, abstractmethod
from typing import Optional, Type

from metadata.data_quality.builders.i_validator_builder import IValidatorBuilder
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)
from metadata.data_quality.validations.runtime_param_setter.param_setter_factory import (
    RuntimeParameterSetterFactory,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.tests.testDefinition import TestDefinition
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.utils.logger import test_suite_logger
from metadata.utils.partition import get_partition_details

logger = test_suite_logger()


class TestSuiteInterface(ABC):
    """Abstract interface for the processor"""

    runtime_params_setter_fact = RuntimeParameterSetterFactory

    @abstractmethod
    def __init__(
        self,
        ometa_client: OpenMetadata,
        service_connection_config: DatabaseConnection,
        table_entity: Table,
    ):
        """Required attribute for the interface"""
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config
        self.table_entity = table_entity

    @property
    def sampler(self):
        """Get the sampler object

        Note: Overriden in the implementation class. This should be removed from the interface. It has been
        implemented as the RuntimeParameterSetter takes the sampler as an argument, though we may want to
        remove that dependency.
        """
        return None

    @abstractmethod
    def _get_validator_builder(
        self, test_case: TestCase, entity_type: str
    ) -> IValidatorBuilder:
        """get the builder class for the validator. Define this in the implementation class

        Args:
            test_case (TestCase): test case object
            entity_type (str): type of the entity

        Returns:
            IValidatorBuilder: a validator builder
        """
        raise NotImplementedError

    @classmethod
    def _get_runtime_params_setter_fact(cls) -> RuntimeParameterSetterFactory:
        """Get the runtime parameter setter factory."""
        return cls.runtime_params_setter_fact()

    @classmethod
    def _set_runtime_params_setter_fact(
        cls, class_fact: Type[RuntimeParameterSetterFactory]
    ):
        """Set the runtime parameter setter factory.
        Use this method to set the runtime parameter setter factory and override the default.

        Args:
            class_fact (Type[RuntimeParameterSetterFactory]): the runtime parameter setter factory class
        """
        cls.runtime_params_setter_fact = class_fact

    def run_test_case(self, test_case: TestCase) -> Optional[TestCaseResult]:
        """run column data quality tests"""
        runtime_params_setter_fact: RuntimeParameterSetterFactory = (
            self._get_runtime_params_setter_fact()
        )  # type: ignore
        runtime_params_setter: Optional[
            RuntimeParameterSetter
        ] = runtime_params_setter_fact.get_runtime_param_setter(
            test_case.testDefinition.fullyQualifiedName,  # type: ignore
            self.ometa_client,
            self.service_connection_config,
            self.table_entity,
            self.sampler,
        )

        # get `column` or `table` type for validator import
        entity_type: str = self.ometa_client.get_by_id(
            TestDefinition, test_case.testDefinition.id
        ).entityType.value

        validator_builder = self._get_validator_builder(test_case, entity_type)
        validator_builder.set_runtime_params(runtime_params_setter)
        validator: BaseTestValidator = validator_builder.validator
        try:
            return validator.run_validation()
        except Exception as err:
            logger.error(
                f"Error executing {test_case.testDefinition.fullyQualifiedName} - {err}"
            )
            raise RuntimeError(err)

    def _get_sample_query(self) -> Optional[str]:
        """Get the sampling query for the data quality tests

        Args:
            entity (Table): _description_
        """
        if self.table_entity.tableProfilerConfig:
            return self.table_entity.tableProfilerConfig.profileQuery

        return None

    def _get_profile_sample(self) -> Optional[ProfileSampleConfig]:
        try:
            if self.table_entity.tableProfilerConfig.profileSample:
                return ProfileSampleConfig(
                    profile_sample=self.table_entity.tableProfilerConfig.profileSample,
                    profile_sample_type=self.table_entity.tableProfilerConfig.profileSampleType,
                )
        except AttributeError:
            # if tableProfilerConfig is None it will indicate that the table has not profiler config
            # hence we can return None
            return None
        return None

    def _get_table_config(self):
        """Get the sampling configuration for the data quality tests"""
        sample_query = self._get_sample_query()
        sample_config = None
        partition_config = None
        if not sample_query:
            sample_config = self._get_profile_sample()
            partition_config = get_partition_details(self.table_entity)

        return sample_query, sample_config, partition_config
