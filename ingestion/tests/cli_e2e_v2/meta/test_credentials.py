#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Fixture credentials use native CI masks without entering config or object reprs."""

import json

import pytest
import requests

from ..mysql import source
from ..runtime.ci import mask_secrets
from ..server import ServerConfig, TokenMintError
from .support import configure_child


@pytest.mark.parametrize("github_actions", [None, "false"])
def test_masking_emits_nothing_outside_github_actions(monkeypatch, capsys, github_actions):
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    if github_actions is not None:
        monkeypatch.setenv("GITHUB_ACTIONS", github_actions)
    mask_secrets("synthetic-local-password")
    captured = capsys.readouterr()
    assert captured.out == captured.err == ""


def test_masking_escapes_command_data_and_ignores_empty_values(monkeypatch, capsys):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    mask_secrets("", "synthetic%password\r\n::warning::value", "synthetic-second-password")
    assert capsys.readouterr().err == (
        "::add-mask::synthetic%25password%0D%0A::warning::value\n::add-mask::synthetic-second-password\n"
    )


def test_configured_token_is_masked_but_not_rendered_in_config_or_repr(monkeypatch, capsys):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-configured-token")
    config = ServerConfig.from_env()
    assert config.jwt_token == "synthetic-configured-token"
    assert config.token_source == "env"
    assert capsys.readouterr().err == "::add-mask::synthetic-configured-token\n"
    assert "synthetic-configured-token" not in repr(config)
    assert config.to_workflow_config_dict() == {
        "openMetadataServerConfig": {
            "hostPort": "${OM_SERVER_URL}",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "${OM_JWT_TOKEN}"},
        }
    }


def test_minted_credentials_are_masked_before_the_next_http_request(monkeypatch, capsys):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_ADMIN_EMAIL", "user@example.com")
    monkeypatch.setenv("OM_ADMIN_PASSWORD", "my_password")
    monkeypatch.delenv("OM_JWT_TOKEN", raising=False)
    replies = iter(
        [
            {"accessToken": "synthetic-admin-token"},
            {"botUser": {"id": "my_bot"}},
            {"config": {"JWTToken": "synthetic-bot-token"}},
        ]
    )
    observed = []

    def send(session, request, **kwargs):
        observed.append(
            (
                request.method,
                request.url,
                request.headers.get("Authorization"),
                json.loads(request.body) if request.body else None,
                capsys.readouterr().err,
            )
        )
        response = requests.Response()
        response.status_code = 200
        response._content = json.dumps(next(replies)).encode()
        response.request = request
        response.url = request.url
        return response

    monkeypatch.setattr(requests.Session, "send", send)
    config = ServerConfig.from_env()
    assert config.jwt_token == "synthetic-bot-token"
    assert config.token_source == "minted"
    assert observed == [
        (
            "POST",
            "http://127.0.0.1:1/api/v1/users/login",
            None,
            {"email": "user@example.com", "password": "bXlfcGFzc3dvcmQ="},
            "::add-mask::my_password\n::add-mask::bXlfcGFzc3dvcmQ=\n",
        ),
        (
            "GET",
            "http://127.0.0.1:1/api/v1/bots/name/ingestion-bot",
            "Bearer synthetic-admin-token",
            None,
            "::add-mask::synthetic-admin-token\n",
        ),
        (
            "GET",
            "http://127.0.0.1:1/api/v1/users/auth-mechanism/my_bot",
            "Bearer synthetic-admin-token",
            None,
            "",
        ),
    ]
    assert capsys.readouterr().err == "::add-mask::synthetic-bot-token\n"
    assert "synthetic-bot-token" not in repr(config)


def test_token_bootstrap_preserves_http_failure(monkeypatch):
    monkeypatch.delenv("GITHUB_ACTIONS", raising=False)
    monkeypatch.delenv("OM_JWT_TOKEN", raising=False)
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_ADMIN_EMAIL", "user@example.com")
    monkeypatch.setenv("OM_ADMIN_PASSWORD", "my_password")
    failure = requests.ConnectionError("synthetic transport unavailable")

    def send(session, request, **kwargs):
        raise failure

    monkeypatch.setattr(requests.Session, "send", send)
    with pytest.raises(TokenMintError, match="synthetic transport unavailable") as error:
        ServerConfig.from_env()
    assert error.value.__cause__ is failure


def test_generated_mysql_passwords_are_masked_before_container_creation(monkeypatch, capsys):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    passwords = iter(["synthetic-root-password", "synthetic-ingest-password"])
    monkeypatch.setattr(source.secrets, "token_urlsafe", lambda size: next(passwords))

    def reject_container(*args, **kwargs):
        assert kwargs["password"] == "synthetic-root-password"
        assert capsys.readouterr().err == (
            "::add-mask::synthetic-root-password\n::add-mask::synthetic-ingest-password\n"
        )
        raise RuntimeError("synthetic container creation failure")

    monkeypatch.setattr(source, "MySqlContainer", reject_container)
    with pytest.raises(RuntimeError, match="synthetic container creation failure"), source.fresh_mysql_instance():
        pytest.fail("Failed container setup must not yield")


@pytest.mark.parametrize("workers", [0, 2])
def test_mask_commands_bypass_fd_capture_and_junit(pytester, monkeypatch, workers):
    configure_child(pytester, monkeypatch, ini="junit_logging = all")
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("OM_SERVER_URL", "http://127.0.0.1:1/api")
    monkeypatch.setenv("OM_JWT_TOKEN", "synthetic-terminal-token")
    pytester.makepyfile(
        """
def test_terminal_mask(om_server_config, capfd):
    assert "jwt_token" not in repr(om_server_config)
    print("ordinary captured output")
    captured = capfd.readouterr().out
    assert captured == "ordinary captured output\\n"
    print("ordinary junit output")
"""
    )
    result = pytester.runpytest_subprocess("-q", "--capture=fd", "--junitxml=report.xml", "-n", str(workers))
    result.assert_outcomes(passed=1)
    assert result.ret == pytest.ExitCode.OK
    assert "::add-mask::synthetic-terminal-token" in result.stdout.str() + result.stderr.str()
    report = (pytester.path / "report.xml").read_text()
    assert "ordinary junit output" in report
    assert "::add-mask::" not in report
    assert "synthetic-terminal-token" not in report
