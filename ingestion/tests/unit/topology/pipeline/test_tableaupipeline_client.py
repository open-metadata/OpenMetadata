"""
Unit tests for the streaming flow-run cache in TableauPipelineClient.
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

    with patch.object(client_mod, "Pager", side_effect=_fake_pager(runs)), patch.object(
        client_mod, "Server"
    ):
        cfg = SimpleNamespace(
            hostPort="https://tableau.example.com",
            apiVersion=None,
            numberOfStatus=number_of_status,
        )
        instance = client_mod.TableauPipelineClient.__new__(
            client_mod.TableauPipelineClient
        )
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
        runs = (
            [_make_run(f"a-{i}", "flow-a", BASE_TIME) for i in range(5)]
            + [_make_run(f"b-{i}", "flow-b", BASE_TIME) for i in range(5)]
        )
        instance, client_mod = _make_client(runs, number_of_status=3)

        with patch.object(client_mod, "Pager", return_value=iter(runs)):
            result = instance.get_flow_runs("flow-a")

        assert len(result) == 3
        assert instance._runs_scanned == 3
        assert not instance._runs_iter_exhausted

    def test_subsequent_call_continues_stream_without_restart(self):
        runs = (
            [_make_run(f"a-{i}", "flow-a", BASE_TIME) for i in range(3)]
            + [_make_run(f"b-{i}", "flow-b", BASE_TIME) for i in range(3)]
        )
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
            _make_run(f"x-{i}", f"flow-{i % 100}", BASE_TIME)
            for i in range(client_mod.MAX_FLOW_RUNS_HARD_LIMIT + 50)
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
