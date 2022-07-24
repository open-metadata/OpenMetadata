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
Great Expectations subpackage to send expectation results to
Open Metadata table quality.

This subpackage needs to be used in Great Expectations
checkpoints actions.
"""

from typing import Dict, Optional, Union

from great_expectations.checkpoint.actions import ValidationAction
from great_expectations.core.batch import Batch
from great_expectations.core.batch_spec import SqlAlchemyDatasourceBatchSpec
from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
)
from great_expectations.data_asset.data_asset import DataAsset
from great_expectations.data_context.data_context import DataContext
from great_expectations.data_context.types.resource_identifiers import (
    ExpectationSuiteIdentifier,
    GeCloudIdentifier,
    ValidationResultIdentifier,
)
from great_expectations.validator.validator import Validator
from sqlalchemy.engine.base import Connection, Engine
from sqlalchemy.engine.url import URL

from metadata.generated.schema.entity.data.table import Table
from metadata.great_expectations.builders.generic_test_case_builder import (
    GenericTestCaseBuilder,
)
from metadata.great_expectations.builders.supported_ge_tests import SupportedGETests
from metadata.great_expectations.utils.ometa_config_handler import (
    create_jinja_environment,
    create_ometa_connection_obj,
    render_template,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import great_expectations_logger

logger = great_expectations_logger()


class OpenMetadataValidationAction(ValidationAction):
    """Open Metdata validation action. It inherits from
    great expection validation action class and implements the
    `_run` method.

    Attributes:
        data_context: great expectation data context
        ometa_service_name: name of the service for the table
        api_version: default to v1
        config_file_path: path to the open metdata config path
    """

    def __init__(
        self,
        data_context: DataContext,
        *,
        config_file_path: str = None,
        ometa_service_name: Optional[str] = None,
    ):
        super().__init__(data_context)
        self.ometa_service_name = ometa_service_name
        self.config_file_path = config_file_path
        self.ometa_conn = self._create_ometa_connection()

    # pylint: disable=arguments-differ,unused-argument
    def _run(
        self,
        validation_result_suite: ExpectationSuiteValidationResult,
        validation_result_suite_identifier: Union[
            ValidationResultIdentifier, GeCloudIdentifier
        ],
        data_asset: Union[Validator, DataAsset, Batch],
        payload=None,
        expectation_suite_identifier: Optional[ExpectationSuiteIdentifier] = None,
        checkpoint_identifier=None,
    ):
        """main function to implement great expectation hook

        Args:
            validation_result_suite: result suite returned when checkpoint is ran
            validation_result_suite_identifier: type of result suite
            data_asset:
            payload:
            expectation_suite_identifier: type of expectation suite
            checkpoint_identifier: identifier for the checkpoint
        """

        check_point_spec = self._get_checkpoint_batch_spec(data_asset)
        execution_engine_url = self._get_execution_engine_url(data_asset)
        table_entity = self._get_table_entity(
            execution_engine_url.database,
            check_point_spec.get("schema_name"),
            check_point_spec.get("table_name"),
        )

        if table_entity:
            for result in validation_result_suite.results:
                self._handle_test_case(result, table_entity)

    @staticmethod
    def _get_checkpoint_batch_spec(
        data_asset: Union[Validator, DataAsset, Batch]
    ) -> Optional[SqlAlchemyDatasourceBatchSpec]:
        """Return run meta and check instance of data_asset

        Args:
            data_asset: data assets of the checkpoint run
        Returns:
            SqlAlchemyDatasourceBatchSpec
        Raises:
            ValueError: if datasource not SqlAlchemyDatasourceBatchSpec raise
        """
        batch_spec = data_asset.active_batch_spec
        if isinstance(batch_spec, SqlAlchemyDatasourceBatchSpec):
            return batch_spec
        raise ValueError(
            f"Type `{type(batch_spec).__name__,}` is not supported."
            " Make sur you ran your expectations against a relational database",
        )

    def _get_table_entity(
        self, database: str, schema_name: str, table_name: str
    ) -> Optional[Table]:
        """Return the table entity for the test. If service name is defined
        in GE checkpoint entity will be fetch using the FQN. If not provided
        iterative search will be perform among all the entities. If 2 entities
        are found with the same `database`.`schema`.`table` the method will
        raise an error.

        Args:
            database: database name
            schema_name: schema name
            table_name: table name

        Return:
           Optional[Table]

        Raises:
             ValueError: if 2 entities with the same
                         `database`.`schema`.`table` are found
        """
        if self.ometa_service_name:
            return self.ometa_conn.get_by_name(
                entity=Table,
                fqn=f"{self.ometa_service_name}.{database}.{schema_name}.{table_name}",
            )

        table_entity = [
            entity
            for entity in self.ometa_conn.list_entities(entity=Table).entities
            if f"{database}.{schema_name}.{table_name}"
            in entity.fullyQualifiedName.__root__
        ]

        if len(table_entity) > 1:
            raise ValueError(
                f"Non unique `database`.`schema`.`table` found: {table_entity}."
                "Please specify an `ometa_service_name` in you checkpoint.yml file.",
            )

        if table_entity:
            return table_entity[0]

        logger.warning(
            "No entity found for %s.%s.%s", database, schema_name, table_name
        )
        return None

    @staticmethod
    def _get_execution_engine_url(
        data_asset: Union[Validator, DataAsset, Batch]
    ) -> URL:
        """Get execution engine used to run the expectation

        Args:
            data_asset: data assets of the checkpoint run
        Returns:
            URL
        Raises:
            ValueError: if expectation is not ran against DB
        """
        if isinstance(data_asset.execution_engine.engine, Engine):
            return data_asset.execution_engine.engine.url
        if isinstance(data_asset.execution_engine.engine, Connection):
            return data_asset.execution_engine.engine.engine.url
        raise ValueError(
            "Type is not supported. Make sur you ran your"
            " expectations against a relational database"
        )

    def _create_ometa_connection(self) -> OpenMetadata:
        """Create OpenMetadata API connection"""
        environment = create_jinja_environment(self.config_file_path)
        rendered_config = render_template(environment)

        return OpenMetadata(create_ometa_connection_obj(rendered_config))

    def _handle_test_case(self, result: Dict, table_entity: Table):
        """Handle adding test to table entity based on the test case.
        Test is added using a generic test case builder that accepts
        a specific test builder. Test builder is retrieved from
        `SupportedGETests` based on the `expectation_type` fetch from GE result.

        Args:
            result: GE test result
            table_entity: table entity object

        """
        try:
            test_builder = SupportedGETests[
                result["expectation_config"]["expectation_type"]
            ].value
            test_builder(result, self.ometa_conn, table_entity)
            GenericTestCaseBuilder(
                test_case_builder=test_builder
            ).build_test_from_builder()
        except KeyError:
            logger.warning(
                "GE Test %s not yet support. Skipping test ingestion",
                result["expectation_config"]["expectation_type"],
            )
