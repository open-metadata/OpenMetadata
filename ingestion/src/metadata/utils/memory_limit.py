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
Memory limit decorator using tracemalloc for lightweight, low-overhead tracking.
"""

import functools
import threading
import tracemalloc
from typing import Callable, Optional

from metadata.utils.constants import BYTES_PER_MB
from metadata.utils.logger import utils_logger

logger = utils_logger()

DEFAULT_MEMORY_LIMIT_MB = 100
MEMORY_CHECK_INTERVAL_SECONDS = 0.1


class MemoryLimitExceeded(Exception):
    """Raised when function exceeds memory limit."""


class MemoryMonitor:
    """Monitors incremental memory usage using tracemalloc's get_traced_memory."""

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
        self.baseline_memory = 0
        self.peak_memory = 0

    def get_current_function_memory(self) -> int:
        """
        Returns lightweight estimate of memory allocated since monitoring started.
        This method is not used in the hot loop but available for debugging.
        """
        try:
            if not tracemalloc.is_tracing():
                return 0

            current_memory, _ = tracemalloc.get_traced_memory()

            if current_memory <= self.baseline_memory:
                return 0

            return current_memory - self.baseline_memory
        except Exception:
            return 0

    def _monitor_loop(self):
        """
        Background thread that checks memory every interval.
        This loop is optimized to do minimal work.
        """
        # This is the hot loop. It must be as fast as possible.
        # We directly call get_traced_memory and do a simple comparison.
        # No logging, no peak tracking inside the loop.
        while not self.should_stop.wait(self.check_interval):
            current, _ = tracemalloc.get_traced_memory()
            if (current - self.baseline_memory) > self.max_memory_bytes:
                self.exceeded.set()
                break

        # Verbose logging happens only after the loop finishes.
        if self.verbose:
            # Final peak memory check after loop exits
            current, self.peak_memory = tracemalloc.get_traced_memory()
            final_diff = current - self.baseline_memory

            self.peak_memory = max(final_diff, self.peak_memory)
            peak_mb = self.peak_memory / BYTES_PER_MB

            context_str = f"[{self.context}] " if self.context else ""
            logger.debug(
                f"{context_str}Memory monitor stopped for {self.function_name}(). "
                f"Peak function memory: {peak_mb:.2f}MB"
            )

    def start(self):
        """Start monitoring thread and tracemalloc."""
        if not tracemalloc.is_tracing():
            tracemalloc.start(1)  # Minimal frame depth for low overhead

        self.baseline_memory, _ = tracemalloc.get_traced_memory()
        self.peak_memory = 0

        self.should_stop.clear()
        self.exceeded.clear()
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()

    def stop(self):
        """Stop monitoring and wait for thread to finish."""
        self.should_stop.set()
        if self.monitor_thread:
            self.monitor_thread.join(timeout=1.0)

        if tracemalloc.is_tracing():
            tracemalloc.stop()

    def check_exceeded(self):
        """Raise exception if limit was exceeded during execution."""
        if self.exceeded.is_set():
            # The peak memory is now calculated in the monitor loop's verbose block
            # or just after the main execution. We need to get the final peak.
            if not self.verbose:
                _, self.peak_memory = tracemalloc.get_traced_memory()

            peak_mb = self.peak_memory / BYTES_PER_MB
            context_str = f"[{self.context}] " if self.context else ""
            raise MemoryLimitExceeded(
                f"{context_str}{self.function_name}() exceeded memory limit of {self.max_memory_mb}MB. "
                f"Peak usage: {peak_mb:.2f}MB"
            )


def memory_limit(
    max_memory_mb: int = DEFAULT_MEMORY_LIMIT_MB,
    context: Optional[str] = None,
    verbose: bool = True,
) -> Callable:
    """
    Limit function memory usage. Raises MemoryLimitExceeded if exceeded.

    Args:
        max_memory_mb: Memory limit in MB (default 100)
        context: Optional context for log messages
        verbose: Enable debug logging
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
                monitor.start()

                if verbose:
                    logger.debug(
                        f"{context_str}Started memory monitoring for {fn.__name__}() "
                        f"(limit: {max_memory_mb}MB)"
                    )

                result = fn(*args, **kwargs)

                monitor.check_exceeded()

                return result

            except MemoryLimitExceeded:
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
                monitor.stop()

        return inner

    return decorator
