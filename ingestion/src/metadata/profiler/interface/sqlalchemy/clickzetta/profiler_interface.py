"""Fail-closed ClickZetta profiler implementation.

The generic SQLAlchemy profiler is reusable for the core aggregate metrics,
but it also exposes window, system, custom-SQL, and other expressions that are
not yet validated against ClickZetta.  This class makes the supported subset
explicit.  It is intentionally not registered in the ClickZetta service spec
until a bounded live smoke test is available.
"""

from collections.abc import Iterable

from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)


class ClickzettaProfilerInterface(SQAProfilerInterface):
    """Run only ClickZetta SQL forms covered by offline compilation tests."""

    SUPPORTED_METRICS = frozenset(
        {
            "rowCount",
            "columnCount",
            "columnNames",
            "valuesCount",
            "nullCount",
            "distinctCount",
            "mean",
            "min",
            "max",
            "sum",
            "stddev",
        }
    )

    @staticmethod
    def _metric_name(metric) -> str:
        name = metric.name() if callable(getattr(metric, "name", None)) else getattr(metric, "name", metric)
        return str(name)

    @classmethod
    def validate_metrics(cls, metrics: Iterable) -> None:
        unsupported = {cls._metric_name(metric) for metric in metrics} - cls.SUPPORTED_METRICS
        if unsupported:
            raise ValueError(f"ClickZetta profiler metrics are not supported: {sorted(unsupported)}")

    def _compute_table_metrics(self, metrics, runner, *args, **kwargs):
        self.validate_metrics(metrics)
        return super()._compute_table_metrics(metrics, runner, *args, **kwargs)

    def _compute_static_metrics(self, metrics, runner, *args, **kwargs):
        self.validate_metrics(metrics)
        return super()._compute_static_metrics(metrics, runner, *args, **kwargs)

    def _compute_query_metrics(self, metric, runner, *args, **kwargs):
        self.validate_metrics([metric])
        return super()._compute_query_metrics(metric, runner, *args, **kwargs)

    def _compute_window_metrics(self, metrics, runner, *args, **kwargs):
        if metrics:
            raise ValueError("ClickZetta window metrics are disabled until their SQL is validated")
        return

    def _compute_custom_metrics(self, metrics, runner, *args, **kwargs):
        if metrics:
            raise ValueError("ClickZetta custom profiler SQL is disabled unless it has an explicit bounded adapter")
        return

    def _compute_system_metrics(self, metrics, runner, *args, **kwargs):
        return []
