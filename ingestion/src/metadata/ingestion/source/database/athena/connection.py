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

from functools import partial
from typing import List, Optional  # noqa: UP035
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.inspection import inspect

from metadata.clients.aws_client import AWSClient
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection as AthenaConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.connections.test_connections import (
    execute_inspector_func,
    test_connection_engine_step,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections_utils import kill_active_connections
from metadata.utils.constants import THREE_MIN
from metadata.utils.filters import filter_by_schema

# Cap how many schemas the test connection probes so a catalog with many
# databases cannot exhaust the test-connection timeout.
MAX_SCHEMAS_TO_PROBE = 100


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
        return create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )

    def _get_targeted_schemas(self, inspector: Inspector) -> List[str]:  # noqa: UP006
        """
        Return the schemas the configured schemaFilterPattern would target,
        mirroring what the ingestion run will actually read. With no pattern
        configured, every schema in the catalog is returned. Collection stops at
        MAX_SCHEMAS_TO_PROBE so a catalog with very many databases cannot exhaust
        the test-connection timeout.
        """
        schema_filter_pattern = self.service_connection.schemaFilterPattern
        targeted: List[str] = []  # noqa: UP006
        for schema in inspector.get_schema_names() or []:
            if filter_by_schema(schema_filter_pattern, schema):
                continue
            targeted.append(schema)
            if len(targeted) >= MAX_SCHEMAS_TO_PROBE:
                break
        return targeted

    def test_connection(
        self,
        metadata: OpenMetadata,
        automation_workflow: Optional[AutomationWorkflow] = None,  # noqa: UP045
        timeout_seconds: Optional[int] = THREE_MIN,  # noqa: UP045
    ) -> TestConnectionResult:
        """
        Test connection. This can be executed either as part
        of a metadata workflow or during an Automation Workflow.

        GetTables raises when the targeted schemas return zero readable tables
        anywhere. AWS Lake Formation silently filters results - pyathena even
        converts the underlying ClientError into an empty list - so an empty
        result is indistinguishable from missing grants. Raising surfaces the
        missing DESCRIBE/SELECT grants instead of passing and then ingesting 0
        tables. By design this also fails a genuinely empty or view-only catalog
        (no tables anywhere); the error message calls out that possibility.
        """
        engine = self.client
        catalog_id = self.service_connection.catalogId
        catalog_label = f"catalog '{catalog_id}'" if catalog_id else "the default catalog (AwsDataCatalog)"
        targeted_schemas_cache: dict = {}

        def get_targeted_schemas() -> List[str]:  # noqa: UP006
            if "value" not in targeted_schemas_cache:
                targeted_schemas_cache["value"] = self._get_targeted_schemas(inspect(engine))
            return targeted_schemas_cache["value"]

        def custom_executor_for_table():
            targeted_schemas = get_targeted_schemas()
            inspector = inspect(engine)
            if not targeted_schemas:
                raise RuntimeError(
                    f"No schemas were available to read in {catalog_label}. This usually means the "
                    "configured schemaFilterPattern matches no databases, or the IAM role is missing "
                    "AWS Lake Formation DESCRIBE grants. Grant Lake Formation DESCRIBE/SELECT and verify "
                    "the schema filter pattern."
                )
            readable = any(inspector.get_table_names(schema) for schema in targeted_schemas)
            if not readable:
                raise RuntimeError(
                    f"Connected and listed schemas, but no tables were readable in any of the "
                    f"{len(targeted_schemas)} targeted schema(s) of {catalog_label}. AWS Lake Formation "
                    "returns an empty list (instead of an error) when grants are missing, so ingestion "
                    "would succeed and ingest 0 tables. Grant Lake Formation DESCRIBE/SELECT to the IAM "
                    "role on the catalog and its databases/tables, then retry. If the catalog is "
                    "genuinely empty (no tables yet), this failure is expected and can be ignored."
                )

        def custom_executor_for_view():
            targeted_schemas = get_targeted_schemas()
            inspector = inspect(engine)
            # Views are frequently absent and GetViews is non-mandatory, so we
            # probe for visibility but never raise on an empty result.
            for schema in targeted_schemas:
                if inspector.get_view_names(schema):
                    break

        test_fn = {
            "CheckAccess": partial(test_connection_engine_step, engine),
            "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
            "GetTables": custom_executor_for_table,
            "GetViews": custom_executor_for_view,
        }

        result = test_connection_steps(
            metadata=metadata,
            test_fn=test_fn,
            service_type=self.service_connection.type.value,  # pyright: ignore[reportOptionalMemberAccess]
            automation_workflow=automation_workflow,
            timeout_seconds=timeout_seconds,
        )

        kill_active_connections(engine)

        return result


def get_lake_formation_client(connection: AthenaConnectionConfig):
    """
    Get the lake formation client
    """
    return AWSClient(connection.awsConfig).get_lake_formation_client()
