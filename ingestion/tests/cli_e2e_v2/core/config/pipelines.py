#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Short-aliased re-exports of OM's generated Pydantic pipeline models.

Dispatch (CLI subcommand, artifact identifier, source-type suffix) is
centralised in `_SPECS`. Adding a pipeline touches only that dict plus
the re-export block.
"""

from __future__ import annotations

from dataclasses import dataclass

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

PipelineOptions = (
    MetadataPipeline | ProfilerPipeline | LineagePipeline | UsagePipeline | TestPipeline | AutoClassificationPipeline
)


@dataclass(frozen=True)
class _PipelineSpec:
    """Per-pipeline dispatch table entry."""

    cli_subcommand: str
    identifier: str
    source_type_suffix: str = ""


_SPECS: dict[type, _PipelineSpec] = {
    MetadataPipeline: _PipelineSpec("ingest", "metadata", ""),
    ProfilerPipeline: _PipelineSpec("profile", "profiler", ""),
    LineagePipeline: _PipelineSpec("ingest", "lineage", "-lineage"),
    UsagePipeline: _PipelineSpec("usage", "usage", "-usage"),
    TestPipeline: _PipelineSpec("test", "test", ""),
    AutoClassificationPipeline: _PipelineSpec("classify", "classify", ""),
}


def cli_subcommand_for(options: PipelineOptions) -> str:
    """Return the `metadata <cmd>` subcommand to run for these options."""
    return _SPECS[type(options)].cli_subcommand


def pipeline_identifier(options: PipelineOptions) -> str:
    """Short identifier for artifact filenames and invocation counters."""
    return _SPECS[type(options)].identifier


def source_type_suffix_for(options: PipelineOptions) -> str:
    """Suffix to append to `source.type` for this pipeline (e.g. `-lineage`)."""
    return _SPECS[type(options)].source_type_suffix


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
    "source_type_suffix_for",
]
