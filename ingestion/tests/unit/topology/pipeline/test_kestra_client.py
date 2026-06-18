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
Unit tests for KestraClient HTTP wrapper.
"""

import json
import pathlib
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.pipeline.kestraConnection import (
    KestraConnection,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.source.pipeline.kestra.client import KestraClient


FIXTURE = (
    pathlib.Path(__file__).resolve().parents[3]
    / "unit"
    / "resources"
    / "datasets"
    / "kestra_dataset.json"
)
DATA = json.loads(FIXTURE.read_text())


def _config(**overrides) -> KestraConnection:
    base = {"hostPort": "http://kestra.test:8080", "tenantId": "main"}
    base.update(overrides)
    return KestraConnection(**base)


def _mock_get(url, **_kwargs):
    m = MagicMock()
    m.raise_for_status.return_value = None
    if url.endswith("/flows/search"):
        m.json.return_value = DATA["flows"]
    elif url.endswith("/flows/hackathon.demo/cron_etl/graph"):
        m.json.return_value = DATA["cronGraph"]
    elif url.endswith("/flows/hackathon.demo/cron_etl"):
        m.json.return_value = DATA["cronFlow"]
    elif url.endswith("/executions/search"):
        m.json.return_value = DATA["executions"]
    elif "/executions/" in url:
        m.json.return_value = DATA["executionDetail"]
    else:
        raise AssertionError(f"unexpected URL: {url}")
    return m


def test_search_flows_returns_results():
    client = KestraClient(_config())
    with patch.object(client._session, "get", side_effect=_mock_get):
        flows = list(client.search_flows(page_size=50))
    assert len(flows) == DATA["flows"]["total"]
    fqns = {f"{f.namespace}.{f.id}" for f in flows}
    assert "hackathon.demo.cron_etl" in fqns
    assert "hackathon.demo.downstream_consumer" in fqns
    assert "hackathon.demo.parallel_job" in fqns


def test_get_flow_graph_returns_nodes_and_edges():
    client = KestraClient(_config())
    with patch.object(client._session, "get", side_effect=_mock_get):
        graph = client.get_flow_graph("hackathon.demo", "cron_etl")
    assert len(graph.nodes) > 0
    assert len(graph.edges) > 0


def test_get_execution_returns_taskrunlist():
    client = KestraClient(_config())
    exec_id = DATA["executionDetail"]["id"]
    with patch.object(client._session, "get", side_effect=_mock_get):
        ex = client.get_execution(exec_id)
    assert ex.state.current == "SUCCESS"
    assert ex.taskRunList and len(ex.taskRunList) >= 3


def test_basic_auth_when_username_and_password_set():
    client = KestraClient(
        _config(username="admin", password=CustomSecretStr("secret"))
    )
    assert client._session.auth == ("admin", "secret")


def test_token_auth_when_token_set():
    client = KestraClient(_config(token=CustomSecretStr("tok")))
    assert client._session.headers.get("Authorization") == "Bearer tok"


def test_no_auth_when_credentials_empty():
    client = KestraClient(_config())
    assert client._session.auth is None
    assert "Authorization" not in client._session.headers


def test_token_wins_over_basic():
    client = KestraClient(
        _config(
            username="admin",
            password=CustomSecretStr("secret"),
            token=CustomSecretStr("tok"),
        )
    )
    assert client._session.headers.get("Authorization") == "Bearer tok"
    assert client._session.auth is None


def test_url_uses_tenant_when_set():
    client = KestraClient(_config(tenantId="main"))
    assert client._url("/flows/search") == "http://kestra.test:8080/api/v1/main/flows/search"


def test_url_omits_tenant_when_empty():
    client = KestraClient(_config(tenantId=""))
    assert client._url("/flows/search") == "http://kestra.test:8080/api/v1/flows/search"
