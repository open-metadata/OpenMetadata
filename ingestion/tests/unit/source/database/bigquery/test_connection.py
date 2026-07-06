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
"""Unit tests for BigQuery test-connection checks and error classification.

Cover the wiring (steps resolve to checks, the network pack is folded in, nothing
connects at construction) and the error-pack mapping (each GCP auth / api_core
scenario classifies to the intended diagnosis).
"""

from unittest.mock import MagicMock, patch

from google.api_core.exceptions import Forbidden, NotFound
from google.auth.exceptions import DefaultCredentialsError, RefreshError

from metadata.core.connections.test_connection import Evidence
from metadata.core.connections.test_connection.check import collect_checks
from metadata.core.connections.test_connection.checks.database import DatabaseStep
from metadata.core.connections.test_connection.network import NetworkUnreachableError
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection as BigQueryConnectionConfig,
)
from metadata.ingestion.source.database.bigquery.connection import (
    BIGQUERY_ERRORS,
    BigQueryChecks,
    get_table_view_names,
)

_CONNECTION_MODULE = "metadata.ingestion.source.database.bigquery.connection"

_GCP_CONFIG = {
    "type": "service_account",
    "projectId": "placeholder",
    "privateKeyId": "key-id",
    "privateKey": "private-key",
    "clientEmail": "user@example.com",
    "clientId": "1234",
    "authUri": "https://accounts.google.com/o/oauth2/auth",
    "tokenUri": "https://oauth2.googleapis.com/token",
    "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
    "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
}


def _config(**overrides) -> BigQueryConnectionConfig:
    base = {"type": "BigQuery", "credentials": {"gcpConfig": {**_GCP_CONFIG}}}
    base.update(overrides)
    return BigQueryConnectionConfig.model_validate(base)


class _ApiError(Exception):
    """Mirror how SQLAlchemy surfaces a driver error: the wrapper's message embeds
    the original and its ``__cause__`` chains to it (via ``raise ... from``), which
    is what the classifier walks."""

    def __init__(self, orig: Exception) -> None:
        super().__init__(f"(google.api_core.exceptions.{type(orig).__name__}) {orig}")
        self.orig = orig
        self.__cause__ = orig


def test_invalid_grant_is_classified():
    error = RefreshError("('invalid_grant: Invalid grant: account not found', {})")
    assert BIGQUERY_ERRORS.classify(error).title == "Invalid service account credentials"


def test_default_credentials_error_is_classified():
    error = DefaultCredentialsError("Could not automatically determine credentials.")
    assert BIGQUERY_ERRORS.classify(error).title == "Could not determine GCP credentials"


def test_refresh_error_is_classified():
    error = RefreshError("Unable to acquire impersonated credentials")
    assert BIGQUERY_ERRORS.classify(error).title == "Failed to obtain a GCP access token"


def test_missing_jobs_create_permission_is_classified():
    error = _ApiError(
        Forbidden("403 POST https://bigquery.googleapis.com: User does not have bigquery.jobs.create permission")
    )
    assert BIGQUERY_ERRORS.classify(error).title == "Missing permission to run BigQuery jobs"


def test_jobs_create_beats_generic_forbidden():
    # A bigquery.jobs.create denial is a Forbidden; the sharper token rule is
    # ordered first so the user gets the actionable role, not a generic message.
    error = Forbidden("403 User does not have bigquery.jobs.create permission in project x")
    assert BIGQUERY_ERRORS.classify(error).title != "Permission denied"


def test_access_denied_is_classified():
    error = _ApiError(Forbidden("403 Access Denied: Table project:dataset.INFORMATION_SCHEMA.JOBS_BY_PROJECT"))
    assert BIGQUERY_ERRORS.classify(error).title == "Access denied"


def test_generic_forbidden_is_permission_denied():
    error = Forbidden("403 The caller does not have permission")
    assert BIGQUERY_ERRORS.classify(error).title == "Permission denied"


def test_not_found_is_classified():
    error = _ApiError(NotFound("404 Not found: Dataset project:dataset was not found"))
    assert BIGQUERY_ERRORS.classify(error).title == "Project or dataset not found"


def test_unknown_error_returns_no_diagnosis():
    assert BIGQUERY_ERRORS.classify(ValueError("something unexpected")) is None


def test_network_errors_classify_through_including():
    error = NetworkUnreachableError("bigquery.googleapis.com:443 is not reachable")
    error.__cause__ = TimeoutError("timed out")
    assert BIGQUERY_ERRORS.classify(error).title == "Connection timed out"


def test_checks_cover_exactly_the_wired_steps():
    checks = BigQueryChecks(client=MagicMock(), service_connection=_config())
    collected = collect_checks(checks)
    assert set(collected.keys()) == {
        DatabaseStep.CheckAccess,
        DatabaseStep.GetSchemas,
        DatabaseStep.GetTables,
        DatabaseStep.GetViews,
        DatabaseStep.GetTags,
        DatabaseStep.GetQueries,
    }


def test_construction_touches_no_network():
    # Regression for gotcha #2: building the provider must not connect - that would
    # run before the gate and bypass the preflight.
    client = MagicMock()
    BigQueryChecks(client=client, service_connection=_config())
    client.connect.assert_not_called()
    client.execute.assert_not_called()


def test_check_access_pings_the_engine():
    checks = BigQueryChecks(client=MagicMock(), service_connection=_config())
    with patch(f"{_CONNECTION_MODULE}.ping", return_value=Evidence(summary="connection established")) as mock_ping:
        evidence = checks.check_access()
    mock_ping.assert_called_once_with(checks.client)
    assert evidence.summary == "connection established"


def test_get_queries_formats_statement_lazily():
    # The INFORMATION_SCHEMA.JOBS_BY_PROJECT statement must be built inside the
    # check (behind the gate), scoped to the configured usage region.
    checks = BigQueryChecks(client=MagicMock(), service_connection=_config(usageLocation="us-east1"))
    captured = {}

    def fake(client, statement, summarize, *args, **kwargs):
        captured["statement"] = statement
        return Evidence(summary=summarize([]), command=statement)

    with patch(f"{_CONNECTION_MODULE}.run_sql", side_effect=fake):
        evidence = checks.get_queries()
    assert "region-us-east1" in captured["statement"]
    assert "JOBS_BY_PROJECT" in captured["statement"]
    assert evidence.summary == "query history accessible"


def test_get_tags_skips_when_policy_tags_disabled():
    checks = BigQueryChecks(client=MagicMock(), service_connection=_config(includePolicyTags=False))
    assert checks.get_tags() is None


def test_get_tags_skips_when_no_taxonomy_project():
    client = MagicMock()
    client.url.host = None
    checks = BigQueryChecks(client=client, service_connection=_config(includePolicyTags=True))
    assert checks.get_tags() is None


def test_get_tags_skips_when_no_location():
    client = MagicMock()
    client.url.host = "proj-a"
    checks = BigQueryChecks(
        client=client,
        service_connection=_config(includePolicyTags=True, taxonomyLocation=None),
    )
    assert checks.get_tags() is None


def test_get_tags_counts_policy_tags():
    client = MagicMock()
    client.url.host = "proj-a"
    checks = BigQueryChecks(
        client=client,
        service_connection=_config(includePolicyTags=True, taxonomyLocation="us"),
    )
    tag_client = MagicMock()
    tag_client.list_taxonomies.return_value = [MagicMock(name="tax")]
    tag_client.list_policy_tags.return_value = [object(), object()]
    with patch(f"{_CONNECTION_MODULE}.PolicyTagManagerClient", return_value=tag_client):
        evidence = checks.get_tags()
    assert evidence.summary == "2 policy tags enumerated"


def test_get_table_view_names_tolerates_deleted_dataset():
    # A dataset dropped between listing datasets and listing its tables raises
    # NotFound; the probe skips it and still reports the datasets it enumerated.
    conn = MagicMock()
    engine = MagicMock()
    engine.connect.return_value.__enter__.return_value = conn
    bq_client = conn.connection._client
    dataset = MagicMock()
    bq_client.list_datasets.return_value = [dataset]
    bq_client.list_tables.side_effect = NotFound("404 Not found: Dataset was deleted")
    evidence = get_table_view_names(engine)
    assert evidence.summary == "1 datasets enumerated"
