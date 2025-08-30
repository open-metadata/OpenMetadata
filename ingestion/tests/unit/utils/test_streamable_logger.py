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
Unit tests for the streamable logger module.
"""

import gzip
import logging
import os
import time
import unittest
from base64 import b64decode
from unittest.mock import Mock, patch
from uuid import uuid4

from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.streamable_logger import (
    CircuitBreaker,
    CircuitState,
    StreamableLogHandler,
    cleanup_streamable_logging,
    setup_streamable_logging_for_workflow,
)


class TestCircuitBreaker(unittest.TestCase):
    """Test the circuit breaker implementation"""

    def setUp(self):
        self.breaker = CircuitBreaker(
            failure_threshold=3, recovery_timeout=1, success_threshold=2
        )

    def test_initial_state_is_closed(self):
        """Test that circuit breaker starts in CLOSED state"""
        self.assertEqual(self.breaker.state, CircuitState.CLOSED)
        self.assertEqual(self.breaker.failure_count, 0)

    def test_opens_after_threshold_failures(self):
        """Test that circuit opens after reaching failure threshold"""

        def failing_func():
            raise Exception("Test failure")

        for i in range(3):
            with self.assertRaises(Exception):
                self.breaker.call(failing_func)

        self.assertEqual(self.breaker.state, CircuitState.OPEN)
        self.assertEqual(self.breaker.failure_count, 3)

    def test_blocks_calls_when_open(self):
        """Test that calls are blocked when circuit is open"""
        # Open the circuit
        self.breaker.state = CircuitState.OPEN
        self.breaker.last_failure_time = time.time()

        with self.assertRaises(Exception) as ctx:
            self.breaker.call(lambda: "success")

        self.assertIn("Circuit breaker is OPEN", str(ctx.exception))

    def test_transitions_to_half_open_after_timeout(self):
        """Test transition to HALF_OPEN state after recovery timeout"""
        # Open the circuit
        self.breaker.state = CircuitState.OPEN
        self.breaker.last_failure_time = time.time() - 2  # 2 seconds ago

        # Should transition to HALF_OPEN
        def success_func():
            return "success"

        result = self.breaker.call(success_func)
        self.assertEqual(result, "success")
        self.assertEqual(self.breaker.state, CircuitState.HALF_OPEN)

    def test_closes_after_success_threshold_in_half_open(self):
        """Test that circuit closes after success threshold in HALF_OPEN"""
        self.breaker.state = CircuitState.HALF_OPEN

        def success_func():
            return "success"

        # First success
        self.breaker.call(success_func)
        self.assertEqual(self.breaker.state, CircuitState.HALF_OPEN)

        # Second success - should close
        self.breaker.call(success_func)
        self.assertEqual(self.breaker.state, CircuitState.CLOSED)

    def test_reopens_on_failure_in_half_open(self):
        """Test that circuit reopens on failure in HALF_OPEN state"""
        self.breaker.state = CircuitState.HALF_OPEN

        def failing_func():
            raise Exception("Test failure")

        with self.assertRaises(Exception):
            self.breaker.call(failing_func)

        self.assertEqual(self.breaker.state, CircuitState.OPEN)


class TestStreamableLogHandler(unittest.TestCase):
    """Test the StreamableLogHandler class"""

    def setUp(self):
        """Set up test fixtures"""
        self.mock_metadata = Mock(spec=OpenMetadata)
        self.mock_metadata.config = Mock()
        self.mock_metadata.config.host_port = "http://localhost:8585"
        self.mock_metadata.config.auth_token = "test-token"

        self.pipeline_fqn = "test.pipeline"
        self.run_id = uuid4()

    def tearDown(self):
        """Clean up after tests"""
        # Ensure any handlers are properly closed
        if hasattr(self, "handler") and self.handler:
            self.handler.close()

    def test_handler_initialization(self):
        """Test handler initialization"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,  # Disable for unit test
        )

        self.assertEqual(handler.pipeline_fqn, self.pipeline_fqn)
        self.assertEqual(handler.run_id, self.run_id)
        self.assertEqual(handler.batch_size, 100)
        self.assertEqual(handler.flush_interval, 5.0)
        self.assertFalse(handler.enable_streaming)
        self.assertIsNone(handler.worker_thread)

        handler.close()

    def test_fallback_when_streaming_disabled(self):
        """Test that logs fallback to local when streaming is disabled"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Mock the fallback handler
        handler.fallback_handler = Mock()

        # Create a log record
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None,
        )

        handler.emit(record)

        # Should have called fallback handler
        handler.fallback_handler.emit.assert_called_once_with(record)

        handler.close()

    @patch("metadata.utils.streamable_logger.requests.Session")
    def test_log_compression(self, mock_session_class):
        """Test log compression for large payloads"""
        mock_session = Mock()
        mock_session_class.return_value = mock_session
        mock_response = Mock()
        mock_response.status_code = 200
        mock_session.post.return_value = mock_response

        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,  # We'll test _send_logs_to_server directly
        )

        # Large log content (> 1KB)
        large_log = "x" * 2000

        with patch.dict(os.environ, {"ENABLE_LOG_COMPRESSION": "true"}):
            handler._send_logs_to_server(large_log)

        # Check that compressed payload was sent
        mock_session.post.assert_called_once()
        call_args = mock_session.post.call_args
        payload = call_args[1]["json"]

        self.assertTrue(payload["compressed"])
        self.assertIn("logs", payload)
        self.assertIn("timestamp", payload)
        self.assertIn("connectorId", payload)

        # Verify compression worked
        decoded = b64decode(payload["logs"])
        decompressed = gzip.decompress(decoded).decode("utf-8")
        self.assertEqual(decompressed, large_log)

        handler.close()

    @patch("metadata.utils.streamable_logger.requests.Session")
    def test_no_compression_for_small_logs(self, mock_session_class):
        """Test that small logs are not compressed"""
        mock_session = Mock()
        mock_session_class.return_value = mock_session
        mock_response = Mock()
        mock_response.status_code = 200
        mock_session.post.return_value = mock_response

        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Small log content (< 1KB)
        small_log = "Small log message"

        with patch.dict(os.environ, {"ENABLE_LOG_COMPRESSION": "true"}):
            handler._send_logs_to_server(small_log)

        # Check that uncompressed payload was sent
        mock_session.post.assert_called_once()
        call_args = mock_session.post.call_args
        payload = call_args[1]["json"]

        self.assertFalse(payload["compressed"])
        self.assertEqual(payload["logs"], small_log)

        handler.close()

    @patch("metadata.utils.streamable_logger.requests.Session")
    def test_session_maintains_cookies(self, mock_session_class):
        """Test that session maintains cookies for ALB stickiness"""
        mock_session = Mock()
        mock_session_class.return_value = mock_session
        mock_response = Mock()
        mock_response.status_code = 200
        mock_session.post.return_value = mock_response

        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Send multiple log batches
        handler._send_logs_to_server("Log batch 1")
        handler._send_logs_to_server("Log batch 2")

        # Same session should be used for both calls
        self.assertEqual(mock_session.post.call_count, 2)

        handler.close()

    def test_circuit_breaker_on_failures(self):
        """Test circuit breaker behavior on repeated failures"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Mock _send_logs_to_server to always fail
        handler._send_logs_to_server = Mock(side_effect=Exception("Network error"))

        logs = ["log1", "log2", "log3"]

        # First few failures should attempt to send
        for _ in range(5):
            handler._ship_logs(logs)

        # Circuit should be open now
        self.assertEqual(handler.circuit_breaker.state, CircuitState.OPEN)

        handler.close()

    def test_queue_overflow_fallback(self):
        """Test fallback behavior when queue is full"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            max_queue_size=1,
            enable_streaming=True,
        )

        # Fill the queue
        handler.log_queue.put("existing_log")

        # Mock the fallback handler
        handler.fallback_handler = Mock()

        # Try to emit when queue is full
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Overflow message",
            args=(),
            exc_info=None,
        )

        handler.emit(record)

        # Should have called fallback handler
        handler.fallback_handler.emit.assert_called_once_with(record)

        handler.close()

    @patch("metadata.utils.streamable_logger.threading.Thread")
    def test_worker_thread_lifecycle(self, mock_thread_class):
        """Test worker thread start and stop"""
        mock_thread = Mock()
        mock_thread.is_alive.return_value = False
        mock_thread_class.return_value = mock_thread

        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=True,
        )

        # Worker thread should be started
        mock_thread.start.assert_called_once()

        # Close handler
        handler.close()

        # Stop event should be set
        self.assertTrue(handler.stop_event.is_set())

    def test_auth_header_included(self):
        """Test that auth header is included when available"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        with patch.object(handler.session, "post") as mock_post:
            mock_response = Mock()
            mock_response.status_code = 200
            mock_post.return_value = mock_response

            handler._send_logs_to_server("Test log")

            # Check auth header was included
            call_args = mock_post.call_args
            headers = call_args[1]["headers"]
            self.assertEqual(headers["Authorization"], "Bearer test-token")

        handler.close()


class TestStreamableLoggingSetup(unittest.TestCase):
    """Test the setup and cleanup functions"""

    @patch.dict(os.environ, {"ENABLE_STREAMABLE_LOGS": "true"})
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_setup_with_valid_config(self, mock_handler_class):
        """Test setup with valid configuration"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler = Mock()
        mock_handler_class.return_value = mock_handler

        pipeline_fqn = "test.pipeline"
        run_id = uuid4()

        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn=pipeline_fqn, run_id=run_id
        )

        self.assertIsNotNone(result)
        mock_handler_class.assert_called_once_with(
            metadata=mock_metadata,
            pipeline_fqn=pipeline_fqn,
            run_id=run_id,
            enable_streaming=True,
        )

        # Cleanup
        cleanup_streamable_logging()

    @patch.dict(os.environ, {"ENABLE_STREAMABLE_LOGS": "false"})
    def test_setup_disabled_by_env_var(self):
        """Test that setup returns None when disabled by env var"""
        mock_metadata = Mock(spec=OpenMetadata)

        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn="test.pipeline", run_id=uuid4()
        )

        self.assertIsNone(result)

    def test_setup_missing_parameters(self):
        """Test that setup returns None when parameters are missing"""
        mock_metadata = Mock(spec=OpenMetadata)

        # Missing pipeline_fqn
        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn=None, run_id=uuid4()
        )
        self.assertIsNone(result)

        # Missing run_id
        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn="test.pipeline", run_id=None
        )
        self.assertIsNone(result)

    @patch.dict(os.environ, {"ENABLE_STREAMABLE_LOGS": "true"})
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_cleanup_removes_handler(self, mock_handler_class):
        """Test that cleanup properly removes the handler"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler = Mock()
        mock_handler_class.return_value = mock_handler

        # Setup
        handler = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn="test.pipeline", run_id=uuid4()
        )

        # Cleanup
        with patch("logging.getLogger") as mock_get_logger:
            mock_logger = Mock()
            mock_get_logger.return_value = mock_logger

            cleanup_streamable_logging()

            mock_logger.removeHandler.assert_called_once_with(mock_handler)
            mock_handler.close.assert_called_once()

    @patch.dict(os.environ, {"ENABLE_STREAMABLE_LOGS": "true"})
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_setup_replaces_existing_handler(self, mock_handler_class):
        """Test that setup properly replaces existing handler"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler1 = Mock()
        mock_handler2 = Mock()
        mock_handler_class.side_effect = [mock_handler1, mock_handler2]

        # First setup
        handler1 = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn="test.pipeline1", run_id=uuid4()
        )

        # Second setup should close first handler
        handler2 = setup_streamable_logging_for_workflow(
            metadata=mock_metadata, pipeline_fqn="test.pipeline2", run_id=uuid4()
        )

        mock_handler1.close.assert_called_once()

        # Cleanup
        cleanup_streamable_logging()


if __name__ == "__main__":
    unittest.main()
