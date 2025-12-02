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
Streamable log handler for shipping logs to OpenMetadata server.

This module provides a pluggable logger that can stream ingestion logs
to the server's S3 storage backend without impacting application traffic.

Configuration:
-------------
The streamable logger is automatically enabled when:
1. The IngestionPipeline entity has `enableStreamableLogs` set to true
2. The ingestion pipeline FQN and run ID are available
3. The OpenMetadata server has log storage configured (S3 or compatible)

Environment Variables (Optional):
--------------------------------
- ENABLE_LOG_COMPRESSION: Set to "true" to compress logs before sending (default: "false")

Features:
--------
- Asynchronous log shipping with buffering
- Automatic compression for large payloads (>10KB when enabled)
- Circuit breaker pattern for failure handling
- Fallback to local logging when remote logging fails
- Session cookie persistence for ALB sticky sessions
- Configurable batch size and flush intervals

Usage:
------
The streamable logger is automatically configured in the BaseWorkflow class
when a workflow starts. No manual setup is required if the environment is
properly configured.

For manual setup (testing):
```python
from metadata.utils.streamable_logger import setup_streamable_logging_for_workflow

handler = setup_streamable_logging_for_workflow(
    metadata=metadata_client,
    pipeline_fqn="service.pipeline_name",
    run_id=UUID("..."),
    log_level=logging.INFO
)
```
"""

import logging
import os
import queue
import threading
import time
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.logger import BASE_LOGGING_FORMAT, METADATA_LOGGER, ingestion_logger

logger = ingestion_logger()


class CircuitBreakerError(Exception):
    """Base exception for circuit breaker errors"""


class CircuitOpenError(CircuitBreakerError):
    """Raised when circuit breaker is in OPEN state"""


class ServiceCallError(Exception):
    """Raised when the underlying service call fails"""


class CircuitState(Enum):
    """Circuit breaker states"""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failures detected, requests blocked
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreaker:
    """
    Circuit breaker pattern implementation to prevent cascading failures.
    Fallback to local logging when remote logging fails.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        self._lock = threading.Lock()

    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                else:
                    raise CircuitOpenError("Circuit breaker is OPEN")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except (CircuitBreakerError, ServiceCallError):
            raise
        except Exception as e:
            self._on_failure()
            raise ServiceCallError(f"Service call failed: {str(e)}") from e

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        return (
            self.last_failure_time
            and time.time() - self.last_failure_time >= self.recovery_timeout
        )

    def _on_success(self):
        """Handle successful call"""
        with self._lock:
            self.failure_count = 0
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.success_threshold:
                    self.state = CircuitState.CLOSED

    def _on_failure(self):
        """Handle failed call"""
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.failure_count >= self.failure_threshold:
                self.state = CircuitState.OPEN
            elif self.state == CircuitState.HALF_OPEN:
                self.state = CircuitState.OPEN


# pylint: disable=too-many-instance-attributes
class StreamableLogHandler(logging.Handler):
    """
    Custom logging handler that streams logs to OpenMetadata server.

    Features:
    - Async log shipping with buffering
    - Circuit breaker for failure handling
    - Automatic fallback to local logging
    - Configurable batch size and flush intervals
    """

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        metadata: OpenMetadata,
        pipeline_fqn: str,
        run_id: UUID,
        batch_size: int = 500,
        flush_interval_sec: float = 10.0,
        max_queue_size: int = 10000,
        enable_streaming: bool = True,
    ):
        """
        Initialize the streamable log handler.

        Args:
            metadata: OpenMetadata client instance
            pipeline_fqn: Fully qualified name of the pipeline
            run_id: Unique run identifier
            batch_size: Number of log entries to batch before sending
            flush_interval_sec: Time in seconds between automatic flushes
            max_queue_size: Maximum size of the log queue
            enable_streaming: Whether to enable log streaming (can be disabled for testing)
        """
        super().__init__()

        self.metadata = metadata
        self.pipeline_fqn = pipeline_fqn
        self.run_id = run_id
        self.batch_size = batch_size
        self.flush_interval_sec = flush_interval_sec
        self.enable_streaming = enable_streaming

        # Local fallback handler
        self.fallback_handler = logging.StreamHandler()
        self.fallback_handler.setFormatter(self.formatter)

        # Circuit breaker for failure handling
        self.circuit_breaker = CircuitBreaker()

        # Log queue and worker thread
        self.log_queue = queue.Queue(maxsize=max_queue_size)
        self.stop_event = threading.Event()
        self.worker_thread = None

        # Session ID for log streaming (if server supports it)
        self.session_id = None

        # Metrics tracking
        self.metrics = {
            "logs_sent": 0,
            "logs_failed": 0,
            "bytes_sent": 0,
            "circuit_trips": 0,
            "fallback_count": 0,
        }

        # Start worker thread if streaming is enabled
        if self.enable_streaming:
            self._initialize_log_stream()
            self._start_worker()

    def _initialize_log_stream(self):
        """Initialize log stream with the server"""
        if hasattr(self.metadata, "create_log_stream"):
            self.session_id = self.metadata.create_log_stream(
                self.pipeline_fqn, self.run_id
            )

    def _start_worker(self):
        """Start the background worker thread for log shipping"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.worker_thread = threading.Thread(
                target=self._worker_loop,
                name=f"log-shipper-{self.pipeline_fqn}",
                daemon=True,
            )
            self.worker_thread.start()

    def _drain_queue_to_buffer(self, buffer: list) -> tuple[list, bool]:
        """
        Drain all available items from the queue into the buffer.

        Args:
            buffer: Current buffer to append items to

        Returns:
            Updated buffer and whether a flush marker was encountered
        """
        timeout = min(1.0, self.flush_interval_sec)
        flush_requested = False

        # Get items from queue until empty
        while True:
            try:
                # Use timeout for first call, then get_nowait for remaining
                log_entry = (
                    self.log_queue.get(timeout=timeout)
                    if timeout
                    else self.log_queue.get_nowait()
                )

                if log_entry is None:
                    # Flush marker encountered
                    flush_requested = True
                else:
                    buffer.append(log_entry)

                # After first successful get, switch to no timeout for draining
                timeout = None

            except queue.Empty:
                break

        return buffer, flush_requested

    def _worker_loop(self):
        """Background worker that ships logs to the server"""
        buffer = []
        last_flush = time.time()

        while not self.stop_event.is_set():
            try:
                # Drain all available items from queue
                buffer, flush_requested = self._drain_queue_to_buffer(buffer)

                # Check if we should flush
                should_flush = (
                    flush_requested
                    or len(buffer) >= self.batch_size
                    or (time.time() - last_flush) >= self.flush_interval_sec
                )

                if should_flush and buffer:
                    self._ship_logs(buffer)
                    buffer = []
                    last_flush = time.time()

                # Let's not flush too often
                time.sleep(1.0)

            except Exception as e:
                logger.error(f"Error in log shipping worker: {e}")
                # Continue processing to avoid blocking

        # Final cleanup - drain ALL remaining items from the queue
        buffer, _ = self._drain_queue_to_buffer(buffer)

        # Send any final buffered logs
        if buffer:
            self._ship_logs(buffer)

    def _ship_logs(self, logs: list):
        """Ship logs to the server with circuit breaker protection"""
        if not logs:
            return

        log_content = "\n".join(logs) + "\n"  # Ensure newline at end

        try:
            # Try to send logs with circuit breaker
            self.circuit_breaker.call(self._send_logs_to_server, log_content)
        except CircuitOpenError:
            # Circuit is open, update metrics
            self.metrics["logs_failed"] += len(logs)
            self.metrics["circuit_trips"] += 1
            self.metrics["fallback_count"] += 1

            logger.debug("Circuit breaker is OPEN, falling back to local logging")
            for log in logs:
                logger.info(f"[FALLBACK] {log}")
        except (ServiceCallError, Exception) as e:
            # Service call failed, update metrics
            self.metrics["logs_failed"] += len(logs)
            self.metrics["fallback_count"] += 1

            # Fallback to local logging
            logger.debug(f"Failed to ship logs to server: {e}")
            for log in logs:
                logger.info(f"[FALLBACK] {log}")

    def _send_logs_to_server(self, log_content: str):
        """Send logs to the OpenMetadata server using the logs mixin"""
        enable_compression = (
            os.getenv("ENABLE_LOG_COMPRESSION", "false").lower() == "true"
        )
        # Use the centralized logs mixin method which handles both new and legacy approaches
        metrics = self.metadata.send_logs_batch(
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            log_content=log_content,
            enable_compression=enable_compression,
        )
        # Update handler metrics with returned metrics
        self.metrics["logs_sent"] += metrics["logs_sent"]
        self.metrics["bytes_sent"] += metrics["bytes_sent"]

    def emit(self, record: logging.LogRecord):
        """
        Emit a log record.

        Puts the log entry in the queue for async shipping.
        Falls back to local logging if queue is full or streaming is disabled.
        """
        try:
            if not self.enable_streaming:
                # Direct fallback if streaming is disabled
                self.fallback_handler.emit(record)
                return

            # Format the log record
            log_entry = self.format(record)

            # Try to add to queue (non-blocking)
            try:
                self.log_queue.put_nowait(log_entry)
            except queue.Full:
                # Queue is full, fallback to local logging
                logger.warning("Log queue is full, falling back to local logging")
                self.fallback_handler.emit(record)

        except Exception as e:
            # Any error, fallback to local logging
            logger.error(f"Error in emit: {e}")
            try:
                self.fallback_handler.emit(record)
            except Exception:
                pass  # Last resort: silently drop the log

    def flush(self):
        """Flush any buffered logs"""
        # Signal worker to flush by adding a None marker
        try:
            self.log_queue.put_nowait(None)
        except queue.Full:
            pass

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics for monitoring"""
        return {
            **self.metrics,
            "circuit_state": self.circuit_breaker.state.value,
            "queue_size": self.log_queue.qsize(),
            "worker_alive": self.worker_thread.is_alive()
            if self.worker_thread
            else False,
        }

    def close(self):
        """Close the handler and cleanup resources"""
        if self.enable_streaming and self.worker_thread:
            # Log final metrics
            logger.info(f"StreamableLogHandler metrics: {self.get_metrics()}")

            # Signal worker to stop AFTER ensuring any pending flush is processed
            self.stop_event.set()

            # Wait for worker to finish (with timeout)
            if self.worker_thread.is_alive():
                self.worker_thread.join(timeout=5.0)

            # Close the log stream
            self.metadata.close_log_stream(self.pipeline_fqn, self.run_id)

        # Close fallback handler
        self.fallback_handler.close()

        super().close()


class StreamableLogHandlerManager:
    """
    Manager class to handle StreamableLogHandler instances.
    This provides better encapsulation than using global variables.

    Note: This manager assumes single-threaded setup/teardown which is
    typical for workflow initialization. The handler itself is thread-safe.
    """

    _instance: Optional["StreamableLogHandler"] = None

    @classmethod
    def get_handler(cls) -> Optional["StreamableLogHandler"]:
        """Get the current handler instance"""
        return cls._instance

    @classmethod
    def set_handler(cls, handler: Optional["StreamableLogHandler"]) -> None:
        """Set or update the handler instance, closing any existing one"""
        if cls._instance and cls._instance != handler:
            try:
                cls._instance.close()
            except Exception as e:
                logger.warning(f"Error closing previous handler: {e}")
        cls._instance = handler

    @classmethod
    def cleanup(cls) -> None:
        """Clean up the current handler, flushing any remaining logs first"""
        if cls._instance:
            try:
                # Force flush any remaining logs before cleanup
                cls._instance.flush()

                # Close will properly wait for worker thread to finish processing
                # the flush marker and any remaining buffered logs
                cls._instance.close()

                # Only remove handler from logger after worker thread has finished
                metadata_logger = logging.getLogger(METADATA_LOGGER)
                metadata_logger.removeHandler(cls._instance)

                logger.debug("Streamable logging handler cleaned up")
            except Exception as e:
                logger.warning(f"Error during handler cleanup: {e}")
            finally:
                cls._instance = None


def setup_streamable_logging_for_workflow(
    metadata: OpenMetadata,
    pipeline_fqn: Optional[str] = None,
    run_id: Optional[UUID] = None,
    log_level: int = logging.INFO,
    enable_streaming: bool = False,
) -> Optional[StreamableLogHandler]:
    """
    Setup streamable logging for a workflow execution.
    This is automatically called when a workflow starts if:
    1. The IngestionPipeline has enableStreamableLogs set to true
    2. The server has log storage configured
    3. The pipeline FQN and run ID are available

    Args:
        metadata: OpenMetadata client instance
        pipeline_fqn: Fully qualified name of the pipeline
        run_id: Unique run identifier
        log_level: Logging level
        enable_streaming: Whether to enable streaming (from IngestionPipeline config)

    Returns:
        StreamableLogHandler instance if configured, None otherwise
    """
    # Check if we have the required parameters
    if not enable_streaming or not pipeline_fqn or not run_id:
        logger.debug(
            f"Streamable logging not configured: enable={enable_streaming}, "
            f"pipeline_fqn={pipeline_fqn}, run_id={run_id}"
        )
        return None

    try:
        # Check if server supports log storage by trying to get the configuration
        # This would need to be implemented as an API endpoint
        # For now, we'll assume it's enabled if the env var is set

        # Clean up any existing handler
        existing_handler = StreamableLogHandlerManager.get_handler()
        if existing_handler:
            existing_handler.close()

        # Create and configure the handler
        handler = StreamableLogHandler(
            metadata=metadata,
            pipeline_fqn=pipeline_fqn,
            run_id=run_id,
            enable_streaming=True,
        )

        # Use the same formatter as the base configuration for consistency
        formatter = logging.Formatter(BASE_LOGGING_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")
        handler.setFormatter(formatter)
        handler.setLevel(log_level)

        # Add handler to the metadata logger (parent of all ingestion loggers)
        metadata_logger = logging.getLogger(METADATA_LOGGER)
        metadata_logger.addHandler(handler)

        # Register with the manager
        StreamableLogHandlerManager.set_handler(handler)

        logger.info(
            f"Streamable logging configured for pipeline: {pipeline_fqn}, run_id: {model_str(run_id)}"
        )

        return handler

    except Exception as e:
        logger.warning(f"Failed to setup streamable logging: {e}")
        return None


def cleanup_streamable_logging():
    """
    Cleanup streamable logging handler.
    This should be called when the workflow completes.
    """
    StreamableLogHandlerManager.cleanup()
