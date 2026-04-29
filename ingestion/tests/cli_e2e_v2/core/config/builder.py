#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Immutable WorkflowConfig builder rendered to YAML for the metadata CLI.

Two-step: factory returns a base (connection + service + server);
`.pipeline(options)` picks the pipeline (options is an OM Pydantic model);
`.with_filter(...)` layers filter patterns. Filters persist across later
`.pipeline()` transitions; inline filters on the options take precedence.
Render fails loudly when no pipeline is set.
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

# Pipelines that require a `processor` block in the rendered YAML.
# OM's Profiler + AutoClassification workflows instantiate an ORM profiler
# to compute column statistics / PII inference; without a processor entry,
# workflow init crashes with `'NoneType' object has no attribute 'model_dump'`.
_PIPELINES_NEEDING_PROCESSOR: tuple[type, ...] = (
    ProfilerPipeline,
    AutoClassificationPipeline,
)


class PipelineNotSetError(RuntimeError):
    """Raised when a WorkflowConfig is rendered or queried before a pipeline
    has been selected via `.pipeline(...)`."""


@dataclass(frozen=True)
class WorkflowConfig:
    """Frozen carrier for one workflow's rendered config + active pipeline.

    Two fields:
      _doc       — the full YAML document as a dict tree
      _options   — the Pydantic pipeline options model (None on base configs
                   returned from the factory; set by .pipeline())

    Instances are frozen — overlays return new instances via copy.deepcopy.
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
        """Build a base config without any pipeline selected.

        Callers pass `service_connection` as a plain dict (either model_dump'd
        from an OM connection class or built manually with env refs).
        """
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
        """Transition to a concrete pipeline.

        `options` is one of the OM-generated Pydantic pipeline models
        (re-exported with short aliases in `pipelines.py`). The instance's
        `.type` field discriminator is carried through into the rendered
        YAML as `sourceConfig.config.type`.

        Filter patterns already set on this config (via `.with_filter(...)`)
        persist across the transition. Filters set inline on `options` take
        precedence over preserved filters.
        """
        dumped = options.model_dump(mode="json", exclude_none=True)

        new_doc = copy.deepcopy(self._doc)
        prior_cfg = new_doc["source"]["sourceConfig"]["config"]
        for key in _FILTER_KEYS:
            if key in prior_cfg:
                dumped.setdefault(key, prior_cfg[key])

        new_doc["source"]["sourceConfig"]["config"] = dumped

        # OM's `import_source_class` selects the connector class by
        # splitting `source.type` on "-" and dispatching to metadata_source_class,
        # lineage_source_class, or usage_source_class. The suffix must match
        # the pipeline: e.g. "mysql-lineage" for a DatabaseLineage run.
        base_connector = new_doc["source"]["type"].split("-", 1)[0]
        new_doc["source"]["type"] = base_connector + source_type_suffix_for(options)

        if isinstance(options, _PIPELINES_NEEDING_PROCESSOR):
            new_doc["processor"] = {"type": "orm-profiler", "config": {}}
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
        """Append include/exclude patterns at database, schema, or table level.

        Multiple calls MERGE (append), not replace. Include AND exclude at the
        same level are allowed — OM's filter semantic applies exclude over
        include on overlapping matches.
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
        """Short id for artifact filenames and invocation counters."""
        if self._options is None:
            raise PipelineNotSetError("pipeline not set — call .pipeline(options) before querying identifier")
        return pipeline_identifier(self._options)

    @property
    def cli_subcommand(self) -> str:
        """The `metadata <cmd>` subcommand CliRunner will invoke."""
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
