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

from tests.cli_e2e_v2.core.config.server import ServerConfig


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
}

# Maps pipeline_type → sourceConfig.config.type (what the workflow Pydantic expects)
_PIPELINE_SOURCE_CONFIG_TYPE: dict[str, str] = {
    "metadata": "DatabaseMetadata",
    "profiler": "Profiler",
    "lineage": "DatabaseLineage",
    "usage": "DatabaseUsage",
    "test": "TestSuite",
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
