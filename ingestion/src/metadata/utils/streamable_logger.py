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

# Recursion guard: sender threads set shipping=True so emit() returns
# immediately if it ever fires from inside the shipping path.
_shipping_state = threading.local()
_CLOSE_MARKER = object()


class StreamableLogHandler(logging.Handler):
    """Fire-and-forget log shipper."""

    BATCH_SIZE = 500
    BATCH_WAIT_SEC = 2.0
    SENDER_TICK_SEC = 1.0
    HTTP_TIMEOUT = (1.0, 2.0)
    SENDER_WORKERS = 1
    MAX_PENDING_BATCHES = 4
    CLOSE_TIMEOUT_SEC = 2.0

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

        self.fallback_handler = logging.StreamHandler()

        self._buffer: Queue = Queue(maxsize=max_buffer)
        self._send_queue: Queue = Queue(maxsize=self.MAX_PENDING_BATCHES)
        self._stop = threading.Event()
        self._closed = False
        self._drainer: Optional[threading.Thread] = None  # noqa: UP045
        self._senders: list = []

        # Isolated session/connection pool; shares ClientConfig so token
        # refresh on the main client is visible here.
        self._client: Optional[REST] = (  # noqa: UP045
            REST(metadata.client.config) if enable_streaming else None
        )

        self.dropped_overflow = 0
        self.dropped_saturated = 0
        self.dropped_shipping = 0

        if self.enable_streaming:
            self._start_workers()

    def _start_workers(self):
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
        # Recursion guard must be the very first check.
        if getattr(_shipping_state, "shipping", False):
            self.dropped_shipping += 1
            return
        if self._closed:
            self.dropped_overflow += 1
            return
        try:
            if not self.enable_streaming:
                self.fallback_handler.emit(record)
                return
            log_entry = self.format(record)
            try:
                self._buffer.put_nowait(log_entry)
            except Full:
                self.dropped_overflow += 1
        except Exception:
            self.dropped_overflow += 1

    def _drain_loop(self):
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
        if self._closed:
            return
        self._closed = True

        if self.enable_streaming:
            self._drain_remaining_buffer()
            with contextlib.suppress(Full):
                self._send_queue.put_nowait(_CLOSE_MARKER)

        # Set _stop AFTER enqueueing — sender's get(timeout) Empty branch
        # checks _stop, so setting it first can race the enqueue and drop
        # the CLOSE_MARKER on a quiet send queue.
        self._stop.set()

        with contextlib.suppress(Exception):
            self.fallback_handler.close()
        super().close()

    def _drain_remaining_buffer(self):
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
    StreamableLogHandlerManager.cleanup()
