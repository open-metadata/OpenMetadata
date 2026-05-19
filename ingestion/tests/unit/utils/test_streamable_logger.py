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
"""Unit tests for the streamable logger module."""

import contextlib
import logging
import time
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest

from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.streamable_logger import (
    StreamableLogHandler,
    StreamableLogHandlerManager,
    _shipping_state,
    cleanup_streamable_logging,
    setup_streamable_logging_for_workflow,
)


def _make_record(msg="test message", level=logging.INFO):
    return logging.LogRecord(
        name="test",
        level=level,
        pathname="test.py",
        lineno=1,
        msg=msg,
        args=(),
        exc_info=None,
    )


def _make_handler(enable_streaming=False, pipeline_fqn="test.pipeline", run_id=None):
    """Minimal handler for Manager/setup tests where the worker isn't exercised.
    enable_streaming=False keeps __init__ from building a REST client or
    starting the worker thread."""
    if run_id is None:
        run_id = uuid4()
    return StreamableLogHandler(
        metadata=Mock(spec=OpenMetadata),
        pipeline_fqn=pipeline_fqn,
        run_id=run_id,
        enable_streaming=enable_streaming,
    )


class TestStreamableLogHandlerManager(unittest.TestCase):
    def tearDown(self):
        StreamableLogHandlerManager._instance = None

    def test_set_handler_removes_previous_from_metadata_logger(self):
        """set_handler must detach the old handler from the metadata logger
        before closing it - otherwise records can still route at it during
        close, and a closed handler stays attached after."""
        from metadata.utils.logger import METADATA_LOGGER

        first = _make_handler(enable_streaming=False)
        second = _make_handler(enable_streaming=False)
        metadata_logger = logging.getLogger(METADATA_LOGGER)
        metadata_logger.addHandler(first)

        StreamableLogHandlerManager.set_handler(first)
        StreamableLogHandlerManager.set_handler(second)

        self.assertNotIn(first, metadata_logger.handlers, "previous handler must be removed before being closed")
        # Cleanup.
        metadata_logger.handlers = [h for h in metadata_logger.handlers if not isinstance(h, StreamableLogHandler)]

    def test_cleanup_clears_singleton(self):
        handler = _make_handler(enable_streaming=False)
        StreamableLogHandlerManager.set_handler(handler)
        StreamableLogHandlerManager.cleanup()
        self.assertIsNone(StreamableLogHandlerManager.get_handler())


class TestStreamableLoggingSetup(unittest.TestCase):
    def tearDown(self):
        from metadata.utils.logger import METADATA_LOGGER

        metadata_logger = logging.getLogger(METADATA_LOGGER)
        metadata_logger.handlers = [
            h for h in metadata_logger.handlers if not isinstance(h, (Mock, StreamableLogHandler))
        ]
        StreamableLogHandlerManager._instance = None

    @patch("logging.getLogger")
    @patch("metadata.utils.streamable_logger.logger")
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_setup_with_valid_config(self, mock_handler_cls, mock_logger, mock_get_logger):
        mock_metadata = Mock(spec=OpenMetadata)
        mock_handler = Mock()
        mock_handler.level = logging.INFO
        mock_handler_cls.return_value = mock_handler
        mock_metadata_logger = Mock()
        mock_get_logger.return_value = mock_metadata_logger

        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=True,
        )

        self.assertIsNotNone(result)
        mock_metadata_logger.addHandler.assert_called_once_with(mock_handler)
        cleanup_streamable_logging()

    def test_setup_returns_none_when_disabled(self):
        result = setup_streamable_logging_for_workflow(
            metadata=Mock(spec=OpenMetadata),
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=False,
        )
        self.assertIsNone(result)

    def test_setup_returns_none_when_pipeline_fqn_missing(self):
        result = setup_streamable_logging_for_workflow(
            metadata=Mock(spec=OpenMetadata),
            pipeline_fqn=None,
            run_id=uuid4(),
            enable_streaming=True,
        )
        self.assertIsNone(result)

    def test_setup_returns_none_when_run_id_missing(self):
        result = setup_streamable_logging_for_workflow(
            metadata=Mock(spec=OpenMetadata),
            pipeline_fqn="test.pipeline",
            run_id=None,
            enable_streaming=True,
        )
        self.assertIsNone(result)


# ============================================================================
# StreamableLogHandler — pytest-style tests using a fake OMeta transport.
#
# These tests drive the full handler lifecycle (emit -> buffer -> worker ->
# flush -> shutdown -> /close) without any real network or infrastructure.
# A FakeOMeta records every batch and close call; failure modes are simulated
# via the post_delay / post_returns / post_raises knobs.
# ============================================================================


class FakeOMeta:
    """Test double for OpenMetadata exposing only what the handler uses.

    Recorded interactions: shipped_batches (log_content per POST),
    close_calls (one tuple per /close POST).

    Fault injection knobs:
      - post_delay: seconds each POST blocks before returning
      - post_returns: True/False return value for send_logs_batch_best_effort
      - post_raises: exception class to raise (None to disable)
      - intermittent_pattern: callable(post_count) -> bool overriding post_returns
    """

    def __init__(self):
        from metadata.ingestion.ometa.client import ClientConfig

        fake_client = type("_FakeClient", (), {})()
        fake_client.config = ClientConfig(base_url="http://test")
        self.client = fake_client
        self.shipped_batches: list = []
        self.close_calls: list = []
        self.post_delay = 0.0
        self.post_returns = True
        self.post_raises = None
        self.intermittent_pattern = None
        self._post_counter = 0

    def send_logs_batch_best_effort(self, pipeline_fqn, run_id, log_content, timeout=None, client=None):
        self._post_counter += 1
        if self.post_delay:
            time.sleep(self.post_delay)
        if self.post_raises is not None:
            raise self.post_raises("simulated failure")
        if self.intermittent_pattern is not None:
            ok = self.intermittent_pattern(self._post_counter)
        else:
            ok = self.post_returns
        if ok:
            self.shipped_batches.append(log_content)
        return ok

    def send_close_best_effort(self, pipeline_fqn, run_id, timeout=None, client=None):
        self.close_calls.append((pipeline_fqn, str(run_id)))
        return True


@pytest.fixture
def fake_ometa():
    return FakeOMeta()


@pytest.fixture
def fake_atexit(monkeypatch):
    """Capture atexit register/unregister calls instead of using the real one."""
    registered = []
    unregistered = []
    monkeypatch.setattr(
        "metadata.utils.streamable_logger.atexit.register",
        lambda fn, *a, **k: registered.append(fn),
    )
    monkeypatch.setattr(
        "metadata.utils.streamable_logger.atexit.unregister",
        unregistered.append,
    )
    return {"registered": registered, "unregistered": unregistered}


@pytest.fixture
def fake_rest(monkeypatch):
    """Mock REST so the P1 force-stop fresh-client path doesn't hit network."""
    calls = []

    class _FakeREST:
        def __init__(self, config):
            calls.append(config)
            self._closed = False

        def close(self):
            self._closed = True

    monkeypatch.setattr("metadata.utils.streamable_logger.REST", _FakeREST)
    return calls


@pytest.fixture
def fast_constants(monkeypatch):
    """Shrink class-level timeouts so tests run in <1s each."""
    monkeypatch.setattr(StreamableLogHandler, "BATCH_WAIT_SEC", 0.05)
    monkeypatch.setattr(StreamableLogHandler, "CLOSE_TIMEOUT_SEC", 1.0)
    monkeypatch.setattr(StreamableLogHandler, "HTTP_TIMEOUT", (0.2, 1.0))


@pytest.fixture
def make_v2(fake_ometa, fake_atexit, fake_rest, fast_constants):
    """Factory for fully configured V2 handlers. Cleans up after each test."""
    handlers = []

    def _make(max_buffer=1000, enable_streaming=True):
        h = StreamableLogHandler(
            metadata=fake_ometa,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            max_buffer=max_buffer,
            enable_streaming=enable_streaming,
        )
        h.setFormatter(logging.Formatter("%(message)s"))
        handlers.append(h)
        return h

    yield _make

    for h in handlers:
        if not h._closed:
            with contextlib.suppress(Exception):
                h.shutdown(timeout=1.0)


def _stop_v2_worker(handler):
    """Halt the worker without going through shutdown — used to test emit
    behavior with a quiescent buffer that won't be drained."""
    handler._stop_event.set()
    if handler._worker is not None:
        handler._worker.join(timeout=1.0)


# ----- Group 1: emit / buffer behavior -----


def test_emit_drops_when_buffer_full(make_v2):
    handler = make_v2(max_buffer=2)
    _stop_v2_worker(handler)

    for i in range(5):
        handler.emit(_make_record(f"log {i}"))

    assert handler.dropped_overflow == 3
    assert handler._buffer.qsize() == 2


def test_emit_drops_after_close(make_v2, fake_ometa):
    handler = make_v2()
    handler.shutdown(timeout=1.0)

    handler.emit(_make_record("after close"))
    handler.emit(_make_record("also after"))

    assert handler.dropped_after_close == 2
    assert all("after close" not in b and "also after" not in b for b in fake_ometa.shipped_batches)


def test_emit_handles_format_error(make_v2):
    handler = make_v2()
    _stop_v2_worker(handler)

    bad_record = _make_record("bad")
    # Force format() to raise on this record only.
    handler.format = Mock(side_effect=ValueError("format boom"))
    handler.emit(bad_record)

    assert handler.dropped_format_error == 1
    assert handler._buffer.qsize() == 0


def test_recursion_guard_prevents_self_emit(make_v2):
    handler = make_v2()
    _stop_v2_worker(handler)
    _shipping_state.shipping = True
    try:
        handler.emit(_make_record("inside shipping"))
        assert handler.dropped_shipping == 1
        assert handler._buffer.qsize() == 0
    finally:
        _shipping_state.shipping = False


# ----- Group 2: flush semantics -----


def test_flush_blocks_until_buffer_empty(make_v2, fake_ometa):
    handler = make_v2()
    for i in range(50):
        handler.emit(_make_record(f"log {i}"))

    handler.flush(timeout=2.0)

    assert handler._buffer.empty()
    # Each batch is a single "\n"-joined log_content; total record count
    # across all batches must be 50.
    total = sum(b.count("\n") for b in fake_ometa.shipped_batches)
    assert total == 50


def test_flush_times_out_when_post_is_slow(make_v2, fake_ometa):
    fake_ometa.post_delay = 1.0
    handler = make_v2()
    handler.emit(_make_record("slow"))

    handler.flush(timeout=0.1)

    assert handler.flush_timed_out == 1


def test_flush_does_not_return_in_dequeue_post_gap(make_v2, fake_ometa):
    """Regression: flush() must NOT report drained while a batch the worker
    just dequeued hasn't started POSTing yet (TOCTOU between buffer.get() and
    _post_in_flight.set())."""
    fake_ometa.post_delay = 0.5
    handler = make_v2()
    handler.emit(_make_record("payload"))

    # Long enough that the worker has dequeued + started its slow POST.
    handler.flush(timeout=2.0)

    # If the race fires, flush() returns before the POST runs and the fake
    # records zero shipped batches.
    assert len(fake_ometa.shipped_batches) >= 1
    assert handler.flush_timed_out == 0


# ----- Group 3: shutdown lifecycle -----


def test_shutdown_is_idempotent(make_v2, fake_ometa):
    handler = make_v2()
    handler.shutdown(timeout=1.0)
    handler.shutdown(timeout=1.0)
    handler.shutdown(timeout=1.0)

    assert len(fake_ometa.close_calls) == 1


def test_shutdown_delivers_close_post(make_v2, fake_ometa):
    handler = make_v2()
    handler.emit(_make_record("first"))
    handler.shutdown(timeout=1.0)

    assert len(fake_ometa.close_calls) == 1


def test_shutdown_ships_metrics_before_close(make_v2, fake_ometa):
    handler = make_v2()
    handler.emit(_make_record("payload"))
    handler.shutdown(timeout=1.0)

    # Last shipped batch must be the multi-line metrics block.
    assert fake_ometa.shipped_batches, "expected at least one shipped batch"
    last = fake_ometa.shipped_batches[-1]
    assert "streamable_logger shutdown:" in last
    assert "shipped:" in last and "failed:" in last
    # Close must have happened after the metrics POST.
    assert len(fake_ometa.close_calls) == 1


def test_atexit_registered_then_unregistered(make_v2, fake_atexit):
    handler = make_v2()
    assert handler.shutdown in fake_atexit["registered"]
    handler.shutdown(timeout=1.0)
    assert handler.shutdown in fake_atexit["unregistered"]


def test_shutdown_force_stops_on_join_timeout(make_v2, fake_ometa, fake_rest):
    # Each POST blocks longer than the shutdown deadline → worker can't
    # finish the drain in its 0.5s budget. P1 force-stop path must fire:
    #   - shutdown_timed_out increments
    #   - A second REST(...) is constructed (first one was in __init__)
    #   - /close is still delivered via the fresh client
    fake_ometa.post_delay = 0.8
    handler = make_v2()
    rest_count_after_init = len(fake_rest)
    for i in range(5):
        handler.emit(_make_record(f"log {i}"))

    handler.shutdown(timeout=0.4)

    assert handler.shutdown_timed_out == 1
    assert len(fake_rest) == rest_count_after_init + 1  # fresh REST was created
    assert len(fake_ometa.close_calls) == 1


# ----- Group 4: worker resilience -----


def test_worker_survives_post_exception(make_v2, fake_ometa):
    fake_ometa.post_raises = RuntimeError
    handler = make_v2()
    handler.emit(_make_record("a"))
    handler.emit(_make_record("b"))
    time.sleep(0.3)  # give worker a chance to run the loop a couple times

    # Worker should have caught the exception(s) and kept running.
    assert handler.worker_errors >= 1
    assert handler._worker.is_alive()

    handler.shutdown(timeout=1.0)


def test_worker_survives_collect_exception(make_v2):
    handler = make_v2()
    # Patch _collect_batch to raise once, then behave normally.
    real_collect = handler._collect_batch
    call_count = {"n": 0}

    def collect_with_one_failure(timeout):
        call_count["n"] += 1
        if call_count["n"] == 2:
            raise RuntimeError("simulated collect failure")
        return real_collect(timeout)

    handler._collect_batch = collect_with_one_failure
    handler.emit(_make_record("a"))
    time.sleep(0.4)

    assert handler.worker_errors >= 1
    assert handler._worker.is_alive()


def test_worker_drain_breaks_on_persistent_failure(make_v2, fake_ometa):
    # During shutdown's drain phase, persistent _collect_batch failure must
    # bail out instead of spinning forever.
    handler = make_v2()
    handler.emit(_make_record("seed"))

    # Wait for the seed to ship so we can move into drain cleanly.
    time.sleep(0.2)

    # Now break collect for the drain phase.
    handler._collect_batch = Mock(side_effect=RuntimeError("persistent"))

    start = time.monotonic()
    handler.shutdown(timeout=2.0)
    elapsed = time.monotonic() - start

    # Must exit promptly, not spin until deadline.
    assert elapsed < 1.5
    assert handler.worker_errors >= 1


# ----- Group 5: network failures / chaos -----


def test_failed_posts_increments_on_false_return(make_v2, fake_ometa):
    fake_ometa.post_returns = False
    handler = make_v2()
    for i in range(3):
        handler.emit(_make_record(f"log {i}"))

    handler.shutdown(timeout=2.0)

    assert handler.failed_posts >= 1
    assert handler.shipped_records == 0


def test_intermittent_failures_counted_correctly(make_v2, fake_ometa):
    # Alternate True / False every other POST.
    fake_ometa.intermittent_pattern = lambda n: n % 2 == 1
    handler = make_v2()
    for i in range(20):
        handler.emit(_make_record(f"log {i}"))
        time.sleep(0.02)  # spread emits so batches form

    handler.shutdown(timeout=2.0)

    # Some succeeded, some failed.
    assert handler.failed_posts >= 1
    assert handler.shipped_records >= 1


def test_slow_om_shutdown_still_delivers_close(make_v2, fake_ometa, fake_rest):
    # Full P1 chaos: every POST takes longer than the join budget.
    fake_ometa.post_delay = 0.6
    handler = make_v2()
    rest_count_after_init = len(fake_rest)
    for i in range(10):
        handler.emit(_make_record(f"log {i}"))

    handler.shutdown(timeout=0.3)

    # Despite the worker being stuck, /close must have been delivered on
    # a fresh REST instance (force-stop + fresh client path).
    assert handler.shutdown_timed_out == 1
    assert len(fake_rest) == rest_count_after_init + 1
    assert len(fake_ometa.close_calls) == 1


# ----- Group 6: end-to-end lifecycle -----


def test_end_to_end_emit_lifecycle(make_v2, fake_ometa):
    """The whole story in one test: emit a bunch, shutdown, assert clean."""
    handler = make_v2()
    for i in range(200):
        handler.emit(_make_record(f"log line {i}"))

    handler.shutdown(timeout=2.0)

    # Reconstruct what landed on the "server": sum of newlines across all
    # shipped batches except the multi-line metrics block at the end.
    payload_batches = fake_ometa.shipped_batches[:-1]
    metrics_batch = fake_ometa.shipped_batches[-1]

    total_lines = sum(b.count("\n") for b in payload_batches)
    assert total_lines == 200

    # Metrics line shipped + /close delivered.
    assert "streamable_logger shutdown:" in metrics_batch
    assert len(fake_ometa.close_calls) == 1

    # Counters all clean.
    assert handler.dropped_overflow == 0
    assert handler.dropped_after_close == 0
    assert handler.dropped_shipping == 0
    assert handler.dropped_format_error == 0
    assert handler.worker_errors == 0
    assert handler.failed_posts == 0
    assert handler.flush_timed_out == 0
    assert handler.shutdown_timed_out == 0
    assert handler.shipped_records == 200
