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

"""Tests for the OperationMetricsState singleton and tracking utilities"""

import threading
import time

import pytest

from metadata.utils.operation_metrics import (
    OperationMetricsState,
    OperationSummary,
    RunningStatistics,
    TrackOperation,
    track_operation,
    track_operation_context,
)
from metadata.utils.singleton import Singleton


class TestRunningStatistics:
    """Tests for the RunningStatistics class (Welford's algorithm)"""

    def test_empty_statistics(self) -> None:
        stats = RunningStatistics()
        assert stats.count == 0
        assert stats.total == 0.0
        assert stats.mean == 0.0
        assert stats.min_val is None
        assert stats.max_val is None

    def test_single_value(self) -> None:
        stats = RunningStatistics()
        stats.add(10.0)
        assert stats.count == 1
        assert stats.total == 10.0
        assert stats.mean == 10.0
        assert stats.min_val == 10.0
        assert stats.max_val == 10.0

    def test_multiple_values(self) -> None:
        stats = RunningStatistics()
        stats.add(10.0)
        stats.add(20.0)
        stats.add(30.0)
        assert stats.count == 3
        assert stats.total == 60.0
        assert stats.mean == 20.0
        assert stats.min_val == 10.0
        assert stats.max_val == 30.0

    def test_running_mean_accuracy(self) -> None:
        stats = RunningStatistics()
        values = [1.0, 2.0, 3.0, 4.0, 5.0, 100.0]
        for v in values:
            stats.add(v)
        expected_mean = sum(values) / len(values)
        assert abs(stats.mean - expected_mean) < 0.0001

    def test_merge_empty_into_empty(self) -> None:
        stats1 = RunningStatistics()
        stats2 = RunningStatistics()
        stats1.merge(stats2)
        assert stats1.count == 0

    def test_merge_values_into_empty(self) -> None:
        stats1 = RunningStatistics()
        stats2 = RunningStatistics()
        stats2.add(10.0)
        stats2.add(20.0)
        stats1.merge(stats2)
        assert stats1.count == 2
        assert stats1.total == 30.0
        assert stats1.mean == 15.0

    def test_merge_two_populated_stats(self) -> None:
        stats1 = RunningStatistics()
        stats1.add(10.0)
        stats1.add(20.0)

        stats2 = RunningStatistics()
        stats2.add(30.0)
        stats2.add(40.0)

        stats1.merge(stats2)
        assert stats1.count == 4
        assert stats1.total == 100.0
        assert stats1.mean == 25.0
        assert stats1.min_val == 10.0
        assert stats1.max_val == 40.0

    def test_merge_updates_min_max(self) -> None:
        stats1 = RunningStatistics()
        stats1.add(50.0)

        stats2 = RunningStatistics()
        stats2.add(10.0)
        stats2.add(100.0)

        stats1.merge(stats2)
        assert stats1.min_val == 10.0
        assert stats1.max_val == 100.0

    def test_to_summary_dict(self) -> None:
        stats = RunningStatistics()
        stats.add(10.0)
        stats.add(20.0)
        stats.add(30.0)

        result = stats.to_summary_dict()
        assert result["count"] == 3
        assert result["totalTimeMs"] == 60.0
        assert result["avgTimeMs"] == 20.0
        assert result["minTimeMs"] == 10.0
        assert result["maxTimeMs"] == 30.0


class TestOperationSummary:
    """Tests for OperationSummary model"""

    def test_to_dict_format(self) -> None:
        summary = OperationSummary(
            count=10,
            total_time_ms=100.0,
            avg_time_ms=10.0,
            min_time_ms=5.0,
            max_time_ms=15.0,
        )
        result = summary.to_dict()
        assert result["count"] == 10
        assert result["totalTimeMs"] == 100.0
        assert result["avgTimeMs"] == 10.0
        assert result["minTimeMs"] == 5.0
        assert result["maxTimeMs"] == 15.0

    def test_defaults(self) -> None:
        summary = OperationSummary()
        assert summary.count == 0
        assert summary.total_time_ms == 0.0
        assert summary.avg_time_ms == 0.0
        assert summary.min_time_ms is None
        assert summary.max_time_ms is None


class TestOperationMetricsState:
    """Tests for OperationMetricsState singleton"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_singleton_returns_same_instance(self) -> None:
        metrics1 = OperationMetricsState()
        metrics2 = OperationMetricsState()
        assert metrics1 is metrics2

    def test_record_operation_basic(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.5)

        metrics.merge_all_threads()
        summary = metrics.get_summary()

        assert "db_queries" in summary
        assert "SELECT" in summary["db_queries"]
        assert "_default" in summary["db_queries"]["SELECT"]

    def test_record_operation_with_entity_type(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.5, "Table")
        metrics.record_operation("db_queries", "SELECT", 5.5, "Table")

        summary = metrics.get_summary()

        assert summary["db_queries"]["SELECT"]["Table"]["count"] == 2
        assert summary["db_queries"]["SELECT"]["Table"]["totalTimeMs"] == 16.0
        assert summary["db_queries"]["SELECT"]["Table"]["avgTimeMs"] == 8.0

    def test_record_operation_multiple_categories(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.0)
        metrics.record_operation("api_calls", "GET:/dashboards", 50.0)
        metrics.record_operation("entity_operations", "yield_table", 5.0)

        summary = metrics.get_summary()

        assert "db_queries" in summary
        assert "api_calls" in summary
        assert "entity_operations" in summary

    def test_summary_statistics(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.0, "Table")
        metrics.record_operation("db_queries", "SELECT", 20.0, "Table")
        metrics.record_operation("db_queries", "SELECT", 30.0, "Table")

        summary = metrics.get_summary()
        table_stats = summary["db_queries"]["SELECT"]["Table"]

        assert table_stats["count"] == 3
        assert table_stats["totalTimeMs"] == 60.0
        assert table_stats["avgTimeMs"] == 20.0
        assert table_stats["minTimeMs"] == 10.0
        assert table_stats["maxTimeMs"] == 30.0

    def test_get_flat_summary(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.0)
        metrics.record_operation("db_queries", "INSERT", 20.0)
        metrics.record_operation("api_calls", "GET", 50.0)

        flat = metrics.get_flat_summary()

        assert flat["db_queries_count"] == 2
        assert flat["db_queries_total_ms"] == 30.0
        assert flat["api_calls_count"] == 1
        assert flat["api_calls_total_ms"] == 50.0

    def test_reset_clears_all_metrics(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.0)

        metrics.reset()

        summary = metrics.get_summary()
        assert len(summary) == 0

    def test_merge_thread_metrics(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("db_queries", "SELECT", 10.0)

        current_thread_id = threading.get_ident()
        metrics.merge_thread_metrics(current_thread_id)

        summary = metrics.get_summary()
        assert summary["db_queries"]["SELECT"]["_default"]["count"] == 1

    def test_merge_all_threads(self) -> None:
        metrics = OperationMetricsState()
        results = []

        def record_in_thread(category, operation, duration):
            metrics.record_operation(category, operation, duration)

        threads = []
        for i in range(5):
            t = threading.Thread(
                target=record_in_thread, args=("db_queries", "SELECT", float(i + 1))
            )
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        metrics.merge_all_threads()
        summary = metrics.get_summary()

        assert summary["db_queries"]["SELECT"]["_default"]["count"] == 5
        assert summary["db_queries"]["SELECT"]["_default"]["totalTimeMs"] == 15.0

    def test_thread_isolation_before_merge(self) -> None:
        metrics = OperationMetricsState()
        barrier = threading.Barrier(2)
        results = {"thread1_count": 0, "thread2_count": 0}

        def thread1_work():
            metrics.record_operation("db_queries", "SELECT", 10.0)
            barrier.wait()  # Wait for both threads to record
            metrics.merge_thread_metrics()

        def thread2_work():
            metrics.record_operation("db_queries", "SELECT", 20.0)
            barrier.wait()  # Wait for both threads to record
            metrics.merge_thread_metrics()

        t1 = threading.Thread(target=thread1_work)
        t2 = threading.Thread(target=thread2_work)

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        summary = metrics.get_summary()
        assert summary["db_queries"]["SELECT"]["_default"]["count"] == 2


class TestTrackOperationDecorator:
    """Tests for the @track_operation decorator"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_decorator_records_operation(self) -> None:
        @track_operation(category="db_queries", operation="SELECT", entity_type="Table")
        def fetch_data():
            time.sleep(0.01)
            return "data"

        result = fetch_data()

        assert result == "data"
        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["db_queries"]["SELECT"]["Table"]["count"] == 1
        assert (
            summary["db_queries"]["SELECT"]["Table"]["avgTimeMs"] >= 10
        )  # At least 10ms

    def test_decorator_uses_function_name_when_no_operation(self) -> None:
        @track_operation(category="entity_operations")
        def yield_tables():
            return ["table1", "table2"]

        result = yield_tables()

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert "yield_tables" in summary["entity_operations"]

    def test_decorator_records_even_on_exception(self) -> None:
        @track_operation(category="db_queries", operation="SELECT")
        def failing_query():
            raise ValueError("Query failed")

        with pytest.raises(ValueError):
            failing_query()

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["db_queries"]["SELECT"]["_default"]["count"] == 1


class TestTrackOperationContextManager:
    """Tests for the TrackOperation context manager class"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_context_manager_records_operation(self) -> None:
        with TrackOperation("api_calls", "GET:/users", "User"):
            time.sleep(0.01)

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["api_calls"]["GET:/users"]["User"]["count"] == 1
        assert summary["api_calls"]["GET:/users"]["User"]["avgTimeMs"] >= 10

    def test_context_manager_without_entity_type(self) -> None:
        with TrackOperation("api_calls", "POST:/data"):
            pass

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["api_calls"]["POST:/data"]["_default"]["count"] == 1

    def test_context_manager_records_on_exception(self) -> None:
        with pytest.raises(RuntimeError):
            with TrackOperation("api_calls", "GET:/error"):
                raise RuntimeError("API Error")

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["api_calls"]["GET:/error"]["_default"]["count"] == 1


class TestTrackOperationContextFunction:
    """Tests for the track_operation_context generator-based context manager"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_context_function_records_operation(self) -> None:
        with track_operation_context("entity_operations", "yield_column", "Column"):
            time.sleep(0.01)

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["entity_operations"]["yield_column"]["Column"]["count"] == 1

    def test_context_function_records_on_exception(self) -> None:
        with pytest.raises(ValueError):
            with track_operation_context("entity_operations", "yield_table"):
                raise ValueError("Processing failed")

        metrics = OperationMetricsState()
        summary = metrics.get_summary()
        assert summary["entity_operations"]["yield_table"]["_default"]["count"] == 1


class TestMultiThreadedOperations:
    """Integration tests for multithreaded operation metrics"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_high_concurrency_accuracy(self) -> None:
        metrics = OperationMetricsState()
        num_threads = 10
        ops_per_thread = 100

        def record_operations():
            for i in range(ops_per_thread):
                metrics.record_operation("db_queries", "SELECT", float(i))
            metrics.merge_thread_metrics()

        threads = [
            threading.Thread(target=record_operations) for _ in range(num_threads)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        summary = metrics.get_summary()
        total_ops = summary["db_queries"]["SELECT"]["_default"]["count"]
        assert total_ops == num_threads * ops_per_thread

    def test_multiple_operations_per_thread(self) -> None:
        metrics = OperationMetricsState()

        def process_entities():
            for entity_type in ["Database", "Schema", "Table"]:
                for _ in range(10):
                    metrics.record_operation(
                        "entity_operations", "yield_entity", 1.0, entity_type
                    )
            metrics.merge_thread_metrics()

        threads = [threading.Thread(target=process_entities) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        summary = metrics.get_summary()
        for entity_type in ["Database", "Schema", "Table"]:
            assert (
                summary["entity_operations"]["yield_entity"][entity_type]["count"] == 50
            )


class TestWorkflowTiming:
    """Tests for workflow-level source vs stage timing"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_get_workflow_timing_empty(self) -> None:
        metrics = OperationMetricsState()
        timing = metrics.get_workflow_timing()

        assert timing["source"]["total_ms"] == 0.0
        assert timing["source"]["call_count"] == 0
        assert timing["stage"]["total_ms"] == 0.0
        assert timing["stage"]["call_count"] == 0

    def test_get_workflow_timing_source_only(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("source_fetch", "yield_table", 100.0, "Table")
        metrics.record_operation("source_fetch", "yield_table", 150.0, "Table")
        metrics.record_operation("source_fetch", "yield_database", 50.0, "Database")

        timing = metrics.get_workflow_timing()

        assert timing["source"]["total_ms"] == 300.0
        assert timing["source"]["call_count"] == 3
        assert timing["source"]["by_entity_type"]["Table"]["total_ms"] == 250.0
        assert timing["source"]["by_entity_type"]["Table"]["call_count"] == 2
        assert timing["source"]["by_entity_type"]["Database"]["total_ms"] == 50.0
        assert timing["stage"]["total_ms"] == 0.0

    def test_get_workflow_timing_stage_only(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("stage_process", "yield_table", 200.0, "Table")
        metrics.record_operation("stage_process", "yield_schema", 100.0, "Schema")

        timing = metrics.get_workflow_timing()

        assert timing["source"]["total_ms"] == 0.0
        assert timing["stage"]["total_ms"] == 300.0
        assert timing["stage"]["call_count"] == 2
        assert timing["stage"]["by_entity_type"]["Table"]["total_ms"] == 200.0
        assert timing["stage"]["by_entity_type"]["Schema"]["total_ms"] == 100.0

    def test_get_workflow_timing_both_source_and_stage(self) -> None:
        metrics = OperationMetricsState()

        # Simulate source fetch time
        metrics.record_operation("source_fetch", "yield_database", 500.0, "Database")
        metrics.record_operation("source_fetch", "yield_table", 1000.0, "Table")

        # Simulate stage processing time
        metrics.record_operation("stage_process", "yield_database", 100.0, "Database")
        metrics.record_operation("stage_process", "yield_table", 200.0, "Table")

        timing = metrics.get_workflow_timing()

        # Verify source timing
        assert timing["source"]["total_ms"] == 1500.0
        assert timing["source"]["call_count"] == 2

        # Verify stage timing
        assert timing["stage"]["total_ms"] == 300.0
        assert timing["stage"]["call_count"] == 2

        # Verify source time > stage time (typical for API-based connectors)
        assert timing["source"]["total_ms"] > timing["stage"]["total_ms"]

    def test_get_workflow_timing_multithreaded(self) -> None:
        metrics = OperationMetricsState()

        def simulate_worker():
            metrics.record_operation("source_fetch", "yield_table", 100.0, "Table")
            metrics.record_operation("stage_process", "yield_table", 50.0, "Table")
            metrics.merge_thread_metrics()

        threads = [threading.Thread(target=simulate_worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        timing = metrics.get_workflow_timing()

        assert timing["source"]["total_ms"] == 500.0
        assert timing["source"]["call_count"] == 5
        assert timing["stage"]["total_ms"] == 250.0
        assert timing["stage"]["call_count"] == 5

    def test_get_workflow_timing_ignores_other_categories(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("source_fetch", "yield_table", 100.0, "Table")
        metrics.record_operation("stage_process", "yield_table", 50.0, "Table")
        metrics.record_operation("db_queries", "SELECT", 1000.0, "Table")
        metrics.record_operation("api_calls", "GET:/users", 500.0)

        timing = metrics.get_workflow_timing()

        # Only source_fetch and stage_process should be included in source/stage
        assert timing["source"]["total_ms"] == 100.0
        assert timing["stage"]["total_ms"] == 50.0

    def test_get_workflow_timing_with_source_queries_and_api(self) -> None:
        metrics = OperationMetricsState()
        metrics.record_operation("source_fetch", "yield_table", 100.0, "Table")
        metrics.record_operation("source_db_queries", "SELECT", 50.0, "Table")
        metrics.record_operation("source_db_queries", "DESCRIBE", 30.0, "Table")
        metrics.record_operation(
            "source_api_calls", "GET:/dashboards", 80.0, "Dashboard"
        )

        timing = metrics.get_workflow_timing()

        assert timing["source"]["total_ms"] == 100.0
        assert timing["source_db_queries"]["total_ms"] == 80.0
        assert timing["source_db_queries"]["call_count"] == 2
        assert timing["source_db_queries"]["by_operation"]["SELECT"]["total_ms"] == 50.0
        assert timing["source_api_calls"]["total_ms"] == 80.0
        assert timing["source_api_calls"]["call_count"] == 1
        assert (
            timing["source_api_calls"]["by_operation"]["GET:/dashboards"]["total_ms"]
            == 80.0
        )


class TestRunContext:
    """Tests for run context management"""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton state before each test"""
        Singleton.clear_all()
        yield
        Singleton.clear_all()

    def test_set_run_context(self) -> None:
        metrics = OperationMetricsState()
        metrics.set_run_context(run_id="test-run-123", pipeline_fqn="service.pipeline")

        context = metrics.get_run_context()
        assert context["run_id"] == "test-run-123"
        assert context["pipeline_fqn"] == "service.pipeline"

    def test_set_run_context_resets_metrics_on_new_run(self) -> None:
        metrics = OperationMetricsState()
        metrics.set_run_context(run_id="run-1")
        metrics.record_operation("db_queries", "SELECT", 10.0)

        # Setting a new run_id should clear old metrics
        metrics.set_run_context(run_id="run-2")

        summary = metrics.get_summary()
        assert len(summary) == 0

    def test_set_run_context_preserves_metrics_on_same_run(self) -> None:
        metrics = OperationMetricsState()
        metrics.set_run_context(run_id="run-1")
        metrics.record_operation("db_queries", "SELECT", 10.0)

        # Setting the same run_id should preserve metrics
        metrics.set_run_context(run_id="run-1")

        summary = metrics.get_summary()
        assert "db_queries" in summary
        assert summary["db_queries"]["SELECT"]["_default"]["count"] == 1

    def test_reset_clears_run_context(self) -> None:
        metrics = OperationMetricsState()
        metrics.set_run_context(run_id="test-run", pipeline_fqn="service.pipeline")
        metrics.reset()

        context = metrics.get_run_context()
        assert context["run_id"] is None
        assert context["pipeline_fqn"] is None

    def test_get_run_context_default_values(self) -> None:
        metrics = OperationMetricsState()
        context = metrics.get_run_context()
        assert context["run_id"] is None
        assert context["pipeline_fqn"] is None
