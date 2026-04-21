#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Pipeline options — re-exports of OM's generated Pydantic pipeline models.

Each pipeline maps to one Pydantic class carrying the full OM schema
(including filter patterns, incremental flags, and pipeline-specific
knobs). Short aliases keep test call sites compact; dispatch for CLI
subcommand + artifact identifier goes through a single `_SPECS` map.

Usage:

    from ..core.config.pipelines import MetadataPipeline

    cfg = base.pipeline(
        MetadataPipeline(includeStoredProcedures=True),
    ).with_filter(tables_include=["customers"])
"""

from __future__ import annotations

from dataclasses import dataclass
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


PipelineOptions = Union[
    MetadataPipeline,
    ProfilerPipeline,
    LineagePipeline,
    UsagePipeline,
    TestPipeline,
    AutoClassificationPipeline,
]


@dataclass(frozen=True)
class _PipelineSpec:
    """CLI subcommand + artifact identifier for one pipeline class."""

    cli_subcommand: str
    identifier: str


# Single source of truth for per-pipeline dispatch. Adding a pipeline
# touches exactly this dict plus the re-export above.
_SPECS: dict[type, _PipelineSpec] = {
    MetadataPipeline:           _PipelineSpec("ingest",   "metadata"),
    ProfilerPipeline:           _PipelineSpec("profile",  "profiler"),
    LineagePipeline:            _PipelineSpec("ingest",   "lineage"),
    UsagePipeline:              _PipelineSpec("usage",    "usage"),
    TestPipeline:               _PipelineSpec("test",     "test"),
    AutoClassificationPipeline: _PipelineSpec("classify", "classify"),
}


def cli_subcommand_for(options: PipelineOptions) -> str:
    """Return the `metadata <cmd>` subcommand to run for these options."""
    return _SPECS[type(options)].cli_subcommand


def pipeline_identifier(options: PipelineOptions) -> str:
    """Short identifier for artifact filenames and invocation counters."""
    return _SPECS[type(options)].identifier


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
