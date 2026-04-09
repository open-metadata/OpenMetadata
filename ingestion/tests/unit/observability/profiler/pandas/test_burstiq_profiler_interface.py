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
Tests for BurstIQProfilerInterface — covers get_columns, _type_casted_dataset,
and the full get_all_metrics profiler flow.
"""
import math
from contextlib import contextmanager
from unittest.mock import Mock, patch
from uuid import uuid4

import pandas as pd
import pytest

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.burstIQConnection import (
    BurstIQConnection,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.api.models import ThreadPoolMetrics
from metadata.profiler.interface.pandas.burstiq.profiler_interface import (
    BurstIQProfilerInterface,
)
from metadata.profiler.metrics.core import MetricTypes, QueryMetric, StaticMetric
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.default import get_default_metrics
from metadata.utils.sqa_like_column import SQALikeColumn

# ── Fake connection stubs (mirrors the pattern in test_profiler_interface.py) ─


class FakeClient:
    def __init__(self):
        self._client = None


class FakeConnection:
    def __init__(self):
        self.client = FakeClient()


# ── Shared connection config ──────────────────────────────────────────────────

BURSTIQ_CONNECTION = BurstIQConnection(
    username="u",
    password="p",
    realmName="realm",
    biqSdzName="sdz",
    biqCustomerName="cust",
)

# ── OM Table entity: 6 declared columns; DataFrames carry only 4 ─────────────
# "tags" (ARRAY) and "meta" (JSON) are intentionally absent from the DataFrames
# to exercise the "fewer columns than OM declares" code path.

FULL_TABLE_ENTITY = Table(
    id=uuid4(),
    name="TestChain",
    databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="schema"),
    columns=[
        EntityColumn(name=ColumnName("score"), dataType=DataType.DOUBLE),
        EntityColumn(name=ColumnName("name"), dataType=DataType.STRING),
        EntityColumn(name=ColumnName("created_at"), dataType=DataType.DATETIME),
        EntityColumn(name=ColumnName("count"), dataType=DataType.INT),
        EntityColumn(name=ColumnName("tags"), dataType=DataType.ARRAY),
        EntityColumn(name=ColumnName("meta"), dataType=DataType.JSON),
    ],
)

# ── Normal DataFrame: 4 of 6 OM columns; created_at is UTC-aware ─────────────
DF_NORMAL = pd.DataFrame(
    {
        "score": [1.5, 2.5, 3.5, None, 4.5],
        "name": ["Alice", "Bob", None, "Dave", "Eve"],
        "created_at": pd.to_datetime(
            ["2024-01-01", "2024-02-01", "2024-03-01", "2024-04-01", "2024-05-01"],
            utc=True,
        ),
        "count": [10, 20, 30, 40, 50],
    }
)

# ── Scientific-notation DataFrame: numeric values encoded as strings ──────────
DF_SCIENTIFIC = pd.DataFrame(
    {
        "score": ["9.87E+08", "1.23E+06", "4.56E+03", None, "7.89E+09"],
        "name": ["Alice", None, "Carol", "Dave", "Eve"],
        "count": ["100", "200", "300", "400", "500"],
    }
)


# ── Interface factory (context manager) ──────────────────────────────────────


@contextmanager
def _make_interface(df_factory, table_entity=FULL_TABLE_ENTITY):
    """
    Build a BurstIQProfilerInterface with a controlled DataFrame source.

    df_factory must be a zero-argument callable that returns a fresh iterator
    of DataFrames each time it is called (e.g. ``lambda: iter([df.copy()])``).

    PandasProfilerInterface.__init__ calls ``self.sampler.get_dataset()`` once
    and stores the result as the dataset callable.  Setting
    ``sampler.get_dataset.return_value = df_factory`` means the call returns
    the lambda itself, which is then passed into ``_type_casted_dataset``.
    """
    sampler = Mock()
    sampler.client = Mock()
    sampler.get_dataset.return_value = df_factory
    sampler.raw_dataset = df_factory

    with patch(
        "metadata.profiler.interface.profiler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    ), patch(
        "metadata.sampler.sampler_interface.get_ssl_connection",
        return_value=FakeConnection(),
    ):
        interface = BurstIQProfilerInterface(
            service_connection_config=BURSTIQ_CONNECTION,
            ometa_client=None,
            entity=table_entity,
            source_config=None,
            sampler=sampler,
        )
        yield interface


# ── Casting helper ────────────────────────────────────────────────────────────


def _get_cast_df(interface, input_df):
    """Pass a single DataFrame through the BurstIQ casting pipeline."""
    dataset = lambda: iter([input_df.copy()])
    cast_gen = interface._type_casted_dataset(dataset)
    return next(cast_gen())


# ── Integration metric builder ────────────────────────────────────────────────


def _build_all_threadpool_metrics(interface, table_entity):
    """
    Build the full list of ThreadPoolMetrics (table + per-column) from the
    interface's own get_columns() list, mirroring how the real Profiler works.

    column_count.df_fn uses ``len(next(dfs()).columns)`` rather than
    SQLAlchemy inspect, so passing the OM Table entity to get_default_metrics
    is safe for pandas profiling.
    """
    metrics = get_default_metrics(Metrics, table_entity)

    static_metrics = [m for m in metrics if issubclass(m, StaticMetric)]
    window_metrics = [
        m for m in metrics if issubclass(m, StaticMetric) and m.is_window_metric()
    ]
    query_metrics = [
        m for m in metrics if issubclass(m, QueryMetric) and m.is_col_metric()
    ]

    table_tpm = ThreadPoolMetrics(
        metrics=[
            m for m in metrics if not m.is_col_metric() and not m.is_system_metrics()
        ],
        metric_type=MetricTypes.Table,
        column=None,
        table=table_entity,
    )

    column_tpms = []
    for col in interface.get_columns():
        column_tpms.append(
            ThreadPoolMetrics(
                metrics=[
                    m
                    for m in static_metrics
                    if m.is_col_metric() and not m.is_window_metric()
                ],
                metric_type=MetricTypes.Static,
                column=col,
                table=table_entity,
            )
        )
        column_tpms.append(
            ThreadPoolMetrics(
                metrics=list(window_metrics),
                metric_type=MetricTypes.Window,
                column=col,
                table=table_entity,
            )
        )
        for qm in query_metrics:
            column_tpms.append(
                ThreadPoolMetrics(
                    metrics=qm,
                    metric_type=MetricTypes.Query,
                    column=col,
                    table=table_entity,
                )
            )

    return [table_tpm, *column_tpms]


# =============================================================================
# 1. TestGetColumns
# =============================================================================


class TestGetColumns:
    """Unit tests for BurstIQProfilerInterface.get_columns()."""

    def test_returns_empty_list_when_dataset_is_none(self):
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            interface.dataset = None
            result = interface.get_columns()
        assert result == []

    def test_returns_empty_list_when_generator_yields_nothing(self):
        df_factory = lambda: iter([])
        with _make_interface(df_factory) as interface:
            result = interface.get_columns()
        assert result == []

    def test_uses_om_declared_type_not_pandas_inferred_type(self):
        """
        Parent class infers dtype from pandas: float64 → DataType.FLOAT and
        datetime64[ns, UTC] → DataType.STRING (not in _data_formats).
        BurstIQ override must return the OM-declared DataType instead.
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            columns = interface.get_columns()

        col_map = {c.name: c.type for c in columns}

        # float64 dtype would infer FLOAT; OM declares DOUBLE
        assert col_map["score"] == DataType.DOUBLE
        # datetime64[ns, UTC] is not in _data_formats → parent returns STRING; OM declares DATETIME
        assert col_map["created_at"] == DataType.DATETIME
        # int64 → INT (same either way, but verifying OM path)
        assert col_map["count"] == DataType.INT

    def test_falls_back_to_fetch_col_types_for_unknown_columns(self):
        """Columns not declared in the OM entity fall back to fetch_col_types()."""
        df_with_extra = DF_NORMAL.copy()
        df_with_extra["extra_col"] = [1, 2, 3, 4, 5]

        df_factory = lambda: iter([df_with_extra])
        with _make_interface(df_factory) as interface:
            columns = interface.get_columns()

        col_map = {c.name: c.type for c in columns}

        # "extra_col" is absent from FULL_TABLE_ENTITY; fetch_col_types maps int64 → INT
        assert "extra_col" in col_map
        assert col_map["extra_col"] == DataType.INT

    def test_only_returns_columns_present_in_df_not_all_om_columns(self):
        """
        DF_NORMAL carries 4 columns; FULL_TABLE_ENTITY declares 6.
        get_columns() must iterate first_df.columns (not self.table.columns),
        so "tags" and "meta" must be absent from the result.
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            columns = interface.get_columns()

        col_names = [c.name for c in columns]

        assert len(col_names) == 4
        assert "tags" not in col_names
        assert "meta" not in col_names
        assert set(col_names) == {"score", "name", "created_at", "count"}

    def test_returned_sqalike_column_has_correct_name_and_type(self):
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            columns = interface.get_columns()

        score_col = next(c for c in columns if c.name == "score")
        assert isinstance(score_col, SQALikeColumn)
        assert score_col.name == "score"
        assert score_col.type == DataType.DOUBLE


# =============================================================================
# 2. TestTypeCastedDataset
# =============================================================================


class TestTypeCastedDataset:
    """Unit tests for BurstIQProfilerInterface._type_casted_dataset()."""

    def test_numeric_cols_cast_via_to_numeric(self):
        """DOUBLE and INT columns in the OM entity must be cast to numeric dtype."""
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            result_df = _get_cast_df(interface, DF_NORMAL)

        assert pd.api.types.is_numeric_dtype(result_df["score"])
        assert pd.api.types.is_numeric_dtype(result_df["count"])

    def test_scientific_notation_strings_become_floats(self):
        """
        BurstIQ returns large numbers as strings like "9.87E+08".
        pd.to_numeric(errors="coerce") must parse them; astype("float64")
        would silently leave them as object dtype.
        """
        df_factory = lambda: iter([DF_SCIENTIFIC.copy()])
        with _make_interface(df_factory) as interface:
            result_df = _get_cast_df(interface, DF_SCIENTIFIC)

        # "9.87E+08" → 987000000.0
        assert abs(result_df["score"].iloc[0] - 987_000_000.0) < 1.0
        # None → NaN (errors="coerce")
        assert math.isnan(result_df["score"].iloc[3])
        # "100" → 100.0
        assert result_df["count"].iloc[0] == 100.0

    def test_datetime_cols_are_not_cast(self):
        """
        Timezone-aware datetime columns (datetime64[ns, UTC]) raise TypeError
        when cast to timezone-naive. BurstIQ override skips them entirely.
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            result_df = _get_cast_df(interface, DF_NORMAL)

        # dtype must still carry tz info — not stripped or coerced
        assert hasattr(result_df["created_at"].dtype, "tz")
        assert str(result_df["created_at"].dtype) == "datetime64[ns, UTC]"

    def test_string_cols_cast_via_astype(self):
        """STRING columns that are not numeric or datetime go through astype()."""
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            result_df = _get_cast_df(interface, DF_NORMAL)

        assert result_df["name"].iloc[0] == "Alice"
        assert result_df["name"].iloc[4] == "Eve"

    def test_json_and_array_excluded_from_other_cast_map(self):
        """
        ARRAY and JSON columns must not be in other_cast_map; attempting to
        astype() a column containing lists or dicts raises ValueError.
        """
        table_with_complex = Table(
            id=uuid4(),
            name="ComplexChain",
            databaseSchema=EntityReference(id=uuid4(), type="databaseSchema", name="s"),
            columns=[
                EntityColumn(name=ColumnName("score"), dataType=DataType.DOUBLE),
                EntityColumn(name=ColumnName("tags"), dataType=DataType.ARRAY),
                EntityColumn(name=ColumnName("meta"), dataType=DataType.JSON),
            ],
        )
        df_complex = pd.DataFrame(
            {
                "score": [1.0, 2.0],
                "tags": [["a", "b"], ["c"]],
                "meta": [{"k": "v"}, {"k": "w"}],
            }
        )
        df_factory = lambda: iter([df_complex.copy()])
        with _make_interface(df_factory, table_entity=table_with_complex) as interface:
            # Must not raise — tags and meta are excluded from astype()
            result_df = _get_cast_df(interface, df_complex)

        assert result_df["tags"].iloc[0] == ["a", "b"]
        assert result_df["meta"].iloc[0] == {"k": "v"}

    def test_missing_numeric_col_in_df_silently_skipped(self):
        """
        "count" is declared INT in OM but absent from the DataFrame.
        The ``if col_name in df.columns`` guard must prevent a KeyError.
        """
        df_missing_count = DF_NORMAL[["score", "name", "created_at"]].copy()
        df_factory = lambda: iter([df_missing_count])
        with _make_interface(df_factory) as interface:
            result_df = _get_cast_df(interface, df_missing_count)

        assert "score" in result_df.columns
        assert "count" not in result_df.columns

    def test_casting_error_caught_and_df_still_yielded(self):
        """
        The outer except-Exception block must catch unexpected errors and still
        yield the (possibly partially cast) DataFrame rather than propagating.
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            with patch(
                "metadata.profiler.interface.pandas.burstiq.profiler_interface._pd.to_numeric",
                side_effect=RuntimeError("unexpected numeric error"),
            ):
                cast_gen = interface._type_casted_dataset(
                    lambda: iter([DF_NORMAL.copy()])
                )
                result_dfs = list(cast_gen())

        assert len(result_dfs) == 1
        assert "score" in result_dfs[0].columns


# =============================================================================
# 3. TestBurstIQProfilerIntegration
# =============================================================================


class TestBurstIQProfilerIntegration:
    """
    End-to-end profiler flow via get_all_metrics().

    Each test creates its own interface so that generator exhaustion in one
    test does not affect the next.
    """

    def test_row_count_is_correct(self):
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            all_metrics = _build_all_threadpool_metrics(interface, FULL_TABLE_ENTITY)
            profile_results = interface.get_all_metrics(all_metrics)

        assert profile_results["table"]["rowCount"] == 5

    def test_scientific_notation_produces_correct_min_max(self):
        """
        When BurstIQ returns numeric data as scientific-notation strings,
        pd.to_numeric must parse them so Min/Max metrics compute correctly.
        DF_SCIENTIFIC["score"] = ["9.87E+08", "1.23E+06", "4.56E+03", None, "7.89E+09"]
        """
        df_factory = lambda: iter([DF_SCIENTIFIC.copy()])
        with _make_interface(df_factory) as interface:
            all_metrics = _build_all_threadpool_metrics(interface, FULL_TABLE_ENTITY)
            profile_results = interface.get_all_metrics(all_metrics)

        score_profile = profile_results["columns"].get("score", {})
        assert score_profile.get("min") == pytest.approx(4560.0, rel=1e-3)
        assert score_profile.get("max") == pytest.approx(7.89e9, rel=1e-3)

    def test_numeric_col_null_count(self):
        """
        DF_NORMAL["score"] has one None; pd.to_numeric(None, errors="coerce") → NaN.
        NaN is detected by isna() → nullCount must be 1.

        STRING columns are NOT tested for null count because astype("str") converts
        None to the string "None", making nullCount 0. Numeric columns are the
        relevant case for BurstIQ null handling since they go through pd.to_numeric.
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            all_metrics = _build_all_threadpool_metrics(interface, FULL_TABLE_ENTITY)
            profile_results = interface.get_all_metrics(all_metrics)

        score_profile = profile_results["columns"].get("score", {})
        assert score_profile.get("nullCount") == 1.0

    def test_df_with_fewer_cols_than_om_entity_no_keyerror(self):
        """
        DF_NORMAL carries 4 of 6 OM-declared columns.  The profiler must not
        raise KeyError for "tags" or "meta", and those columns must be absent
        from the column profiles (since they were not in the DataFrame).
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            all_metrics = _build_all_threadpool_metrics(interface, FULL_TABLE_ENTITY)
            profile_results = interface.get_all_metrics(all_metrics)

        assert "tags" not in profile_results["columns"]
        assert "meta" not in profile_results["columns"]
        # Columns that were in the DataFrame are profiled
        assert "score" in profile_results["columns"]
        assert "count" in profile_results["columns"]

    def test_timezone_aware_datetime_col_does_not_crash(self):
        """
        DF_NORMAL["created_at"] is datetime64[ns, UTC].  The parent's positional
        astype() would try to cast it to "object" dtype → TypeError.
        BurstIQ's datetime-skip logic must prevent any crash.
        """
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            all_metrics = _build_all_threadpool_metrics(interface, FULL_TABLE_ENTITY)
            # Must not raise
            profile_results = interface.get_all_metrics(all_metrics)

        assert "created_at" in profile_results["columns"]

    def test_get_all_metrics_returns_complete_profile_results(self):
        """get_all_metrics must return the expected top-level structure."""
        df_factory = lambda: iter([DF_NORMAL.copy()])
        with _make_interface(df_factory) as interface:
            all_metrics = _build_all_threadpool_metrics(interface, FULL_TABLE_ENTITY)
            profile_results = interface.get_all_metrics(all_metrics)

        assert "table" in profile_results
        assert "columns" in profile_results
        assert "rowCount" in profile_results["table"]
        assert "columnCount" in profile_results["table"]

        # All four DataFrame columns must have a profile entry
        for col_name in ("score", "name", "created_at", "count"):
            assert (
                col_name in profile_results["columns"]
            ), f"Missing column profile for '{col_name}'"
            col_prof = profile_results["columns"][col_name]
            assert col_prof["name"] == col_name
            assert "timestamp" in col_prof
