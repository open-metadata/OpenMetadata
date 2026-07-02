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

from typing import TYPE_CHECKING
from urllib.parse import quote_plus

from botocore.exceptions import ClientError
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.clients.aws_client import AWSClient
from metadata.core.connections.test_connection import (
    ErrorPack,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.database import (
    DatabaseStep,
    list_schemas,
    run_sql,
)
from metadata.core.connections.test_connection.classifier import exception_chain
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.core.connections.test_connection.records import Evidence
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
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.classifier import Matcher
    from metadata.generated.schema.type.filterPattern import FilterPattern

# Cap how many schemas the test connection probes so a catalog with many
# databases cannot exhaust the test-connection timeout.
MAX_SCHEMAS_TO_PROBE = 100


def _message(error: BaseException) -> str:
    """The lower-cased text of the error and its cause chain."""
    return " ".join(str(current) for current in exception_chain(error)).lower()


def _aws_error_code(error: BaseException) -> str | None:
    """The botocore ``ClientError`` code anywhere in the cause chain.

    pyathena wraps a botocore ``ClientError`` raised by the underlying AWS call;
    SQLAlchemy then wraps that, so the actionable code (``AccessDeniedException``
    and friends) only survives by walking the chain."""
    code = None
    for current in exception_chain(error):
        if isinstance(current, ClientError):
            code = current.response.get("Error", {}).get("Code")
            break
    return code


def _aws_code(*codes: str) -> Matcher:
    """Match a botocore ``ClientError`` code - the stable signal for an AWS-side
    rejection, where the rendered message text varies."""
    wanted = frozenset(codes)
    return lambda error: _aws_error_code(error) in wanted


def _all_of(*tokens: str) -> Matcher:
    """Match when every token is present in the error's cause-chain text."""
    return lambda error: all(token in _message(error) for token in tokens)


def _authorization_error(error: BaseException) -> bool:
    """An IAM authorization failure - valid credentials, missing permission.

    ``AccessDeniedException`` is botocore's authorization code (distinct from the
    authentication codes), and AWS usually renders it "... is not authorized to
    perform: ...". Match either form so a missing-privilege error is never read as
    a credential problem, whatever the message wording."""
    return _aws_error_code(error) == "AccessDeniedException" or "not authorized" in _message(error)


# Athena's transport is HTTPS to the regional AWS endpoint over botocore, so auth
# and permission failures surface as botocore ``ClientError``s matched by
# code/message, not driver errnos. NETWORK_ERRORS is still folded in so a genuine
# DNS/socket failure to the endpoint is typed rather than left raw.
ATHENA_ERRORS = ErrorPack(
    when(
        _aws_code(
            "UnrecognizedClientException",
            "InvalidSignatureException",
            "AuthFailure",
        )
    ).diagnose(
        "Authentication failed",
        fix="Check the AWS credentials (access key, secret, session token, or assume-role ARN).",
    ),
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
    when(Matchers.contains("could not connect to the endpoint")).diagnose(
        "Cannot reach the AWS Athena endpoint",
        fix="Check that awsRegion is correct and that the Athena endpoint is reachable from where ingestion runs.",
    ),
).including(NETWORK_ERRORS)


class AthenaChecks:
    """Test-connection checks for Athena."""

    errors = ATHENA_ERRORS

    def __init__(
        self,
        client: Engine,
        schema_filter_pattern: FilterPattern | None = None,
        catalog_id: str | None = None,
    ) -> None:
        self.client = client
        self.schema_filter_pattern = schema_filter_pattern
        self.catalog_id = catalog_id
        self._targeted: list[str] | None = None

    @property
    def _catalog_label(self) -> str:
        return f"catalog '{self.catalog_id}'" if self.catalog_id else "the default catalog (AwsDataCatalog)"

    def _targeted_schemas(self) -> list[str]:
        """The schemas the configured schemaFilterPattern would target, mirroring
        what the ingestion run will read.

        Memoized so the table and view checks share a single catalog listing, and
        built lazily here - never at construction - so the catalog is listed only
        after the CheckAccess gate has confirmed connectivity. Collection stops at
        MAX_SCHEMAS_TO_PROBE so a catalog with very many databases cannot exhaust
        the test-connection timeout."""
        if self._targeted is None:
            inspector = inspect(self.client)
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
        return run_sql(self.client, "SELECT 1", lambda _: "connection established")

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        # AWS Lake Formation silently filters unreadable objects - pyathena even
        # converts the underlying ClientError into an empty list - so an empty
        # result is indistinguishable from missing grants. Raise so a missing grant
        # surfaces here instead of passing and then ingesting 0 tables. This by
        # design also fails a genuinely empty or view-only catalog; the message
        # calls out that possibility.
        targeted = self._targeted_schemas()
        if not targeted:
            raise RuntimeError(
                f"No schemas were available to read in {self._catalog_label}. This usually means the "
                "configured schemaFilterPattern matches no databases, or the IAM role is missing "
                "AWS Lake Formation DESCRIBE grants. Grant Lake Formation DESCRIBE/SELECT and verify "
                "the schema filter pattern."
            )
        inspector = inspect(self.client)
        readable = any(inspector.get_table_names(schema) for schema in targeted)
        if not readable:
            raise RuntimeError(
                f"Connected and listed schemas, but no tables were readable in any of the "
                f"{len(targeted)} targeted schema(s) of {self._catalog_label}. AWS Lake Formation "
                "returns an empty list (instead of an error) when grants are missing, so ingestion "
                "would succeed and ingest 0 tables. Grant Lake Formation DESCRIBE/SELECT to the IAM "
                "role on the catalog and its databases/tables, then retry. If the catalog is "
                "genuinely empty (no tables yet), this failure is expected and can be ignored."
            )
        return Evidence(summary=f"tables readable across {len(targeted)} targeted schema(s) of {self._catalog_label}")

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        # Views are frequently absent and GetViews is non-mandatory, so we probe
        # for visibility but never raise on an empty result.
        targeted = self._targeted_schemas()
        inspector = inspect(self.client)
        visible = any(inspector.get_view_names(schema) for schema in targeted)
        summary = "views visible" if visible else "no views visible (not required)"
        return Evidence(summary=f"{summary} across {len(targeted)} targeted schema(s)")


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
        return AthenaChecks(
            client=self.client,
            schema_filter_pattern=self.service_connection.schemaFilterPattern,
            catalog_id=self.service_connection.catalogId,
        )


def get_lake_formation_client(connection: AthenaConnectionConfig):
    """
    Get the lake formation client
    """
    return AWSClient(connection.awsConfig).get_lake_formation_client()
