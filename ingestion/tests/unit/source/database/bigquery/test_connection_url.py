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
"""Unit tests for BigQuery's ``get_connection_url``.

A domain-scoped project id (e.g. ``s3ns:my_project``, used by sovereign clouds
such as S3NS PREMI3NS) contains a literal ``:``. Building the URL as an
f-string and letting SQLAlchemy re-parse it crashes, because
``sqlalchemy.engine.url.make_url`` splits the host on the first literal ``:``
and casts the remainder to a port number. ``get_connection_url`` must build a
``sqlalchemy.engine.url.URL`` object directly so that never happens.
"""

from sqlalchemy.engine.url import URL

from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection as BigQueryConnectionConfig,
)
from metadata.ingestion.source.database.bigquery.connection import (
    get_connection_args,
    get_connection_url,
)
from metadata.ingestion.source.database.bigquery.helper import (
    get_api_endpoint,
    get_bigquery_client_for_project,
)
from metadata.utils.bigquery_utils import get_bigquery_client

_GCP_CONFIG = {
    "type": "service_account",
    "privateKeyId": "key-id",
    "privateKey": "private-key",
    "clientEmail": "user@example.com",
    "clientId": "1234",
}


def _config(project_id, **overrides) -> BigQueryConnectionConfig:
    gcp_config = {**_GCP_CONFIG, "projectId": project_id}
    base = {
        "type": "BigQuery",
        "credentials": {"gcpConfig": gcp_config},
    }
    base.update(overrides)
    return BigQueryConnectionConfig.model_validate(base)


def test_get_connection_url_returns_a_url_object():
    # create_engine/create_generic_db_connection accept both str and URL, but
    # only a URL object is guaranteed to bypass make_url's regex re-parsing.
    url = get_connection_url(_config("my-project"))
    assert isinstance(url, URL)


def test_get_connection_url_preserves_colon_in_domain_scoped_project_id():
    url = get_connection_url(_config("s3ns:my_project"))
    assert url.host == "s3ns:my_project"
    assert url.port is None


def test_get_connection_url_preserves_colon_with_multiple_project_ids():
    url = get_connection_url(_config(["s3ns:my_project", "s3ns:other_project"]))
    assert url.host == "s3ns:my_project"
    assert url.port is None


def test_get_connection_url_nominal_project_id_without_colon():
    url = get_connection_url(_config("my-project"))
    assert url.host == "my-project"
    assert url.port is None


def test_get_connection_url_adds_usage_location_as_query_param():
    url = get_connection_url(_config("my-project", usageLocation="us-east1"))
    assert url.query.get("location") == "us-east1"


def test_get_connection_url_does_not_override_existing_location():
    # usageLocation always has a default value on BigQueryConnection, so the
    # "already present" branch of _add_location is exercised on every call;
    # this pins that it is never appended twice or overwritten unexpectedly.
    url = get_connection_url(_config("my-project", usageLocation="eu"))
    url_str = str(url)
    assert url_str.count("location=") == 1


def test_get_connection_url_uses_supplied_client_for_non_default_universe_domain():
    url = get_connection_url(_config("s3ns:my_project", hostPort="bigquery.s3nsapis.fr"))
    assert "user_supplied_client" not in url.query

    url = get_connection_url(
        _config(
            "s3ns:my_project",
            hostPort="bigquery.s3nsapis.fr",
            credentials={
                "gcpConfig": {
                    **_GCP_CONFIG,
                    "projectId": "s3ns:my_project",
                    "universeDomain": "s3nsapis.fr",
                }
            },
        )
    )
    assert url.query["user_supplied_client"] == "true"


def test_get_connection_args_builds_client_for_non_default_universe_domain(monkeypatch):
    calls = []
    mocked_client = object()

    def fake_get_bigquery_client(**kwargs):
        calls.append(kwargs)
        return mocked_client

    monkeypatch.setattr(
        "metadata.ingestion.source.database.bigquery.connection.get_bigquery_client",
        fake_get_bigquery_client,
    )
    connection = _config(
        "s3ns:my_project",
        hostPort="bigquery.s3nsapis.fr",
        usageLocation="eu",
        credentials={
            "gcpConfig": {
                **_GCP_CONFIG,
                "projectId": "s3ns:my_project",
                "universeDomain": "s3nsapis.fr",
            }
        },
    )

    connect_args = get_connection_args(connection)

    assert connect_args["client"] == mocked_client
    assert calls == [
        {
            "project_id": "s3ns:my_project",
            "location": "eu",
            "api_endpoint": "https://bigquery.s3nsapis.fr",
        }
    ]


def test_get_api_endpoint_falls_back_to_universe_host_when_hostport_is_default():
    # hostPort defaults to "bigquery.googleapis.com" in the connection schema,
    # so a user configuring only `universeDomain` (never touching `hostPort`)
    # must still resolve the custom-universe endpoint instead of silently
    # calling the default Google Cloud host.
    connection = _config(
        "s3ns:my_project",
        credentials={
            "gcpConfig": {
                **_GCP_CONFIG,
                "projectId": "s3ns:my_project",
                "universeDomain": "s3nsapis.fr",
            }
        },
    )

    assert get_api_endpoint(connection) == "https://bigquery.s3nsapis.fr"


def test_get_api_endpoint_returns_none_for_default_universe_domain():
    connection = _config("my-project", hostPort="bigquery.googleapis.com")
    assert get_api_endpoint(connection) is None


def test_get_bigquery_client_accepts_api_endpoint(monkeypatch):
    # Regression test: `get_bigquery_client` must declare `api_endpoint` in its
    # signature. Calling it without mocking the function itself (only its
    # collaborators) catches a `NameError`/`TypeError` if that parameter is
    # ever dropped again.
    monkeypatch.setattr(
        "metadata.utils.bigquery_utils.get_gcp_default_credentials",
        lambda quota_project_id=None: object(),
    )
    created_clients = []

    class FakeClient:
        def __init__(self, **kwargs):
            created_clients.append(kwargs)

    monkeypatch.setattr("google.cloud.bigquery.Client", FakeClient)

    get_bigquery_client(project_id="my-project", api_endpoint="https://bigquery.s3nsapis.fr")

    assert created_clients == [
        {
            "credentials": created_clients[0]["credentials"],
            "project": "my-project",
            "location": None,
            "client_options": {"api_endpoint": "https://bigquery.s3nsapis.fr"},
        }
    ]


def test_get_bigquery_client_for_project_passes_api_endpoint(monkeypatch):
    # Regression test: the per-project client used for metadata ingestion
    # (dataset listing, table metadata) must resolve and forward the custom
    # universe endpoint the same way the SQLAlchemy engine path does.
    calls = []
    mocked_client = object()

    def fake_get_bigquery_client(**kwargs):
        calls.append(kwargs)
        return mocked_client

    monkeypatch.setattr(
        "metadata.ingestion.source.database.bigquery.helper.get_bigquery_client",
        fake_get_bigquery_client,
    )
    connection = _config(
        "s3ns:my_project",
        usageLocation="eu",
        credentials={
            "gcpConfig": {
                **_GCP_CONFIG,
                "projectId": "s3ns:my_project",
                "universeDomain": "s3nsapis.fr",
            }
        },
    )

    client = get_bigquery_client_for_project("s3ns:my_project", connection)

    assert client is mocked_client
    assert calls == [
        {
            "project_id": "s3ns:my_project",
            "location": "eu",
            "api_endpoint": "https://bigquery.s3nsapis.fr",
        }
    ]
