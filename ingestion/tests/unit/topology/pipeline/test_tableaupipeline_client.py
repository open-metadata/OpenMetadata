"""
Unit tests for TableauPipelineClient — streaming flow-run cache,
user-email cache, metadata API calls, and lifecycle.
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _make_run(run_id, flow_id, started):
    return SimpleNamespace(
        id=run_id,
        flow_id=flow_id,
        status="Success",
        started_at=started,
        completed_at=started,
        progress=None,
    )


def _fake_pager(runs):
    """Stand-in for tableauserverclient.Pager — yields runs and exposes iter()."""

    def ctor(endpoint, *_, **__):
        return iter(runs)

    return ctor


def _make_client(runs, number_of_status=3):
    from metadata.ingestion.source.pipeline.tableaupipeline import client as client_mod

    with patch.object(client_mod, "Pager", side_effect=_fake_pager(runs)), patch.object(client_mod, "Server"):
        cfg = SimpleNamespace(
            hostPort="https://tableau.example.com",
            apiVersion=None,
            numberOfStatus=number_of_status,
        )
        instance = client_mod.TableauPipelineClient.__new__(client_mod.TableauPipelineClient)
        instance.tableau_server = MagicMock()
        instance.config = cfg
        instance.ssl_manager = None
        instance.number_of_status = number_of_status
        instance._runs_by_flow = {}
        instance._runs_iter = None
        instance._runs_iter_exhausted = False
        instance._runs_scanned = 0
        instance._user_email_cache = {}
        return instance, client_mod


BASE_TIME = datetime(2025, 1, 1, tzinfo=timezone.utc)


class TestStreamingFlowRuns:
    def test_early_exit_when_flow_has_enough_runs(self):
        runs = [_make_run(f"a-{i}", "flow-a", BASE_TIME) for i in range(5)] + [
            _make_run(f"b-{i}", "flow-b", BASE_TIME) for i in range(5)
        ]
        instance, client_mod = _make_client(runs, number_of_status=3)

        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            result = instance.get_flow_runs("flow-a")

        assert len(result) == 3
        assert instance._runs_scanned == 3
        assert not instance._runs_iter_exhausted

    def test_subsequent_call_continues_stream_without_restart(self):
        runs = [_make_run(f"a-{i}", "flow-a", BASE_TIME) for i in range(3)] + [
            _make_run(f"b-{i}", "flow-b", BASE_TIME) for i in range(3)
        ]
        instance, client_mod = _make_client(runs, number_of_status=3)

        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            first = instance.get_flow_runs("flow-a")
            second = instance.get_flow_runs("flow-b")

        assert len(first) == 3
        assert len(second) == 3
        assert instance._runs_scanned == 6

    def test_interleaved_runs_stop_at_enough(self):
        runs = []
        for i in range(3):
            runs.append(_make_run(f"a-{i}", "flow-a", BASE_TIME))
            runs.append(_make_run(f"b-{i}", "flow-b", BASE_TIME))
        instance, client_mod = _make_client(runs, number_of_status=2)

        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            result = instance.get_flow_runs("flow-a")

        assert len(result) == 2
        assert instance._runs_scanned <= 4

    def test_exhausted_iterator_is_sticky(self):
        runs = [_make_run(f"a-{i}", "flow-a", BASE_TIME) for i in range(2)]
        instance, client_mod = _make_client(runs, number_of_status=10)

        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            first = instance.get_flow_runs("flow-a")

        assert len(first) == 2
        assert instance._runs_iter_exhausted

        with patch.object(client_mod, "Pager", return_value=iter([])) as pager:
            second = instance.get_flow_runs("flow-never-seen")
            assert second == []
            pager.assert_not_called()

    def test_hard_limit_stops_traversal(self):
        from metadata.ingestion.source.pipeline.tableaupipeline import (
            client as client_mod,
        )

        runs = [
            _make_run(f"x-{i}", f"flow-{i % 100}", BASE_TIME) for i in range(client_mod.MAX_FLOW_RUNS_HARD_LIMIT + 50)
        ]
        instance, _ = _make_client(runs, number_of_status=5)

        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            result = instance.get_flow_runs("flow-999999-not-present")

        assert result == []
        assert instance._runs_iter_exhausted
        assert instance._runs_scanned == client_mod.MAX_FLOW_RUNS_HARD_LIMIT

    def test_cleared_cache_reuses_new_stream(self):
        runs_1 = [_make_run(f"a-{i}", "flow-a", BASE_TIME) for i in range(3)]
        runs_2 = [_make_run(f"b-{i}", "flow-b", BASE_TIME) for i in range(3)]
        instance, client_mod = _make_client(runs_1, number_of_status=3)

        with patch.object(client_mod, "Pager", return_value=iter(runs_1)):
            first = instance.get_flow_runs("flow-a")
        assert len(first) == 3

        instance.clear_flow_runs_cache()
        assert instance._runs_by_flow == {}
        assert instance._runs_iter is None
        assert not instance._runs_iter_exhausted

        with patch.object(client_mod, "Pager", return_value=iter(runs_2)):
            second = instance.get_flow_runs("flow-b")
        assert len(second) == 3

    def test_normalizes_non_string_flow_id(self):
        """Tableau's SDK occasionally surfaces UUID-like flow_id objects.
        The cache must key on the string form so str-keyed get_flow_runs
        calls hit the cache instead of missing silently."""

        class FlowIdLike:
            def __init__(self, value):
                self.value = value

            def __str__(self):
                return self.value

            def __bool__(self):
                return bool(self.value)

        runs = [
            SimpleNamespace(
                id="a-1",
                flow_id=FlowIdLike("flow-a"),
                status="Success",
                started_at=BASE_TIME,
                completed_at=BASE_TIME,
                progress=None,
            )
        ]
        instance, client_mod = _make_client(runs, number_of_status=5)
        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            result = instance.get_flow_runs("flow-a")

        assert len(result) == 1
        assert result[0].flow_id == "flow-a"  # normalized to str
        # Cache must be keyed on the string form, not the FlowIdLike object
        assert "flow-a" in instance._runs_by_flow

    def test_runs_without_flow_id_are_skipped(self):
        runs = [
            _make_run("a-1", "flow-a", BASE_TIME),
            _make_run("orphan", None, BASE_TIME),
            _make_run("a-2", "flow-a", BASE_TIME),
        ]
        instance, client_mod = _make_client(runs, number_of_status=5)
        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            result = instance.get_flow_runs("flow-a")
        assert len(result) == 2
        assert {r.id for r in result} == {"a-1", "a-2"}


class TestGetPipelines:
    def test_get_pipelines_propagates_flow_fields(self):
        instance, _ = _make_client([], number_of_status=10)
        from metadata.ingestion.source.pipeline.tableaupipeline.models import (
            TableauFlowItem,
        )

        flow = TableauFlowItem(
            id="flow-1",
            name="My Flow",
            description="Cleans data",
            project_name="Sales",
            owner_id="user-1",
            webpage_url="https://tab/#/flow-1",
            tags=["daily", "sales"],
        )
        with patch.object(instance, "get_flows", return_value=iter([flow])):
            pipelines = list(instance.get_pipelines())
        assert len(pipelines) == 1
        p = pipelines[0]
        assert p.id == "flow-1"
        assert p.name == "flow-1"
        assert p.display_name == "My Flow"
        assert p.description == "Cleans data"
        assert p.project_name == "Sales"
        assert p.owner_id == "user-1"
        assert p.webpage_url == "https://tab/#/flow-1"
        assert p.tags == ["daily", "sales"]


class TestGetFlows:
    def test_get_flows_yields_shape(self):
        instance, client_mod = _make_client([], number_of_status=10)
        raw_flow = SimpleNamespace(
            id="abc-123",
            name="Flow Name",
            description="Desc",
            project_id="proj-1",
            project_name="My Project",
            owner_id="user-x",
            webpage_url="https://tab/#/flow",
            created_at=BASE_TIME,
            updated_at=BASE_TIME,
            tags={"b", "a"},
        )
        with patch.object(client_mod, "Pager", return_value=iter([raw_flow])):
            items = list(instance.get_flows())
        assert len(items) == 1
        item = items[0]
        assert item.id == "abc-123"
        assert item.owner_id == "user-x"
        assert item.project_id == "proj-1"
        # tags sorted
        assert item.tags == ["a", "b"]

    def test_get_flows_handles_none_ids_and_missing_tags(self):
        instance, client_mod = _make_client([], number_of_status=10)
        raw_flow = SimpleNamespace(
            id="abc-123",
            name="Flow Name",
            description=None,
            project_id=None,
            project_name=None,
            owner_id=None,
            webpage_url=None,
            created_at=None,
            updated_at=None,
        )
        with patch.object(client_mod, "Pager", return_value=iter([raw_flow])):
            items = list(instance.get_flows())
        assert items[0].project_id is None
        assert items[0].owner_id is None
        assert items[0].tags == []


class TestGetUserEmail:
    def test_resolves_and_caches(self):
        instance, _ = _make_client([], number_of_status=10)
        mock_users = MagicMock()
        mock_users.get_by_id.return_value = SimpleNamespace(email="alice@example.com", name="alice")
        instance.tableau_server.users = mock_users

        first = instance.get_user_email("user-1")
        second = instance.get_user_email("user-1")

        assert first == "alice@example.com"
        assert second == "alice@example.com"
        # Second call must be a cache hit
        mock_users.get_by_id.assert_called_once_with("user-1")

    def test_falls_back_to_name_when_email_missing(self):
        instance, _ = _make_client([], number_of_status=10)
        mock_users = MagicMock()
        mock_users.get_by_id.return_value = SimpleNamespace(email=None, name="alice")
        instance.tableau_server.users = mock_users

        assert instance.get_user_email("user-1") == "alice"

    def test_returns_none_on_api_error(self):
        instance, _ = _make_client([], number_of_status=10)
        mock_users = MagicMock()
        mock_users.get_by_id.side_effect = RuntimeError("403 forbidden")
        instance.tableau_server.users = mock_users

        assert instance.get_user_email("user-1") is None
        assert instance._user_email_cache["user-1"] is None

    def test_empty_user_id_returns_none(self):
        instance, _ = _make_client([], number_of_status=10)
        assert instance.get_user_email("") is None
        assert instance.get_user_email(None) is None


class TestConnectionTests:
    def test_test_get_flows_calls_api_with_pagesize_1(self):
        instance, _ = _make_client([], number_of_status=10)
        mock_flows = MagicMock()
        instance.tableau_server.flows = mock_flows

        instance.test_get_flows()

        mock_flows.get.assert_called_once()
        req_options = mock_flows.get.call_args[0][0]
        assert req_options.pagesize == 1

    def test_test_metadata_api_invokes_graphql(self):
        instance, _ = _make_client([], number_of_status=10)
        mock_metadata = MagicMock()
        instance.tableau_server.metadata = mock_metadata

        instance.test_metadata_api()

        mock_metadata.query.assert_called_once()
        query = mock_metadata.query.call_args.kwargs.get("query") or mock_metadata.query.call_args[0][0]
        assert "serverInfo" in query


class TestGetFlowLineage:
    def _mk_metadata(self, payload=None, raises=None):
        mock_metadata = MagicMock()
        if raises is not None:
            mock_metadata.query.side_effect = raises
        else:
            mock_metadata.query.return_value = payload
        return mock_metadata

    def test_success_returns_parsed_lineage(self):
        instance, _ = _make_client([], number_of_status=10)
        payload = {
            "data": {
                "flows": [
                    {
                        "id": "flow-1",
                        "luid": "flow-1",
                        "name": "My Flow",
                        "upstreamTables": [
                            {
                                "id": "Table-1",
                                "name": "orders",
                                "fullName": "db.schema.orders",
                            }
                        ],
                        "outputSteps": [{"id": "Out-1", "name": "Out"}],
                    }
                ]
            }
        }
        instance.tableau_server.metadata = self._mk_metadata(payload=payload)

        lineage = instance.get_flow_lineage("flow-1")

        assert lineage is not None
        assert lineage.luid == "flow-1"
        assert len(lineage.upstream_tables) == 1
        assert lineage.upstream_tables[0].name == "orders"
        assert len(lineage.output_steps) == 1

    def test_query_exception_returns_none(self):
        instance, _ = _make_client([], number_of_status=10)
        instance.tableau_server.metadata = self._mk_metadata(raises=RuntimeError("API down"))

        assert instance.get_flow_lineage("flow-1") is None

    def test_empty_data_returns_none(self):
        instance, _ = _make_client([], number_of_status=10)
        instance.tableau_server.metadata = self._mk_metadata(payload={})

        assert instance.get_flow_lineage("flow-1") is None

    def test_no_flows_in_response_returns_none(self):
        instance, _ = _make_client([], number_of_status=10)
        instance.tableau_server.metadata = self._mk_metadata(payload={"data": {"flows": []}})

        assert instance.get_flow_lineage("flow-1") is None

    def test_invalid_flow_shape_returns_none(self):
        instance, _ = _make_client([], number_of_status=10)
        # upstreamTables must be a list — passing a dict triggers validation error
        instance.tableau_server.metadata = self._mk_metadata(
            payload={"data": {"flows": [{"upstreamTables": {"bogus": True}}]}}
        )

        assert instance.get_flow_lineage("flow-1") is None


class TestClientInit:
    def test_init_wires_tsc_server_with_ssl_and_auth(self):
        from metadata.ingestion.source.pipeline.tableaupipeline import (
            client as client_mod,
        )

        fake_server_instance = MagicMock()
        auth = MagicMock()
        config = SimpleNamespace(
            hostPort="https://tab.example.com",
            apiVersion="3.22",
            numberOfStatus=5,
        )
        ssl_manager = MagicMock()

        with patch.object(client_mod, "Server", return_value=fake_server_instance):
            instance = client_mod.TableauPipelineClient(
                tableau_server_auth=auth,
                config=config,
                verify_ssl=True,
                ssl_manager=ssl_manager,
            )

        # apiVersion explicitly set on the server
        assert fake_server_instance.version == "3.22"
        # SSL option passed through
        fake_server_instance.add_http_options.assert_called_once_with({"verify": True})
        # Auth called with the provided credentials
        fake_server_instance.auth.sign_in.assert_called_once_with(auth)
        # Config and caches initialized
        assert instance.config is config
        assert instance.ssl_manager is ssl_manager
        assert instance.number_of_status == 5
        assert instance._runs_by_flow == {}
        assert instance._runs_iter is None
        assert instance._runs_iter_exhausted is False
        assert instance._runs_scanned == 0
        assert instance._user_email_cache == {}

    def test_init_omits_version_when_not_provided(self):
        from metadata.ingestion.source.pipeline.tableaupipeline import (
            client as client_mod,
        )

        fake_server_instance = MagicMock()
        # version attribute fresh on the MagicMock — should not be explicitly set
        del fake_server_instance.version
        config = SimpleNamespace(
            hostPort="https://tab.example.com",
            apiVersion=None,
            numberOfStatus=None,
        )

        with patch.object(client_mod, "Server", return_value=fake_server_instance):
            instance = client_mod.TableauPipelineClient(
                tableau_server_auth=MagicMock(),
                config=config,
                verify_ssl=False,
            )

        # When apiVersion is falsy the client must not write to server.version
        assert not hasattr(fake_server_instance, "version")
        # Default numberOfStatus
        assert instance.number_of_status == client_mod.DEFAULT_NUMBER_OF_STATUS


class TestLifecycle:
    def test_sign_out_runs_cleanup_on_error(self):
        instance, _ = _make_client([], number_of_status=10)
        instance.tableau_server.auth = MagicMock()
        instance.tableau_server.auth.sign_out.side_effect = RuntimeError("offline")
        instance.ssl_manager = MagicMock()
        instance._runs_by_flow = {"flow-a": ["run1"]}

        with pytest.raises(RuntimeError):
            instance.sign_out()

        # cleanup must still have been called
        assert instance._runs_by_flow == {}
        instance.ssl_manager.cleanup_temp_files.assert_called_once()

    def test_cleanup_without_ssl_manager_is_noop(self):
        instance, _ = _make_client([], number_of_status=10)
        instance.ssl_manager = None
        instance._runs_by_flow = {"flow-a": ["run1"]}

        instance.cleanup()

        assert instance._runs_by_flow == {}

    def test_default_number_of_status_when_config_field_absent(self):
        """Exercise the real __init__ with a config object that has no
        `numberOfStatus` attribute at all — proves the `getattr(..., None)`
        fallback in production actually fires."""
        from metadata.ingestion.source.pipeline.tableaupipeline import (
            client as client_mod,
        )

        # SimpleNamespace without numberOfStatus attribute
        config = SimpleNamespace(hostPort="https://tab.example.com", apiVersion=None)
        assert not hasattr(config, "numberOfStatus")

        with patch.object(client_mod, "Server", return_value=MagicMock()):
            instance = client_mod.TableauPipelineClient(
                tableau_server_auth=MagicMock(),
                config=config,
                verify_ssl=False,
            )

        assert instance.number_of_status == client_mod.DEFAULT_NUMBER_OF_STATUS
