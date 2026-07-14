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
Source connection handler
"""

from __future__ import annotations

from dataclasses import replace
from typing import TYPE_CHECKING
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import (
    ErrorPack,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.aws import (
    AWS_AUTHENTICATION_CODES,
    AWS_ERRORS,
    aws_error_code,
)
from metadata.core.connections.test_connection.checks.database import (
    DatabaseStep,
    list_schemas,
    run_sql,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.records import Diagnosis, Evidence
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection as AthenaConnectionConfig,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.utils.filters import filter_by_schema

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher
    from metadata.generated.schema.type.filterPattern import FilterPattern

# Cap how many schemas the test connection probes so a catalog with many
# databases cannot exhaust the test-connection timeout.
MAX_SCHEMAS_TO_PROBE = 100

DEFAULT_CATALOG = "AwsDataCatalog"

# pyathena reflects through the Athena metadata API rather than SQL, so the shared
# statement capture records nothing; the reported command is the API operation.
LIST_DATABASES = "athena:ListDatabases"
LIST_TABLE_METADATA = "athena:ListTableMetadata"


def _message(error: BaseException) -> str:
    """The lower-cased text of the error and its cause chain."""
    return " ".join(str(current) for current in exception_chain(error)).lower()


def _all_of(*tokens: str) -> Matcher:
    """Match when every token is present in the error's cause-chain text."""
    return lambda error: all(token in _message(error) for token in tokens)


_AUTHORIZATION_CODES = frozenset({"AccessDeniedException", "AccessDenied"})


def _authorization_error(error: BaseException) -> bool:
    """An IAM authorization failure - valid credentials, missing permission.

    Athena/Glue raise ``AccessDeniedException``, STS raises ``AccessDenied``, and
    AWS renders both as "... is not authorized to perform: ...". The message
    fallback stands down for an authentication code, which AWS_ERRORS owns."""
    code = aws_error_code(error)
    return code in _AUTHORIZATION_CODES or (
        code not in AWS_AUTHENTICATION_CODES and "not authorized" in _message(error)
    )


# Only what is specific to Athena; the rest comes from AWS_ERRORS.
ATHENA_ERRORS = ErrorPack(
    when(_authorization_error).diagnose(
        "Not authorized",
        fix="Grant the IAM principal the required Athena and Glue permissions "
        "(e.g. athena:StartQueryExecution, glue:GetDatabases, glue:GetTables).",
    ),
    when(_all_of("workgroup", "is not found")).diagnose(
        "Workgroup not found",
        fix="Verify the configured workgroup exists in this account and region.",
    ),
    when(Matchers.contains("output location")).diagnose(
        "Query result location not configured",
        fix="Set s3StagingDir to an S3 path the principal can write to, or configure a query "
        "result location on the workgroup.",
    ),
    # Athena raises this before the query runs, when it cannot even reach the bucket.
    when(Matchers.contains("unable to verify/create output bucket")).diagnose(
        "Query result bucket not usable",
        fix="Athena cannot reach the bucket in s3StagingDir. Check that it exists in awsRegion "
        "and that the identity has s3:ListBucket and s3:GetBucketLocation on it.",
    ),
    when(Matchers.contains("writing to location")).diagnose(
        "Cannot write query results",
        fix="Athena could not write results to the staging location. Grant s3:PutObject on "
        "s3StagingDir, and if the bucket requires encryption, use a workgroup that sets "
        "server-side encryption on query results.",
    ),
    # By message, not by type: pyathena renders EndpointConnectionError into the
    # SQLAlchemy error it raises, so the original type does not survive the chain.
    when(Matchers.contains("could not connect to the endpoint")).diagnose(
        "Cannot reach the AWS Athena endpoint",
        fix="Check that awsRegion is correct and that the Athena endpoint is reachable from where ingestion runs.",
    ),
).including(AWS_ERRORS)


class AthenaChecks:
    """Test-connection checks for Athena."""

    errors = ATHENA_ERRORS

    def __init__(
        self,
        db: Borrowed[Engine],
        schema_filter_pattern: FilterPattern | None = None,
        catalog_id: str | None = None,
    ) -> None:
        self._db = db
        self.schema_filter_pattern = schema_filter_pattern
        self.catalog_id = catalog_id
        self._targeted: list[str] | None = None

    @property
    def _catalog_label(self) -> str:
        return f"catalog '{self.catalog_id}'" if self.catalog_id else "the default catalog (AwsDataCatalog)"

    @property
    def _catalog_name(self) -> str:
        return self.catalog_id or DEFAULT_CATALOG

    def _targeted_schemas(self) -> list[str]:
        """The schemas the configured schemaFilterPattern would target, mirroring
        what the ingestion run will read.

        Memoized so the table and view checks share a single catalog listing, and
        built lazily here - never at construction - so the catalog is listed only
        after the CheckAccess gate has confirmed connectivity. Collection stops at
        MAX_SCHEMAS_TO_PROBE so a catalog with very many databases cannot exhaust
        the test-connection timeout."""
        if self._targeted is None:
            inspector = inspect(self._db.client)
            targeted: list[str] = []
            for schema in inspector.get_schema_names() or []:
                if filter_by_schema(self.schema_filter_pattern, schema):
                    continue
                targeted.append(schema)
                if len(targeted) >= MAX_SCHEMAS_TO_PROBE:
                    break
            self._targeted = targeted
        return self._targeted

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        # run_sql, not ping: the URL carries the AWS endpoint host:port but the
        # transport is HTTPS over botocore, so a raw TCP preflight to it would be
        # meaningless. A real reachability failure still surfaces via NETWORK_ERRORS.
        return run_sql(self._db.client, "SELECT 1", lambda _: "connection established")

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        command = f"{LIST_DATABASES} (CatalogName={self._catalog_name})"
        return replace(list_schemas(self._db.client), command=command)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        # An empty table list is INDISTINGUISHABLE from missing grants: AWS Lake
        # Formation filters objects the login cannot see and returns an empty list
        # (not an error), so a genuinely empty catalog and an LF-filtered one look
        # byte-identical here. Surface it as a non-blocking caveat for the user to
        # judge - never a hard failure, which would wrongly reject a legitimately
        # empty or view-only catalog.
        targeted = self._targeted_schemas()
        if not targeted:
            return Evidence(
                summary=f"no schemas visible in {self._catalog_label}",
                command=f"{LIST_DATABASES} (CatalogName={self._catalog_name})",
                caveat=Diagnosis(
                    title="No schemas visible",
                    remediation=f"No databases were listable in {self._catalog_label}. Check the login's "
                    "Glue/Athena list permissions and Lake Formation DESCRIBE grants, or confirm the "
                    "catalog and schemaFilterPattern are not excluding everything.",
                ),
            )
        inspector = inspect(self._db.client)
        command = f"{LIST_TABLE_METADATA} (CatalogName={self._catalog_name})"
        readable = any(inspector.get_table_names(schema) for schema in targeted)
        result = Evidence(
            summary=f"tables readable across {len(targeted)} targeted schema(s) of {self._catalog_label}",
            command=command,
        )
        if not readable:
            result = Evidence(
                summary=f"no readable tables across {len(targeted)} targeted schema(s) of {self._catalog_label}",
                command=command,
                caveat=Diagnosis(
                    title="No readable tables",
                    remediation="No tables were readable in any targeted schema. AWS Lake Formation returns "
                    "an empty list (not an error) when grants are missing, so ingestion would collect 0 "
                    "tables. Grant Lake Formation DESCRIBE/SELECT on the databases and tables the login "
                    "should read. If the catalog is genuinely empty or view-only, this is expected.",
                ),
            )
        return result

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        # Views are frequently absent and GetViews is non-mandatory, so we probe
        # for visibility but never raise on an empty result.
        targeted = self._targeted_schemas()
        inspector = inspect(self._db.client)
        visible = any(inspector.get_view_names(schema) for schema in targeted)
        summary = "views visible" if visible else "no views visible (not required)"
        return Evidence(
            summary=f"{summary} across {len(targeted)} targeted schema(s)",
            command=f"{LIST_TABLE_METADATA} (CatalogName={self._catalog_name})",
        )


class AthenaConnection(BaseConnection[AthenaConnectionConfig, Engine]):
    @staticmethod
    def get_connection_url(connection: AthenaConnectionConfig) -> str:
        """
        Method to get connection url
        """
        aws_access_key_id = connection.awsConfig.awsAccessKeyId
        aws_secret_access_key = connection.awsConfig.awsSecretAccessKey
        aws_session_token = connection.awsConfig.awsSessionToken
        if connection.awsConfig.assumeRoleArn:
            assume_configs = AWSClient.get_assume_role_config(connection.awsConfig)
            if assume_configs:
                aws_access_key_id = assume_configs.accessKeyId
                aws_secret_access_key = assume_configs.secretAccessKey
                aws_session_token = assume_configs.sessionToken

        url = f"{connection.scheme.value}://"  # pyright: ignore[reportOptionalMemberAccess]
        if aws_access_key_id:
            url += aws_access_key_id
            if aws_secret_access_key:
                url += f":{aws_secret_access_key.get_secret_value()}"
        else:
            url += ":"
        url += f"@athena.{connection.awsConfig.awsRegion}.amazonaws.com:443"

        url += f"?s3_staging_dir={quote_plus(str(connection.s3StagingDir))}"
        if connection.workgroup:
            url += f"&work_group={connection.workgroup}"
        if aws_session_token:
            url += f"&aws_session_token={quote_plus(aws_session_token)}"
        if connection.catalogId:
            url += f"&catalog_name={quote_plus(connection.catalogId)}"

        return url

    def _get_client(self) -> Engine:
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        self._on_close(engine.dispose)
        return engine

    def checks(self) -> ChecksProvider:
        # The borrow defers the build: reading it inside CheckAccess keeps the STS
        # assume-role handshake behind the gate, where a denial is classified.
        return AthenaChecks(
            db=self.borrow(),
            schema_filter_pattern=self.service_connection.schemaFilterPattern,
            catalog_id=self.service_connection.catalogId,
        )


def get_lake_formation_client(connection: AthenaConnectionConfig):
    """
    Get the lake formation client
    """
    return AWSClient(connection.awsConfig).get_lake_formation_client()
