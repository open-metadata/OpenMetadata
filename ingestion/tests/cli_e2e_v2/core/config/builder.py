#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Immutable WorkflowConfig builder rendered to YAML for the metadata CLI.

- `.pipeline(options)` selects the pipeline and must be called before rendering.
- `.with_filter(...)` layers filter patterns; filters persist across `.pipeline()` calls.
- Raises `PipelineNotSetError` if rendered or queried before a pipeline is set.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import yaml

from .pipelines import (
    AutoClassificationPipeline,
    PipelineOptions,
    ProfilerPipeline,
    cli_subcommand_for,
    pipeline_identifier,
    source_type_suffix_for,
)

if TYPE_CHECKING:
    from pathlib import Path

    from .server import ServerConfig

_FILTER_KEYS: tuple[str, ...] = (
    "databaseFilterPattern",
    "schemaFilterPattern",
    "tableFilterPattern",
)

# Pipelines that require a `processor` block in the rendered YAML, and the
# processor type each one uses. Omitting the block crashes workflow init on
# model_dump of a None processor.
_PROCESSOR_BY_PIPELINE: dict[type, str] = {
    ProfilerPipeline: "orm-profiler",
    AutoClassificationPipeline: "tag-pii-processor",
}


class PipelineNotSetError(RuntimeError):
    """Raised when a WorkflowConfig is rendered or queried before a pipeline
    has been selected via `.pipeline(...)`."""


@dataclass(frozen=True)
class WorkflowConfig:
    """Frozen carrier for one workflow's rendered config + active pipeline.

    Overlays (`.pipeline()`, `.with_filter()`) return new instances; this
    instance is never mutated.
    """

    _doc: dict[str, Any]
    _options: PipelineOptions | None = None

    # --- construction ---------------------------------------------------
    @classmethod
    def build(
        cls,
        *,
        source_type: str,
        service_name: str,
        service_connection: dict[str, Any],
        server: ServerConfig,
    ) -> WorkflowConfig:
        """Build a base config without a pipeline selected."""
        doc: dict[str, Any] = {
            "source": {
                "type": source_type,
                "serviceName": service_name,
                "serviceConnection": {"config": dict(service_connection)},
                "sourceConfig": {"config": {}},
            },
            "sink": server.to_sink_config_dict(),
            "workflowConfig": server.to_workflow_config_dict(),
        }
        return cls(_doc=doc, _options=None)

    # --- pipeline transition --------------------------------------------
    def pipeline(self, options: PipelineOptions) -> WorkflowConfig:
        """Return a new config with the given pipeline selected.

        Filter patterns previously set via `.with_filter()` are preserved;
        filters set inline on `options` take precedence.
        """
        dumped = options.model_dump(mode="json", exclude_none=True)

        new_doc = copy.deepcopy(self._doc)
        prior_cfg = new_doc["source"]["sourceConfig"]["config"]
        for key in _FILTER_KEYS:
            if key in prior_cfg:
                dumped.setdefault(key, prior_cfg[key])

        new_doc["source"]["sourceConfig"]["config"] = dumped

        # `import_source_class` dispatches by suffix (e.g. "-lineage", "-usage").
        base_connector = new_doc["source"]["type"].split("-", 1)[0]
        new_doc["source"]["type"] = base_connector + source_type_suffix_for(options)

        processor_type = _PROCESSOR_BY_PIPELINE.get(type(options))
        if processor_type is not None:
            new_doc["processor"] = {"type": processor_type, "config": {}}
        else:
            new_doc.pop("processor", None)

        return WorkflowConfig(_doc=new_doc, _options=options)

    # --- filter overlay -------------------------------------------------
    def with_filter(
        self,
        *,
        databases_include: list[str] | None = None,
        databases_exclude: list[str] | None = None,
        schemas_include: list[str] | None = None,
        schemas_exclude: list[str] | None = None,
        tables_include: list[str] | None = None,
        tables_exclude: list[str] | None = None,
    ) -> WorkflowConfig:
        """Return a new config with patterns appended (not replaced) at each level.

        Multiple calls merge. Exclude takes priority over include on overlapping
        matches per OM's filter semantics.
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

        return WorkflowConfig(_doc=new_doc, _options=self._options)

    # --- accessors ------------------------------------------------------
    @property
    def pipeline_identifier(self) -> str:
        """Short id for artifact filenames and invocation counters. Raises `PipelineNotSetError` if no pipeline is set."""
        if self._options is None:
            raise PipelineNotSetError("pipeline not set — call .pipeline(options) before querying identifier")
        return pipeline_identifier(self._options)

    @property
    def cli_subcommand(self) -> str:
        """The `metadata <cmd>` subcommand to invoke. Raises `PipelineNotSetError` if no pipeline is set."""
        if self._options is None:
            raise PipelineNotSetError("pipeline not set — call .pipeline(options) before querying subcommand")
        return cli_subcommand_for(self._options)

    # --- rendering ------------------------------------------------------
    def write_tmp(self, tmp_path: Path, invocation: int = 0) -> Path:
        """Dump to `<tmp_path>/cfg_<id>_<invocation>.yaml` and return the path."""
        if self._options is None:
            raise PipelineNotSetError("pipeline not set — call .pipeline(options) before rendering")
        path = tmp_path / f"cfg_{self.pipeline_identifier}_{invocation}.yaml"
        path.write_text(yaml.safe_dump(self._doc, sort_keys=False))
        return path
