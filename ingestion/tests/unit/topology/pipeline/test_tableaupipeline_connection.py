"""
Unit tests for the Tableau pipeline connection module — get_connection /
test_connection wiring.
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.connections.test_connections import SourceConnectionException
from metadata.ingestion.source.pipeline.tableaupipeline import connection as conn_mod


class TestGetConnection:
    def test_builds_client_with_auth_and_ssl(self):
        fake_auth = object()
        fake_verify = object()
        fake_ssl = object()
        fake_client = MagicMock()
        connection = MagicMock()

        with patch.object(
            conn_mod, "build_server_config", return_value=fake_auth
        ) as mock_build, patch.object(
            conn_mod, "set_verify_ssl", return_value=(fake_verify, fake_ssl)
        ) as mock_ssl, patch.object(
            conn_mod, "TableauPipelineClient", return_value=fake_client
        ) as mock_client_ctor:
            result = conn_mod.get_connection(connection)

        assert result is fake_client
        mock_build.assert_called_once_with(connection)
        mock_ssl.assert_called_once_with(connection)
        mock_client_ctor.assert_called_once_with(
            tableau_server_auth=fake_auth,
            config=connection,
            verify_ssl=fake_verify,
            ssl_manager=fake_ssl,
        )

    def test_raises_source_connection_exception_on_client_failure(self):
        connection = MagicMock()

        with patch.object(
            conn_mod, "build_server_config", return_value=object()
        ), patch.object(
            conn_mod, "set_verify_ssl", return_value=(None, None)
        ), patch.object(
            conn_mod,
            "TableauPipelineClient",
            side_effect=RuntimeError("sign-in 401"),
        ):
            with pytest.raises(SourceConnectionException) as excinfo:
                conn_mod.get_connection(connection)

        assert "sign-in 401" in str(excinfo.value)


class TestTestConnection:
    def test_wires_both_capability_steps(self):
        metadata = MagicMock()
        client = MagicMock()
        service_connection = MagicMock()
        service_connection.type.value = "TableauPipeline"

        with patch.object(conn_mod, "test_connection_steps") as mock_steps:
            mock_steps.return_value = "result-sentinel"
            result = conn_mod.test_connection(
                metadata=metadata,
                client=client,
                service_connection=service_connection,
            )

        assert result == "result-sentinel"
        call_kwargs = mock_steps.call_args.kwargs
        assert call_kwargs["metadata"] is metadata
        assert call_kwargs["service_type"] == "TableauPipeline"
        assert call_kwargs["test_fn"] == {
            "GetPipelines": client.test_get_flows,
            "GetLineage": client.test_metadata_api,
        }

    def test_passes_optional_automation_workflow_and_timeout(self):
        metadata = MagicMock()
        client = MagicMock()
        service_connection = MagicMock()
        service_connection.type.value = "TableauPipeline"
        workflow = MagicMock()

        with patch.object(conn_mod, "test_connection_steps") as mock_steps:
            conn_mod.test_connection(
                metadata=metadata,
                client=client,
                service_connection=service_connection,
                automation_workflow=workflow,
                timeout_seconds=42,
            )

        call_kwargs = mock_steps.call_args.kwargs
        assert call_kwargs["automation_workflow"] is workflow
        assert call_kwargs["timeout_seconds"] == 42
