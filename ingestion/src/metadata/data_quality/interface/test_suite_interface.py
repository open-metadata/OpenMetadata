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
from typing import Optional, Set, Type

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
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
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TestSuiteInterface(ABC):
    """Abstract interface for the processor"""

    runtime_params_setter_fact = RuntimeParameterSetterFactory

    def __init__(
        self,
        service_connection_config: DatabaseConnection,
        ometa_client: OpenMetadata,
        sampler: SamplerInterface,
        table_entity: Table,
        validator_builder: Type[ValidatorBuilder],
    ):
        """Required attribute for the interface"""
        self.ometa_client = ometa_client
        self.service_connection_config = service_connection_config
        self.table_entity = table_entity
        self.sampler = sampler
        self.validator_builder_class = validator_builder

    @classmethod
    def create(
        cls,
        service_connection_config: DatabaseConnection,
        ometa_client: OpenMetadata,
        sampler: SamplerInterface,
        table_entity: Table,
        *args,
        **kwargs,
    ):
        return cls(
            service_connection_config,
            ometa_client,
            sampler,
            table_entity,
            *args,
            **kwargs,
        )

    @abstractmethod
    def _get_validator_builder(
        self, test_case: TestCase, entity_type: str
    ) -> ValidatorBuilder:
        """get the builder class for the validator. Define this in the implementation class

        Args:
            test_case (TestCase): test case object
            entity_type (str): type of the entity

        Returns:
            ValidatorBuilder: a validator builder
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
        runtime_params_setters: Set[
            RuntimeParameterSetter
        ] = runtime_params_setter_fact.get_runtime_param_setters(
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
        validator_builder.set_runtime_params(runtime_params_setters)
        validator: BaseTestValidator = validator_builder.validator
        try:
            return validator.run_validation()
        except Exception as err:
            logger.error(
                f"Error executing {test_case.testDefinition.fullyQualifiedName} - {err}"
            )
            raise RuntimeError(err)

    def _get_table_config(self):
        """Get the sampling configuration for the data quality tests"""
        return (
            self.sampler.sample_query,
            self.sampler.sample_config,
            self.sampler.partition_details,
        )
