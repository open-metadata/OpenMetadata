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
Unit tests for BigQuery service account impersonation across the SQLAlchemy
engine path (Test Connection + information_schema reads), the BigQuery Python
client path (dataset listing) and the Data Catalog path (policy tags).

Regression coverage for
https://github.com/open-metadata/OpenMetadata/issues/28204
https://github.com/open-metadata/OpenMetadata/issues/30964
"""

import threading
import time
from copy import deepcopy
from unittest.mock import MagicMock, patch

import pytest
from google.api_core.exceptions import PermissionDenied

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.ingestion.source.database.bigquery.connection import (
    BIGQUERY_ERRORS,
    BigQueryChecks,
    PolicyTagAccessError,
    get_connection_args,
)
from metadata.ingestion.source.database.bigquery.helper import (
    get_impersonate_client_kwargs,
    get_policy_tag_client,
)
from metadata.ingestion.source.database.bigquery.metadata import BigquerySource
from metadata.utils.bigquery_utils import get_bigquery_client

_HELPER_MODULE = "metadata.ingestion.source.database.bigquery.helper"
_CONNECTION_MODULE = "metadata.ingestion.source.database.bigquery.connection"
_METADATA_MODULE = "metadata.ingestion.source.database.bigquery.metadata"

TARGET_SA = "target-reader@my-project.iam.gserviceaccount.com"

VALID_PRIVATE_KEY = (
    "-----BEGIN RSA PRIVATE KEY-----\n"
    "MIIEpQIBAAKCAQEAw3vHG9fDIkcYB0xi2Mv4fS2gUzKR9ZRrcVNeKkqGFTT71AVB\n"
    "OzgIqYVe8b2aWODuNye6sipcrqTqOt05Esj+sxhk5McM9bE2RlxXC5QH/Bp9zxMP\n"
    "/Yksv9Ov7fdDt/loUk7sTXvI+7LDJfmRYU6MtVjyyLs7KpQIB2xBWEToU1xZY+v0\n"
    "dRC1NA+YWc+FjXbAiFAf9d4gXkYO8VmU5meixVh4C8nsjokEXk0T/HEItpZCxadk\n"
    "dZ7LKUE/HDmWCO2oNG6sCf4ET2crjSdYIfXuREopX1aQwnk7KbI4/YIdlRz1I369\n"
    "Az3+Hxlf9lLJVH3+itN4GXrR9yWWKWKDnwDPbQIDAQABAoIBAQC3X5QuTR7SN8iV\n"
    "iBUtc2D84+ECSmza5shG/UJW/6N5n0Mf53ICgBS4GNEwiYCRISa0/ILIgK6CcVb7\n"
    "suvH8F3kWNzEMui4TO0x4YsR5GH9HkioCCS224frxkLBQnL20HIIy9ok8Rpe6Zjg\n"
    "NZUnp4yczPyqSeA9l7FUbTt69uDM2Cx61m8REOpFukpnYLyZGbmNPYmikEO+rq9r\n"
    "wNID5dkSeVuQYo4MQdRavOGFUWvUYXzkEQ0A6vPyraVBfolESX8WaLNVjic7nIa3\n"
    "ujdSNojnJqGJ3gslntcmN1d4JOfydc4bja4/NdNlcOHpWDGLzY1QnaDe0Koxn8sx\n"
    "LT9MVD2NAoGBAPy7r726bKVGWcwqTzUuq1OWh5c9CAc4N2zWBBldSJyUdllUq52L\n"
    "WTyva6GRoRzCcYa/dKLLSM/k4eLf9tpxeIIfTOMsvzGtbAdm257ndMXNvfYpxCfU\n"
    "K/gUFfAUGHZ3MucTHRY6DTkJg763Sf6PubA2fqv3HhVZDK/1HGDtHlTPAoGBAMYC\n"
    "pdV7O7lAyXS/d9X4PQZ4BM+P8MbXEdGBbPPlzJ2YIb53TEmYfSj3z41u9+BNnhGP\n"
    "4uzUyAR/E4sxrA2+Ll1lPSCn+KY14WWiVGfWmC5j1ftdpkbrXstLN8NpNYzrKZwx\n"
    "jdR0ZkwvZ8B5+kJ1hK96giwWS+SJxJR3TohcQ18DAoGAJSfmv2r//BBqtURnHrd8\n"
    "wq43wvlbC8ytAVg5hA0d1r9Q4vM6w8+vz+cuWLOTTyobDKdrG1/tlXrd5r/sh9L0\n"
    "15SIdkGm3kPTxQbPNP5sQYRs8BrV1tEvoao6S3B45DnEBwrdVN42AXOvpcNGoqE4\n"
    "uHpahyeuiY7s+ZV8lZdmxSsCgYEAolr5bpmk1rjwdfGoaKEqKGuwRiBX5DHkQkxE\n"
    "8Zayt2VOBcX7nzyRI05NuEIMrLX3rZ61CktN1aH8fF02He6aRaoE/Qm9L0tujM8V\n"
    "Ni8WiLMDeR/Ifs3u4/HAv1E8v1byv0dCa7klR8J257McJ/ID4X4pzcxaXgE4ViOd\n"
    "GOHNu9ECgYEApq1zkZthEQymTUxs+lSFcubQpaXyf5ZC61cJewpWkqGDtSC+8DxE\n"
    "F/jydybWuoNHXymnvY6QywxuIooivbuib6AlgpEJeybmnWlDOZklFOD0abNZ+aNO\n"
    "dUk7XVGffCakXQ0jp1kmZA4lGsYK1h5dEU5DgXqu4UYJ88Vttax2W+Y=\n"
    "-----END RSA PRIVATE KEY-----\n"
)

ADC_CONFIG = {
    "type": "BigQuery",
    "credentials": {"gcpConfig": {"type": "gcp_adc", "projectId": "proj-adc"}},
}

JSON_KEY_CONFIG = {
    "type": "BigQuery",
    "credentials": {
        "gcpConfig": {
            "type": "service_account",
            "projectId": "proj-key",
            "privateKeyId": "private_key_id",
            "privateKey": VALID_PRIVATE_KEY,
            "clientEmail": "svc@proj-key.iam.gserviceaccount.com",
            "clientId": "1234",
            "authUri": "https://accounts.google.com/o/oauth2/auth",
            "tokenUri": "https://oauth2.googleapis.com/token",
            "authProviderX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
            "clientX509CertUrl": "https://www.googleapis.com/oauth2/v1/certs",
        }
    },
}


def _with_impersonation(base_config: dict, lifetime: int = 1800) -> BigQueryConnection:
    config = deepcopy(base_config)
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": TARGET_SA,
        "lifetime": lifetime,
    }
    return BigQueryConnection.model_validate(config)


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
def test_impersonate_kwargs_built_for_all_config_types(base_config):
    """Impersonation kwargs must be produced independently of the gcpConfig type."""
    connection = _with_impersonation(base_config, lifetime=1800)

    kwargs = get_impersonate_client_kwargs(connection)

    assert kwargs == {
        "impersonate_service_account": TARGET_SA,
        "lifetime": 1800,
    }


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
def test_no_impersonation_returns_empty_kwargs(base_config):
    """Without a target service account, no impersonation kwargs are emitted."""
    connection = BigQueryConnection.model_validate(base_config)

    assert get_impersonate_client_kwargs(connection) == {}


@pytest.mark.parametrize("blank_email", ["", "   ", "\t", "\n  "])
def test_blank_target_email_is_ignored(blank_email):
    """An empty or whitespace-only impersonate email must not trigger impersonation."""
    config = deepcopy(ADC_CONFIG)
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": blank_email,
        "lifetime": 3600,
    }
    connection = BigQueryConnection.model_validate(config)

    assert get_impersonate_client_kwargs(connection) == {}


def test_target_email_is_stripped():
    """Surrounding whitespace on the target email is trimmed before use."""
    config = deepcopy(ADC_CONFIG)
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": f"  {TARGET_SA}  ",
        "lifetime": 3600,
    }
    connection = BigQueryConnection.model_validate(config)

    assert get_impersonate_client_kwargs(connection) == {
        "impersonate_service_account": TARGET_SA,
        "lifetime": 3600,
    }


@pytest.mark.parametrize(
    "base_config,expected_project",
    [(ADC_CONFIG, "proj-adc"), (JSON_KEY_CONFIG, "proj-key")],
)
@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_engine_connect_args_inject_impersonated_client(mock_common, mock_get_client, base_config, expected_project):
    """
    Path A: when impersonation is set, the SQLAlchemy connect args must carry a
    pre-built impersonated client scoped to the configured project so that
    queries run under the target identity.
    """
    mock_common.return_value = {}
    sentinel_client = MagicMock(name="impersonated_bq_client")
    mock_get_client.return_value = sentinel_client

    connection = _with_impersonation(base_config, lifetime=1800)
    connect_args = get_connection_args(connection)

    assert connect_args["client"] is sentinel_client
    mock_get_client.assert_called_once_with(
        project_id=expected_project,
        impersonate_service_account=TARGET_SA,
        lifetime=1800,
    )


@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_billing_project_id_scopes_impersonated_client(mock_common, mock_get_client):
    """billingProjectId takes precedence over the credentials project id."""
    mock_common.return_value = {}
    mock_get_client.return_value = MagicMock()

    config = deepcopy(ADC_CONFIG)
    config["billingProjectId"] = "billing-proj"
    config["credentials"]["gcpImpersonateServiceAccount"] = {
        "impersonateServiceAccount": TARGET_SA,
        "lifetime": 3600,
    }
    connection = BigQueryConnection.model_validate(config)

    get_connection_args(connection)

    mock_get_client.assert_called_once_with(
        project_id="billing-proj",
        impersonate_service_account=TARGET_SA,
        lifetime=3600,
    )


@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_credentials_path_scopes_impersonated_client(mock_common, mock_get_client):
    """
    A credentials-path config exposes a projectId, so the impersonated client is
    scoped to it (guards the docstring's cross-type support claim).
    """
    mock_common.return_value = {}
    mock_get_client.return_value = MagicMock()

    config = {
        "type": "BigQuery",
        "credentials": {
            "gcpConfig": {
                "type": "gcp_credential_path",
                "path": "/tmp/creds.json",
                "projectId": "proj-path",
            },
            "gcpImpersonateServiceAccount": {"impersonateServiceAccount": TARGET_SA, "lifetime": 3600},
        },
    }
    connection = BigQueryConnection.model_validate(config)

    get_connection_args(connection)

    mock_get_client.assert_called_once_with(
        project_id="proj-path",
        impersonate_service_account=TARGET_SA,
        lifetime=3600,
    )


@patch("metadata.ingestion.source.database.bigquery.connection.logger")
@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_unresolved_project_id_logs_warning(mock_common, mock_get_client, mock_logger):
    """
    When neither billingProjectId nor a credentials projectId is available, the
    impersonated client is still built (project resolved from the environment)
    but a warning is logged to aid diagnosis.
    """
    mock_common.return_value = {}
    mock_get_client.return_value = MagicMock()

    config = {
        "type": "BigQuery",
        "credentials": {
            "gcpConfig": {"type": "gcp_adc"},
            "gcpImpersonateServiceAccount": {"impersonateServiceAccount": TARGET_SA, "lifetime": 3600},
        },
    }
    connection = BigQueryConnection.model_validate(config)

    get_connection_args(connection)

    mock_logger.warning.assert_called_once()
    mock_get_client.assert_called_once_with(
        project_id=None,
        impersonate_service_account=TARGET_SA,
        lifetime=3600,
    )


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
@patch("metadata.ingestion.source.database.bigquery.connection.get_bigquery_client")
@patch("metadata.ingestion.source.database.bigquery.connection.get_connection_args_common")
def test_engine_connect_args_unchanged_without_impersonation(mock_common, mock_get_client, base_config):
    """
    Regression guard: without impersonation the connect args are exactly the
    common args and NO client is injected, so existing behaviour is preserved.
    """
    mock_common.return_value = {"existing": "arg"}

    connection = BigQueryConnection.model_validate(base_config)
    connect_args = get_connection_args(connection)

    assert connect_args == {"existing": "arg"}
    assert "client" not in connect_args
    mock_get_client.assert_not_called()


@patch("metadata.utils.bigquery_utils.get_gcp_impersonate_credentials")
@patch("metadata.utils.bigquery_utils.get_gcp_default_credentials")
def test_get_bigquery_client_uses_impersonated_credentials(mock_default, mock_impersonate):
    """
    The BigQuery client must be built with impersonated credentials targeting
    the configured service account when impersonation is requested.
    """
    impersonated_creds = MagicMock(name="impersonated_creds")
    mock_impersonate.return_value = impersonated_creds

    with patch("google.cloud.bigquery.Client") as mock_bq_client:
        get_bigquery_client(
            project_id="proj-adc",
            impersonate_service_account=TARGET_SA,
            lifetime=1800,
        )

    mock_impersonate.assert_called_once_with(
        impersonate_service_account=TARGET_SA,
        quoted_project_id=None,
        scopes=None,
        lifetime=1800,
    )
    mock_default.assert_not_called()
    _, client_kwargs = mock_bq_client.call_args
    assert client_kwargs["credentials"] is impersonated_creds
    assert client_kwargs["project"] == "proj-adc"


@patch("metadata.utils.bigquery_utils.get_gcp_impersonate_credentials")
@patch("metadata.utils.bigquery_utils.get_gcp_default_credentials")
def test_get_bigquery_client_uses_default_credentials_without_impersonation(mock_default, mock_impersonate):
    """Without a target service account, default credentials are used as before."""
    default_creds = MagicMock(name="default_creds")
    mock_default.return_value = default_creds

    with patch("google.cloud.bigquery.Client") as mock_bq_client:
        get_bigquery_client(project_id="proj-adc")

    mock_default.assert_called_once()
    mock_impersonate.assert_not_called()
    _, client_kwargs = mock_bq_client.call_args
    assert client_kwargs["credentials"] is default_creds


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
@patch(f"{_HELPER_MODULE}.PolicyTagManagerClient")
@patch(f"{_HELPER_MODULE}.get_gcp_impersonate_credentials")
def test_policy_tag_client_uses_impersonated_credentials(mock_impersonate, mock_client, base_config):
    """
    Path C: the Data Catalog client must carry impersonated credentials too.
    Without them it falls back to google.auth.default(), i.e. the source service
    account, and taxonomy reads 403 while every other step passes.
    """
    impersonated_creds = MagicMock(name="impersonated_creds")
    mock_impersonate.return_value = impersonated_creds

    client = get_policy_tag_client(_with_impersonation(base_config, lifetime=1800))

    mock_impersonate.assert_called_once_with(
        impersonate_service_account=TARGET_SA,
        lifetime=1800,
    )
    mock_client.assert_called_once_with(credentials=impersonated_creds)
    assert client is mock_client.return_value


@pytest.mark.parametrize("base_config", [ADC_CONFIG, JSON_KEY_CONFIG])
@patch(f"{_HELPER_MODULE}.PolicyTagManagerClient")
@patch(f"{_HELPER_MODULE}.get_gcp_impersonate_credentials")
def test_policy_tag_client_unchanged_without_impersonation(mock_impersonate, mock_client, base_config):
    """Regression guard: no impersonation means the credential-less client as before."""
    get_policy_tag_client(BigQueryConnection.model_validate(base_config))

    mock_impersonate.assert_not_called()
    mock_client.assert_called_once_with()


def _policy_tag_checks(taxonomy_project_ids=None) -> BigQueryChecks:
    config = deepcopy(ADC_CONFIG)
    config["includePolicyTags"] = True
    config["taxonomyLocation"] = "eu"
    if taxonomy_project_ids:
        config["taxonomyProjectID"] = taxonomy_project_ids

    db = MagicMock()
    db.client.url.host = "proj-adc"
    return BigQueryChecks(db=db, service_connection=BigQueryConnection.model_validate(config))


@patch(f"{_CONNECTION_MODULE}.get_policy_tag_client")
def test_get_tags_step_uses_the_impersonation_aware_client(mock_get_client):
    """The GetTags step must read taxonomies through the shared helper."""
    client = mock_get_client.return_value
    taxonomy = MagicMock()
    taxonomy.name = "projects/proj-adc/locations/eu/taxonomies/1"
    client.list_taxonomies.return_value = [taxonomy]
    client.list_policy_tags.return_value = [MagicMock(), MagicMock()]

    checks = _policy_tag_checks(taxonomy_project_ids=["governance-proj"])
    evidence = checks.get_tags()

    mock_get_client.assert_called_once_with(checks.service_connection)
    assert [call.kwargs["parent"] for call in client.list_taxonomies.call_args_list] == [
        "projects/proj-adc/locations/eu",
        "projects/governance-proj/locations/eu",
    ]
    assert "4" in evidence.summary
    client.transport.close.assert_called_once()


@patch(f"{_CONNECTION_MODULE}.get_policy_tag_client")
def test_denied_taxonomy_read_is_diagnosed_as_a_policy_tag_failure(mock_get_client):
    """
    A Data Catalog 403 must not be classified as a missing BigQuery role - that
    remediation points at the wrong API and, under impersonation, the wrong
    identity.
    """
    client = mock_get_client.return_value
    client.list_taxonomies.side_effect = PermissionDenied("The caller does not have permission")

    checks = _policy_tag_checks()
    with pytest.raises(PolicyTagAccessError) as raised:
        checks.get_tags()

    assert "projects/proj-adc/locations/eu" in str(raised.value)
    client.transport.close.assert_called_once()

    diagnosis = BIGQUERY_ERRORS.classify(raised.value)
    assert diagnosis.title == "Cannot read BigQuery policy tags"
    assert "impersonated service account" in diagnosis.remediation


def _workflow_source(**connection_overrides) -> dict:
    return {
        "type": "bigquery",
        "serviceName": "local_bigquery",
        "serviceConnection": {"config": {**deepcopy(JSON_KEY_CONFIG), **connection_overrides}},
        "sourceConfig": {"config": {"type": "DatabaseMetadata", "includeTags": False}},
    }


@patch(f"{_METADATA_MODULE}.get_policy_tag_client")
@patch(f"{_CONNECTION_MODULE}.BigQueryConnection._get_client")
@patch(f"{_METADATA_MODULE}.BigquerySource.set_project_id")
@patch(f"{_METADATA_MODULE}.BigquerySource._test_connection")
def test_ingestion_source_builds_the_policy_tag_client_through_the_helper(
    mock_test_connection, mock_set_project_id, mock_get_engine, mock_get_client
):
    """
    The ingestion run reads policy tags with its own long-lived client, so it
    needs the same impersonation-aware construction as the GetTags step.
    """
    mock_test_connection.return_value = False
    mock_set_project_id.return_value = ["proj-key"]
    mock_get_engine.return_value = MagicMock()

    source = BigquerySource.create(
        _workflow_source(
            credentials={
                **deepcopy(JSON_KEY_CONFIG["credentials"]),
                "gcpImpersonateServiceAccount": {"impersonateServiceAccount": TARGET_SA, "lifetime": 3600},
            },
            includePolicyTags=True,
        ),
        MagicMock(),
    )

    mock_get_client.assert_called_once_with(source.service_connection)
    assert source._policy_tag_client is mock_get_client.return_value


def _prefetch_source(taxonomy_project_ids=None, database="proj-key") -> BigquerySource:
    """A BigquerySource with only what ``_prefetch_policy_tags`` touches."""
    config = deepcopy(JSON_KEY_CONFIG)
    config["includePolicyTags"] = True
    config["taxonomyLocation"] = "eu"
    if taxonomy_project_ids:
        config["taxonomyProjectID"] = taxonomy_project_ids

    source = object.__new__(BigquerySource)
    source.service_connection = BigQueryConnection.model_validate(config)
    source.context = MagicMock()
    source.context.get.return_value.database = database
    source._policy_tag_cache = {}
    source._taxonomy_cache = {}
    source._taxonomy_to_tags = {}
    source._policy_tag_prefetch_key = None
    source._policy_tag_lock = threading.Lock()
    source._policy_tag_client = MagicMock()
    source._policy_tag_client.list_policy_tags.return_value = []
    return source


def _taxonomy(name: str, display_name: str) -> MagicMock:
    taxonomy = MagicMock()
    taxonomy.name = name
    taxonomy.display_name = display_name
    return taxonomy


def test_prefetch_policy_tags_is_not_repeated_for_the_same_projects():
    """
    ``yield_tag`` calls this once per dataset; re-listing every taxonomy per
    schema multiplies the Data Catalog calls (and, on failure, the warning) by
    the dataset count. Uses the reported shape: the database project plus a
    separate governance project holding the taxonomies.
    """
    source = _prefetch_source(taxonomy_project_ids=["governance-proj"])
    source._policy_tag_client.list_taxonomies.return_value = [_taxonomy("t/1", "PII")]

    source._prefetch_policy_tags()
    source._prefetch_policy_tags()
    source._prefetch_policy_tags()

    assert [call.kwargs["parent"] for call in source._policy_tag_client.list_taxonomies.call_args_list] == [
        "projects/proj-key/locations/eu",
        "projects/governance-proj/locations/eu",
    ]
    assert source._taxonomy_cache == {"t/1": "PII"}


def test_prefetch_policy_tags_skipped_when_the_client_failed_to_initialise():
    """An unusable Data Catalog client must not raise, and must not retry per schema."""
    source = _prefetch_source()
    source._policy_tag_client = None

    source._prefetch_policy_tags()
    source._prefetch_policy_tags()

    assert source._taxonomy_cache == {}


def test_prefetch_policy_tags_refetches_when_the_project_set_changes():
    """
    A multi-project run must never serve one project's taxonomies to another, so
    the skip is keyed on the project list rather than a done-flag.
    """
    source = _prefetch_source()
    source._policy_tag_client.list_taxonomies.return_value = [_taxonomy("t/1", "PII")]
    source._prefetch_policy_tags()

    source.context.get.return_value.database = "other-proj"
    source._policy_tag_client.list_taxonomies.return_value = [_taxonomy("t/2", "Confidential")]
    source._prefetch_policy_tags()

    assert source._taxonomy_cache == {"t/2": "Confidential"}
    assert [call.kwargs["parent"] for call in source._policy_tag_client.list_taxonomies.call_args_list] == [
        "projects/proj-key/locations/eu",
        "projects/other-proj/locations/eu",
    ]


def test_prefetch_policy_tags_does_not_retry_a_denied_project_per_schema():
    """A 403 will not resolve mid-run; retrying it per dataset only repeats the warning."""
    source = _prefetch_source()
    source._policy_tag_client.list_taxonomies.side_effect = PermissionDenied("The caller does not have permission")

    source._prefetch_policy_tags()
    source._prefetch_policy_tags()

    source._policy_tag_client.list_taxonomies.assert_called_once()


def test_prefetch_policy_tags_never_exposes_a_half_built_cache_to_a_second_thread():
    """
    The databaseSchema node runs with threads=True, so schemas prefetch
    concurrently on one source instance. A thread that skips the fetch must still
    observe a fully populated cache - ``yield_tag`` iterates ``_taxonomy_cache``
    the moment this returns, and a partial read silently emits zero or missing
    policy tags for that schema.
    """
    source = _prefetch_source()
    taxonomies = [_taxonomy(f"t/{i}", f"PII-{i}") for i in range(25)]
    started = threading.Event()

    def slow_list_taxonomies(parent):
        started.set()
        time.sleep(0.2)  # hold the lock across the "network" call
        return iter(taxonomies)

    source._policy_tag_client.list_taxonomies.side_effect = slow_list_taxonomies
    source._policy_tag_client.list_policy_tags.side_effect = lambda parent: iter([])

    observed = []

    def prefetch_then_consume():
        source._prefetch_policy_tags()
        # exactly what yield_tag does with the caches on return
        observed.append(dict(source._taxonomy_cache))

    first = threading.Thread(target=prefetch_then_consume)
    first.start()
    started.wait(timeout=5)
    second = threading.Thread(target=prefetch_then_consume)
    second.start()
    first.join(timeout=5)
    second.join(timeout=5)

    expected = {f"t/{i}": f"PII-{i}" for i in range(25)}
    assert observed == [expected, expected]
    source._policy_tag_client.list_taxonomies.assert_called_once()
