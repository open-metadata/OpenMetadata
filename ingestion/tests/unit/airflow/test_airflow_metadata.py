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
Test Airflow metadata source for compatibility between Airflow SDK v3.x
and Airflow 2.x/3.x databases.

The Airflow SDK is always v3.x (which has DagRun.logical_date), but we may
connect to Airflow 2.x databases (which have execution_date column).
"""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, PropertyMock, patch
from uuid import uuid4

import pytest

try:
    from airflow.models import DagRun
except ImportError:
    pytest.skip("Airflow dependencies not installed", allow_module_level=True)


class TestExecutionDateColumnDetection:
    """Test the execution_date_column property for detecting database schema."""

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_detects_logical_date_column(self, mock_init, mock_session):
        """When database has logical_date column, it should be detected."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_inspector = MagicMock()
        mock_inspector.get_columns.return_value = [
            {"name": "dag_id"},
            {"name": "run_id"},
            {"name": "logical_date"},
            {"name": "start_date"},
            {"name": "state"},
        ]

        mock_bind = MagicMock()
        mock_session.return_value.bind = mock_bind

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.inspect",
            return_value=mock_inspector,
        ):
            result = source.execution_date_column

        assert result == "logical_date"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_detects_execution_date_column(self, mock_init, mock_session):
        """When database has execution_date column (Airflow 2.x), it should be detected."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_inspector = MagicMock()
        mock_inspector.get_columns.return_value = [
            {"name": "dag_id"},
            {"name": "run_id"},
            {"name": "execution_date"},
            {"name": "start_date"},
            {"name": "state"},
        ]

        mock_bind = MagicMock()
        mock_session.return_value.bind = mock_bind

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.inspect",
            return_value=mock_inspector,
        ):
            result = source.execution_date_column

        assert result == "execution_date"

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_caches_column_detection(self, mock_init, mock_session):
        """Column detection should be cached after first call."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = "logical_date"

        result = source.execution_date_column

        assert result == "logical_date"
        mock_session.assert_not_called()

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_fallback_on_inspection_error(self, mock_init, mock_session):
        """On inspection error, should fallback to execution_date."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_bind = MagicMock()
        mock_session.return_value.bind = mock_bind

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.inspect",
            side_effect=Exception("Inspection failed"),
        ):
            result = source.execution_date_column

        assert result == "execution_date"


class TestGetPipelineStatus:
    """Test get_pipeline_status method for cross-version compatibility."""

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.execution_date_column",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_handles_query_exception(self, mock_init, mock_exec_col, mock_session):
        """When query fails, should return empty list and log warning."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_exec_col.return_value = "logical_date"

        mock_config = MagicMock()
        mock_config.serviceConnection.root.config.numberOfStatus = 10
        source.config = mock_config

        mock_session.return_value.query.side_effect = Exception("Database error")

        dag_runs = source.get_pipeline_status("test_dag")

        assert dag_runs == []

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.session",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.execution_date_column",
        new_callable=PropertyMock,
    )
    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_returns_empty_list_for_no_results(self, mock_init, mock_exec_col, mock_session):
        """When no dag runs found, should return empty list."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source._execution_date_column = None

        mock_exec_col.return_value = "logical_date"

        mock_config = MagicMock()
        mock_config.serviceConnection.root.config.numberOfStatus = 10
        source.config = mock_config

        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_session.return_value.query.return_value = mock_query

        dag_runs = source.get_pipeline_status("test_dag")

        assert dag_runs == []


class TestDagRunLogicalDateUsage:
    """Test that DagRun model has expected attributes for SDK v3.x."""

    def test_dagrun_has_logical_date_attribute(self):
        """Verify DagRun model has logical_date attribute (Airflow SDK 3.x)."""
        assert hasattr(DagRun, "logical_date"), "DagRun should have logical_date attribute in Airflow SDK 3.x"

    def test_dagrun_does_not_have_execution_date_attribute(self):
        """Verify DagRun model does NOT have execution_date attribute (Airflow SDK 3.x).

        This is the core issue - SDK 3.x removed execution_date from the ORM model,
        so code must use column() to reference the database column directly.
        """
        assert not hasattr(DagRun, "execution_date"), (
            "DagRun should NOT have execution_date attribute in Airflow SDK 3.x. "
            "The code uses column() to reference the database column directly."
        )


class TestBuildObservabilityFromDagRun:
    """Test _build_observability_from_dag_run uses logical_date."""

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_uses_logical_date_from_dag_run(self, mock_init):
        """Observability should be built using dag_run.logical_date."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)

        test_date = datetime(2024, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        start_date = datetime(2024, 1, 15, 10, 25, 0, tzinfo=timezone.utc)

        mock_dag_run = MagicMock()
        mock_dag_run.logical_date = test_date
        mock_dag_run.start_date = start_date
        mock_dag_run.state = "success"

        pipeline_uuid = uuid4()
        mock_pipeline_entity = MagicMock()
        mock_pipeline_entity.id.root = pipeline_uuid
        mock_pipeline_entity.fullyQualifiedName.root = "service.pipeline_name"

        observability = source._build_observability_from_dag_run(
            dag_run=mock_dag_run,
            pipeline_entity=mock_pipeline_entity,
            schedule_interval="@daily",
        )

        assert observability.scheduleInterval == "@daily"
        assert observability.lastRunStatus.value == "Successful"


class TestTaskDetailAccess:
    """Test _test_task_detail_access across Airflow versions."""

    def _make_session(self, first_return_value):
        mock_session = MagicMock()
        mock_session.query.return_value.first.return_value = first_return_value
        return mock_session

    def test_compressed_dag_falls_back_to_dag_id_query(self):
        """Data column is NULL (COMPRESS_SERIALIZED_DAGS enabled); must fall back to dag_id query."""
        from metadata.ingestion.source.pipeline.airflow.connection import (
            _test_task_detail_access,
        )

        dag_id_row = ("my_dag",)
        mock_session = MagicMock()
        mock_session.query.return_value.first.side_effect = [(None,), dag_id_row]

        result = _test_task_detail_access(mock_session)

        assert result == dag_id_row

    def test_airflow2_returns_tasks_when_data_is_valid(self):
        """Uncompressed DAG: extracts and returns the task list from serialized DAG data."""
        from metadata.ingestion.source.pipeline.airflow.connection import (
            _test_task_detail_access,
        )

        tasks_payload = [{"task_id": "task_1"}, {"task_id": "task_2"}]
        row = ({"dag": {"tasks": tasks_payload}},)
        session = self._make_session(first_return_value=row)

        result = _test_task_detail_access(session)

        assert result == tasks_payload

    def test_airflow2_returns_none_when_table_empty(self):
        """Empty serialized_dag table returns None without raising."""
        from metadata.ingestion.source.pipeline.airflow.connection import (
            _test_task_detail_access,
        )

        session = self._make_session(first_return_value=None)

        result = _test_task_detail_access(session)

        assert result is None


class TestYieldPipelineStatus:
    """Test yield_pipeline_status fallback logic for missing dates."""

    def _make_source(self):
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        return AirflowSource.__new__(AirflowSource)

    def _make_dag_run(self, logical_date, start_date):
        # A SimpleNamespace carries exactly the attributes yield_pipeline_status
        # reads. MagicMock(spec=DagRun) would force SQLAlchemy to configure the
        # whole shared mapper registry (via DagRun's association proxies) just to
        # build the mock; if any unrelated test on the same xdist worker has left
        # a mapper in a failed state, that configuration raises and this test
        # fails for reasons that have nothing to do with what it verifies.
        return SimpleNamespace(
            run_id="manual__2024-01-01",
            dag_id="test_dag",
            state="success",
            logical_date=logical_date,
            start_date=start_date,
        )

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_uses_start_date_when_logical_date_is_none(self, mock_init):
        """When logical_date is None but start_date is present, a status is yielded."""
        source = self._make_source()

        start_date = datetime(2024, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        dag_run = self._make_dag_run(logical_date=None, start_date=start_date)

        mock_context = MagicMock()
        mock_context.task_names = ["task1"]
        mock_context.pipeline_service = "test_service"
        mock_context.pipeline = "test_pipeline"
        source.context = MagicMock()
        source.context.get.return_value = mock_context

        source.get_pipeline_status = MagicMock(return_value=[dag_run])
        source.get_task_instances = MagicMock(return_value={})
        source.metadata = MagicMock()

        mock_pipeline_details = MagicMock()
        mock_pipeline_details.dag_id = "test_dag"
        mock_pipeline_details.tasks = []

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.fqn.build",
            return_value="test_service.test_pipeline",
        ):
            results = list(source.yield_pipeline_status(mock_pipeline_details))

        assert len(results) == 1
        assert results[0].right is not None
        assert results[0].right.pipeline_status.timestamp is not None

    @patch(
        "metadata.ingestion.source.pipeline.airflow.metadata.AirflowSource.__init__",
        return_value=None,
    )
    def test_skips_run_when_both_dates_are_none(self, mock_init):
        """When both logical_date and start_date are None, the run is skipped without raising."""
        source = self._make_source()
        dag_run = self._make_dag_run(logical_date=None, start_date=None)

        mock_context = MagicMock()
        mock_context.task_names = ["task1"]
        source.context = MagicMock()
        source.context.get.return_value = mock_context

        source.get_pipeline_status = MagicMock(return_value=[dag_run])
        source.get_task_instances = MagicMock(return_value={})
        source.metadata = MagicMock()

        mock_pipeline_details = MagicMock()
        mock_pipeline_details.dag_id = "test_dag"
        mock_pipeline_details.tasks = []

        results = list(source.yield_pipeline_status(mock_pipeline_details))

        assert results == []


class TestColumnFunctionUsage:
    """Test that the code uses sqlalchemy column() for database queries."""

    def test_column_import_exists(self):
        """Verify column is imported from sqlalchemy in the metadata module."""
        from metadata.ingestion.source.pipeline.airflow import metadata

        assert hasattr(metadata, "column"), "The metadata module should import column from sqlalchemy"

    def test_get_pipeline_status_uses_column_function(self):
        """Verify get_pipeline_status method exists and can handle both column names."""
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        assert hasattr(AirflowSource, "get_pipeline_status")
        assert hasattr(AirflowSource, "execution_date_column")


class TestPipelineObservabilityScope:
    """
    Observability is stored server-side under table.pipelineObservability.<pipelineFqn>,
    one row per (table, pipeline). These tests pin the emission down to that shape:
    replaying earlier DAGs or older runs only rewrites rows that are already correct,
    and at 500+ DAGs that replay is what turns a run into a multi-day job.
    """

    @staticmethod
    def _source_with_context(pipeline_entity, table_fqns, latest_dag_run):
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)

        ctx = SimpleNamespace(
            current_pipeline_entity=pipeline_entity,
            current_table_fqns=table_fqns,
            latest_dag_run=latest_dag_run,
        )
        source.context = MagicMock()
        source.context.get.return_value = ctx
        return source

    @staticmethod
    def _dag_run(run_id, logical_date, state="success"):
        dag_run = MagicMock()
        dag_run.run_id = run_id
        dag_run.logical_date = logical_date
        dag_run.start_date = logical_date
        dag_run.state = state
        return dag_run

    @staticmethod
    def _pipeline_entity(fqn="service.dag_a"):
        entity = MagicMock()
        entity.id.root = uuid4()
        entity.fullyQualifiedName.root = fqn
        return entity

    @staticmethod
    def _dag_details(dag_id, schedule_interval="@daily"):
        return SimpleNamespace(dag_id=dag_id, schedule_interval=schedule_interval)

    def test_emits_only_the_current_dag_tables(self):
        """
        A record written while processing DAG A stays valid, so DAG B must not
        re-emit A's tables. Re-emitting them is what made this stage
        O(dags x cumulative tables).
        """
        run = self._dag_run("run_a", datetime(2024, 1, 15, tzinfo=timezone.utc))
        source = self._source_with_context(self._pipeline_entity("service.dag_a"), ["svc.db.sch.table_a"], run)

        first = list(source.get_table_pipeline_observability(self._dag_details("dag_a")))
        assert set(first[0]) == {"svc.db.sch.table_a"}

        # The next DAG overwrites the context, as yield_pipeline_lineage_details does.
        ctx = source.context.get.return_value
        ctx.current_pipeline_entity = self._pipeline_entity("service.dag_b")
        ctx.current_table_fqns = ["svc.db.sch.table_b"]

        second = list(source.get_table_pipeline_observability(self._dag_details("dag_b")))

        assert set(second[0]) == {"svc.db.sch.table_b"}
        assert "svc.db.sch.table_a" not in second[0]

    def test_emits_single_record_built_from_the_newest_run(self):
        """
        get_pipeline_status returns runs newest-first and the server keys the row on
        the pipeline FQN, so every run of a DAG upserts the same row and the last one
        written wins. Emitting all N runs therefore persisted the *oldest* of them.
        """
        newest = self._dag_run("run_new", datetime(2024, 3, 1, tzinfo=timezone.utc), state="success")
        source = self._source_with_context(self._pipeline_entity(), ["svc.db.sch.table_a"], newest)

        result = list(source.get_table_pipeline_observability(self._dag_details("dag_a")))

        observability_list = result[0]["svc.db.sch.table_a"]
        assert len(observability_list) == 1
        assert observability_list[0].lastRunStatus.value == "Successful"
        assert observability_list[0].lastRunTime.root == int(newest.logical_date.timestamp() * 1000)

    @pytest.mark.parametrize(
        "pipeline_entity,table_fqns,latest_dag_run",
        [
            (None, ["svc.db.sch.table_a"], "run"),
            ("entity", [], "run"),
            ("entity", ["svc.db.sch.table_a"], None),
        ],
    )
    def test_emits_nothing_when_lineage_context_is_incomplete(self, pipeline_entity, table_fqns, latest_dag_run):
        """
        yield_pipeline_lineage_details resets this context before its early return, so
        a DAG whose pipeline entity is missing must emit nothing rather than inherit
        the previous sibling DAG's tables.
        """
        run = self._dag_run("run_a", datetime(2024, 1, 15, tzinfo=timezone.utc)) if latest_dag_run else None
        entity = self._pipeline_entity() if pipeline_entity else None
        source = self._source_with_context(entity, table_fqns, run)

        result = list(source.get_table_pipeline_observability(self._dag_details("dag_a")))

        assert result == []


class TestLineageObservabilityContext:
    """
    yield_pipeline_lineage_details is what populates the context the observability
    stage reads. These tests pin down the two properties that stage depends on.
    """

    @staticmethod
    def _source(dag_runs, pipeline_entity, table_entity):
        from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource

        source = AirflowSource.__new__(AirflowSource)
        source.metadata = MagicMock()
        source._table_entity_cache = {}
        source.cache_table_entity = MagicMock()

        def get_by_name(entity, fqn, **_):
            from metadata.generated.schema.entity.data.pipeline import Pipeline

            return pipeline_entity if entity is Pipeline else table_entity

        source.metadata.get_by_name.side_effect = get_by_name
        source.get_pipeline_status = MagicMock(return_value=dag_runs)

        ctx = SimpleNamespace(pipeline_service="service", pipeline="dag_a")
        source.context = MagicMock()
        source.context.get.return_value = ctx
        return source, ctx

    @staticmethod
    def _dag_run(run_id, logical_date):
        dag_run = MagicMock()
        dag_run.run_id = run_id
        dag_run.logical_date = logical_date
        dag_run.start_date = logical_date
        dag_run.state = "success"
        return dag_run

    def test_stores_the_newest_run_for_observability(self):
        """
        get_pipeline_status orders runs newest-first. The server upserts observability
        on the pipeline FQN, so whichever run is emitted last is the one persisted --
        it has to be dag_runs[0], not the tail of the numberOfStatus window.
        """
        newest = self._dag_run("newest", datetime(2024, 3, 3, tzinfo=timezone.utc))
        middle = self._dag_run("middle", datetime(2024, 2, 2, tzinfo=timezone.utc))
        oldest = self._dag_run("oldest", datetime(2024, 1, 1, tzinfo=timezone.utc))

        pipeline_entity = MagicMock()
        pipeline_entity.id.root = uuid4()
        pipeline_entity.fullyQualifiedName.root = "service.dag_a"

        source, ctx = self._source([newest, middle, oldest], pipeline_entity, None)

        with (
            patch("metadata.ingestion.source.pipeline.airflow.metadata.fqn.build", return_value="service.dag_a"),
            patch("metadata.ingestion.source.pipeline.airflow.metadata.get_xlets_from_dag", return_value=[]),
        ):
            list(source.yield_pipeline_lineage_details(SimpleNamespace(dag_id="dag_a", schedule_interval="@daily")))

        assert ctx.latest_dag_run is newest
        assert ctx.latest_dag_run is not oldest

    def test_resets_observability_context_when_the_pipeline_is_missing(self):
        """
        The topology context is shared across sibling DAGs. A DAG whose pipeline entity
        cannot be resolved returns early, so it must clear the previous DAG's entity and
        tables first or its observability is written under the wrong pipeline.
        """
        source, ctx = self._source([], None, None)
        ctx.current_pipeline_entity = "stale entity from the previous dag"
        ctx.current_table_fqns = ["svc.db.sch.previous_table"]
        ctx.latest_dag_run = "stale run"

        with patch(
            "metadata.ingestion.source.pipeline.airflow.metadata.fqn.build",
            return_value="service.dag_a",
        ):
            list(source.yield_pipeline_lineage_details(SimpleNamespace(dag_id="dag_a", schedule_interval="@daily")))

        assert ctx.current_pipeline_entity is None
        assert ctx.current_table_fqns == []
        assert ctx.latest_dag_run is None

    def test_hands_resolved_table_entities_to_the_observability_stage(self):
        """
        Lineage already fetched every table entity. Passing them on is what keeps the
        observability stage from issuing a second get_by_name per table, per DAG.
        """
        from metadata.generated.schema.entity.data.table import Table
        from metadata.ingestion.source.pipeline.airflow.lineage_parser import (
            OMEntity,
            XLets,
        )

        pipeline_entity = MagicMock()
        pipeline_entity.id.root = uuid4()
        pipeline_entity.fullyQualifiedName.root = "service.dag_a"

        table_entity = MagicMock()
        table_entity.id = uuid4()

        source, ctx = self._source(
            [self._dag_run("newest", datetime(2024, 3, 3, tzinfo=timezone.utc))],
            pipeline_entity,
            table_entity,
        )

        xlets = [
            XLets(
                inlets=[OMEntity(entity=Table, fqn="svc.db.sch.in_table")],
                outlets=[OMEntity(entity=Table, fqn="svc.db.sch.out_table")],
            )
        ]

        with (
            patch("metadata.ingestion.source.pipeline.airflow.metadata.fqn.build", return_value="service.dag_a"),
            patch(
                "metadata.ingestion.source.pipeline.airflow.metadata.get_xlets_from_dag",
                return_value=xlets,
            ),
        ):
            list(source.yield_pipeline_lineage_details(SimpleNamespace(dag_id="dag_a", schedule_interval="@daily")))

        assert set(ctx.current_table_fqns) == {"svc.db.sch.in_table", "svc.db.sch.out_table"}
        assert source.cache_table_entity.call_count == 2
