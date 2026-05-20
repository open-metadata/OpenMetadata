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
"""Best-effort streamable log handler for OpenMetadata ingestion pipelines."""

import atexit
import contextlib
import logging
import threading
import time
from queue import Empty, Full, Queue
from typing import Optional
from uuid import UUID

from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import BASE_LOGGING_FORMAT, METADATA_LOGGER, ingestion_logger

logger = ingestion_logger()

# Recursion guard: sender threads set shipping=True so emit() returns
# immediately if it ever fires from inside the shipping path.
_shipping_state = threading.local()


class StreamableLogHandler(logging.Handler):
    """Ship ingestion log records to the OM server.

    Caller invokes shutdown() to flush and close synchronously; an atexit
    hook covers callers that forget.
    """

    BATCH_SIZE = 500
    BATCH_WAIT_SEC = 2.0
    HTTP_TIMEOUT = (2.0, 10.0)
    CLOSE_TIMEOUT_SEC = 30.0
    FLUSH_DEFAULT_SEC = 5.0  # flush() default deadline
    FLUSH_POLL_SEC = 0.05  # how often flush() rechecks state
    FORCE_STOP_JOIN_SEC = 2.0  # secondary worker join after force-stop

    # pylint: disable=too-many-arguments,too-many-instance-attributes
    def __init__(
        self,
        metadata: OpenMetadata,
        pipeline_fqn: str,
        run_id: UUID,
        max_buffer: int = 30_000,
        enable_streaming: bool = True,
    ):
        super().__init__()
        self.metadata = metadata
        self.pipeline_fqn = pipeline_fqn
        self.run_id = run_id
        self.enable_streaming = enable_streaming

        self.fallback_handler = logging.StreamHandler()

        self._buffer: Queue = Queue(maxsize=max_buffer)
        self._stop_event = threading.Event()
        self._closed = False
        self._worker: Optional[threading.Thread] = None  # noqa: UP045
        self._post_in_flight = threading.Event()

        # Isolated session/connection pool; shares ClientConfig so token
        # refresh on the main client is visible here.
        self._client: Optional[REST] = (  # noqa: UP045
            REST(metadata.client.config) if enable_streaming else None
        )

        # Counters surfaced at shutdown.
        self.shipped_records = 0
        self.shipped_batches = 0
        self.failed_posts = 0
        self.dropped_overflow = 0
        self.dropped_after_close = 0
        self.dropped_shipping = 0
        self.dropped_format_error = 0
        self.flush_timed_out = 0
        self.shutdown_timed_out = 0
        self.worker_errors = 0

        self._atexit_registered = False
        if self.enable_streaming:
            # daemon=True so a hung OM can't block process exit; atexit +
            # shutdown() handle the normal-exit drain.
            self._worker = threading.Thread(
                target=self._worker_loop,
                daemon=True,
                name=f"log-ship-{self.pipeline_fqn[:24]}",
            )
            self._worker.start()
            atexit.register(self.shutdown)
            self._atexit_registered = True

    def emit(self, record: logging.LogRecord):
        # Recursion guard: shipping thread must not enqueue while shipping.
        if getattr(_shipping_state, "shipping", False):
            self.dropped_shipping += 1
            return
        if self._closed:
            self.dropped_after_close += 1
            return
        if not self.enable_streaming:
            self.fallback_handler.emit(record)
            return
        try:
            log_entry = self.format(record)
        except Exception:
            self.dropped_format_error += 1
            return
        # Drop fast on full buffer — must not block the producer.
        try:
            self._buffer.put_nowait(log_entry)
        except Full:
            self.dropped_overflow += 1

    def _worker_loop(self):
        try:
            while not self._stop_event.is_set():
                # Catch per-iteration so a single failure can't kill the worker.
                try:
                    batch = self._collect_batch(timeout=self.BATCH_WAIT_SEC)
                    if batch:
                        self._post_batch(batch)
                except Exception:
                    self.worker_errors += 1
            while True:
                try:
                    batch = self._collect_batch(timeout=0)
                    if not batch:
                        break
                    self._post_batch(batch)
                except Exception:
                    self.worker_errors += 1
                    # Persistent failure during drain: bail to avoid infinite loop.
                    break
        finally:
            with contextlib.suppress(Exception):
                if self._client is not None:
                    self._client.close()

    def _collect_batch(self, timeout: float) -> list:
        try:
            batch = [self._buffer.get(timeout=timeout)] if timeout > 0 else [self._buffer.get_nowait()]
        except Empty:
            return []
        # Claim "in flight" the moment we own a batch so flush() can't return
        # in the gap between dequeue and the POST starting.
        self._post_in_flight.set()
        while len(batch) < self.BATCH_SIZE:
            try:
                batch.append(self._buffer.get_nowait())
            except Empty:
                break
        return batch

    def _post_batch(self, batch: list):
        self._post_in_flight.set()
        _shipping_state.shipping = True
        try:
            ok = self.metadata.send_logs_batch_best_effort(
                pipeline_fqn=self.pipeline_fqn,
                run_id=self.run_id,
                log_content="\n".join(batch) + "\n",
                timeout=self.HTTP_TIMEOUT,
                client=self._client,
            )
            if ok:
                self.shipped_records += len(batch)
                self.shipped_batches += 1
            else:
                self.failed_posts += 1
        finally:
            _shipping_state.shipping = False
            self._post_in_flight.clear()

    def flush(self, timeout: float | None = None) -> None:
        """Block until queue is drained, or until deadline."""
        if not self.enable_streaming or self._worker is None:
            return
        deadline = time.monotonic() + (timeout if timeout is not None else self.FLUSH_DEFAULT_SEC)
        while time.monotonic() < deadline:
            if self._buffer.empty() and not self._post_in_flight.is_set():
                return
            # Poll: no single condition covers both "buffer drained" and
            # "in-flight POST returned", so we re-check at FLUSH_POLL_SEC.
            time.sleep(self.FLUSH_POLL_SEC)
        self.flush_timed_out += 1

    def shutdown(self, timeout: float | None = None) -> None:
        """Synchronous flush + close. Idempotent.

        `timeout` bounds the flush + worker-join phases. The post-stop metrics
        POST and `/close` POST each carry their own HTTP timeouts on top, so
        the total wall-time can be up to roughly `timeout + 2 * HTTP read`
        (~`timeout + 32s` with defaults) in pathological cases.
        """
        if self._closed:
            return
        self._closed = True

        if self._atexit_registered:
            with contextlib.suppress(Exception):
                atexit.unregister(self.shutdown)
            self._atexit_registered = False

        if not self.enable_streaming:
            self._print_shutdown_metrics(self._format_shutdown_metrics())
            with contextlib.suppress(Exception):
                self.fallback_handler.close()
            super().close()
            return

        deadline_total = timeout if timeout is not None else self.CLOSE_TIMEOUT_SEC
        flush_budget = deadline_total / 2
        self.flush(timeout=flush_budget)

        # Default: worker still owns self._client. If we force-stop the
        # worker below, we use a LOCAL fresh REST for the post-stop POSTs so
        # the dying worker's finally (which closes self._client) can't close
        # the session under the main thread.
        post_close_client = self._client
        self._stop_event.set()
        if self._worker is not None:
            self._worker.join(timeout=deadline_total - flush_budget)
            if self._worker.is_alive():
                self.shutdown_timed_out += 1
                with contextlib.suppress(Exception):
                    if self._client is not None:
                        self._client.close()
                self._worker.join(timeout=self.FORCE_STOP_JOIN_SEC)
                with contextlib.suppress(Exception):
                    post_close_client = REST(self.metadata.client.config)

        metrics_line = self._format_shutdown_metrics()
        with contextlib.suppress(Exception):
            _shipping_state.shipping = True
            try:
                self.metadata.send_logs_batch_best_effort(
                    pipeline_fqn=self.pipeline_fqn,
                    run_id=self.run_id,
                    log_content=metrics_line + "\n",
                    timeout=self.HTTP_TIMEOUT,
                    client=post_close_client,
                )
            finally:
                _shipping_state.shipping = False

        with contextlib.suppress(Exception):
            _shipping_state.shipping = True
            try:
                self.metadata.send_close_best_effort(
                    pipeline_fqn=self.pipeline_fqn,
                    run_id=self.run_id,
                    timeout=(2.0, self.CLOSE_TIMEOUT_SEC),
                    client=post_close_client,
                )
            finally:
                _shipping_state.shipping = False

        self._print_shutdown_metrics(metrics_line)
        with contextlib.suppress(Exception):
            self.fallback_handler.close()
        super().close()

    def close(self):
        self.shutdown()

    def _format_shutdown_metrics(self) -> str:
        lines = [
            "streamable_logger shutdown:",
            f"  shipped:  records={self.shipped_records} batches={self.shipped_batches}",
            f"  failed:   posts={self.failed_posts}",
            (
                f"  dropped:  overflow={self.dropped_overflow}"
                f" after_close={self.dropped_after_close}"
                f" shipping={self.dropped_shipping}"
                f" format_error={self.dropped_format_error}"
            ),
            f"  errors:   worker={self.worker_errors}",
            f"  timeouts: flush={self.flush_timed_out} shutdown={self.shutdown_timed_out}",
        ]
        return "\n".join(lines)

    def _print_shutdown_metrics(self, msg: str) -> None:
        """Print metrics to stderr via the fallback handler."""
        try:
            record = logging.LogRecord(
                name=METADATA_LOGGER,
                level=logging.INFO,
                pathname=__file__,
                lineno=0,
                msg=msg,
                args=None,
                exc_info=None,
            )
            self.fallback_handler.emit(record)
        except Exception:
            pass


class StreamableLogHandlerManager:
    _instance: Optional["StreamableLogHandler"] = None

    @classmethod
    def get_handler(cls) -> Optional["StreamableLogHandler"]:
        return cls._instance

    @classmethod
    def set_handler(cls, handler: Optional["StreamableLogHandler"]) -> None:
        if cls._instance and cls._instance is not handler:
            # Detach before close so in-flight emits don't route at a closed handler.
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
    if not enable_streaming or not pipeline_fqn or not run_id:
        logger.debug(
            "Streamable logging not configured: enable=%s, pipeline_fqn=%s, run_id=%s",
            enable_streaming,
            pipeline_fqn,
            run_id,
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

        logger.info(
            "Streamable logging configured for pipeline: %s, run_id: %s",
            pipeline_fqn,
            model_str(run_id),
        )
        return handler  # noqa: TRY300

    except Exception as e:
        logger.warning("Failed to setup streamable logging: %s", e)
        return None


def cleanup_streamable_logging():
    StreamableLogHandlerManager.cleanup()
