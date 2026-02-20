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

import logging
import os
import time
import unittest
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
        # Mock the _auth_header method
        self.mock_metadata._auth_header = Mock(
            return_value={"Authorization": "Bearer test-token"}
        )

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
        self.assertEqual(handler.batch_size, 500)
        self.assertEqual(handler.flush_interval_sec, 10.0)
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

    def test_log_compression(self):
        """Test log compression for large payloads"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,  # We'll test _send_logs_to_server directly
        )

        # Large log content (> 10KB to trigger compression)
        large_log = "x" * 11000

        # Mock send_logs_batch to capture the call
        with patch.object(self.mock_metadata, "send_logs_batch") as mock_send_logs:
            mock_send_logs.return_value = {"logs_sent": 1, "bytes_sent": len(large_log)}

            with patch.dict(os.environ, {"ENABLE_LOG_COMPRESSION": "true"}):
                handler._send_logs_to_server(large_log)

            # Verify send_logs_batch was called with compression enabled
            mock_send_logs.assert_called_once_with(
                pipeline_fqn=self.pipeline_fqn,
                run_id=self.run_id,
                log_content=large_log,
                enable_compression=True,
            )

        handler.close()

    def test_no_compression_for_small_logs(self):
        """Test that small logs are not compressed"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Small log content (< 1KB)
        small_log = "Small log message"

        # Mock send_logs_batch to capture the call
        with patch.object(self.mock_metadata, "send_logs_batch") as mock_send_logs:
            mock_send_logs.return_value = {"logs_sent": 1, "bytes_sent": len(small_log)}

            with patch.dict(os.environ, {"ENABLE_LOG_COMPRESSION": "true"}):
                handler._send_logs_to_server(small_log)

            # Verify send_logs_batch was called with compression enabled
            # Note: The actual compression decision is made inside send_logs_batch
            mock_send_logs.assert_called_once_with(
                pipeline_fqn=self.pipeline_fqn,
                run_id=self.run_id,
                log_content=small_log,
                enable_compression=True,
            )

        handler.close()

    def test_session_maintains_cookies(self):
        """Test that session maintains cookies for ALB stickiness"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Mock send_logs_batch to capture the calls
        with patch.object(self.mock_metadata, "send_logs_batch") as mock_send_logs:
            mock_send_logs.return_value = {"logs_sent": 1, "bytes_sent": 100}

            # Send multiple log batches
            handler._send_logs_to_server("Log batch 1")
            handler._send_logs_to_server("Log batch 2")

            # Two requests should be made with the same metadata instance
            self.assertEqual(mock_send_logs.call_count, 2)
            # Verify both calls used the same metadata instance
            calls = mock_send_logs.call_args_list
            for call in calls:
                self.assertEqual(call.kwargs["pipeline_fqn"], self.pipeline_fqn)
                self.assertEqual(call.kwargs["run_id"], self.run_id)

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

        # Mock the send_logs_batch method to verify it's called with correct parameters
        with patch.object(self.mock_metadata, "send_logs_batch") as mock_send_logs:
            mock_send_logs.return_value = {"logs_sent": 1, "bytes_sent": 100}

            handler._send_logs_to_server("Test log")

            # Verify send_logs_batch was called with the correct parameters
            mock_send_logs.assert_called_once_with(
                pipeline_fqn=self.pipeline_fqn,
                run_id=self.run_id,
                log_content="Test log",
                enable_compression=False,
            )

        handler.close()

    def test_drain_queue_to_buffer_empty_queue(self):
        """Test _drain_queue_to_buffer with empty queue"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        buffer = []
        result_buffer, flush_requested = handler._drain_queue_to_buffer(buffer)

        # Buffer should be unchanged and no flush requested
        self.assertEqual(result_buffer, [])
        self.assertFalse(flush_requested)

        handler.close()

    def test_drain_queue_to_buffer_with_logs(self):
        """Test _drain_queue_to_buffer with regular log entries"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Add some log entries to queue
        handler.log_queue.put("log entry 1")
        handler.log_queue.put("log entry 2")
        handler.log_queue.put("log entry 3")

        buffer = ["existing log"]
        result_buffer, flush_requested = handler._drain_queue_to_buffer(buffer)

        # Buffer should contain all logs
        expected_buffer = ["existing log", "log entry 1", "log entry 2", "log entry 3"]
        self.assertEqual(result_buffer, expected_buffer)
        self.assertFalse(flush_requested)

        handler.close()

    def test_drain_queue_to_buffer_with_flush_marker(self):
        """Test _drain_queue_to_buffer handles flush markers correctly"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Add log entries and a flush marker
        handler.log_queue.put("log entry 1")
        handler.log_queue.put(None)  # Flush marker
        handler.log_queue.put("log entry 2")

        buffer = []
        result_buffer, flush_requested = handler._drain_queue_to_buffer(buffer)

        # Buffer should contain only log entries, not the flush marker
        expected_buffer = ["log entry 1", "log entry 2"]
        self.assertEqual(result_buffer, expected_buffer)
        self.assertTrue(flush_requested)

        handler.close()

    def test_drain_queue_to_buffer_multiple_flush_markers(self):
        """Test _drain_queue_to_buffer with multiple flush markers"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
        )

        # Add multiple flush markers
        handler.log_queue.put("log entry 1")
        handler.log_queue.put(None)  # First flush marker
        handler.log_queue.put("log entry 2")
        handler.log_queue.put(None)  # Second flush marker
        handler.log_queue.put("log entry 3")

        buffer = []
        result_buffer, flush_requested = handler._drain_queue_to_buffer(buffer)

        # Buffer should contain all log entries
        expected_buffer = ["log entry 1", "log entry 2", "log entry 3"]
        self.assertEqual(result_buffer, expected_buffer)
        self.assertTrue(flush_requested)

        handler.close()

    @patch("time.time")
    def test_worker_loop_flush_logic(self, mock_time):
        """Test worker loop flush decision logic"""
        # Set up consistent time for testing
        mock_time.return_value = 1000.0

        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
            batch_size=3,
            flush_interval_sec=5.0,
        )

        # Mock the shipping method
        handler._ship_logs = Mock()

        # Test flush due to batch size
        handler.log_queue.put("log1")
        handler.log_queue.put("log2")
        handler.log_queue.put("log3")

        # Simulate one iteration of worker loop logic
        buffer = []
        last_flush = mock_time.return_value

        buffer, flush_requested = handler._drain_queue_to_buffer(buffer)
        should_flush = (
            flush_requested
            or len(buffer) >= handler.batch_size
            or (mock_time.return_value - last_flush) >= handler.flush_interval_sec
        )

        self.assertTrue(should_flush)  # Should flush due to batch size
        self.assertEqual(len(buffer), 3)

        handler.close()

    @patch("time.time")
    def test_worker_loop_time_based_flush(self, mock_time):
        """Test worker loop time-based flush logic"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
            batch_size=10,
            flush_interval_sec=5.0,
        )

        # Add one log (below batch size)
        handler.log_queue.put("single log")

        # Set up time progression: first call returns 1000.0, subsequent calls return 1006.0
        mock_time.side_effect = [
            1000.0,
            1006.0,
            1006.0,
        ]  # Allow for multiple time() calls

        # Simulate worker loop logic with time progression
        buffer = []
        last_flush = 1000.0  # Initial time

        buffer, flush_requested = handler._drain_queue_to_buffer(buffer)
        current_time = 1006.0  # Time after drainage

        should_flush = (
            flush_requested
            or len(buffer) >= handler.batch_size
            or (current_time - last_flush) >= handler.flush_interval_sec
        )

        self.assertTrue(should_flush)  # Should flush due to time interval (6 > 5)
        self.assertEqual(len(buffer), 1)

        handler.close()

    def test_flush_marker_triggers_immediate_flush(self):
        """Test that flush markers trigger immediate flush regardless of batch size or time"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn=self.pipeline_fqn,
            run_id=self.run_id,
            enable_streaming=False,
            batch_size=10,  # Large batch size
            flush_interval_sec=60.0,  # Long time interval
        )

        # Add just one log and a flush marker
        handler.log_queue.put("single log")
        handler.log_queue.put(None)  # Flush marker

        buffer = []
        buffer, flush_requested = handler._drain_queue_to_buffer(buffer)

        # Should request flush despite small buffer and short time
        self.assertTrue(flush_requested)
        self.assertEqual(len(buffer), 1)

        handler.close()

    def test_worker_loop_final_drainage_on_shutdown(self):
        """Test that worker loop drains queue completely on shutdown"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=False,
        )

        # Mock _ship_logs to track what gets shipped
        shipped_logs = []

        def mock_ship_logs(logs):
            shipped_logs.extend(logs)

        handler._ship_logs = mock_ship_logs

        # Add logs to queue after stop event is set (simulating final drainage)
        handler.log_queue.put("final log 1")
        handler.log_queue.put("final log 2")
        handler.log_queue.put(None)  # Flush marker
        handler.log_queue.put("final log 3")

        # Simulate final cleanup drainage
        buffer, _ = handler._drain_queue_to_buffer([])
        if buffer:
            handler._ship_logs(buffer)

        # All logs should be shipped
        expected_logs = ["final log 1", "final log 2", "final log 3"]
        self.assertEqual(shipped_logs, expected_logs)

        handler.close()

    def test_flush_method_adds_marker_to_queue(self):
        """Test that flush method properly adds None marker to queue"""
        handler = StreamableLogHandler(
            metadata=self.mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=False,
        )

        # Flush should add None marker
        handler.flush()

        # Verify marker was added
        marker = handler.log_queue.get_nowait()
        self.assertIsNone(marker)

        handler.close()

    def test_close_waits_for_worker_thread(self):
        """Test that close method properly waits for worker thread"""
        with patch("threading.Thread") as mock_thread_class:
            mock_thread = Mock()
            mock_thread.is_alive.return_value = True
            mock_thread_class.return_value = mock_thread

            handler = StreamableLogHandler(
                metadata=self.mock_metadata,
                pipeline_fqn="test.pipeline",
                run_id=uuid4(),
                enable_streaming=True,
            )

            # Close handler
            handler.close()

            # Verify stop event was set and thread join was called
            self.assertTrue(handler.stop_event.is_set())
            mock_thread.join.assert_called_once_with(timeout=5.0)


class TestStreamableLoggingSetup(unittest.TestCase):
    """Test the setup and cleanup functions"""

    def tearDown(self):
        """Clean up any handlers that were added to loggers during tests"""
        # Clean up any handlers from the metadata logger
        import logging

        from metadata.utils.logger import METADATA_LOGGER
        from metadata.utils.streamable_logger import StreamableLogHandlerManager

        metadata_logger = logging.getLogger(METADATA_LOGGER)
        # Remove any mock handlers
        metadata_logger.handlers = [
            h for h in metadata_logger.handlers if not isinstance(h, Mock)
        ]

        # Also clean up the manager
        StreamableLogHandlerManager._instance = None

    @patch("logging.getLogger")
    @patch("metadata.utils.streamable_logger.logger")
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_setup_with_valid_config(
        self, mock_handler_class, mock_logger, mock_get_logger
    ):
        """Test setup with valid configuration"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler = Mock()
        mock_handler.level = logging.INFO  # Add level attribute
        mock_handler_class.return_value = mock_handler

        pipeline_fqn = "test.pipeline"
        run_id = uuid4()

        # Setup mock logger to prevent handler from being added to real logger
        mock_metadata_logger = Mock()
        mock_get_logger.return_value = mock_metadata_logger

        # Test with enable_streaming=True (from IngestionPipeline config)
        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn=pipeline_fqn,
            run_id=run_id,
            enable_streaming=True,  # This would come from IngestionPipeline.enableStreamableLogs
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

    def test_setup_disabled_by_config(self):
        """Test that setup returns None when disabled by config"""
        mock_metadata = Mock(spec=OpenMetadata)

        # Test with enable_streaming=False (from IngestionPipeline config)
        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=False,  # This would come from IngestionPipeline.enableStreamableLogs
        )

        self.assertIsNone(result)

    def test_setup_missing_parameters(self):
        """Test that setup returns None when parameters are missing"""
        mock_metadata = Mock(spec=OpenMetadata)

        # Missing pipeline_fqn
        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn=None,
            run_id=uuid4(),
            enable_streaming=True,
        )
        self.assertIsNone(result)

        # Missing run_id
        result = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=None,
            enable_streaming=True,
        )
        self.assertIsNone(result)

    @patch("logging.getLogger")
    @patch("metadata.utils.streamable_logger.logger")
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_cleanup_removes_handler(
        self, mock_handler_class, mock_logger, mock_get_logger
    ):
        """Test that cleanup properly removes the handler"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler = Mock()
        mock_handler.level = logging.INFO  # Add level attribute to prevent TypeError
        mock_handler_class.return_value = mock_handler

        # Setup mock logger to prevent handler from being added to real logger
        mock_metadata_logger = Mock()
        mock_get_logger.return_value = mock_metadata_logger

        # Setup
        handler = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=True,
        )

        # Cleanup
        cleanup_streamable_logging()

        mock_metadata_logger.removeHandler.assert_called_once_with(mock_handler)
        mock_handler.close.assert_called_once()

    @patch("logging.getLogger")
    @patch("metadata.utils.streamable_logger.logger")
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_setup_replaces_existing_handler(
        self, mock_handler_class, mock_logger, mock_get_logger
    ):
        """Test that setup properly replaces existing handler"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler1 = Mock()
        mock_handler1.level = logging.INFO  # Add level attribute
        mock_handler2 = Mock()
        mock_handler2.level = logging.INFO  # Add level attribute
        mock_handler_class.side_effect = [mock_handler1, mock_handler2]

        # Setup mock logger to prevent handler from being added to real logger
        mock_metadata_logger = Mock()
        mock_get_logger.return_value = mock_metadata_logger

        # First setup
        handler1 = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline1",
            run_id=uuid4(),
            enable_streaming=True,
        )

        # Second setup should close first handler
        handler2 = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline2",
            run_id=uuid4(),
            enable_streaming=True,
        )

        # The first handler should be closed when the second one is set
        mock_handler1.close.assert_called()

        # Cleanup
        cleanup_streamable_logging()

    @patch("logging.getLogger")
    @patch("metadata.utils.streamable_logger.logger")
    @patch("metadata.utils.streamable_logger.StreamableLogHandler")
    def test_cleanup_flushes_before_closing(
        self, mock_handler_class, mock_logger, mock_get_logger
    ):
        """Test that cleanup calls flush before closing handler"""
        mock_metadata = Mock(spec=OpenMetadata)
        mock_metadata.config = Mock()
        mock_metadata.config.host_port = "http://localhost:8585"

        mock_handler = Mock()
        mock_handler.level = logging.INFO
        # Mock the specific methods that should be called
        mock_handler.flush = Mock()
        mock_handler.close = Mock()
        mock_handler_class.return_value = mock_handler

        # Setup mock logger
        mock_metadata_logger = Mock()
        mock_get_logger.return_value = mock_metadata_logger

        # Setup handler
        handler = setup_streamable_logging_for_workflow(
            metadata=mock_metadata,
            pipeline_fqn="test.pipeline",
            run_id=uuid4(),
            enable_streaming=True,
        )

        # Verify handler was created and returned
        self.assertIsNotNone(handler)
        self.assertEqual(handler, mock_handler)

        # Cleanup and verify order of operations
        cleanup_streamable_logging()

        # Verify flush was called
        mock_handler.flush.assert_called_once()

        # Verify close was called
        mock_handler.close.assert_called_once()

        # Verify handler was removed from logger
        mock_metadata_logger.removeHandler.assert_called_once_with(mock_handler)


if __name__ == "__main__":
    unittest.main()
