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
to the server without impacting application traffic.
"""

import gzip
import logging
import os
import queue
import socket
import threading
import time
from enum import Enum
from typing import Any, Dict, Optional
from uuid import UUID

import requests
from requests.adapters import HTTPAdapter, Retry

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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
                    raise Exception("Circuit breaker is OPEN")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise e

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


class StreamableLogHandler(logging.Handler):
    """
    Custom logging handler that streams logs to OpenMetadata server.

    Features:
    - Async log shipping with buffering
    - Circuit breaker for failure handling
    - Automatic fallback to local logging
    - Configurable batch size and flush intervals
    """

    def __init__(
        self,
        metadata: OpenMetadata,
        pipeline_fqn: str,
        run_id: UUID,
        batch_size: int = 100,
        flush_interval: float = 5.0,
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
            flush_interval: Time in seconds between automatic flushes
            max_queue_size: Maximum size of the log queue
            enable_streaming: Whether to enable log streaming (can be disabled for testing)
        """
        super().__init__()

        self.metadata = metadata
        self.pipeline_fqn = pipeline_fqn
        self.run_id = run_id
        self.batch_size = batch_size
        self.flush_interval = flush_interval
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

        # HTTP session with retries
        self.session = self._create_session()

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
            self._start_worker()

    def _create_session(self) -> requests.Session:
        """Create HTTP session with retry configuration and cookie persistence"""
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=2,  # Exponential backoff: 2, 4, 8 seconds
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST", "GET"],  # Allow retries on POST
        )
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=10,  # Connection pooling
            pool_maxsize=10,
        )
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        # Session will maintain cookies for ALB stickiness
        return session

    def _start_worker(self):
        """Start the background worker thread for log shipping"""
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self.worker_thread = threading.Thread(
                target=self._worker_loop,
                name=f"log-shipper-{self.pipeline_fqn}",
                daemon=True,
            )
            self.worker_thread.start()

    def _worker_loop(self):
        """Background worker that ships logs to the server"""
        buffer = []
        last_flush = time.time()

        while not self.stop_event.is_set():
            try:
                # Try to get log entry with timeout
                timeout = min(1.0, self.flush_interval)
                try:
                    log_entry = self.log_queue.get(timeout=timeout)
                    buffer.append(log_entry)
                except queue.Empty:
                    pass

                # Check if we should flush
                should_flush = (
                    len(buffer) >= self.batch_size
                    or (time.time() - last_flush) >= self.flush_interval
                )

                if should_flush and buffer:
                    self._ship_logs(buffer)
                    buffer = []
                    last_flush = time.time()

            except Exception as e:
                logger.error(f"Error in log shipping worker: {e}")
                # Continue processing to avoid blocking

        # Final flush on shutdown
        if buffer:
            self._ship_logs(buffer)

    def _get_pipeline_id_from_fqn(self, pipeline_fqn: str) -> str:
        """Get pipeline ID from FQN by querying the API"""
        try:
            # Try to get pipeline by FQN
            pipeline = self.metadata.get_by_name(
                entity=IngestionPipeline, fqn=pipeline_fqn
            )
            if pipeline:
                return str(pipeline.id.root)
        except Exception as e:
            logger.error(f"Failed to get pipeline ID for FQN {pipeline_fqn}: {e}")

        # Fallback: use FQN as ID (might not work but better than nothing)
        return pipeline_fqn

    def _ship_logs(self, logs: list):
        """Ship logs to the server with circuit breaker protection"""
        if not logs:
            return

        log_content = "\n".join(logs)

        try:
            # Try to send logs with circuit breaker
            self.circuit_breaker.call(self._send_logs_to_server, log_content)
        except Exception as e:
            # Update metrics
            self.metrics["logs_failed"] += len(logs)
            if self.circuit_breaker.state == CircuitState.OPEN:
                self.metrics["circuit_trips"] += 1
            self.metrics["fallback_count"] += 1

            # Fallback to local logging
            logger.debug(
                f"Failed to ship logs to server (circuit breaker state: {self.circuit_breaker.state}): {e}"
            )
            for log in logs:
                print(f"[FALLBACK] {log}")

    def _send_logs_to_server(self, log_content: str):
        """Send logs to the OpenMetadata server with optional compression"""
        try:
            # Build the API endpoint - use pipeline ID not FQN in URL
            # The endpoint expects: /api/v1/services/ingestionPipelines/{pipelineId}/logs/{runId}/stream
            # We need to get the pipeline ID from the FQN
            pipeline_id = self._get_pipeline_id_from_fqn(self.pipeline_fqn)
            url = f"{self.metadata.config.host_port}/api/v1/services/ingestionPipelines/{pipeline_id}/logs/{self.run_id}/stream"

            # The streaming endpoint expects plain text, not JSON
            # Add metadata as header if needed
            headers = {
                "Content-Type": "text/plain",
                "X-Connector-Id": f"{socket.gethostname()}-{os.getpid()}",
                "X-Line-Count": str(log_content.count("\n")),
            }

            # Optional: compress for large payloads
            enable_compression = (
                os.getenv("ENABLE_LOG_COMPRESSION", "false").lower() == "true"
            )

            if enable_compression and len(log_content) > 10240:  # Compress if > 10KB
                # Compress with gzip
                compressed = gzip.compress(log_content.encode("utf-8"))
                headers["Content-Encoding"] = "gzip"
                data = compressed
            else:
                data = log_content.encode("utf-8")

            # Add auth header if available
            auth_header = self.metadata._auth_header()
            if auth_header:
                headers.update(auth_header)

            # Send logs - session maintains cookies for ALB stickiness
            response = self.session.post(url, data=data, headers=headers, timeout=10)
            response.raise_for_status()

            # Update metrics
            self.metrics["logs_sent"] += log_content.count("\n")
            self.metrics["bytes_sent"] += len(data)

            # Log successful shipment for debugging
            logger.debug(
                f"Successfully shipped {log_content.count(chr(10))} log lines to server"
            )

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send logs to server: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending logs: {e}")
            raise

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

            # Signal worker to stop
            self.stop_event.set()

            # Wait for worker to finish (with timeout)
            if self.worker_thread.is_alive():
                self.worker_thread.join(timeout=5.0)

            # Close the session
            self.session.close()

        # Close fallback handler
        self.fallback_handler.close()

        super().close()


# Global handler instance for cleanup
_streamable_handler: Optional[StreamableLogHandler] = None


def setup_streamable_logging_for_workflow(
    metadata: OpenMetadata,
    pipeline_fqn: Optional[str] = None,
    run_id: Optional[UUID] = None,
    log_level: int = logging.INFO,
) -> Optional[StreamableLogHandler]:
    """
    Setup streamable logging for a workflow execution.
    This is automatically called when a workflow starts if:
    1. The server has log storage configured
    2. The pipeline FQN and run ID are available
    3. ENABLE_STREAMABLE_LOGS environment variable is set to 'true' (optional)

    Args:
        metadata: OpenMetadata client instance
        pipeline_fqn: Fully qualified name of the pipeline
        run_id: Unique run identifier
        log_level: Logging level

    Returns:
        StreamableLogHandler instance if configured, None otherwise
    """
    global _streamable_handler

    # Check if streamable logging should be enabled
    enable_streaming = os.getenv("ENABLE_STREAMABLE_LOGS", "false").lower() == "true"

    # Also check if we have the required parameters
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
        if _streamable_handler:
            _streamable_handler.close()

        # Create and configure the handler
        _streamable_handler = StreamableLogHandler(
            metadata=metadata,
            pipeline_fqn=pipeline_fqn,
            run_id=run_id,
            enable_streaming=True,
        )

        # Set formatter
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)-8s {%(name)s:%(module)s:%(lineno)d} - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        _streamable_handler.setFormatter(formatter)
        _streamable_handler.setLevel(log_level)

        # Add handler to the metadata logger (parent of all ingestion loggers)
        metadata_logger = logging.getLogger("metadata")
        metadata_logger.addHandler(_streamable_handler)

        logger.info(
            f"Streamable logging configured for pipeline: {pipeline_fqn}, run_id: {run_id}"
        )

        return _streamable_handler

    except Exception as e:
        logger.warning(f"Failed to setup streamable logging: {e}")
        return None


def cleanup_streamable_logging():
    """
    Cleanup streamable logging handler.
    This should be called when the workflow completes.
    """
    global _streamable_handler

    if _streamable_handler:
        try:
            # Remove from logger
            metadata_logger = logging.getLogger("metadata")
            metadata_logger.removeHandler(_streamable_handler)

            # Close the handler
            _streamable_handler.close()

            logger.debug("Streamable logging handler cleaned up")
        except Exception as e:
            logger.warning(f"Error cleaning up streamable logging: {e}")
        finally:
            _streamable_handler = None
