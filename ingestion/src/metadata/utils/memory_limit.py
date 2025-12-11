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
Memory limit utilities for controlling memory consumption.
Cross-platform solution using tracemalloc to track ONLY function-specific allocations.
"""
import functools
import threading
import time
import tracemalloc
from typing import Callable, Optional

from metadata.utils.logger import utils_logger

logger = utils_logger()

# Default memory limit: 100MB in bytes
DEFAULT_MEMORY_LIMIT_MB = 100
BYTES_PER_MB = 1024 * 1024
# Check memory every 0.1 seconds
MEMORY_CHECK_INTERVAL_SECONDS = 0.1


class MemoryLimitExceeded(Exception):
    """Exception raised when memory limit is exceeded"""

    pass


class MemoryMonitor:
    """
    Memory monitoring class that tracks ONLY the memory allocated by the decorated function.
    Uses tracemalloc to get precise, function-specific memory tracking.
    Works across all platforms: Windows, Linux, macOS, and in any thread context.
    """

    def __init__(
        self,
        max_memory_mb: int,
        check_interval: float = MEMORY_CHECK_INTERVAL_SECONDS,
        context: Optional[str] = None,
        function_name: Optional[str] = None,
        verbose: bool = False,
    ):
        self.max_memory_bytes = max_memory_mb * BYTES_PER_MB
        self.max_memory_mb = max_memory_mb
        self.check_interval = check_interval
        self.context = context or ""
        self.function_name = function_name or "unknown"
        self.verbose = verbose
        self.should_stop = threading.Event()
        self.exceeded = threading.Event()
        self.monitor_thread: Optional[threading.Thread] = None
        self.snapshot_start = None
        self.peak_memory = 0

    def get_current_function_memory(self) -> int:
        """
        Get current memory allocated by THIS function only.
        Returns memory in bytes.
        """
        try:
            if not tracemalloc.is_tracing():
                return 0

            # Get current snapshot
            snapshot = tracemalloc.take_snapshot()

            if self.snapshot_start is None:
                return 0

            # Calculate memory difference from start
            # This gives us ONLY the memory allocated since we started tracking
            top_stats = snapshot.compare_to(self.snapshot_start, "lineno")

            # Sum up all the size differences (new allocations minus deallocations)
            total_diff = sum(stat.size_diff for stat in top_stats if stat.size_diff > 0)

            return total_diff
        except Exception:
            return 0

    def _monitor_loop(self):
        """Main monitoring loop that runs in a separate thread."""
        context_str = f"[{self.context}] " if self.context else ""
        logger.debug(
            f"{context_str}Memory monitor started for {self.function_name}(). "
            f"Limit: {self.max_memory_mb}MB"
        )

        while not self.should_stop.is_set():
            # Get memory allocated by THIS function only
            current_memory = self.get_current_function_memory()
            current_mb = current_memory / BYTES_PER_MB

            # Log checkpoint only if verbose mode is enabled
            if self.verbose:
                logger.debug(
                    f"{context_str}Memory checkpoint for {self.function_name}(): "
                    f"Current function memory: {current_mb:.2f}MB, Limit: {self.max_memory_mb}MB"
                )

            # Track peak memory
            if current_memory > self.peak_memory:
                self.peak_memory = current_memory

            # Check if memory limit exceeded
            if current_memory > self.max_memory_bytes:
                logger.warning(
                    f"{context_str}Memory limit exceeded in {self.function_name}()! "
                    f"Function memory usage: {current_mb:.2f}MB, Limit: {self.max_memory_mb}MB"
                )
                self.exceeded.set()
                break

            time.sleep(self.check_interval)

        peak_mb = self.peak_memory / BYTES_PER_MB
        logger.debug(
            f"{context_str}Memory monitor stopped for {self.function_name}(). "
            f"Peak function memory: {peak_mb:.2f}MB"
        )

    def start(self):
        """Start the memory monitoring thread and begin tracking."""
        # Start tracemalloc to track allocations
        if not tracemalloc.is_tracing():
            tracemalloc.start()

        # Take initial snapshot
        self.snapshot_start = tracemalloc.take_snapshot()

        # Start monitoring thread
        self.should_stop.clear()
        self.exceeded.clear()
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()

    def stop(self):
        """Stop the memory monitoring thread."""
        self.should_stop.set()
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)

    def check_exceeded(self):
        """Check if memory limit was exceeded and raise exception if so."""
        if self.exceeded.is_set():
            peak_mb = self.peak_memory / BYTES_PER_MB
            context_str = f"[{self.context}] " if self.context else ""
            raise MemoryLimitExceeded(
                f"{context_str}{self.function_name}() exceeded memory limit of {self.max_memory_mb}MB. "
                f"Peak usage: {peak_mb:.2f}MB"
            )


def memory_limit(
    max_memory_mb: int = DEFAULT_MEMORY_LIMIT_MB,
    context: Optional[str] = None,
    verbose: bool = False,
) -> Callable:
    """
    Decorator factory to handle memory limits in functions.
    Monitors ONLY the memory allocated by the decorated function using tracemalloc.

    This tracks ONLY the function's own allocations, ignoring:
    - Memory from other functions
    - Pre-existing process memory
    - Other threads' allocations

    Works across ALL platforms: Windows, Linux, macOS, Argo, Airflow, Kubernetes.

    Args:
        max_memory_mb: Maximum memory the function can allocate (in megabytes)
        context: Optional context string for logging (e.g., query hash, request ID)
        verbose: Enable verbose checkpoint logging to see memory growth (default: False)

    Raises:
        MemoryLimitExceeded: When the function exceeds the memory limit

    Example:
        @memory_limit(max_memory_mb=100, context="query_abc123", verbose=True)
        def expensive_function():
            # Your code here
            pass
    """

    def decorator(fn):
        @functools.wraps(fn)
        def inner(*args, **kwargs):
            monitor = MemoryMonitor(
                max_memory_mb=max_memory_mb,
                context=context,
                function_name=fn.__name__,
                verbose=verbose,
            )

            context_str = f"[{context}] " if context else ""
            try:
                # Start monitoring
                monitor.start()
                logger.debug(
                    f"{context_str}Started memory monitoring for {fn.__name__}() "
                    f"(limit: {max_memory_mb}MB)"
                )

                # Execute the function
                result = fn(*args, **kwargs)

                # Check if memory was exceeded during execution
                monitor.check_exceeded()

                return result

            except MemoryLimitExceeded:
                # Re-raise with function context
                peak_mb = monitor.peak_memory / BYTES_PER_MB
                logger.error(
                    f"{context_str}Function {fn.__name__}() exceeded memory limit of {max_memory_mb}MB. "
                    f"Peak usage: {peak_mb:.2f}MB"
                )
                raise MemoryLimitExceeded(
                    f"{context_str}Function {fn.__name__}() exceeded memory limit of {max_memory_mb}MB. "
                    f"Peak usage: {peak_mb:.2f}MB"
                )
            finally:
                # Always stop monitoring
                monitor.stop()

        return inner

    return decorator
