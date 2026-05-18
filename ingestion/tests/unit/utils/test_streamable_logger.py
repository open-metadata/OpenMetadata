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

import logging
import threading
import time
import unittest
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

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


def _make_metadata_mock():
    """Build a Mock that satisfies StreamableLogHandler's needs:
    - send_logs_batch_best_effort / send_close_best_effort attrs
    - .client.config (real ClientConfig) so handler can build its own REST"""
    from metadata.ingestion.ometa.client import ClientConfig

    metadata = Mock(spec=OpenMetadata)
    metadata.client = Mock()
    metadata.client.config = ClientConfig(base_url="http://localhost:8585")
    metadata.send_logs_batch_best_effort = Mock(return_value=True)
    metadata.send_close_best_effort = Mock(return_value=True)
    return metadata


def _make_handler(
    metadata=None,
    pipeline_fqn="test.pipeline",
    run_id=None,
    max_buffer=10000,
    enable_streaming=False,
):
    if metadata is None:
        metadata = _make_metadata_mock()
    if run_id is None:
        run_id = uuid4()
    handler = StreamableLogHandler(
        metadata=metadata,
        pipeline_fqn=pipeline_fqn,
        run_id=run_id,
        max_buffer=max_buffer,
        enable_streaming=enable_streaming,
    )
    handler.setFormatter(logging.Formatter("%(message)s"))
    return handler


def _stop_workers(handler):
    """Signal stop and give the drainer/senders a moment to notice.
    Used in tests that need a quiescent handler. We don't .join() in
    production close() - see TestNoWaitClose - but in tests we want
    to be sure background threads aren't going to race assertions."""
    handler._stop.set()
    if handler._drainer:
        handler._drainer.join(timeout=3)
    for t in handler._senders:
        t.join(timeout=3)


class TestEmitNonBlocking(unittest.TestCase):
    """emit() must be fast and must never raise."""

    def test_emit_with_streaming_disabled_goes_to_fallback(self):
        handler = _make_handler(enable_streaming=False)
        handler.fallback_handler = Mock()
        record = _make_record()

        handler.emit(record)

        handler.fallback_handler.emit.assert_called_once_with(record)

    def test_emit_with_streaming_enabled_queues_to_buffer(self):
        handler = _make_handler(enable_streaming=True)
        _stop_workers(handler)

        handler.emit(_make_record("log A"))
        handler.emit(_make_record("log B"))

        self.assertEqual(handler._buffer.qsize(), 2)
        handler.close()

    def test_emit_drops_silently_when_buffer_full(self):
        """No stderr fallback per record on overflow - only a counter."""
        handler = _make_handler(max_buffer=1, enable_streaming=True)
        _stop_workers(handler)
        handler.fallback_handler = Mock()
        handler._buffer.put_nowait("already-here")

        start = time.monotonic()
        handler.emit(_make_record("overflow"))
        elapsed = time.monotonic() - start

        self.assertLess(elapsed, 0.05, "emit() must return immediately on overflow")
        handler.fallback_handler.emit.assert_not_called()
        self.assertEqual(handler.dropped_overflow, 1)

    def test_emit_never_raises_when_format_fails(self):
        handler = _make_handler(enable_streaming=True)
        _stop_workers(handler)
        handler.format = Mock(side_effect=ValueError("boom"))

        handler.emit(_make_record())

        self.assertEqual(handler.dropped_format_error, 1)
        self.assertEqual(handler.dropped_overflow, 0)
        handler.close()

    def test_emit_after_close_increments_dedicated_counter(self):
        handler = _make_handler(enable_streaming=True)
        handler.close()
        handler.emit(_make_record("post-close"))
        self.assertEqual(handler.dropped_after_close, 1)
        self.assertEqual(handler.dropped_overflow, 0)
        self.assertEqual(handler.dropped_format_error, 0)

    def test_emit_returns_quickly_under_high_volume(self):
        handler = _make_handler(max_buffer=10000, enable_streaming=True)
        _stop_workers(handler)

        start = time.monotonic()
        for i in range(1000):
            handler.emit(_make_record(f"msg-{i}"))
        elapsed = time.monotonic() - start

        self.assertLess(elapsed, 0.5, f"1000 emits took {elapsed:.3f}s - too slow")


class TestRecursionGuard(unittest.TestCase):
    """The thread-local guard prevents emit() from re-entering itself
    even if a future change reintroduces logging on the shipping path."""

    def tearDown(self):
        # Make sure the guard is clear after each test.
        if hasattr(_shipping_state, "shipping"):
            _shipping_state.shipping = False

    def test_emit_drops_when_shipping_flag_set(self):
        handler = _make_handler(enable_streaming=True)
        _stop_workers(handler)

        _shipping_state.shipping = True
        try:
            handler.emit(_make_record("would-recurse"))
        finally:
            _shipping_state.shipping = False

        self.assertEqual(handler._buffer.qsize(), 0)
        self.assertEqual(handler.dropped_shipping, 1)

    def test_post_thread_sets_and_clears_shipping_flag(self):
        seen_flag = {"value": None}

        def capture(*_, **__):
            seen_flag["value"] = getattr(_shipping_state, "shipping", False)
            return True

        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(side_effect=capture)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.emit(_make_record("trigger"))
        for _ in range(50):
            if metadata.send_logs_batch_best_effort.called:
                break
            time.sleep(0.05)

        self.assertTrue(seen_flag["value"], "shipping flag must be True inside the sender")
        handler.close()
        # Flag must be cleared after the sender returns. Give the
        # sender thread a moment to hit its finally block.
        time.sleep(0.1)
        self.assertFalse(getattr(_shipping_state, "shipping", False))


class TestSenderPool(unittest.TestCase):
    """Bounded send queue. Drainer never waits on a POST."""

    def test_drainer_does_not_wait_on_slow_post(self):
        slow_event = threading.Event()
        post_started = threading.Event()

        def slow_send(*_, **__):
            post_started.set()
            slow_event.wait(timeout=30)
            return True

        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(side_effect=slow_send)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.emit(_make_record("first"))
        self.assertTrue(post_started.wait(timeout=5))

        start = time.monotonic()
        for i in range(50):
            handler.emit(_make_record(f"hangs-{i}"))
        elapsed = time.monotonic() - start

        self.assertLess(elapsed, 0.5, "emits must not block while a POST is hanging")

        handler._stop.set()
        slow_event.set()
        handler._drainer.join(timeout=5)

    def test_saturated_sender_drops_batches(self):
        """When senders + send queue are full on a dead server, the drainer
        drops new batches and counts them. No unbounded growth."""
        hang = threading.Event()  # never set during the test

        def block_forever(*_, **__):
            hang.wait(timeout=30)
            return True

        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(side_effect=block_forever)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        # Make the test cycle faster than defaults.
        handler.BATCH_WAIT_SEC = 0.1

        # Pump 20 separately-timed batches; each wave > BATCH_WAIT_SEC so
        # the drainer ships each as its own batch. Senders block forever
        # on the first MAX_PENDING_BATCHES + SENDER_WORKERS; everything
        # after that must be dropped at drainer-submit time.
        total_waves = handler.MAX_PENDING_BATCHES + handler.SENDER_WORKERS + 10
        for wave in range(total_waves):
            handler.emit(_make_record(f"wave-{wave}"))
            time.sleep(0.2)

        # At least some batches must have been dropped at the send-queue
        # boundary - we sent way more than the cap.
        self.assertGreater(handler.dropped_saturated, 0, "saturated drainer must have dropped at least one batch")
        # In-flight POSTs bounded by SENDER_WORKERS (others wait in queue
        # but don't actually call send_logs_batch_best_effort).
        self.assertLessEqual(
            metadata.send_logs_batch_best_effort.call_count,
            handler.SENDER_WORKERS,
        )

        handler._stop.set()
        hang.set()

    def test_close_notify_is_ordered_after_in_flight_log_batch(self):
        """Regression for the close-vs-late-POST race. /close must not
        overtake an already-started log batch, otherwise the server can
        finalize logs.txt and then receive a late tail batch."""
        log_started = threading.Event()
        release_log = threading.Event()
        close_called = threading.Event()

        def slow_log_send(*_, **__):
            log_started.set()
            release_log.wait(timeout=30)
            return True

        def close_send(*_, **__):
            close_called.set()
            return True

        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(side_effect=slow_log_send)
        metadata.send_close_best_effort = Mock(side_effect=close_send)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.emit(_make_record("first"))
        self.assertTrue(log_started.wait(timeout=5))

        start = time.monotonic()
        handler.close()
        elapsed = time.monotonic() - start

        self.assertLess(elapsed, 0.1, "close() must still return immediately")
        time.sleep(0.2)
        self.assertFalse(
            close_called.is_set(),
            "/close must wait behind the in-flight log batch in the sender queue",
        )

        release_log.set()
        self.assertTrue(close_called.wait(timeout=5))


class TestDaemonThreads(unittest.TestCase):
    """All background threads MUST be daemon, otherwise a wedged sender
    can keep the ingestion process alive past main-thread exit."""

    def test_drainer_thread_is_daemon(self):
        handler = _make_handler(enable_streaming=True)
        self.assertTrue(handler._drainer.daemon, "drainer must be a daemon thread")
        handler.close()

    def test_sender_threads_are_daemon(self):
        handler = _make_handler(enable_streaming=True)
        self.assertEqual(len(handler._senders), handler.SENDER_WORKERS)
        for t in handler._senders:
            self.assertTrue(t.daemon, f"sender {t.name} must be daemon")
        handler.close()

    def test_close_notify_thread_is_daemon(self):
        """The /close call goes out on a daemon so close() doesn't wait."""
        seen = {"daemon": None}

        def capture(*_, **__):
            seen["daemon"] = threading.current_thread().daemon
            return True

        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(return_value=True)
        metadata.send_close_best_effort = Mock(side_effect=capture)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.close()
        for _ in range(50):
            if seen["daemon"] is not None:
                break
            time.sleep(0.05)
        self.assertTrue(seen["daemon"], "close notify must run on a daemon sender thread")


class TestIsolatedClient(unittest.TestCase):
    """The handler must use its OWN REST instance (own session/cookies/
    connection pool), not the main metadata client's."""

    def test_handler_creates_dedicated_rest_client(self):
        from metadata.ingestion.ometa.client import REST

        metadata = Mock(spec=OpenMetadata)
        # Give the mock client a real ClientConfig so REST() can copy it.
        from metadata.ingestion.ometa.client import ClientConfig

        metadata.client = Mock()
        metadata.client.config = ClientConfig(base_url="http://localhost:8585")
        metadata.send_logs_batch_best_effort = Mock(return_value=True)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)

        self.assertIsInstance(handler._client, REST)
        self.assertIsNot(handler._client, metadata.client, "handler must own a SEPARATE REST instance")
        self.assertIsNot(handler._client._session, metadata.client, "handler's session must not be the main client")
        handler.close()

    def test_handler_passes_isolated_client_to_post(self):
        """The send_logs_batch_best_effort call must include the handler's
        own client kwarg so log shipping doesn't go through the main session."""
        from metadata.ingestion.ometa.client import ClientConfig

        captured = {"client": None}

        def capture(*_, client=None, **__):
            captured["client"] = client
            return True

        metadata = Mock(spec=OpenMetadata)
        metadata.client = Mock()
        metadata.client.config = ClientConfig(base_url="http://localhost:8585")
        metadata.send_logs_batch_best_effort = Mock(side_effect=capture)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.emit(_make_record("trigger"))
        for _ in range(50):
            if metadata.send_logs_batch_best_effort.called:
                break
            time.sleep(0.05)

        self.assertIs(
            captured["client"], handler._client, "handler must pass its own _client to send_logs_batch_best_effort"
        )
        handler.close()

    @patch("metadata.utils.streamable_logger.REST")
    def test_handler_reuses_one_isolated_client_for_all_batches(self, mock_rest):
        """Persistent connection pool guarantee: construct one isolated REST
        client per handler, pass that same client for every batch, and close
        it only when the sender exits."""
        client = Mock()
        mock_rest.return_value = client

        metadata = Mock(spec=OpenMetadata)
        metadata.client = Mock()
        metadata.client.config = Mock()
        metadata.send_logs_batch_best_effort = Mock(return_value=True)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)

        handler._post_batch(["first"])
        handler._post_batch(["second"])

        mock_rest.assert_called_once_with(metadata.client.config)
        self.assertEqual(metadata.send_logs_batch_best_effort.call_count, 2)
        first_call, second_call = metadata.send_logs_batch_best_effort.call_args_list
        self.assertIs(first_call.kwargs["client"], client)
        self.assertIs(second_call.kwargs["client"], client)
        client.close.assert_not_called()

        handler.close()

    def test_isolated_client_is_closed_by_sender_thread(self):
        metadata = _make_metadata_mock()
        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler._client.close = Mock()

        handler.close()
        for _ in range(50):
            if handler._client.close.called:
                break
            time.sleep(0.05)

        handler._client.close.assert_called()


class TestNoWaitClose(unittest.TestCase):
    """close() must return effectively instantly. It must NOT join the
    drainer / senders and must NOT wait on the server /close response."""

    def test_close_returns_in_under_100ms_when_idle(self):
        handler = _make_handler(enable_streaming=True)

        start = time.monotonic()
        handler.close()
        elapsed = time.monotonic() - start

        self.assertLess(
            elapsed,
            0.1,
            f"close() took {elapsed * 1000:.1f}ms - must not block",
        )

    def test_close_returns_quickly_when_close_endpoint_hangs(self):
        hang = threading.Event()

        def block_forever(*_, **__):
            hang.wait(timeout=30)
            return True

        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(return_value=True)
        metadata.send_close_best_effort = Mock(side_effect=block_forever)

        handler = _make_handler(metadata=metadata, enable_streaming=True)

        start = time.monotonic()
        handler.close()
        elapsed = time.monotonic() - start

        self.assertLess(
            elapsed,
            0.1,
            f"close() took {elapsed * 1000:.1f}ms - must not wait on /close response",
        )
        hang.set()

    def test_close_signals_stop(self):
        handler = _make_handler(enable_streaming=True)
        handler.close()
        self.assertTrue(handler._stop.is_set())

    def test_close_is_idempotent(self):
        handler = _make_handler(enable_streaming=True)
        handler.close()
        handler.close()  # must not raise


class TestQuietClientPath(unittest.TestCase):
    """The handler uses the best-effort path that bypasses retries and logging."""

    def test_post_uses_best_effort_method(self):
        metadata = _make_metadata_mock()
        metadata.send_logs_batch_best_effort = Mock(return_value=True)
        metadata.send_close_best_effort = Mock(return_value=True)

        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.emit(_make_record("trigger"))
        for _ in range(50):
            if metadata.send_logs_batch_best_effort.called:
                break
            time.sleep(0.05)

        self.assertTrue(metadata.send_logs_batch_best_effort.called)
        kwargs = metadata.send_logs_batch_best_effort.call_args.kwargs
        self.assertEqual(kwargs["timeout"], StreamableLogHandler.HTTP_TIMEOUT)
        handler.close()


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


class TestRecursionRegression(unittest.TestCase):
    """emit() must run exactly once per producer call even when overflow
    or format failure would historically have triggered recursive logging."""

    def setUp(self):
        self.mock_metadata = _make_metadata_mock()
        self.test_logger = logging.getLogger(f"test_recursion_{id(self)}")
        self.test_logger.handlers = []
        self.test_logger.setLevel(logging.DEBUG)
        self.test_logger.propagate = False

    def tearDown(self):
        self.test_logger.handlers = []

    def _make_handler_with_full_buffer(self):
        handler = _make_handler(
            metadata=self.mock_metadata,
            max_buffer=2,
            enable_streaming=True,
        )
        _stop_workers(handler)
        handler._buffer.put_nowait("a")
        handler._buffer.put_nowait("b")
        self.assertTrue(handler._buffer.full())
        return handler

    def test_emit_does_not_recurse_when_buffer_full(self):
        handler = self._make_handler_with_full_buffer()
        self.test_logger.addHandler(handler)

        emit_calls = {"n": 0}
        real_emit = handler.emit

        def counting(record):
            emit_calls["n"] += 1
            if emit_calls["n"] > 5:
                raise AssertionError("emit() recursed — single-call regression")
            real_emit(record)

        handler.emit = counting
        start = time.monotonic()
        self.test_logger.warning("trigger overflow")
        elapsed = time.monotonic() - start

        self.assertEqual(emit_calls["n"], 1)
        self.assertLess(elapsed, 1.0)

    def test_emit_does_not_recurse_when_format_raises(self):
        handler = _make_handler(metadata=self.mock_metadata, enable_streaming=True)
        _stop_workers(handler)
        handler.format = MagicMock(side_effect=ValueError("boom"))

        self.test_logger.addHandler(handler)
        emit_calls = {"n": 0}
        real_emit = handler.emit

        def counting(record):
            emit_calls["n"] += 1
            if emit_calls["n"] > 5:
                raise AssertionError("emit() recursed via format-failure path")
            real_emit(record)

        handler.emit = counting
        start = time.monotonic()
        self.test_logger.error("trigger format failure")
        elapsed = time.monotonic() - start

        self.assertEqual(emit_calls["n"], 1)
        self.assertLess(elapsed, 1.0)


class TestQuietClientPostMixin(unittest.TestCase):
    """The mixin's best-effort methods must NOT log through ometa_logger
    (which would propagate back to the streamable handler)."""

    def test_send_logs_batch_best_effort_does_not_log_on_failure(self):
        from metadata.ingestion.ometa.mixins.logs_mixin import OMetaLogsMixin

        # Build a bare instance and stub the client.
        instance = OMetaLogsMixin()
        instance.client = Mock()
        instance.client.post_best_effort = Mock(return_value=False)

        with patch("metadata.ingestion.ometa.mixins.logs_mixin.logger") as mock_logger:
            ok = instance.send_logs_batch_best_effort(
                pipeline_fqn="test",
                run_id=uuid4(),
                log_content="x",
                timeout=(1, 2),
            )

        self.assertFalse(ok)
        mock_logger.error.assert_not_called()
        mock_logger.warning.assert_not_called()
        mock_logger.info.assert_not_called()
        mock_logger.debug.assert_not_called()

    def test_send_logs_batch_best_effort_does_not_log_on_exception(self):
        from metadata.ingestion.ometa.mixins.logs_mixin import OMetaLogsMixin

        instance = OMetaLogsMixin()
        instance.client = Mock()
        instance.client.post_best_effort = Mock(side_effect=RuntimeError("boom"))

        with patch("metadata.ingestion.ometa.mixins.logs_mixin.logger") as mock_logger:
            ok = instance.send_logs_batch_best_effort(
                pipeline_fqn="test",
                run_id=uuid4(),
                log_content="x",
                timeout=(1, 2),
            )

        self.assertFalse(ok)
        mock_logger.error.assert_not_called()
        mock_logger.warning.assert_not_called()


class TestClientPostBestEffort(unittest.TestCase):
    """REST.post_best_effort must NOT enter the retry/sleep loop and
    must NOT log on failure."""

    def _make_client(self):
        from metadata.ingestion.ometa.client import REST, ClientConfig

        config = ClientConfig(
            base_url="http://localhost:8585",
            api_version="v1",
            auth_token=lambda: ("token", 60),
        )
        client = REST(config)
        client._session = Mock()
        return client

    def test_post_best_effort_does_not_sleep_on_504(self):
        client = self._make_client()
        resp = Mock()
        resp.status_code = 504
        client._session.post = Mock(return_value=resp)

        with patch("time.sleep") as mock_sleep:
            start = time.monotonic()
            ok = client.post_best_effort("/path", data="x", timeout=(1, 2))
            elapsed = time.monotonic() - start

        self.assertFalse(ok)
        mock_sleep.assert_not_called()
        self.assertLess(elapsed, 0.2, "post_best_effort must NOT sleep on 504")

    def test_post_best_effort_does_not_log_on_failure(self):
        client = self._make_client()
        client._session.post = Mock(side_effect=RuntimeError("network down"))

        with patch("metadata.ingestion.ometa.client.logger") as mock_logger:
            ok = client.post_best_effort("/path", data="x", timeout=(1, 2))

        self.assertFalse(ok)
        mock_logger.error.assert_not_called()
        mock_logger.warning.assert_not_called()
        mock_logger.info.assert_not_called()

    def test_post_best_effort_returns_true_on_2xx(self):
        client = self._make_client()
        resp = Mock()
        resp.status_code = 200
        client._session.post = Mock(return_value=resp)

        self.assertTrue(client.post_best_effort("/path", data="x"))

    def test_build_request_headers_does_not_refresh_token(self):
        """Token refresh stays on _request(); concurrent refresh from the
        sender would race the main thread on shared ClientConfig."""
        client = self._make_client()
        client._auth_token = Mock(return_value=("fresh-token", 60))
        client.config.expires_in = 0
        client.config.access_token = "stale-token"
        client.config.auth_header = "Authorization"

        headers = client._build_request_headers()

        client._auth_token.assert_not_called()
        self.assertEqual(headers["Authorization"], "Bearer stale-token")
        self.assertEqual(client.config.expires_in, 0)


class TestCloseOrderingRegression(unittest.TestCase):
    """close() must enqueue CLOSE_MARKER before setting _stop, otherwise
    the sender's get(timeout) Empty branch can race the enqueue."""

    def test_close_enqueues_marker_before_setting_stop(self):
        metadata = _make_metadata_mock()
        handler = _make_handler(metadata=metadata, enable_streaming=True)
        handler.close()
        for _ in range(50):
            if metadata.send_close_best_effort.called:
                break
            time.sleep(0.05)
        metadata.send_close_best_effort.assert_called_once()

    def test_close_marker_arrives_even_when_sender_was_idle(self):
        metadata = _make_metadata_mock()
        handler = _make_handler(metadata=metadata, enable_streaming=True)
        time.sleep(0.2)  # let sender enter get(timeout=...)
        handler.close()
        for _ in range(50):
            if metadata.send_close_best_effort.called:
                break
            time.sleep(0.05)
        metadata.send_close_best_effort.assert_called_once()


if __name__ == "__main__":
    unittest.main()
