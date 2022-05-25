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

import logging
import os
from enum import Enum
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
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (  # pylint: disable=line-too-long
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client import (
    auth0SSOClientConfig,
    azureSSOClientConfig,
    customOidcSSOClientConfig,
    googleSSOClientConfig,
    oktaSSOClientConfig,
)
from metadata.great_expectations.columns.column_test_builders import (
    ColumnValuesLengthsToBeBetweenBuilder,
    ColumnValuesToBeBetweenBuilder,
    ColumnValuesToBeNotInSetBuilder,
    ColumnValuesToBeNotNullBuilder,
    ColumnValuesToBeUniqueBuilder,
    ColumnValuesToMatchRegexBuilder,
)
from metadata.great_expectations.tables.table_test_builders import (
    TableColumCountToEqualBuilder,
    TableRowCountToBeBetweenBuilder,
    TableRowCountToEqualBuilder,
)
from metadata.great_expectations.utils.utils import (
    create_jinja_environment,
    render_template,
    create_ometa_connection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

logger = logging.getLogger(__name__)


class SupportedGETests(Enum):
    """list of supported GE test OMeta builders"""

    # pylint: disable=invalid-name
    expect_table_column_count_to_equal = TableColumCountToEqualBuilder()
    expect_table_row_count_to_be_between = TableRowCountToBeBetweenBuilder()
    expect_table_row_count_to_equal = TableRowCountToEqualBuilder()
    expect_column_value_lengths_to_be_between = ColumnValuesLengthsToBeBetweenBuilder()
    expect_column_values_to_be_between = ColumnValuesToBeBetweenBuilder()
    expect_column_values_to_not_be_in_set = ColumnValuesToBeNotInSetBuilder()
    expect_column_values_to_not_be_null = ColumnValuesToBeNotNullBuilder()
    expect_column_values_to_be_unique = ColumnValuesToBeUniqueBuilder()
    expect_column_values_to_match_regex = ColumnValuesToMatchRegexBuilder()


class GenericTestCaseBuilder:
    """Generic TestCase builder to create test case entity

    Attributes:
        test_case_builder: Specific builder for the GE expectation
    """

    def __init__(self, *, test_case_builder):
        self.test_case_builder = test_case_builder

    def build_test_from_builder(self):
        """Main method to build the test case entity
        and send the results to OMeta
        """
        self.test_case_builder.add_test()


# pylint: disable=too-many-instance-attributes
class OpenMetadataValidationAction(ValidationAction):
    """Open Metdata validation action. It inherits from
    great expection validation action class and implements the
    `_run` method.

    Attributes:
        data_context: great expectation data context
        ometa_server: server URL
        ometa_service_name: name of the service for the table
        auth_provider: auth. provider for OMeta
        secret_key: key for the auth. method used
        client_id: client ID for the auth. method used
        google_audience: if auth. method is google
        okta_org_url: if auth is okta
        okta_email: if auth is okta
        okta_scopes: if auth is okta
        auth0_domain: if auth is auth0
        azure_authority: if auth method is azure
        azure_scopes: if auth method is azure
        custom_oid_token_endpoint: if auth method is custom
        api_version: default to v1
        config_file_path: path to the open metdata config path
    """

    # pylint: disable=too-many-locals
    def __init__(
        self,
        data_context: DataContext,
        *,
        ometa_server: str,
        ometa_service_name: Optional[str] = None,
        auth_provider: Optional[str] = "no_auth",
        secret_key: Optional[str] = None,
        client_id: Optional[str] = None,
        google_audience: Optional[str] = None,
        okta_org_url: Optional[str] = None,
        okta_email: Optional[str] = None,
        okta_scopes: Optional[str] = None,
        auth0_domain: Optional[str] = None,
        azure_authority: Optional[str] = None,
        azure_scopes: Optional[str] = None,
        custom_oid_token_endpoint: Optional[str] = None,
        api_version: str = "v1",
        config_file_path: str = None,
    ):
        super().__init__(data_context)
        self.ometa_server = ometa_server
        self.ometa_service_name = ometa_service_name
        self.auth_provider = self._get_auth_provider(auth_provider)
        self.client_id = client_id
        self.secret_key = secret_key
        self.google_audience = google_audience
        self.okta_org_url = okta_org_url
        self.okta_email = okta_email
        self.okta_scopes = okta_scopes
        self.auth0_domain = auth0_domain
        self.azure_authority = azure_authority
        self.azure_scopes = azure_scopes
        self.custom_oid_token_endpoint = custom_oid_token_endpoint
        self.api_version = api_version
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
                fqdn=f"{self.ometa_service_name}.{database}.{schema_name}.{table_name}",
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
        config = OpenMetadataConnection(
            hostPort=self.ometa_server,
            authProvider=self.auth_provider,
            securityConfig=self._get_security_config(),
            apiVersion=self.api_version,
        )

        ometa_connection = OpenMetadata(
            config,
        )

        return ometa_connection

    def _create_ometa_connection_from_file(self) -> OpenMetadata:
        """Create OpenMetadata API connection"""
        environment = create_jinja_environment(self.config_file_path)
        rendered_config = render_template(environment)

        return create_ometa_connection(rendered_config)


    @staticmethod
    def _get_auth_provider(auth_provider: str) -> AuthProvider:
        """Get enum object for the auth. provider from
        string passed in checkpoint file config

        Args:
            auth_provider: auth provider name

        Return:
            AuthProvider
        """
        try:
            return AuthProvider[auth_provider]
        except KeyError:
            raise ValueError(
                f"value {auth_provider} for `auth_provider` is not supported."
            )

    def _get_security_config(
        self,
    ) -> Union[
        azureSSOClientConfig.AzureSSOClientConfig,
        googleSSOClientConfig.GoogleSSOClientConfig,
        auth0SSOClientConfig.Auth0SSOClientConfig,
        auth0SSOClientConfig.Auth0SSOClientConfig,
    ]:
        """Get security config object based on the auth. provider"""
        if self.auth_provider == AuthProvider.no_auth:
            return None
        if self.auth_provider == AuthProvider.azure:
            return azureSSOClientConfig.AzureSSOClientConfig(
                clientSecret=self.secret_key,
                authority=self.azure_authority,
                clientId=self.client_id,
                scopes=self.azure_scopes,
            )
        if self.auth_provider == AuthProvider.google:
            return googleSSOClientConfig.GoogleSSOClientConfig(
                secretKey=self.secret_key,
                audience=self.google_audience,
            )
        if self.auth_provider == AuthProvider.okta:
            return oktaSSOClientConfig.OktaSSOClientConfig(
                clientId=self.client_id,
                orgURL=self.okta_org_url,
                privateKey=self.secret_key,
                email=self.okta_email,
                scopes=self.okta_scopes,
            )
        if self.auth_provider == AuthProvider.auth0:
            return auth0SSOClientConfig.Auth0SSOClientConfig(
                clientId=self.client_id,
                secretKey=self.secret_key,
                domain=self.auth0_domain,
            )
        if self.auth_provider == AuthProvider.custom_oidc:
            return customOidcSSOClientConfig.CustomOIDCSSOClientConfig(
                clientId=self.client_id,
                secretKey=self.secret_key,
                tokenEndpoint=self.api_version,
            )
        raise NotImplementedError(
            f"Security config formmatting for `{self.auth_provider}` is not supported"
        )

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
