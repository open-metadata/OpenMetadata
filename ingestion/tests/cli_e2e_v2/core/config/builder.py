#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Immutable Python builder for a workflow config rendered to YAML for the metadata CLI.

Replaces v1's YAML-per-test-variant pattern. Each test builds a base config from
the connector factory and derives variants via `.as_*()` / `.with_*()` overlays.
All overlays return new instances (deep copy) so composing never mutates the base.

Pipeline type → CLI subcommand mapping is owned here; the CliRunner reads
`cli_subcommand` to decide which `metadata` subcommand to invoke.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from .server import ServerConfig


# Maps pipeline_type → CLI subcommand name (what `metadata <cmd>` expects).
#
# "lineage" maps to "ingest", not "lineage": `metadata lineage` is a separate
# raw-SQL-parse tool (LineageWorkflow with filePath/query/serviceName) that has
# nothing to do with connector-based DatabaseLineage pipelines. Connector lineage
# runs through `metadata ingest` exactly like DatabaseMetadata — the pipeline
# type is signalled only by sourceConfig.config.type = "DatabaseLineage" and by
# pointing source.type at the connector's lineage variant (e.g. "mysql-lineage").
_PIPELINE_CLI_SUBCOMMAND: dict[str, str] = {
    "metadata": "ingest",
    "profiler": "profile",
    "lineage": "ingest",
    "usage": "usage",
    "test": "test",
    "auto_classification": "classify",
}

# Maps pipeline_type → sourceConfig.config.type (what the workflow Pydantic expects)
_PIPELINE_SOURCE_CONFIG_TYPE: dict[str, str] = {
    "metadata": "DatabaseMetadata",
    "profiler": "Profiler",
    "lineage": "DatabaseLineage",
    "usage": "DatabaseUsage",
    "test": "TestSuite",
    "auto_classification": "AutoClassification",
}


@dataclass
class WorkflowConfig:
    """Holds the workflow config as a nested dict; overlays return new instances."""

    _doc: dict[str, Any]  # the full YAML document as a dict
    _pipeline: str  # one of _PIPELINE_CLI_SUBCOMMAND keys

    # --- construction ---------------------------------------------------
    @classmethod
    def build(
        cls,
        *,
        source_type: str,
        service_name: str,
        service_connection: dict[str, Any],
        server: ServerConfig,
    ) -> "WorkflowConfig":
        """Build a base config starting in 'metadata' pipeline mode.

        Callers provide `service_connection` as a plain dict (already
        model_dump'd from an OM Pydantic connection class, or built manually).
        """
        doc: dict[str, Any] = {
            "source": {
                "type": source_type,
                "serviceName": service_name,
                "serviceConnection": {"config": dict(service_connection)},
                "sourceConfig": {
                    "config": {"type": _PIPELINE_SOURCE_CONFIG_TYPE["metadata"]}
                },
            },
            "sink": server.to_sink_config_dict(),
            "workflowConfig": server.to_workflow_config_dict(),
        }
        return cls(_doc=doc, _pipeline="metadata")

    # --- immutability helper --------------------------------------------
    def _clone_with(
        self,
        *,
        pipeline: str,
        source_config_changes: dict[str, Any] | None = None,
    ) -> "WorkflowConfig":
        """Return a new WorkflowConfig with the given pipeline and sourceConfig overrides.

        Replaces sourceConfig.config entirely (keyed only by new pipeline's type)
        then layers in the requested changes. Other parts of the doc are deep-copied
        unchanged.
        """
        new_doc = copy.deepcopy(self._doc)
        new_doc["source"]["sourceConfig"]["config"] = {
            "type": _PIPELINE_SOURCE_CONFIG_TYPE[pipeline]
        }
        if source_config_changes:
            new_doc["source"]["sourceConfig"]["config"].update(source_config_changes)
        return WorkflowConfig(_doc=new_doc, _pipeline=pipeline)

    # --- pipeline switchers ---------------------------------------------
    def as_metadata(
        self,
        *,
        mark_deleted_tables: bool = True,
        include_tables: bool = True,
        include_views: bool = True,
        include_stored_procedures: bool = False,
    ) -> "WorkflowConfig":
        """Switch to 'metadata' ingestion pipeline with optional flags.

        Default matches a sensible production-like shape: pick up tables & views,
        mark soft-deleted tables, skip stored procedures.
        """
        return self._clone_with(
            pipeline="metadata",
            source_config_changes={
                "markDeletedTables": mark_deleted_tables,
                "includeTables": include_tables,
                "includeViews": include_views,
                "includeStoredProcedures": include_stored_procedures,
            },
        )

    # --- accessors ------------------------------------------------------
    @property
    def pipeline_type(self) -> str:
        return self._pipeline

    @property
    def cli_subcommand(self) -> str:
        """CLI subcommand corresponding to the current pipeline type.

        Used by CliRunner to pick the right `metadata <cmd>` invocation.
        """
        return _PIPELINE_CLI_SUBCOMMAND[self._pipeline]

    # --- rendering ------------------------------------------------------
    def write_tmp(self, tmp_path: Path, invocation: int = 0) -> Path:
        """Dump to tmp_path/cfg_<pipeline>_<n>.yaml and return the path.

        Per-invocation numbering avoids overwrites when a single test calls
        cli_runner.run() multiple times (e.g., ingest → profile → test).
        """
        path = tmp_path / f"cfg_{self._pipeline}_{invocation}.yaml"
        path.write_text(yaml.safe_dump(self._doc, sort_keys=False))
        return path

    def to_dict(self) -> dict[str, Any]:
        """Deep copy of the internal document. For tests or debugging only."""
        return copy.deepcopy(self._doc)

    def as_profiler(
        self,
        *,
        profile_sample: float | None = None,
        include_views: bool = False,
        compute_table_metrics: bool = True,
        compute_column_metrics: bool = True,
    ) -> "WorkflowConfig":
        """Switch to the profiler pipeline.

        `profile_sample` maps to sourceConfig.config.profileSample (percentage of rows,
        0-100). Omitted when None, which lets OM use its default (full table scan).
        `include_views` / `compute_table_metrics` / `compute_column_metrics` map to
        their OM profiler schema flags.
        """
        changes: dict[str, Any] = {
            "includeViews": include_views,
            "computeTableMetrics": compute_table_metrics,
            "computeColumnMetrics": compute_column_metrics,
        }
        if profile_sample is not None:
            changes["profileSample"] = profile_sample
        return self._clone_with(pipeline="profiler", source_config_changes=changes)

    def as_lineage(
        self,
        *,
        query_log_duration_days: int = 1,
        result_limit: int = 1000,
    ) -> "WorkflowConfig":
        """Switch to the connector-based lineage pipeline.

        Despite the name, the rendered CLI command is `metadata ingest` (not
        `metadata lineage`, which is a separate raw-SQL tool). Pipeline type
        `"lineage"` resolves to CLI subcommand `"ingest"` via the mapping
        defined at module top.
        """
        return self._clone_with(
            pipeline="lineage",
            source_config_changes={
                "queryLogDuration": query_log_duration_days,
                "resultLimit": result_limit,
            },
        )

    def as_usage(
        self,
        *,
        query_log_duration_days: int = 1,
        result_limit: int = 1000,
    ) -> "WorkflowConfig":
        """Switch to the usage pipeline.

        CLI subcommand is `metadata usage`.
        """
        return self._clone_with(
            pipeline="usage",
            source_config_changes={
                "queryLogDuration": query_log_duration_days,
                "resultLimit": result_limit,
            },
        )

    def as_test(self) -> "WorkflowConfig":
        """Switch to the data-quality test pipeline (metadata test)."""
        return self._clone_with(pipeline="test")

    def as_auto_classification(
        self,
        *,
        store_sample_data: bool = False,
        enable_auto_classification: bool = True,
        sample_data_count: int | None = None,
        include_views: bool = True,
    ) -> "WorkflowConfig":
        """Switch to the auto-classification pipeline (metadata classify).

        `store_sample_data` controls whether sample rows are persisted in OM.
        `enable_auto_classification` toggles PII tagging inference.
        `sample_data_count` maps to sampleDataCount (omitted when None, uses OM default of 50).
        `include_views` mirrors the OM schema flag (default true for auto-classification).
        """
        changes: dict[str, Any] = {
            "storeSampleData": store_sample_data,
            "enableAutoClassification": enable_auto_classification,
            "includeViews": include_views,
        }
        if sample_data_count is not None:
            changes["sampleDataCount"] = sample_data_count
        return self._clone_with(pipeline="auto_classification", source_config_changes=changes)

    # --- universal tweaks -----------------------------------------------
    def with_filter(
        self,
        *,
        databases_include: list[str] | None = None,
        databases_exclude: list[str] | None = None,
        schemas_include: list[str] | None = None,
        schemas_exclude: list[str] | None = None,
        tables_include: list[str] | None = None,
        tables_exclude: list[str] | None = None,
    ) -> "WorkflowConfig":
        """Adds include/exclude filter patterns at database, schema, or table level.

        Multiple calls MERGE lists (append), not replace. Supports simultaneous
        include AND exclude at the same level (OM's filter model allows this and
        v1 tests use the combination).

        Each pattern dict has shape {"includes": [...], "excludes": [...]}.
        Empty / omitted levels are not written at all.
        """
        new_doc = copy.deepcopy(self._doc)
        cfg = new_doc["source"]["sourceConfig"]["config"]

        def _merge(key: str, includes: list[str] | None, excludes: list[str] | None) -> None:
            if not includes and not excludes:
                return
            pattern = cfg.setdefault(key, {})
            if includes:
                pattern.setdefault("includes", []).extend(includes)
            if excludes:
                pattern.setdefault("excludes", []).extend(excludes)

        _merge("databaseFilterPattern", databases_include, databases_exclude)
        _merge("schemaFilterPattern", schemas_include, schemas_exclude)
        _merge("tableFilterPattern", tables_include, tables_exclude)

        return WorkflowConfig(_doc=new_doc, _pipeline=self._pipeline)
