"""Public ClickZetta table-metric adapter."""

from metadata.profiler.orm.functions.table_metric_computer import (
    ClickzettaTableMetricComputer,
    clickzetta_full_scan_allowed,
)

__all__ = ["ClickzettaTableMetricComputer", "clickzetta_full_scan_allowed"]
