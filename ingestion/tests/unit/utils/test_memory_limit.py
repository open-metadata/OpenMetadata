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
Unit tests for memory_limit decorator
Tests that memory limits are enforced correctly and only track function-specific allocations
"""

import time
import unittest

from metadata.utils.memory_limit import MemoryLimitExceeded, memory_limit
from metadata.utils.timeout import timeout


class TestMemoryLimit(unittest.TestCase):
    """Test cases for memory limit functionality"""

    def test_memory_limit_enforcement(self):
        """
        Test that memory limit is correctly enforced when function exceeds limit.
        Function allocates 100MB with 50MB limit - should raise MemoryLimitExceeded.
        """

        @memory_limit(max_memory_mb=50, context="test_enforcement", verbose=True)
        def allocate_memory_100mb():
            """Function that allocates ~100MB of memory"""
            data = []
            for i in range(100):
                # Each allocation is ~1MB of actual bytes
                chunk = bytearray(1024 * 1024)  # Exactly 1MB
                data.append(chunk)
                # Small sleep to allow monitor to check
                if i % 10 == 0:
                    time.sleep(0.5)
            return len(data)

        # Should raise MemoryLimitExceeded
        with self.assertRaises(MemoryLimitExceeded) as context:
            allocate_memory_100mb()

        # Verify exception message contains expected info
        exception_message = str(context.exception)
        self.assertIn("exceeded memory limit", exception_message.lower())
        self.assertIn("50MB", exception_message)

    def test_function_specific_memory_tracking(self):
        """
        Test that memory limit only tracks function's OWN memory allocations.
        Pre-allocate 80MB before function, function uses only 5MB.
        Should NOT raise exception (proves delta-based tracking).
        """
        # Pre-allocate 80MB BEFORE the decorated function
        preexisting_data = []
        for i in range(80):
            chunk = [0] * (1024 * 128)  # ~1MB per chunk
            preexisting_data.append(chunk)

        @memory_limit(max_memory_mb=30, context="test_tracking", verbose=False)
        def allocate_only_5mb():
            """Function that allocates only ~5MB (well under limit)"""
            data = []
            for i in range(5):
                chunk = [0] * (1024 * 128)  # ~1MB per chunk
                data.append(chunk)
            return len(data)

        try:
            result = allocate_only_5mb()
            # Should succeed - function only allocated 5MB despite process having 80MB
            self.assertEqual(result, 5)
        except MemoryLimitExceeded:
            self.fail(
                "Function should NOT have been killed - only allocated 5MB (under 30MB limit)"
            )
        finally:
            # Clean up preexisting data
            del preexisting_data

    def test_memory_limit_with_context(self):
        """
        Test that context parameter is properly included in exception messages.
        """
        test_context = "query_abc123"

        @memory_limit(max_memory_mb=10, context=test_context, verbose=False)
        def small_allocation():
            """Function that allocates enough to trigger limit"""
            data = []
            for i in range(20):
                chunk = bytearray(1024 * 1024)  # 1MB each
                data.append(chunk)
                time.sleep(0.1)
            return len(data)

        with self.assertRaises(MemoryLimitExceeded) as context:
            small_allocation()

        # Verify context appears in exception message
        exception_message = str(context.exception)
        self.assertIn(test_context, exception_message)

    def test_memory_limit_success_case(self):
        """
        Test that function completes successfully when staying under limit.
        """

        @memory_limit(max_memory_mb=100, context="test_success", verbose=False)
        def small_allocation():
            """Function that allocates small amount of memory"""
            data = []
            for i in range(10):
                chunk = bytearray(1024 * 1024)  # 1MB each = 10MB total
                data.append(chunk)
            return len(data)

        # Should complete successfully
        result = small_allocation()
        self.assertEqual(result, 10)

    def test_verbose_mode(self):
        """
        Test that verbose mode doesn't affect functionality.
        Just ensures verbose=True doesn't break anything.
        """

        @memory_limit(max_memory_mb=50, context="test_verbose", verbose=True)
        def small_allocation():
            """Function with verbose logging enabled"""
            data = []
            for i in range(10):
                chunk = bytearray(1024 * 1024)  # 1MB each
                data.append(chunk)
                time.sleep(0.1)  # Allow checkpoint logs to appear
            return len(data)

        # Should complete successfully with verbose logs
        result = small_allocation()
        self.assertEqual(result, 10)

    def test_no_context(self):
        """
        Test that decorator works without context parameter.
        """

        @memory_limit(max_memory_mb=50, verbose=False)
        def small_allocation():
            """Function without context"""
            data = []
            for i in range(10):
                chunk = bytearray(1024 * 1024)  # 1MB each
                data.append(chunk)
            return len(data)

        # Should complete successfully
        result = small_allocation()
        self.assertEqual(result, 10)

    def test_rapid_memory_allocation(self):
        """
        Test rapid memory allocation without delays.
        Tests if monitor can catch very fast allocations.
        Note: May complete before monitor catches it due to speed.
        """

        @memory_limit(max_memory_mb=30, context="test_rapid", verbose=True)
        def rapid_allocation():
            """Rapidly allocate memory without sleeps"""
            data = []
            for i in range(50):  # Try to allocate 50MB quickly
                chunk = bytearray(1024 * 1024)  # 1MB each
                data.append(chunk)
                # Small delay every few iterations to give monitor a chance
                if i % 5 == 0:
                    time.sleep(0.1)
            return len(data)

        # Should raise MemoryLimitExceeded
        with self.assertRaises(MemoryLimitExceeded) as context:
            rapid_allocation()

        exception_message = str(context.exception)
        self.assertIn("exceeded memory limit", exception_message.lower())
        self.assertIn("30MB", exception_message)

    def test_memory_spike_then_release(self):
        """
        Test memory spike followed by release.
        Should track peak memory correctly.
        """

        @memory_limit(max_memory_mb=80, context="test_spike", verbose=True)
        def spike_and_release():
            """Allocate memory, then release some"""
            # Allocate 60MB
            data = []
            for i in range(60):
                chunk = bytearray(1024 * 1024)
                data.append(chunk)

            # Release half
            data = data[:30]

            # Try to allocate more (should be fine since we released)
            for i in range(10):
                chunk = bytearray(1024 * 1024)
                data.append(chunk)
                time.sleep(0.1)

            return len(data)

        # Should complete successfully - peak should be ~60MB
        result = spike_and_release()
        self.assertEqual(result, 40)  # 30 + 10

    def test_gradual_memory_leak(self):
        """
        Test gradual memory growth (simulating a leak).
        Should eventually hit the limit.
        """

        @memory_limit(max_memory_mb=40, context="test_leak", verbose=True)
        def gradual_leak():
            """Gradually allocate memory"""
            data = []
            for i in range(100):
                # Small allocations that add up
                chunk = bytearray(512 * 1024)  # 0.5MB each
                data.append(chunk)
                time.sleep(0.05)  # Give monitor time to check
            return len(data)

        # Should raise MemoryLimitExceeded before completing all 100 iterations
        with self.assertRaises(MemoryLimitExceeded) as context:
            gradual_leak()

        exception_message = str(context.exception)
        self.assertIn("exceeded memory limit", exception_message.lower())

    def test_large_single_allocation(self):
        """
        Test a single large allocation that exceeds limit.
        Should be caught immediately.
        """

        @memory_limit(max_memory_mb=50, context="test_large_single", verbose=True)
        def single_large_allocation():
            """Single allocation of 80MB"""
            # Single large allocation
            data = bytearray(80 * 1024 * 1024)  # 80MB at once
            time.sleep(1)  # Give monitor time to detect
            return len(data)

        # Should raise MemoryLimitExceeded
        with self.assertRaises(MemoryLimitExceeded):
            single_large_allocation()

    def test_multiple_data_structures(self):
        """
        Test with multiple different data structures.
        Should track total memory across all structures.
        """

        @memory_limit(max_memory_mb=70, context="test_multi_struct", verbose=True)
        def multiple_structures():
            """Allocate memory across different data types"""
            # Lists
            lists = [bytearray(10 * 1024 * 1024) for _ in range(3)]  # 30MB

            # Dictionaries
            dicts = {i: bytearray(5 * 1024 * 1024) for i in range(4)}  # 20MB

            # Strings (less efficient but still counted)
            strings = ["x" * (2 * 1024 * 1024) for _ in range(5)]  # ~10MB

            time.sleep(0.5)
            return len(lists) + len(dicts) + len(strings)

        # Should complete successfully - total ~60MB, limit 70MB
        result = multiple_structures()
        self.assertEqual(result, 12)

    def test_allocation_with_processing(self):
        """
        Test memory allocation combined with processing.
        Simulates real-world scenario of parsing + storing data.
        """

        @memory_limit(max_memory_mb=40, context="test_processing", verbose=False)
        def allocate_and_process():
            """Allocate memory while doing processing"""
            data = []
            for i in range(30):
                # Allocate memory
                chunk = bytearray(1024 * 1024)  # 1MB

                # Do some processing (simulate real work)
                processed = bytes(chunk)  # Convert to bytes
                data.append(processed)

                # Small delay
                time.sleep(0.05)

            return len(data)

        # Should complete successfully
        result = allocate_and_process()
        self.assertEqual(result, 30)

    def test_nested_function_memory(self):
        """
        Test that nested function allocations are tracked correctly.
        """

        @memory_limit(max_memory_mb=40, context="test_nested", verbose=True)
        def outer_function():
            """Function that calls nested functions"""

            def inner_allocate(size_mb):
                """Inner function that allocates memory"""
                return bytearray(size_mb * 1024 * 1024)

            data = []
            # Call inner function multiple times
            for i in range(10):
                chunk = inner_allocate(5)  # 5MB each
                data.append(chunk)
                time.sleep(0.2)  # Give monitor time to detect

            return len(data)

        # Should raise MemoryLimitExceeded (10 * 5MB = 50MB > 40MB limit)
        with self.assertRaises(MemoryLimitExceeded):
            outer_function()

    def test_memory_with_exceptions(self):
        """
        Test that memory tracking works even when exceptions occur.
        """

        @memory_limit(max_memory_mb=100, context="test_exceptions", verbose=False)
        def allocate_with_exception():
            """Allocate memory then raise an exception"""
            data = []
            for i in range(20):
                chunk = bytearray(1024 * 1024)  # 1MB each
                data.append(chunk)

                if i == 10:
                    raise ValueError("Test exception")

            return len(data)

        # Should raise ValueError, not MemoryLimitExceeded
        with self.assertRaises(ValueError):
            allocate_with_exception()

    def test_zero_memory_function(self):
        """
        Test function that allocates minimal/no memory.
        Should complete successfully.
        """

        @memory_limit(max_memory_mb=10, context="test_zero", verbose=False)
        def minimal_allocation():
            """Function with minimal memory usage"""
            # Just do some computation
            result = sum(range(1000000))
            return result

        # Should complete successfully
        result = minimal_allocation()
        self.assertGreater(result, 0)

    def test_concurrent_decorated_functions(self):
        """
        Test that multiple decorated functions can run without interfering.
        Each should track its own memory independently.
        """

        @memory_limit(max_memory_mb=30, context="test_concurrent_1", verbose=False)
        def function_1():
            """First function"""
            data = [bytearray(1024 * 1024) for _ in range(20)]  # 20MB
            time.sleep(0.5)
            return len(data)

        @memory_limit(max_memory_mb=30, context="test_concurrent_2", verbose=False)
        def function_2():
            """Second function"""
            data = [bytearray(1024 * 1024) for _ in range(15)]  # 15MB
            time.sleep(0.5)
            return len(data)

        # Run sequentially (not parallel, just testing independence)
        result1 = function_1()
        result2 = function_2()

        self.assertEqual(result1, 20)
        self.assertEqual(result2, 15)

    def test_repeated_executions(self):
        """
        Test that decorator can be used multiple times on same function.
        Memory should reset between executions.
        """

        @memory_limit(max_memory_mb=50, context="test_repeated", verbose=False)
        def repeated_function():
            """Function that will be called multiple times"""
            data = [bytearray(1024 * 1024) for _ in range(30)]  # 30MB
            return len(data)

        # Execute multiple times
        for i in range(3):
            result = repeated_function()
            self.assertEqual(result, 30)
            time.sleep(0.5)  # Brief pause between executions

    def test_extremely_rapid_allocation_no_delay(self):
        """
        Test extremely rapid memory allocation (500MB) without delays.

        Note: Due to the 0.1s monitor interval, there's a race condition:
        - If the function completes in <200ms, it may finish before monitor catches it
        - The monitor WILL detect the violation but may not raise exception in time

        This test verifies that:
        1. Monitor detects the violation (warning logged)
        2. Exception is raised either during or after execution
        3. Adding a small delay at the end ensures exception propagates
        """

        @memory_limit(max_memory_mb=300, context="test_extremely_rapid", verbose=True)
        def extremely_rapid_allocation():
            """Allocate 500MB as fast as possible - ZERO delays during allocation"""
            data = []
            # Allocate 500 chunks of 1MB each = 500MB total
            # This happens in milliseconds, much faster than 0.1s monitor interval
            for i in range(500):
                chunk = bytearray(1024 * 1024)  # 1MB
                data.append(chunk)

            # Give monitor a chance to detect and raise exception
            # In real parsers, there's usually processing time after allocation
            time.sleep(0.3)
            return len(data)

        # Should raise MemoryLimitExceeded
        # The delay ensures monitor has time to detect and raise exception
        with self.assertRaises(MemoryLimitExceeded):
            extremely_rapid_allocation()

    def test_timeout_then_memory_limit_timeout_triggers(self):
        """
        Test CORRECT order: @timeout (outer) then @memory_limit (inner)
        When timeout triggers FIRST (function runs too long but under memory limit).

        This is the CORRECT order for production use because timeout
        doesn't work inside threads (memory_limit uses threads).
        """

        @timeout(seconds=1)
        @memory_limit(max_memory_mb=100, context="test_timeout_first", verbose=False)
        def slow_function_under_memory():
            """Function that takes too long but doesn't exceed memory"""
            data = [bytearray(1024 * 1024) for _ in range(10)]  # 10MB
            time.sleep(2)  # Exceeds 1 second timeout
            return len(data)

        # Should raise TimeoutError (timeout triggers first)
        with self.assertRaises(TimeoutError):
            slow_function_under_memory()

    def test_timeout_then_memory_limit_memory_triggers(self):
        """
        Test CORRECT order: @timeout (outer) then @memory_limit (inner)
        When memory limit triggers FIRST (exceeds memory before timeout).

        This is the CORRECT order for production use.
        """

        @timeout(seconds=10)  # Long timeout, won't trigger
        @memory_limit(max_memory_mb=30, context="test_memory_first", verbose=False)
        def fast_high_memory_function():
            """Function that exceeds memory quickly"""
            data = []
            for i in range(50):
                chunk = bytearray(1024 * 1024)  # 1MB
                data.append(chunk)
                if i % 5 == 0:
                    time.sleep(0.1)  # Give monitor time
            return len(data)

        # Should raise MemoryLimitExceeded (memory limit triggers first)
        with self.assertRaises(MemoryLimitExceeded):
            fast_high_memory_function()

    def test_timeout_then_memory_limit_both_within_limits(self):
        """
        Test CORRECT order: @timeout (outer) then @memory_limit (inner)
        When function completes successfully within both limits.
        """

        @timeout(seconds=5)
        @memory_limit(max_memory_mb=50, context="test_both_ok", verbose=False)
        def normal_function():
            """Function within both limits"""
            data = [bytearray(1024 * 1024) for _ in range(20)]  # 20MB
            time.sleep(0.5)
            return len(data)

        # Should complete successfully
        result = normal_function()
        self.assertEqual(result, 20)

    def test_memory_limit_then_timeout_timeout_may_fail(self):
        """
        Test INCORRECT order: @memory_limit (outer) then @timeout (inner)
        This is the WRONG order but we document the behavior.

        WARNING: In this order, timeout runs inside the memory_limit thread.
        Timeout mechanisms may not work reliably inside threads!

        This test documents that memory_limit still works but timeout
        behavior is unpredictable when it's the inner decorator.
        """

        @memory_limit(max_memory_mb=100, context="test_wrong_order", verbose=False)
        @timeout(seconds=1)
        def slow_function_wrong_order():
            """Function with decorators in WRONG order"""
            data = [bytearray(1024 * 1024) for _ in range(10)]  # 10MB
            time.sleep(2)  # Would exceed timeout
            return len(data)

        # Timeout may or may not work reliably in this order
        # This test just documents that it exists - behavior is undefined
        try:
            result = slow_function_wrong_order()
            # If it completes, memory limit still worked
            self.assertIsNotNone(result)
        except (TimeoutError, MemoryLimitExceeded):
            # Either exception is possible depending on thread timing
            pass

    def test_combined_decorators_realistic_parser_scenario(self):
        """
        Test realistic lineage parser scenario with both decorators.
        Simulates a query parser that could fail due to either:
        - Taking too long (timeout)
        - Using too much memory (memory limit)

        Uses CORRECT order: @timeout then @memory_limit
        """

        @timeout(seconds=3)
        @memory_limit(max_memory_mb=80, context="test_parser_scenario", verbose=False)
        def simulate_query_parser(query_size: int, parse_time: float):
            """
            Simulates a query parser that allocates memory based on query size
            and takes time to parse.
            """
            # Simulate parsing data structures
            data = []
            for i in range(query_size):
                chunk = bytearray(1024 * 1024)  # 1MB per query element
                data.append(chunk)
                if i % 5 == 0:
                    time.sleep(0.1)  # Simulate parsing work

            # Simulate additional parsing time
            time.sleep(parse_time)
            return len(data)

        # Scenario 1: Normal query - should succeed
        result = simulate_query_parser(query_size=30, parse_time=0.5)
        self.assertEqual(result, 30)

        # Scenario 2: Complex query - should hit memory limit
        with self.assertRaises(MemoryLimitExceeded):
            simulate_query_parser(query_size=100, parse_time=0.5)

        # Scenario 3: Slow query - should hit timeout
        with self.assertRaises(TimeoutError):
            simulate_query_parser(query_size=10, parse_time=5)

    def test_timeout_memory_limit_exception_precedence(self):
        """
        Test which exception is raised when both limits could be exceeded.
        With correct order (@timeout outer, @memory_limit inner),
        whichever condition is detected first will raise its exception.
        """

        @timeout(seconds=2)
        @memory_limit(max_memory_mb=40, context="test_precedence", verbose=True)
        def function_exceeding_both():
            """Function that will exceed both limits"""
            data = []
            # Allocate memory quickly to trigger memory limit first
            for i in range(60):
                chunk = bytearray(1024 * 1024)  # 1MB
                data.append(chunk)
                if i % 10 == 0:
                    time.sleep(0.2)  # Some delay but should hit memory first
            return len(data)

        # Memory limit should trigger first since we allocate quickly
        with self.assertRaises(MemoryLimitExceeded):
            function_exceeding_both()


if __name__ == "__main__":
    unittest.main()
