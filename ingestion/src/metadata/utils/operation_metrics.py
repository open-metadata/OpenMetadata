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
Operation Metrics Module

Provides singleton-based operation metrics collection for tracking
source database queries, source API calls, and other operations during ingestion.

Key Categories:
- source_db_queries: SQL queries to source databases (SELECT, DESCRIBE, SHOW, etc.)
- source_api_calls: HTTP calls to source APIs (Tableau, Looker, PowerBI, etc.)
- source_fetch: Time spent in topology producers fetching from sources
- stage_process: Time spent processing entities in stages

Uses free-form strings for category, operation, and entityType to
accommodate all connector types without schema changes.

Memory-bounded: Uses Welford's online algorithm for running statistics
instead of storing all timing values.

Async: Uses a background thread to process metrics asynchronously,
minimizing impact on ingestion performance.
"""

import atexit
import threading
from collections import defaultdict
from contextlib import contextmanager
from functools import wraps
from queue import Empty, Queue
from time import perf_counter
from typing import Callable, Dict, Optional

from pydantic import BaseModel, Field

from metadata.utils.singleton import Singleton


class RunningStatistics:
    """
    Memory-efficient running statistics using Welford's online algorithm.
    Computes count, mean, min, max, and total without storing individual values.
    O(1) space complexity regardless of number of operations tracked.
    """

    __slots__ = ("count", "total", "mean", "min_val", "max_val", "_m2")

    def __init__(self):
        self.count: int = 0
        self.total: float = 0.0
        self.mean: float = 0.0
        self.min_val: Optional[float] = None
        self.max_val: Optional[float] = None
        self._m2: float = 0.0  # For variance calculation if needed

    def add(self, value: float) -> None:
        """Add a new value and update running statistics."""
        self.count += 1
        self.total += value

        # Welford's online mean update
        delta = value - self.mean
        self.mean += delta / self.count
        delta2 = value - self.mean
        self._m2 += delta * delta2

        # Update min/max
        if self.min_val is None or value < self.min_val:
            self.min_val = value
        if self.max_val is None or value > self.max_val:
            self.max_val = value

    def merge(self, other: "RunningStatistics") -> None:
        """Merge another RunningStatistics into this one (for thread merging)."""
        if other.count == 0:
            return
        if self.count == 0:
            self.count = other.count
            self.total = other.total
            self.mean = other.mean
            self.min_val = other.min_val
            self.max_val = other.max_val
            self._m2 = other._m2
            return

        # Parallel algorithm for merging means and M2
        combined_count = self.count + other.count
        delta = other.mean - self.mean
        combined_mean = (
            self.count * self.mean + other.count * other.mean
        ) / combined_count
        combined_m2 = (
            self._m2
            + other._m2
            + delta * delta * self.count * other.count / combined_count
        )

        self.count = combined_count
        self.total += other.total
        self.mean = combined_mean
        self._m2 = combined_m2

        # Merge min/max
        if other.min_val is not None:
            if self.min_val is None or other.min_val < self.min_val:
                self.min_val = other.min_val
        if other.max_val is not None:
            if self.max_val is None or other.max_val > self.max_val:
                self.max_val = other.max_val

    def to_summary_dict(self) -> Dict:
        """Convert to API-compatible dictionary."""
        return {
            "count": self.count,
            "totalTimeMs": self.total,
            "avgTimeMs": self.mean if self.count > 0 else 0.0,
            "minTimeMs": self.min_val,
            "maxTimeMs": self.max_val,
        }


class OperationSummary(BaseModel):
    """Summary statistics for an operation type"""

    count: int = Field(default=0, description="Total operations")
    total_time_ms: float = Field(default=0.0, description="Total time in ms")
    avg_time_ms: float = Field(default=0.0, description="Average time in ms")
    min_time_ms: Optional[float] = Field(default=None, description="Min time in ms")
    max_time_ms: Optional[float] = Field(default=None, description="Max time in ms")

    def to_dict(self) -> Dict:
        """Convert to dictionary for API response"""
        return {
            "count": self.count,
            "totalTimeMs": self.total_time_ms,
            "avgTimeMs": self.avg_time_ms,
            "minTimeMs": self.min_time_ms,
            "maxTimeMs": self.max_time_ms,
        }


def _create_running_stats_dict():
    """Factory function for creating nested defaultdict with RunningStatistics."""
    return defaultdict(RunningStatistics)


def _create_operation_dict():
    """Factory function for creating operation-level defaultdict."""
    return defaultdict(_create_running_stats_dict)


def _create_category_dict():
    """Factory function for creating category-level defaultdict."""
    return defaultdict(_create_operation_dict)


class OperationMetricsState(metaclass=Singleton):
    """
    Thread-safe singleton for collecting operation metrics asynchronously.

    Uses per-thread storage to avoid lock contention during high-throughput
    multithreaded processing. Metrics are merged when threads complete.

    Memory-bounded: Uses RunningStatistics (Welford's algorithm) instead
    of storing all timing values. O(1) space per operation type.

    Async: Uses a background worker thread to process metrics from a queue,
    minimizing latency impact on the main ingestion workflow.

    Run-scoped: Maintains a run_id to associate metrics with a specific
    workflow run. Should be set at workflow start and reset at workflow end.

    Structure: category -> operation -> entity_type -> RunningStatistics
    Example: source_db_queries -> SELECT -> Table -> RunningStatistics(count=100, ...)
    """

    def __init__(self):
        # Global metrics: category -> operation -> entity_type -> RunningStatistics
        self._global_metrics: Dict[
            str, Dict[str, Dict[str, RunningStatistics]]
        ] = _create_category_dict()
        # Per-thread metrics for lock-free recording
        self._thread_metrics: Dict[
            int, Dict[str, Dict[str, Dict[str, RunningStatistics]]]
        ] = defaultdict(_create_category_dict)
        self._lock = threading.Lock()

        # Async processing queue and worker
        self._async_queue: Queue = Queue()
        self._worker_thread: Optional[threading.Thread] = None
        self._shutdown_flag = threading.Event()
        self._async_enabled = True

        # Run context for associating metrics with a workflow run
        self._run_id: Optional[str] = None
        self._pipeline_fqn: Optional[str] = None

        # Start background worker
        self._start_worker()
        atexit.register(self._shutdown_worker)

    def _start_worker(self) -> None:
        """Start the background worker thread for async metric processing."""
        if self._worker_thread is None or not self._worker_thread.is_alive():
            self._shutdown_flag.clear()
            self._worker_thread = threading.Thread(
                target=self._worker_loop, daemon=True, name="MetricsWorker"
            )
            self._worker_thread.start()

    def _worker_loop(self) -> None:
        """Background worker that processes metrics from the queue."""
        while not self._shutdown_flag.is_set():
            try:
                # Wait for items with timeout to allow shutdown check
                item = self._async_queue.get(timeout=0.1)
                if item is None:  # Shutdown signal
                    break
                category, operation, duration_ms, entity_type = item
                self._record_sync(category, operation, duration_ms, entity_type)
                self._async_queue.task_done()
            except Empty:
                continue
            except Exception:
                # Don't let worker crash on errors
                pass

    def _shutdown_worker(self) -> None:
        """Shutdown the background worker gracefully."""
        self._shutdown_flag.set()
        # Drain the queue
        while not self._async_queue.empty():
            try:
                item = self._async_queue.get_nowait()
                if item is not None:
                    category, operation, duration_ms, entity_type = item
                    self._record_sync(category, operation, duration_ms, entity_type)
            except Empty:
                break
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=1.0)

    def set_run_context(
        self, run_id: Optional[str] = None, pipeline_fqn: Optional[str] = None
    ) -> None:
        """
        Set the run context for associating metrics with a workflow run.

        Should be called at workflow start. Automatically resets metrics
        to ensure clean state for the new run.

        Args:
            run_id: Unique identifier for this workflow run
            pipeline_fqn: Fully qualified name of the ingestion pipeline
        """
        # Reset metrics when starting a new run
        if self._run_id != run_id:
            # Clear the async queue first to discard any pending items from old run
            self._clear_async_queue()
            with self._lock:
                self._global_metrics = _create_category_dict()
                self._thread_metrics = defaultdict(_create_category_dict)
        with self._lock:
            self._run_id = run_id
            self._pipeline_fqn = pipeline_fqn

    def _clear_async_queue(self) -> None:
        """Clear the async queue without processing items."""
        while not self._async_queue.empty():
            try:
                self._async_queue.get_nowait()
            except Empty:
                break

    def get_run_context(self) -> Dict[str, Optional[str]]:
        """Get the current run context."""
        return {"run_id": self._run_id, "pipeline_fqn": self._pipeline_fqn}

    def record_operation(
        self,
        category: str,
        operation: str,
        duration_ms: float,
        entity_type: Optional[str] = None,
    ) -> None:
        """
        Record an operation metric asynchronously.

        Puts the metric on a queue for background processing to minimize
        latency impact on the main ingestion workflow.

        Args:
            category: High-level category (source_db_queries, source_api_calls, etc.)
            operation: Operation name (SELECT, GET:/path, yield_database)
            duration_ms: Duration in milliseconds
            entity_type: Optional entity type (Table, Dashboard, etc.)
        """
        if self._async_enabled:
            self._async_queue.put((category, operation, duration_ms, entity_type))
        else:
            self._record_sync(category, operation, duration_ms, entity_type)

    def _record_sync(
        self,
        category: str,
        operation: str,
        duration_ms: float,
        entity_type: Optional[str] = None,
    ) -> None:
        """
        Record an operation metric synchronously (used by worker thread).

        Uses per-thread storage to avoid lock contention.
        Updates running statistics in O(1) time and space.
        """
        thread_id = threading.get_ident()
        entity_key = entity_type or "_default"

        self._thread_metrics[thread_id][category][operation][entity_key].add(
            duration_ms
        )

    def merge_thread_metrics(self, thread_id: Optional[int] = None) -> None:
        """
        Merge metrics from a specific thread into global state.

        Called when a thread completes processing to consolidate metrics.

        Args:
            thread_id: Thread ID to merge. If None, uses current thread.
        """
        tid = thread_id if thread_id is not None else threading.get_ident()

        if tid not in self._thread_metrics:
            return

        thread_data = self._thread_metrics.pop(tid, {})

        with self._lock:
            for category, operations in thread_data.items():
                for operation, entity_types in operations.items():
                    for entity_type, stats in entity_types.items():
                        self._global_metrics[category][operation][entity_type].merge(
                            stats
                        )

    def merge_all_threads(self) -> None:
        """Merge metrics from all threads into global state"""
        thread_ids = list(self._thread_metrics.keys())
        for tid in thread_ids:
            self.merge_thread_metrics(tid)

    def get_summary(self) -> Dict[str, Dict[str, Dict[str, Dict]]]:
        """
        Get aggregated operation metrics summary.

        Returns:
            Nested dict: category -> operation -> entity_type -> OperationSummary
        """
        self._flush_async_queue()
        self.merge_all_threads()

        with self._lock:
            result: Dict[str, Dict[str, Dict[str, Dict]]] = {}

            for category, operations in self._global_metrics.items():
                result[category] = {}
                for operation, entity_types in operations.items():
                    result[category][operation] = {}
                    for entity_type, stats in entity_types.items():
                        if stats.count > 0:
                            result[category][operation][
                                entity_type
                            ] = stats.to_summary_dict()

            return result

    def get_flat_summary(self) -> Dict[str, int]:
        """
        Get a flat summary with total counts per category.

        Returns:
            Dict with keys like 'db_queries_count', 'api_calls_count'
        """
        self._flush_async_queue()
        self.merge_all_threads()

        with self._lock:
            result = {}
            for category, operations in self._global_metrics.items():
                total_count = sum(
                    stats.count
                    for op_data in operations.values()
                    for stats in op_data.values()
                )
                total_time = sum(
                    stats.total
                    for op_data in operations.values()
                    for stats in op_data.values()
                )
                result[f"{category}_count"] = total_count
                result[f"{category}_total_ms"] = total_time
            return result

    def get_workflow_timing(self) -> Dict[str, Dict]:
        """
        Get high-level workflow timing for source operations.

        Returns a summary of time spent on source systems:
        - source_db_queries: SQL queries to source databases
        - source_api_calls: HTTP calls to source APIs (Tableau, Looker, etc.)
        - source_fetch: Time in topology producers fetching from sources
        - stage_process: Time spent processing entities in stages

        Returns:
            Dict with source timing breakdown by category
        """
        self._flush_async_queue()
        self.merge_all_threads()

        with self._lock:
            result = {
                "source": {"total_ms": 0.0, "call_count": 0, "by_entity_type": {}},
                "source_db_queries": {
                    "total_ms": 0.0,
                    "call_count": 0,
                    "by_operation": {},
                },
                "source_api_calls": {
                    "total_ms": 0.0,
                    "call_count": 0,
                    "by_operation": {},
                },
                "stage": {"total_ms": 0.0, "call_count": 0, "by_entity_type": {}},
            }

            # Aggregate source_fetch category (topology producer time)
            if "source_fetch" in self._global_metrics:
                for operation, entity_types in self._global_metrics[
                    "source_fetch"
                ].items():
                    for entity_type, stats in entity_types.items():
                        if stats.count > 0:
                            result["source"]["total_ms"] += stats.total
                            result["source"]["call_count"] += stats.count

                            if entity_type not in result["source"]["by_entity_type"]:
                                result["source"]["by_entity_type"][entity_type] = {
                                    "total_ms": 0.0,
                                    "call_count": 0,
                                }
                            result["source"]["by_entity_type"][entity_type][
                                "total_ms"
                            ] += stats.total
                            result["source"]["by_entity_type"][entity_type][
                                "call_count"
                            ] += stats.count

            # Aggregate source_db_queries category (SQL queries to source)
            if "source_db_queries" in self._global_metrics:
                for operation, entity_types in self._global_metrics[
                    "source_db_queries"
                ].items():
                    for entity_type, stats in entity_types.items():
                        if stats.count > 0:
                            result["source_db_queries"]["total_ms"] += stats.total
                            result["source_db_queries"]["call_count"] += stats.count

                            if (
                                operation
                                not in result["source_db_queries"]["by_operation"]
                            ):
                                result["source_db_queries"]["by_operation"][
                                    operation
                                ] = {"total_ms": 0.0, "call_count": 0}
                            result["source_db_queries"]["by_operation"][operation][
                                "total_ms"
                            ] += stats.total
                            result["source_db_queries"]["by_operation"][operation][
                                "call_count"
                            ] += stats.count

            # Aggregate source_api_calls category (HTTP calls to source APIs)
            if "source_api_calls" in self._global_metrics:
                for operation, entity_types in self._global_metrics[
                    "source_api_calls"
                ].items():
                    for entity_type, stats in entity_types.items():
                        if stats.count > 0:
                            result["source_api_calls"]["total_ms"] += stats.total
                            result["source_api_calls"]["call_count"] += stats.count

                            if (
                                operation
                                not in result["source_api_calls"]["by_operation"]
                            ):
                                result["source_api_calls"]["by_operation"][
                                    operation
                                ] = {"total_ms": 0.0, "call_count": 0}
                            result["source_api_calls"]["by_operation"][operation][
                                "total_ms"
                            ] += stats.total
                            result["source_api_calls"]["by_operation"][operation][
                                "call_count"
                            ] += stats.count

            # Aggregate stage_process category
            if "stage_process" in self._global_metrics:
                for operation, entity_types in self._global_metrics[
                    "stage_process"
                ].items():
                    for entity_type, stats in entity_types.items():
                        if stats.count > 0:
                            result["stage"]["total_ms"] += stats.total
                            result["stage"]["call_count"] += stats.count

                            if entity_type not in result["stage"]["by_entity_type"]:
                                result["stage"]["by_entity_type"][entity_type] = {
                                    "total_ms": 0.0,
                                    "call_count": 0,
                                }
                            result["stage"]["by_entity_type"][entity_type][
                                "total_ms"
                            ] += stats.total
                            result["stage"]["by_entity_type"][entity_type][
                                "call_count"
                            ] += stats.count

            return result

    def _flush_async_queue(self) -> None:
        """Flush any pending items in the async queue."""
        while not self._async_queue.empty():
            try:
                item = self._async_queue.get_nowait()
                if item is not None:
                    category, operation, duration_ms, entity_type = item
                    self._record_sync(category, operation, duration_ms, entity_type)
            except Empty:
                break

    def reset(self) -> None:
        """Reset all metrics and run context"""
        self._flush_async_queue()
        with self._lock:
            self._global_metrics = _create_category_dict()
            self._thread_metrics = defaultdict(_create_category_dict)
            self._run_id = None
            self._pipeline_fqn = None


def track_operation(
    category: str, operation: Optional[str] = None, entity_type: Optional[str] = None
) -> Callable:
    """
    Decorator to track operation timing.

    Usage:
        @track_operation(category="db_queries", operation="SELECT", entity_type="Table")
        def fetch_table_columns():
            ...

        @track_operation(category="api_calls", operation="GET:/dashboards")
        def list_dashboards():
            ...

    Args:
        category: Operation category (db_queries, api_calls, entity_operations)
        operation: Operation name. If None, uses function name.
        entity_type: Optional entity type being operated on.
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            op_name = operation or func.__name__
            start = perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                duration_ms = (perf_counter() - start) * 1000
                OperationMetricsState().record_operation(
                    category, op_name, duration_ms, entity_type
                )

        return wrapper

    return decorator


class TrackOperation:
    """
    Context manager for tracking operation timing.

    Usage:
        with TrackOperation("db_queries", "SELECT", "Table"):
            result = cursor.execute(query)

        with TrackOperation("api_calls", "GET:/dashboards"):
            response = client.get("/dashboards")
    """

    def __init__(
        self, category: str, operation: str, entity_type: Optional[str] = None
    ):
        self.category = category
        self.operation = operation
        self.entity_type = entity_type
        self.start: Optional[float] = None

    def __enter__(self) -> "TrackOperation":
        self.start = perf_counter()
        return self

    def __exit__(self, *args) -> None:
        if self.start is not None:
            duration_ms = (perf_counter() - self.start) * 1000
            OperationMetricsState().record_operation(
                self.category, self.operation, duration_ms, self.entity_type
            )


@contextmanager
def track_operation_context(
    category: str, operation: str, entity_type: Optional[str] = None
):
    """
    Generator-based context manager for operation tracking.

    Useful for tracking operations in generator functions.

    Usage:
        with track_operation_context("entity_operations", "yield_table", "Table"):
            yield from get_tables()
    """
    start = perf_counter()
    try:
        yield
    finally:
        duration_ms = (perf_counter() - start) * 1000
        OperationMetricsState().record_operation(
            category, operation, duration_ms, entity_type
        )
