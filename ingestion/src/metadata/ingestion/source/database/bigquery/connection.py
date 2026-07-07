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

import os
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from urllib.parse import parse_qs, quote, urlparse

from google.api_core.exceptions import Forbidden, NotFound
from google.auth.exceptions import DefaultCredentialsError, RefreshError
from google.cloud.datacatalog_v1 import PolicyTagManagerClient
from sqlalchemy.engine import Engine

from metadata.core.connections.test_connection import (
    ErrorPack,
    Evidence,
    Matchers,
    check,
    when,
)
from metadata.core.connections.test_connection.checks.database import (
    DatabaseStep,
    list_schemas,
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection as BigQueryConnectionConfig,
)
from metadata.generated.schema.security.credentials.gcpCredentials import (
    GcpADC,
    GcpCredentialsPath,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.bigquery.helper import (
    get_impersonate_client_kwargs,
)
from metadata.ingestion.source.database.bigquery.queries import BIGQUERY_TEST_STATEMENT
from metadata.utils.bigquery_utils import get_bigquery_client
from metadata.utils.constants import THREE_MIN
from metadata.utils.credentials import (
    InvalidPrivateKeyException,
    set_google_credentials,
)
from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Callable

    from metadata.core.connections.test_connection import ChecksProvider

logger = ingestion_logger()

# BigQuery authenticates through Google credentials + a project id; there is no
# host:port to preflight, so CheckAccess skips the shared TCP probe and folds in
# NETWORK_ERRORS only for genuine socket/DNS failures reaching the Google
# endpoint. The real failures are google.auth / google.api_core errors, keyed by
# type and stable message token below (customer project ids never appear in a
# rule).
BIGQUERY_ERRORS = ErrorPack(
    when(Matchers.exception(InvalidPrivateKeyException)).diagnose(
        "Malformed service account private key",
        fix="The private key in the GCP credentials could not be parsed as a PEM key. Paste the "
        "full key from the service account JSON, including the BEGIN/END lines and real newlines.",
    ),
    when(Matchers.contains("invalid_grant")).diagnose(
        "Invalid service account credentials",
        fix="The service account key was rejected (invalid_grant). Verify the private key and "
        "client email are correct and that the key has not been revoked, disabled, or expired.",
    ),
    when(Matchers.exception(DefaultCredentialsError)).diagnose(
        "Could not determine GCP credentials",
        fix="No usable credentials were found. Provide a service account key, or configure "
        "Application Default Credentials (ADC) in the environment where ingestion runs.",
    ),
    when(Matchers.exception(RefreshError)).diagnose(
        "Failed to obtain a GCP access token",
        fix="The credentials could not be exchanged for an access token. Check the service "
        "account key, its client email, and that the account is enabled.",
    ),
    when(Matchers.contains("bigquery.jobs.create")).diagnose(
        "Missing permission to run BigQuery jobs",
        fix="Grant the service account the BigQuery Job User role (bigquery.jobs.create) on the "
        "billing project so it can run queries.",
    ),
    when(Matchers.contains("access denied")).diagnose(
        "Access denied",
        fix="The service account is authenticated but lacks permission for the requested "
        "resource. Grant the appropriate BigQuery role (e.g. BigQuery Data Viewer / Metadata "
        "Viewer), or, for query history, access to INFORMATION_SCHEMA.JOBS_BY_PROJECT.",
    ),
    when(Matchers.exception(Forbidden)).diagnose(
        "Permission denied",
        fix="The service account is authenticated but not authorized. Grant it the BigQuery "
        "roles needed to read metadata (BigQuery Data Viewer / Metadata Viewer / Job User).",
    ),
    when(Matchers.exception(NotFound)).diagnose(
        "Project or dataset not found",
        fix="Verify the configured project id (and dataset, if set) exist and that the service account can see them.",
    ),
).including(NETWORK_ERRORS)


def _add_location(url: str, connection: BigQueryConnectionConfig) -> str:
    """
    Attach the `usageLocation` value to the URL when available.
    """
    location = getattr(connection, "usageLocation", None)
    if not location:
        return url

    # Parse the URL to check if location parameter already exists
    parsed = urlparse(url)
    params = parse_qs(parsed.query)

    if "location" in params:
        return url

    # Add location parameter with proper URL encoding
    separator = "&" if parsed.query else "?"
    encoded_location = quote(str(location), safe="")
    return f"{url}{separator}location={encoded_location}"


def get_connection_url(connection: BigQueryConnectionConfig) -> str:  # noqa: C901
    """
    Build the connection URL and set the project
    environment variable when needed
    """
    url = None

    if isinstance(connection.credentials.gcpConfig, GcpCredentialsValues):
        if isinstance(  # pylint: disable=no-else-return
            connection.credentials.gcpConfig.projectId, SingleProjectId
        ):
            if not connection.credentials.gcpConfig.projectId.root:
                url = f"{connection.scheme.value}://{connection.credentials.gcpConfig.projectId.root or ''}"
            elif not connection.credentials.gcpConfig.privateKey and connection.credentials.gcpConfig.projectId.root:
                project_id = connection.credentials.gcpConfig.projectId.root
                os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
                url = f"{connection.scheme.value}://{connection.credentials.gcpConfig.projectId.root}"
            else:
                url = f"{connection.scheme.value}://{connection.credentials.gcpConfig.projectId.root}"
        elif isinstance(connection.credentials.gcpConfig.projectId, MultipleProjectId):
            for project_id in connection.credentials.gcpConfig.projectId.root:
                if not connection.credentials.gcpConfig.privateKey and project_id:
                    os.environ["GOOGLE_CLOUD_PROJECT"] = project_id
                url = f"{connection.scheme.value}://{project_id}"
                break
            if url is None:
                url = f"{connection.scheme.value}://"

    # If gcpConfig is the JSON key path and projectId is defined, we use it by default
    elif (
        isinstance(connection.credentials.gcpConfig, GcpCredentialsPath) and connection.credentials.gcpConfig.projectId
    ):
        if isinstance(  # pylint: disable=no-else-return
            connection.credentials.gcpConfig.projectId, SingleProjectId
        ):
            url = f"{connection.scheme.value}://{connection.credentials.gcpConfig.projectId.root}"
        elif isinstance(connection.credentials.gcpConfig.projectId, MultipleProjectId):
            for project_id in connection.credentials.gcpConfig.projectId.root:
                url = f"{connection.scheme.value}://{project_id}"
                break

    # If gcpConfig is the GCP ADC and projectId is defined, we use it by default
    elif isinstance(connection.credentials.gcpConfig, GcpADC) and connection.credentials.gcpConfig.projectId:
        if isinstance(  # pylint: disable=no-else-return
            connection.credentials.gcpConfig.projectId, SingleProjectId
        ):
            url = f"{connection.scheme.value}://{connection.credentials.gcpConfig.projectId.root}"
        elif isinstance(connection.credentials.gcpConfig.projectId, MultipleProjectId):
            for project_id in connection.credentials.gcpConfig.projectId.root:
                url = f"{connection.scheme.value}://{project_id}"
                break

    if url is None:
        url = f"{connection.scheme.value}://"

    return _add_location(url, connection)


def get_connection_args(connection: BigQueryConnectionConfig) -> dict:
    """
    Build the SQLAlchemy connect args for BigQuery.

    When service account impersonation is configured, inject a pre-built
    impersonated ``bigquery.Client`` so that every query issued through the
    engine (Test Connection and information_schema reads) runs under the
    target identity. Without impersonation this is identical to the common
    connection args, preserving the previous behaviour.
    """
    connect_args = get_connection_args_common(connection)
    impersonate_kwargs = get_impersonate_client_kwargs(connection)
    if impersonate_kwargs:
        billing_or_project_id = connection.billingProjectId or _get_first_project_id(connection)
        if billing_or_project_id is None:
            logger.warning(
                "Could not resolve a project id for the impersonated BigQuery client from "
                "billingProjectId or the credentials config. The project will be resolved from the "
                "environment (e.g. GOOGLE_CLOUD_PROJECT) at query time; set billingProjectId or a "
                "projectId to make this explicit."
            )
        connect_args = {
            **connect_args,
            "client": get_bigquery_client(project_id=billing_or_project_id, **impersonate_kwargs),
        }
    return connect_args


def _get_first_project_id(connection: BigQueryConnectionConfig) -> Optional[str]:  # noqa: UP045
    """
    Return a single project id from the connection config to scope the
    impersonated client. Falls back to None when it cannot be determined.
    """
    project_id = None
    gcp_config = connection.credentials.gcpConfig
    config_project_id = getattr(gcp_config, "projectId", None)
    if config_project_id is not None:
        if isinstance(config_project_id, SingleProjectId):
            project_id = config_project_id.root
        elif isinstance(config_project_id, MultipleProjectId) and config_project_id.root:
            project_id = config_project_id.root[0]
    return project_id


_OBJECT_TYPES = ("TABLE", "EXTERNAL", "VIEW", "MATERIALIZED_VIEW")


def probe_table_view_enumeration(connection: Engine) -> Evidence:
    """Probe that datasets and their objects can be enumerated.

    A ``NotFound`` on a dataset is tolerated - it can be dropped between listing
    datasets and listing its tables (python-bigquery-sqlalchemy#105); any other
    failure propagates so the step fails and is classified.
    """
    dataset_count = 0
    with connection.connect() as conn:
        client = conn.connection._client
        for dataset in client.list_datasets():
            dataset_count += 1
            try:
                for table in client.list_tables(dataset.reference, page_size=1):
                    if table.table_type in _OBJECT_TYPES:
                        break
            except NotFound:
                continue
    return Evidence(summary=f"{dataset_count} datasets enumerated")


class BigQueryChecks:
    """Test-connection checks for BigQuery.

    Steps run against a single-project ``Engine``; the multi-project fan-out
    happens a layer up (``BigquerySource._test_connection`` clones the connection
    per project and drives this provider once per clone).

    The engine is built lazily on first use inside ``CheckAccess`` (never at
    construction), so credential parsing - which happens while building the engine
    (e.g. a malformed private key) - fails *inside the gate step* and is classified
    by the error pack, instead of escaping before the runner starts.
    """

    errors = BIGQUERY_ERRORS

    def __init__(
        self,
        get_client: Callable[[], Engine],
        service_connection: BigQueryConnectionConfig,
    ) -> None:
        self._get_client = get_client
        self._client: Engine | None = None
        self.service_connection = service_connection

    @property
    def client(self) -> Engine:
        if self._client is None:
            self._client = self._get_client()
        return self._client

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        return ping(self.client)

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        return probe_table_view_enumeration(self.client)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return probe_table_view_enumeration(self.client)

    @check(DatabaseStep.GetTags)
    def get_tags(self) -> Evidence | None:
        return self._list_policy_tags()

    @check(DatabaseStep.GetQueries)
    def get_queries(self) -> Evidence:
        statement = BIGQUERY_TEST_STATEMENT.format(
            region=self.service_connection.usageLocation,
            creation_date=datetime.now().strftime("%Y-%m-%d"),
        )
        return run_sql(self.client, statement, lambda _: "query history accessible")

    def _taxonomy_project_ids(self) -> list[str]:
        project_ids: list[str] = []
        if self.client.url.host:
            project_ids.append(self.client.url.host)
        if self.service_connection.taxonomyProjectID:
            project_ids.extend(self.service_connection.taxonomyProjectID)
        return project_ids

    def _list_policy_tags(self) -> Evidence | None:
        if not self.service_connection.includePolicyTags:
            logger.info("'includePolicyTags' is set to false, so skipping this test.")
            return None

        project_ids = self._taxonomy_project_ids()
        if not project_ids:
            logger.info("'taxonomyProjectID' is not set, so skipping this test.")
            return None

        location = self.service_connection.taxonomyLocation
        if not location:
            logger.info("'taxonomyLocation' is not set, so skipping this test.")
            return None

        client = PolicyTagManagerClient()
        tag_count = 0
        for project_id in project_ids:
            parent = f"projects/{project_id}/locations/{location}"
            for taxonomy in client.list_taxonomies(parent=parent):
                tag_count += sum(1 for _ in client.list_policy_tags(parent=taxonomy.name))
        return Evidence(summary=f"{tag_count} policy tags enumerated")


class BigQueryConnection(BaseConnection[BigQueryConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        connection = self.service_connection
        set_google_credentials(gcp_credentials=connection.credentials)
        kwargs = {}
        if connection.billingProjectId:
            kwargs["billing_project_id"] = connection.billingProjectId

        engine = create_generic_db_connection(
            connection=connection,
            get_connection_url_fn=get_connection_url,
            get_connection_args_fn=get_connection_args,
            **kwargs,
        )
        self._on_close(engine.dispose)
        return engine

    # BigQuery enumerates every dataset and queries INFORMATION_SCHEMA; keep the
    # pre-migration 3-minute per-step budget so slow projects are not failed.
    step_timeout_seconds = THREE_MIN

    def checks(self) -> ChecksProvider:
        return BigQueryChecks(
            get_client=lambda: self.client,
            service_connection=self.service_connection,
        )
