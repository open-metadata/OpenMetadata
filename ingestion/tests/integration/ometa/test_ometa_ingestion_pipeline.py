#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Test how we create and update status in Ingestion Pipelines
"""
import sys

import pytest

from metadata.generated.schema.entity.services.ingestionPipelines.ingestionPipeline import (
    IngestionPipeline,
    PipelineState,
    PipelineStatus,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    IngestionStatus,
    StackTraceError,
    StepSummary,
)
from metadata.ingestion.api.status import TruncatedStackTraceError

if sys.version_info < (3, 9):
    pytest.skip("requires python 3.9+", allow_module_level=True)


def test_create_ingestion_pipeline(workflow) -> None:
    """We can create an ingestion pipeline"""

    ingestion_pipeline: IngestionPipeline = workflow.ingestion_pipeline
    assert ingestion_pipeline is not None
    assert ingestion_pipeline.name.root == "ingestion"


def test_add_status(metadata, workflow) -> None:
    """We can add status to the ingestion pipeline"""

    ingestion_pipeline: IngestionPipeline = workflow.ingestion_pipeline
    assert ingestion_pipeline is not None

    # We can send a status to the ingestion pipeline
    ingestion_status = IngestionStatus(
        [
            StepSummary(
                name="source",
                failures=[
                    StackTraceError(
                        name="error",
                        error="error",
                        stackTrace="stackTrace",
                    )
                ],
            )
        ]
    )

    pipeline_status: PipelineStatus = workflow._new_pipeline_status(
        PipelineState.success
    )
    pipeline_status.status = ingestion_status

    # Gets properly created
    metadata.create_or_update_pipeline_status(
        ingestion_pipeline.fullyQualifiedName.root, pipeline_status
    )

    real_pipeline_status: PipelineStatus = metadata.get_pipeline_status(
        ingestion_pipeline.fullyQualifiedName.root, workflow.run_id
    )
    assert real_pipeline_status.pipelineState == PipelineState.success

    # If the status has too long names/errors it will fail
    too_long_status = IngestionStatus(
        [
            StepSummary(
                name="source",
                failures=[
                    StackTraceError(
                        name="error",
                        error="error" * 20_000_000,
                        stackTrace="stackTrace",
                    )
                ],
            )
        ]
    )

    pipeline_status: PipelineStatus = workflow._new_pipeline_status(
        PipelineState.success
    )
    pipeline_status.status = too_long_status

    # We get a bad request error
    with pytest.raises(Exception) as exc:
        metadata.create_or_update_pipeline_status(
            ingestion_pipeline.fullyQualifiedName.root, pipeline_status
        )

    assert ("exceeds the maximum allowed" in str(exc.value)) or (
        "Connection aborted." in str(exc.value)
    )

    # If we truncate the status it all runs good
    truncated_long_status = IngestionStatus(
        [
            StepSummary(
                name="source",
                failures=[
                    TruncatedStackTraceError(
                        name="error",
                        error="error" * 20_000_000,
                        stackTrace="stackTrace",
                    )
                ],
            )
        ]
    )

    pipeline_status: PipelineStatus = workflow._new_pipeline_status(
        PipelineState.success
    )
    pipeline_status.status = truncated_long_status

    res = metadata.create_or_update_pipeline_status(
        ingestion_pipeline.fullyQualifiedName.root, pipeline_status
    )

    assert res["entityFullyQualifiedName"] == ingestion_pipeline.fullyQualifiedName.root
