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
Best-effort streamable log handler for OpenMetadata ingestion pipelines.

Design contract (in order of importance):

1. emit() never blocks the producer. Format -> put_nowait -> return.
   On overflow we increment a counter and drop the record. We do NOT
   write the dropped record to stderr from inside emit() - that would
   add synchronous stderr I/O to every producer log under backpressure.

2. emit() can NEVER re-enter itself. A thread-local flag is set on the
   sender thread; if emit() sees it, it returns immediately. This is a
   belt-and-suspenders backstop to the PR #28160 fix: even if a future
   change reintroduces logging on the shipping path, the recursion
   simply can't happen.

3. ALL background threads are DAEMON. Drainer and senders alike. If
   the connector main thread exits while a sender is wedged on a slow
   DNS / TLS / auth call, the process still terminates. Logging will
   never keep a pod alive.

4. The sender pool is bounded by a fixed-size send queue. If all sender
   slots are occupied (slow / dead server), the drainer drops new
   batches and increments a counter. No unbounded thread / memory
   growth regardless of how long the server takes.

5. The HTTP POST goes through a dedicated quiet path
   (``send_logs_batch_best_effort`` -> ``client.post_best_effort``):
   no retries, no sleep, no connection-error retry, no logging through
   ``ometa_logger``. Failure is a silent bool - counted, not logged.

6. The handler uses an ISOLATED ``REST`` client (own ``requests.Session``,
   own connection pool, own cookie jar). Shares ``ClientConfig`` with
   the main metadata client so auth-token refreshes done by the main
   client are picked up here too - but log shipping can never interfere
   with normal ingestion API traffic.

7. close() does NOT block on the server and does NOT join workers.
   It signals the drainer/senders to stop, enqueues a close marker
   behind already-queued log batches, and returns.

No locks. No sleeps beyond ``queue.get(timeout=...)`` in the drainer/
senders, which is necessary so they're not in a tight loop when idle.
"""

import contextlib
import logging
import threading
from queue import Empty, Full, Queue
from typing import Optional
from uuid import UUID

from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import BASE_LOGGING_FORMAT, METADATA_LOGGER, ingestion_logger

logger = ingestion_logger()

# Thread-local recursion guard. Sender threads set ``shipping = True``
# before doing any work. If emit() sees this flag (i.e. someone logged
# from inside the shipping path), it returns immediately. This protects
# us even if a future refactor reintroduces logging in the POST path.
_shipping_state = threading.local()
_CLOSE_MARKER = object()


class StreamableLogHandler(logging.Handler):
    """Fire-and-forget log shipper. See module docstring for the contract."""

    # Tunables. None affect correctness - only loss rate and how many
    # sender threads can be in flight at once. Conservative defaults.
    BATCH_SIZE = 500
    BATCH_WAIT_SEC = 2.0
    SENDER_TICK_SEC = 1.0
    HTTP_TIMEOUT = (1.0, 2.0)  # (connect, read) seconds
    SENDER_WORKERS = 1  # single daemon sender preserves logs -> close ordering
    MAX_PENDING_BATCHES = 4  # bounded send-queue depth
    CLOSE_TIMEOUT_SEC = 2.0  # for the fire-and-forget /close call

    # pylint: disable=too-many-arguments,too-many-instance-attributes
    def __init__(
        self,
        metadata: OpenMetadata,
        pipeline_fqn: str,
        run_id: UUID,
        max_buffer: int = 10000,
        enable_streaming: bool = True,
    ):
        super().__init__()
        self.metadata = metadata
        self.pipeline_fqn = pipeline_fqn
        self.run_id = run_id
        self.enable_streaming = enable_streaming

        # Used only when streaming is disabled - direct passthrough.
        self.fallback_handler = logging.StreamHandler()

        # Producer-side bounded buffer; drainer drains, senders POST.
        self._buffer: Queue = Queue(maxsize=max_buffer)
        # Send queue is the in-flight cap. Drainer put_nowait - drop on Full.
        self._send_queue: Queue = Queue(maxsize=self.MAX_PENDING_BATCHES)
        self._stop = threading.Event()
        self._closed = False
        self._drainer: Optional[threading.Thread] = None  # noqa: UP045
        self._senders: list = []

        # Isolated REST client. Same ClientConfig (token refresh visible)
        # but distinct requests.Session / connection pool / cookie jar.
        # Log shipping cannot interfere with normal ingestion API traffic.
        self._client: Optional[REST] = (  # noqa: UP045
            REST(metadata.client.config) if enable_streaming else None
        )

        # Diagnostic counters (plain ints - the GIL makes ++ monotonic-safe).
        self.dropped_overflow = 0  # buffer Full at emit()
        self.dropped_saturated = 0  # send_queue Full at drain()
        self.dropped_shipping = 0  # recursion guard tripped

        if self.enable_streaming:
            self._start_workers()

    def _start_workers(self):
        """All daemon. Drainer + N senders. Process can exit at any time
        without waiting for them - that's the explicit non-blocking goal."""
        self._drainer = threading.Thread(
            target=self._drain_loop,
            daemon=True,
            name=f"log-drain-{self.pipeline_fqn[:24]}",
        )
        self._drainer.start()
        for i in range(self.SENDER_WORKERS):
            t = threading.Thread(
                target=self._sender_loop,
                daemon=True,
                name=f"log-ship-{self.pipeline_fqn[:16]}-{i}",
            )
            t.start()
            self._senders.append(t)

    def emit(self, record: logging.LogRecord):
        """Producer entry point. MUST be fast and MUST NOT raise.

        Order of guards:
        1. Recursion guard - if this thread is currently shipping, drop
           silently. Prevents any future logging-from-shipping bug.
        2. Streaming disabled - direct passthrough to fallback.
        3. Format + put_nowait. On Full, count and drop.
        """
        # (1) must be the very first check
        if getattr(_shipping_state, "shipping", False):
            self.dropped_shipping += 1
            return
        if self._closed:
            self.dropped_overflow += 1
            return
        try:
            # (2)
            if not self.enable_streaming:
                self.fallback_handler.emit(record)
                return
            # (3)
            log_entry = self.format(record)
            try:
                self._buffer.put_nowait(log_entry)
            except Full:
                self.dropped_overflow += 1
        except Exception:
            # Format/attr error. Don't re-enter the logger; just count.
            self.dropped_overflow += 1

    def _drain_loop(self):
        """Drain buffer -> batch -> send_queue.put_nowait. Drop if Full.

        Never blocks on the senders. If all sender slots are busy (slow/
        dead server), the batch is dropped immediately and counted.
        """
        while not self._stop.is_set():
            batch = self._collect_batch()
            if not batch:
                continue
            if self._closed:
                self.dropped_saturated += len(batch)
                continue
            try:
                self._send_queue.put_nowait(batch)
            except Full:
                self.dropped_saturated += len(batch)

    def _collect_batch(self) -> list:
        """Pull up to BATCH_SIZE entries. Waits at most BATCH_WAIT_SEC
        for the first entry - the only blocking point in the drainer."""
        try:
            batch = [self._buffer.get(timeout=self.BATCH_WAIT_SEC)]
        except Empty:
            return []
        while len(batch) < self.BATCH_SIZE:
            try:
                batch.append(self._buffer.get_nowait())
            except Empty:
                break
        return batch

    def _sender_loop(self):
        """Daemon-thread worker. Drains send_queue and POSTs each batch."""
        try:
            while True:
                try:
                    item = self._send_queue.get(timeout=self.SENDER_TICK_SEC)
                except Empty:
                    if self._stop.is_set():
                        return
                    continue
                if item is _CLOSE_MARKER:
                    self._notify_close()
                    return
                self._post_batch(item)
        finally:
            with contextlib.suppress(Exception):
                if self._client is not None:
                    self._client.close()

    def _post_batch(self, batch: list):
        """Sender entry point. Sets the recursion guard, ships via the
        quiet client path, clears the guard."""
        _shipping_state.shipping = True
        try:
            self.metadata.send_logs_batch_best_effort(
                pipeline_fqn=self.pipeline_fqn,
                run_id=self.run_id,
                log_content="\n".join(batch) + "\n",
                timeout=self.HTTP_TIMEOUT,
                client=self._client,
            )
        finally:
            _shipping_state.shipping = False

    def close(self):
        """Stop workers and enqueue /close behind already queued batches.

        Returns immediately - does NOT join daemon workers and does NOT
        wait on the server response. The /close marker uses the same
        bounded send queue as log batches; if the queue is saturated, we
        skip /close and rely on server-side abandoned-stream cleanup.
        """
        if self._closed:
            return
        self._closed = True

        if self.enable_streaming:
            self._drain_remaining_buffer()
            with contextlib.suppress(Full):
                self._send_queue.put_nowait(_CLOSE_MARKER)

        # Signal stop AFTER the remaining batches and CLOSE_MARKER are
        # in the send queue. The sender's loop checks _stop only on an
        # Empty timeout; setting stop first creates a race where the
        # sender's in-flight get(timeout=1s) returns Empty in the narrow
        # window between set() and enqueue, exits, and never processes
        # either the remaining batches or the CLOSE_MARKER. Enqueue first,
        # then set — preserves the ordering guarantee in docstring point 7.
        self._stop.set()

        with contextlib.suppress(Exception):
            self.fallback_handler.close()
        super().close()

    def _drain_remaining_buffer(self):
        """Best-effort transfer of producer buffer into the send queue.

        Runs only from close(); never waits. If the send queue is already
        full, remaining logs are dropped and /close is skipped by the full
        queue check in close().
        """
        while True:
            batch = []
            while len(batch) < self.BATCH_SIZE:
                try:
                    batch.append(self._buffer.get_nowait())
                except Empty:
                    break
            if not batch:
                return
            try:
                self._send_queue.put_nowait(batch)
            except Full:
                self.dropped_saturated += len(batch)
                return

    def _notify_close(self):
        """Daemon-thread tail call for close()."""
        _shipping_state.shipping = True
        try:
            self.metadata.send_close_best_effort(
                pipeline_fqn=self.pipeline_fqn,
                run_id=self.run_id,
                timeout=(1.0, self.CLOSE_TIMEOUT_SEC),
                client=self._client,
            )
        finally:
            _shipping_state.shipping = False


class StreamableLogHandlerManager:
    """Process-wide singleton holding the active handler instance."""

    _instance: Optional["StreamableLogHandler"] = None

    @classmethod
    def get_handler(cls) -> Optional["StreamableLogHandler"]:
        return cls._instance

    @classmethod
    def set_handler(cls, handler: Optional["StreamableLogHandler"]) -> None:
        if cls._instance and cls._instance is not handler:
            # Detach the old one from the metadata logger BEFORE closing -
            # otherwise records can still be routed at it during close.
            with contextlib.suppress(Exception):
                logging.getLogger(METADATA_LOGGER).removeHandler(cls._instance)
            with contextlib.suppress(Exception):
                cls._instance.close()
        cls._instance = handler

    @classmethod
    def cleanup(cls) -> None:
        if not cls._instance:
            return
        try:
            with contextlib.suppress(Exception):
                logging.getLogger(METADATA_LOGGER).removeHandler(cls._instance)
            with contextlib.suppress(Exception):
                cls._instance.close()
        finally:
            cls._instance = None


def setup_streamable_logging_for_workflow(
    metadata: OpenMetadata,
    pipeline_fqn: Optional[str] = None,  # noqa: UP045
    run_id: Optional[UUID] = None,  # noqa: UP045
    log_level: int = logging.INFO,
    enable_streaming: bool = False,
) -> Optional[StreamableLogHandler]:  # noqa: UP045
    """Wire up the handler onto the metadata logger, replacing any existing one."""
    if not enable_streaming or not pipeline_fqn or not run_id:
        logger.debug(
            f"Streamable logging not configured: enable={enable_streaming}, "
            f"pipeline_fqn={pipeline_fqn}, run_id={run_id}"
        )
        return None

    try:
        metadata_logger = logging.getLogger(METADATA_LOGGER)
        existing = StreamableLogHandlerManager.get_handler()
        if existing is not None:
            with contextlib.suppress(Exception):
                metadata_logger.removeHandler(existing)

        handler = StreamableLogHandler(
            metadata=metadata,
            pipeline_fqn=pipeline_fqn,
            run_id=run_id,
            enable_streaming=True,
        )
        formatter = logging.Formatter(BASE_LOGGING_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")
        handler.setFormatter(formatter)
        handler.setLevel(log_level)

        metadata_logger.addHandler(handler)
        StreamableLogHandlerManager.set_handler(handler)

        logger.info(f"Streamable logging configured for pipeline: {pipeline_fqn}, run_id: {model_str(run_id)}")
        return handler  # noqa: TRY300

    except Exception as e:
        logger.warning(f"Failed to setup streamable logging: {e}")
        return None


def cleanup_streamable_logging():
    """Remove the active handler. Safe to call multiple times."""
    StreamableLogHandlerManager.cleanup()
