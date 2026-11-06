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
Validate that a misconfigured `hostPort`, an unreachable API or a version
mismatch surface an actionable message instead of a downstream ``TypeError``.
"""

from unittest.mock import MagicMock, patch

import pytest
import requests

from metadata.ingestion.ometa.client import REST, ClientConfig, HtmlResponseError
from metadata.ingestion.ometa.client_utils import OMetaClientInitError, create_ometa_client
from metadata.ingestion.ometa.mixins.server_mixin import (
    OMetaServerMixin,
    VersionMismatchException,
    VersionNotFoundException,
)

VERSION_URL = "https://release-1-13.getcollate.io/v1/system/version"

# The OpenMetadata UI serves index.html for any unknown route, so a `hostPort`
# missing the `/api` suffix answers 200 with this instead of the REST API.
UI_INDEX_HTML = """<!--
  Copyright 2022 Collate.
-->
<!doctype html>
<html lang="en"><head><title>OpenMetadata</title></head></html>
"""


def _response(
    status: int,
    body: str,
    content_type: str = "application/json",
    url: str = VERSION_URL,
) -> requests.Response:
    resp = requests.Response()
    resp.status_code = status
    resp._content = body.encode()
    resp.headers["Content-Type"] = content_type
    resp.url = url
    return resp


def _rest_returning(resp: requests.Response, raise_on_html: bool = True) -> REST:
    """A REST client whose single request answers `resp`.

    `raise_on_html` defaults to True here because these tests exercise the
    OpenMetadata client, which opts in; the plain default is covered separately.
    """
    client = REST(ClientConfig(base_url="https://release-1-13.getcollate.io", retry=0, raise_on_html=raise_on_html))
    client._session = MagicMock()
    client._session.request.return_value = resp
    return client


class _Server(OMetaServerMixin):
    """Minimal host for the mixin under test."""

    def __init__(self, client: REST):
        self.client = client


class TestHtmlResponseIsNamed:
    """A UI page where JSON is expected must name the misconfiguration."""

    def test_html_body_raises_actionable_error(self):
        client = _rest_returning(_response(200, UI_INDEX_HTML, "text/html;charset=utf-8"))

        with pytest.raises(HtmlResponseError) as err:
            client.get("/system/version")

        message = str(err.value)
        assert VERSION_URL in message
        assert "web page, not an API response" in message

    def test_message_stays_provider_neutral(self):
        """Connectors share this client, so it must not name OpenMetadata."""
        client = _rest_returning(_response(200, UI_INDEX_HTML, "text/html"))

        with pytest.raises(HtmlResponseError) as err:
            client.get("/api/v1/dashboards")

        message = str(err.value)
        assert "OpenMetadata" not in message
        assert "hostPort" not in message

    def test_raising_is_opt_in(self):
        """Connectors build this client against third-party APIs and some tolerate a
        non-JSON reply on purpose (e.g. `AirflowApiClient.get_version`), so the
        default must keep handing back the Response."""
        client = _rest_returning(_response(200, UI_INDEX_HTML, "text/html"), raise_on_html=False)

        response = client.get("/v2/version")

        assert isinstance(response, requests.Response)
        assert response.status_code == 200

    def test_html_sniffed_when_content_type_lies(self):
        client = _rest_returning(_response(200, UI_INDEX_HTML, "text/plain"))

        with pytest.raises(HtmlResponseError):
            client.get("/system/version")

    def test_non_json_text_payloads_still_return_the_response(self):
        """CSV / ODCS-YAML exports legitimately answer with a non-JSON body."""
        csv_body = "name,description\nfoo,bar\n"
        client = _rest_returning(_response(200, csv_body, "text/plain"))

        response = client.get("/glossaries/name/g/export")

        assert isinstance(response, requests.Response)
        assert response.text == csv_body

    def test_unexpected_decode_error_still_returns_none(self):
        """A decode failure that is not a JSONDecodeError keeps the old behaviour."""
        resp = MagicMock(spec=requests.Response)
        resp.status_code = 200
        resp.text = "{}"
        resp.headers = {}
        resp.json.side_effect = RuntimeError("boom")
        client = _rest_returning(resp)

        assert client.get("/system/version") is None


class TestGetServerVersionErrors:
    """Every failure mode of /system/version must say what to fix."""

    def test_html_page_adds_the_host_port_hint(self):
        """Here we know the target is an OpenMetadata server, so we can be specific."""
        client = MagicMock()
        client.get_raw.return_value = _response(200, UI_INDEX_HTML, "text/html")

        with pytest.raises(HtmlResponseError) as err:
            _Server(client).get_server_version()

        message = str(err.value)
        assert "hostPort" in message
        assert "/api" in message

    def test_xml_body_is_not_mistaken_for_a_ui_page(self):
        """A body starting with `<` is not necessarily HTML - no misleading `/api` hint."""
        client = MagicMock()
        client.get_raw.return_value = _response(
            200, '<?xml version="1.0"?><Error><Code>AccessDenied</Code></Error>', "application/xml"
        )

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        message = str(err.value)
        assert "not JSON" in message
        assert "application/xml" in message
        assert "hostPort" not in message

    def test_not_found_names_the_url(self):
        client = MagicMock()
        client.get_raw.return_value = _response(404, '{"code":404,"message":"HTTP 404 Not Found"}')

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        message = str(err.value)
        assert VERSION_URL in message
        assert "404" in message

    @pytest.mark.parametrize("status", [401, 403])
    def test_auth_failure_points_at_the_token(self, status: int):
        client = MagicMock()
        client.get_raw.return_value = _response(status, f'{{"code":{status},"message":"Not authorized"}}')

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        message = str(err.value)
        assert str(status) in message
        assert "token" in message.lower()

    def test_missing_version_field_keeps_the_dev_mode_hint(self):
        client = MagicMock()
        client.get_raw.return_value = _response(200, '{"revision":"abc"}')

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        assert "mvn clean install" in str(err.value)

    def test_json_that_is_not_an_object(self):
        client = MagicMock()
        client.get_raw.return_value = _response(200, "[]")

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        assert VERSION_URL in str(err.value)

    def test_server_error_reports_status_and_body(self):
        client = MagicMock()
        client.get_raw.return_value = _response(503, "upstream unavailable", "text/plain")

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        message = str(err.value)
        assert "503" in message
        assert "upstream unavailable" in message

    def test_non_json_non_html_body_reports_the_content_type(self):
        client = MagicMock()
        client.get_raw.return_value = _response(200, "version: 1.13.1", "text/yaml")

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        message = str(err.value)
        assert "not JSON" in message
        assert "text/yaml" in message

    def test_retry_budget_exhausted(self):
        """`_request` answers None once the 504/429 retries run out."""
        client = MagicMock()
        client.get_raw.return_value = None

        with pytest.raises(VersionNotFoundException) as err:
            _Server(client).get_server_version()

        assert "retry budget" in str(err.value)

    def test_happy_path(self):
        client = MagicMock()
        client.get_raw.return_value = _response(200, '{"version":"1.13.1","revision":"abc"}')

        assert _Server(client).get_server_version() == "1.13.1"


class TestVersionMismatchMessage:
    """The 2.0 client against a 1.13 server must say exactly that."""

    def test_mismatch_reports_both_versions_and_the_remedy(self):
        client = MagicMock()
        client.get_raw.return_value = _response(200, '{"version":"1.13.1"}')
        server = _Server(client)
        server._client_version = "2.0.0.0"

        with pytest.raises(VersionMismatchException) as err:
            server.validate_versions()

        message = str(err.value)
        assert "1.13.1" in message
        assert "2.0.0.0" in message
        assert "openmetadata-ingestion~=1.13.0" in message


class TestCreateOMetaClientKeepsContext:
    """The workflow-level wrapper must not flatten the cause into noise."""

    def test_init_error_keeps_type_cause_and_host(self):
        metadata_config = MagicMock()
        metadata_config.hostPort = "https://release-1-13.getcollate.io/v1"
        cause = VersionMismatchException("Server version is 1.13.1 vs. Client version 2.0.0.0.")

        # `create_ometa_client` builds `OpenMetadata[T, C](...)`, so the generic
        # subscript has to resolve to the raising constructor.
        ometa_mock = MagicMock()
        ometa_mock.__getitem__.return_value = MagicMock(side_effect=cause)

        with (
            patch("metadata.ingestion.ometa.client_utils.OpenMetadata", ometa_mock),
            pytest.raises(OMetaClientInitError) as err,
        ):
            create_ometa_client(metadata_config)

        message = str(err.value)
        assert "VersionMismatchException" in message
        assert "1.13.1" in message
        assert "https://release-1-13.getcollate.io/v1" in message
        assert err.value.__cause__ is cause

    def test_init_error_is_still_a_value_error(self):
        """Callers already catching ValueError must keep working."""
        assert issubclass(OMetaClientInitError, ValueError)
