#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Pipeline options — thin facade over OM's generated Pydantic pipeline models.

Each pipeline (metadata, profiler, lineage, usage, test, classification)
maps to exactly one generated Pydantic class with the full OM schema
(including filter patterns, incremental flags, and pipeline-specific knobs).
We re-export them under short aliases so test call sites stay compact, and
dispatch `cli_subcommand_for(options)` / `pipeline_identifier(options)` by
the concrete options class.

Why the generated classes and not a hand-rolled dataclass tree:
  - Field names + camelCase match the YAML the CLI expects.
  - `extra='forbid'` catches typos at instantiation time (not when the
    subprocess explodes).
  - The options tree stays drift-free as OM's schema evolves — new fields
    land automatically on next `make generate`.

Test usage:

    from ..core.config.pipelines import MetadataPipeline

    cfg = base.pipeline(
        MetadataPipeline(includeStoredProcedures=True),
    ).with_filter(tables_include=["customers"])
"""

from __future__ import annotations

from typing import Union

from metadata.generated.schema.metadataIngestion.databaseServiceAutoClassificationPipeline import (
    DatabaseServiceAutoClassificationPipeline as AutoClassificationPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline as MetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline as ProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryLineagePipeline import (
    DatabaseServiceQueryLineagePipeline as LineagePipeline,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseServiceQueryUsagePipeline as UsagePipeline,
)
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline as TestPipeline,
)


# Union of all supported pipeline options — used as the parameter type
# for WorkflowConfig.pipeline(). Mypy / basedpyright rejects a value that
# isn't one of these six classes (or a subclass).
PipelineOptions = Union[
    MetadataPipeline,
    ProfilerPipeline,
    LineagePipeline,
    UsagePipeline,
    TestPipeline,
    AutoClassificationPipeline,
]


# CLI subcommand dispatch, keyed by the concrete options class. One row per
# supported pipeline — adding a pipeline means adding one line here plus the
# re-export above. "lineage" and "ingest" share the `metadata ingest` CLI
# entrypoint; they differ only in sourceConfig.config.type, which the options
# class carries in its `type` field.
_CLI_SUBCOMMAND: dict[type, str] = {
    MetadataPipeline:           "ingest",
    ProfilerPipeline:           "profile",
    LineagePipeline:            "ingest",
    UsagePipeline:              "usage",
    TestPipeline:               "test",
    AutoClassificationPipeline: "classify",
}


# Short identifier used for cfg_<id>_<n>.yaml / status_<id>_<n>.json
# artifact naming and for CliRunner's per-pipeline invocation counter.
_IDENTIFIER: dict[type, str] = {
    MetadataPipeline:           "metadata",
    ProfilerPipeline:           "profiler",
    LineagePipeline:            "lineage",
    UsagePipeline:              "usage",
    TestPipeline:               "test",
    AutoClassificationPipeline: "classify",
}


def cli_subcommand_for(options: PipelineOptions) -> str:
    """Return the `metadata <cmd>` subcommand to run for these options."""
    return _CLI_SUBCOMMAND[type(options)]


def pipeline_identifier(options: PipelineOptions) -> str:
    """Short identifier for artifact filenames and invocation counters."""
    return _IDENTIFIER[type(options)]


__all__ = [
    "AutoClassificationPipeline",
    "LineagePipeline",
    "MetadataPipeline",
    "PipelineOptions",
    "ProfilerPipeline",
    "TestPipeline",
    "UsagePipeline",
    "cli_subcommand_for",
    "pipeline_identifier",
]
