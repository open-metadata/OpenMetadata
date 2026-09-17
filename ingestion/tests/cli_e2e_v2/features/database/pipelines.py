#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Database-family dispatch for generated pipeline models.

Dispatch (CLI subcommand, source-type suffix) is
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
from metadata.generated.schema.metadataIngestion.testSuitePipeline import (
    TestSuitePipeline as TestPipeline,
)

PipelineOptions = MetadataPipeline | ProfilerPipeline | LineagePipeline | TestPipeline | AutoClassificationPipeline


@dataclass(frozen=True)
class _PipelineSpec:
    """Per-pipeline dispatch table entry."""

    cli_subcommand: str
    source_type_suffix: str = ""


_SPECS: dict[type, _PipelineSpec] = {
    MetadataPipeline: _PipelineSpec("ingest"),
    ProfilerPipeline: _PipelineSpec("profile"),
    LineagePipeline: _PipelineSpec("ingest", "-lineage"),
    TestPipeline: _PipelineSpec("test"),
    AutoClassificationPipeline: _PipelineSpec("classify"),
}


def _spec_for(options: PipelineOptions) -> _PipelineSpec:
    try:
        return _SPECS[type(options)]
    except KeyError:
        raise ValueError(f"Unsupported database pipeline: {type(options).__name__}") from None


def cli_subcommand_for(options: PipelineOptions) -> str:
    """Return the `metadata <cmd>` subcommand to run for these options."""
    return _spec_for(options).cli_subcommand


def source_type_suffix_for(options: PipelineOptions) -> str:
    """Suffix to append to `source.type` for this pipeline (e.g. `-lineage`)."""
    return _spec_for(options).source_type_suffix


__all__ = [
    "AutoClassificationPipeline",
    "LineagePipeline",
    "MetadataPipeline",
    "PipelineOptions",
    "ProfilerPipeline",
    "TestPipeline",
    "cli_subcommand_for",
    "source_type_suffix_for",
]
