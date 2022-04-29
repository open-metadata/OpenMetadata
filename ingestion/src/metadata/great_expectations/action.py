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

from typing import Optional, Union
from enum import Enum
import logging

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)

from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.security.client import (
    auth0SSOClientConfig,
    azureSSOClientConfig,
    customOidcSSOClientConfig,
    googleSSOClientConfig,
    oktaSSOClientConfig,
)
from metadata.great_expectations.table_test_builders import (
    GenericTableTestCaseBuilder,
    TableColumCountToEqualBuilder,
)
from great_expectations.checkpoint.actions import ValidationAction
from great_expectations.validator.validator import Validator
from great_expectations.data_context.data_context import DataContext
from great_expectations.data_asset.data_asset import DataAsset
from great_expectations.core.batch import Batch
from great_expectations.core.expectation_validation_result import (
    ExpectationSuiteValidationResult,
)
from great_expectations.data_context.types.resource_identifiers import (
    ExpectationSuiteIdentifier,
    GeCloudIdentifier,
    ValidationResultIdentifier,
)
from great_expectations.core.batch_spec import SqlAlchemyDatasourceBatchSpec
from sqlalchemy.engine.base  import Engine, Connection
from sqlalchemy.engine.url import URL

logger = logging.getLogger(__name__)


class GETests(Enum):
    expect_table_column_count_to_equal = TableColumCountToEqualBuilder()


class OpenMetadataValidationAction(ValidationAction):
    """Open Metdata validation action. It inherits from
    great expection validation action class and implements the
    `_run` method


    Attributes:
        data_context DataContext: 
    """
    def __init__(
        self,
        data_context: DataContext,
        ometa_server: str,
        database: Optional[str] = None,
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
    ):
        super().__init__(data_context)
        self.ometa_server = ometa_server
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
        
        self.security_config = self._get_security_config()
        self.ometa_conn = self._get_ometa_connection()


    def _run(
        self,
        validation_result_suite: ExpectationSuiteValidationResult,
        validation_result_suite_identifier: Union[ValidationResultIdentifier,GeCloudIdentifier],
        data_asset: Union[Validator, DataAsset, Batch],
        payload=None,
        expectation_suite_identifier: Optional[ExpectationSuiteIdentifier]=None,
        checkpoint_identifier=None, 
        ):

        check_point_spec = self._get_checkpoint_batch_spec(data_asset)
        execution_engine_url = self._get_execution_engine_url(data_asset)
        table_entity = self._get_table_entity(
            execution_engine_url.database,
            check_point_spec.get("schema_name"),
            check_point_spec.get("table_name"),

        )
        for result in validation_result_suite.results:
            self._handle_test_case(result, table_entity)


    def _get_checkpoint_batch_spec(self, data_asset: Union[Validator, DataAsset, Batch]) -> SqlAlchemyDatasourceBatchSpec:
        """Return run meta and check instance of data_asset
        
        Args:
            data_asset Union[Validator, DataAsset, Batch]: data assets of the checkpoint run 

        Returns:
            SqlAlchemyDatasourceBatchSpec
        """
        batch_spec = data_asset.active_batch_spec
        if isinstance(batch_spec, SqlAlchemyDatasourceBatchSpec):
            return batch_spec
        logger.error("Type `%s` is not supported. Make sur you ran your expectations against a relational database", type(batch_spec).__name__)

    
    def _get_table_entity(self, database, schema_name, table_name):
        """..."""
        table_entity = [
                        entity for entity in self.ometa_conn.list_entities(entity=Table).entities
                        if f"{database}.{schema_name}.{table_name}" in entity.fullyQualifiedName.__root__
                        ]
        
        if len(table_entity) > 1:
            raise Error(
                "Non unique `database`.`schema`.`table` found: %s."
                "Please specify a service name in you checkpoint.yml file.",
                table_entity
                )

        return table_entity[0] or None

    
    def _get_execution_engine_url(self, data_asset: Union[Validator, DataAsset, Batch]) -> URL:
        """Get execution engine used to run the expectation
        
        Args:
            data_asset Union[Validator, DataAsset, Batch]: data assets of the checkpoint run 
        
        Returns:
            URL
        """
        if isinstance(data_asset.execution_engine.engine, Engine):
            return data_asset.execution_engine.engine.url
        if isinstance(data_asset.execution_engine.engine, Connection):
            return data_asset.execution_engine.engine.engine.url
        logger.error("Type is not supported. Make sur you ran your expectations against a relational database") 


    def _get_ometa_connection(self) -> OpenMetadata:
        """Get OpenMetadata API connection"""
        config = OpenMetadataConnection(
            hostPort=self.ometa_server,
            authProvider=self.auth_provider,
            securityConfig=self.security_config,
            apiVersion=self.api_version,
        )

        ometa_connection = OpenMetadata(
            config,
        )

        return ometa_connection


    def _get_auth_provider(self, auth_provider) -> AuthProvider:
        """Get enum object for the auth. provider from
        string passed in checkpoint file config
        """
        try:
            return AuthProvider[auth_provider]
        except KeyError:
            raise ValueError(
                f"value {auth_provider} for `auth_provider` is not supported."
            )

    def _get_security_config(self) -> Union[
        azureSSOClientConfig.AzureSSOClientConfig,
        googleSSOClientConfig.GoogleSSOClientConfig,
        auth0SSOClientConfig.Auth0SSOClientConfig,
        auth0SSOClientConfig.Auth0SSOClientConfig,

    ]:
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
            return oktaSSOClientConfig.OktaSSOClientConfig (
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

    
    def _handle_test_case(self, result, table_entity):
        self.ometa_conn.add_table_test(
            table_entity,
            GenericTableTestCaseBuilder(
                test_case_builder=GETests[result["expectation_config"]["expectation_type"]].value
            ).build_table_test(result),
        )