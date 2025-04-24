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
Great Expectations subpackage to send expectation results to
Open Metadata table quality.

This subpackage needs to be used in Great Expectations
checkpoints actions.
"""
import logging
import traceback
from datetime import datetime
from typing import Dict, List, Optional, Union, cast

from great_expectations.checkpoint.actions import ValidationAction
from great_expectations.core.batch import Batch
from great_expectations.core.batch_spec import (
    RuntimeDataBatchSpec,
    SqlAlchemyDatasourceBatchSpec,
)
from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
)
from great_expectations.data_asset.data_asset import DataAsset
from great_expectations.data_context.data_context import DataContext

from metadata.generated.schema.type.basic import Timestamp

try:
    from great_expectations.data_context.types.resource_identifiers import (
        GeCloudIdentifier,  # type: ignore
    )
    from great_expectations.data_context.types.resource_identifiers import (
        ExpectationSuiteIdentifier,
        ValidationResultIdentifier,
    )
except ImportError:
    from great_expectations.data_context.types.resource_identifiers import (
        ExpectationSuiteIdentifier,
        GXCloudIdentifier as GeCloudIdentifier,
        ValidationResultIdentifier,
    )

from great_expectations.validator.validator import Validator
from sqlalchemy.engine.base import Connection, Engine
from sqlalchemy.engine.url import URL

from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.generated.schema.tests.testDefinition import (
    EntityType,
    TestCaseParameterDefinition,
    TestPlatform,
)
from metadata.generated.schema.tests.testSuite import TestSuite
from metadata.great_expectations.utils.ometa_config_handler import (
    create_jinja_environment,
    create_ometa_connection_obj,
    render_template,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils import fqn
from metadata.utils.entity_link import get_entity_link

logger = logging.getLogger(
    "great_expectations.validation_operators.validation_operators.openmetadata"
)


class OpenMetadataValidationAction(ValidationAction):
    """Open Metdata validation action. It inherits from
    great expection validation action class and implements the
    `_run` method.

    Attributes:
        data_context: great expectation data context
        database_service_name: name of the service for the table
        api_version: default to v1
        config_file_path: path to the open metdata config path
    """

    def __init__(
        self,
        data_context: DataContext,  # type: ignore
        *,
        config_file_path: Optional[str] = None,
        database_service_name: Optional[str] = None,
        schema_name: Optional[str] = "default",
        database_name: Optional[str] = None,
        table_name: Optional[str] = None,
    ):
        super().__init__(data_context)
        self.database_service_name = database_service_name
        self.database_name = database_name
        self.table_name = table_name
        self.schema_name = schema_name  # for database without schema concept
        self.config_file_path = config_file_path
        self.ometa_conn = self._create_ometa_connection()

    def _run(  # pylint: disable=unused-argument
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
            expectation_suite_identifier: type of expectation suite
            checkpoint_identifier: identifier for the checkpoint
        """

        check_point_spec = self._get_checkpoint_batch_spec(data_asset)
        table_entity = None
        if isinstance(check_point_spec, SqlAlchemyDatasourceBatchSpec):
            execution_engine_url = self._get_execution_engine_url(data_asset)
            table_entity = self._get_table_entity(
                execution_engine_url.database
                if not self.database_name
                else self.database_name,
                check_point_spec.get("schema_name", self.schema_name),
                check_point_spec.get("table_name"),
            )

        elif isinstance(check_point_spec, RuntimeDataBatchSpec):
            table_entity = self._get_table_entity(
                self.database_name,
                self.schema_name,
                self.table_name,
            )

        if table_entity:
            test_suite = self._check_or_create_test_suite(table_entity)
            for result in validation_result_suite.results:
                self._handle_test_case(result, table_entity, test_suite)

    @staticmethod
    def _get_checkpoint_batch_spec(
        data_asset: Union[Validator, DataAsset, Batch]
    ) -> SqlAlchemyDatasourceBatchSpec:
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
        if isinstance(batch_spec, RuntimeDataBatchSpec):
            return batch_spec
        raise ValueError(
            f"Type `{type(batch_spec).__name__,}` is not supported."
            " Make sure you ran your expectations against a relational database",
        )

    def _get_table_entity(
        self,
        database: Optional[str],
        schema_name: Optional[str],
        table_name: Optional[str],
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
        if not all([schema_name, table_name]):
            raise ValueError(
                "No Schema or Table name provided. Can't fetch table entity from OpenMetadata."
            )

        if self.database_service_name:
            return self.ometa_conn.get_by_name(
                entity=Table,
                fqn=f"{self.database_service_name}.{database}.{schema_name}.{table_name}",
                fields=["testSuite"],
            )

        table_entity = [
            entity
            for entity in self.ometa_conn.list_entities(
                entity=Table, fields=["testSuite"]
            ).entities
            if f"{database}.{schema_name}.{table_name}"
            in entity.fullyQualifiedName.root
        ]

        if len(table_entity) > 1:
            raise ValueError(
                f"Non unique `database`.`schema`.`table` found: {table_entity}."
                "Please specify an `database_service_name` in you checkpoint.yml file.",
            )

        if table_entity:
            return table_entity[0]

        logger.warning(
            "No entity found for %s.%s.%s", database, schema_name, table_name
        )
        return None

    def _check_or_create_test_suite(self, table_entity: Table) -> TestSuite:
        """Check if test suite already exists for a given table entity. If not
        create a new one.

        Args:
            table_entity: table entity object
        Returns:
            TestSuite
        """

        if table_entity.testSuite:
            test_suite = self.ometa_conn.get_by_name(
                TestSuite, table_entity.testSuite.fullyQualifiedName
            )
            test_suite = cast(TestSuite, test_suite)
            return test_suite

        create_test_suite = CreateTestSuiteRequest(
            name=f"{table_entity.fullyQualifiedName.root}.TestSuite",
            basicEntityReference=table_entity.fullyQualifiedName.root,
        )  # type: ignore
        test_suite = self.ometa_conn.create_or_update_executable_test_suite(
            create_test_suite
        )
        return test_suite

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

    def _build_test_case_fqn(self, table_fqn: str, result: Dict) -> str:
        """build test case fqn from table entity and GE test results

        Args:
            table_fqn (str): table fully qualified name
            result (Dict): result from great expectation tests
        """
        split_table_fqn = table_fqn.split(".")
        fqn_ = fqn.build(
            self.ometa_conn,
            entity_type=TestCase,
            service_name=split_table_fqn[0],
            database_name=split_table_fqn[1],
            schema_name=split_table_fqn[2],
            table_name=split_table_fqn[3],
            column_name=result["expectation_config"]["kwargs"].get("column"),
            test_case_name=result["expectation_config"]["expectation_type"],
        )
        fqn_ = cast(str, fqn_)
        return fqn_

    def _get_test_case_params_value(self, result: dict) -> List[TestCaseParameterValue]:
        """Build test case parameter value from GE test result"""
        if "observed_value" not in result["result"]:
            return [
                TestCaseParameterValue(
                    name="unexpected_percentage_total",
                    value=str(0.0),
                )
            ]

        return [
            TestCaseParameterValue(
                name=key,
                value=str(value),
            )
            for key, value in result["expectation_config"]["kwargs"].items()
            if key not in {"column", "batch_id"}
        ]

    def _get_test_case_params_definition(
        self, result: dict
    ) -> List[TestCaseParameterDefinition]:
        """Build test case parameter definition from GE test result"""
        if "observed_value" not in result["result"]:
            return [
                TestCaseParameterDefinition(
                    name="unexpected_percentage_total",
                )  # type: ignore
            ]

        return [
            TestCaseParameterDefinition(
                name=key,
            )  # type: ignore
            for key, _ in result["expectation_config"]["kwargs"].items()
            if key not in {"column", "batch_id"}
        ]

    def _get_test_result_value(self, result: dict) -> List[TestResultValue]:
        """Get test result value from GE test result

        Args:
            result (dict): result

        Returns:
            TestCaseResult: a test case result object
        """
        try:
            test_result_value = TestResultValue(
                name="observed_value",
                value=str(result["result"]["observed_value"]),
            )
        except KeyError:
            unexpected_percent_total = result["result"].get("unexpected_percent_total")
            test_result_value = TestResultValue(
                name="unexpected_percentage_total",
                value=str(unexpected_percent_total),
            )

        return [test_result_value]

    def _handle_test_case(
        self, result: Dict, table_entity: Table, test_suite: TestSuite
    ):
        """Handle adding test to table entity based on the test case.
        Test Definitions will be created on the fly from the results of the
        great expectations run. We will then write the test case results to the
        specific test case.

        Args:
            result: GE test result
            table_entity: table entity object
            test_suite: test suite object
        """

        try:
            test_definition = self.ometa_conn.get_or_create_test_definition(
                test_definition_fqn=result["expectation_config"]["expectation_type"],
                test_definition_description=result["expectation_config"][
                    "expectation_type"
                ].replace("_", " "),
                entity_type=EntityType.COLUMN
                if "column" in result["expectation_config"]["kwargs"]
                else EntityType.TABLE,
                test_platforms=[TestPlatform.GreatExpectations],
                test_case_parameter_definition=self._get_test_case_params_definition(
                    result
                ),
            )

            test_case_fqn = self._build_test_case_fqn(
                table_entity.fullyQualifiedName.root,
                result,
            )

            test_case = self.ometa_conn.get_or_create_test_case(
                test_case_fqn,
                entity_link=get_entity_link(
                    Table,
                    fqn=table_entity.fullyQualifiedName.root,
                    column_name=fqn.split_test_case_fqn(test_case_fqn).column,
                ),
                test_suite_fqn=test_suite.fullyQualifiedName.root,
                test_definition_fqn=test_definition.fullyQualifiedName.root,
                test_case_parameter_values=self._get_test_case_params_value(result),
            )

            self.ometa_conn.add_test_case_results(
                test_results=TestCaseResult(
                    timestamp=Timestamp(int(datetime.now().timestamp() * 1000)),
                    testCaseStatus=TestCaseStatus.Success
                    if result["success"]
                    else TestCaseStatus.Failed,
                    testResultValue=self._get_test_result_value(result),
                ),  # type: ignore
                test_case_fqn=test_case.fullyQualifiedName.root,
            )

            logger.debug(
                f"Test case result for {test_case.fullyQualifiedName.root} successfully ingested"
            )

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(exc)
