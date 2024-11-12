#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Profiler Processor Step
"""
import traceback
from typing import Optional, cast

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.api.models import ProfilerProcessorConfig, ProfilerResponse
from metadata.profiler.processor.core import Profiler
from metadata.profiler.source.model import ProfilerSourceAndEntity


class ProfilerProcessor(Processor):
    """
    This processor is in charge of getting the profiler source and entity coming from
    the OpenMetadataSource and compute the metrics.
    """

    def __init__(self, config: OpenMetadataWorkflowConfig):
        super().__init__()

        self.config = config
        self.profiler_config = ProfilerProcessorConfig.model_validate(
            self.config.processor.model_dump().get("config")
        )
        self.source_config: DatabaseServiceProfilerPipeline = cast(
            DatabaseServiceProfilerPipeline, self.config.source.sourceConfig.config
        )  # Used to satisfy type checked

    @property
    def name(self) -> str:
        return "Profiler"

    def _run(self, record: ProfilerSourceAndEntity) -> Either[ProfilerResponse]:
        profiler_runner: Profiler = record.profiler_source.get_profiler_runner(
            record.entity, self.profiler_config
        )

        try:
            profile: ProfilerResponse = profiler_runner.process()
        except Exception as exc:
            self.status.failed(
                StackTraceError(
                    name=record.entity.fullyQualifiedName.root,
                    error=f"Unexpected exception processing entity {record.entity.fullyQualifiedName.root}: {exc}",
                    stackTrace=traceback.format_exc(),
                )
            )
            self.status.failures.extend(
                record.profiler_source.interface.status.failures
            )
        else:
            # at this point we know we have an interface variable since we the `try` block above didn't raise
            self.status.failures.extend(record.profiler_source.interface.status.failures)  # type: ignore
            return Either(right=profile)
        finally:
            profiler_runner.close()

        return Either()

    @classmethod
    def create(
        cls, config_dict: dict, _: OpenMetadata, pipeline_name: Optional[str] = None
    ) -> "Step":
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config)

    def close(self) -> None:
        """We are already closing the connections after each execution"""
