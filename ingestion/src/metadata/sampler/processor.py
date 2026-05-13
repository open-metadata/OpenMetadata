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
Data Sampler for the PII Workflow
"""

from __future__ import annotations

import traceback
from typing import TYPE_CHECKING, Optional, cast

from metadata.generated.schema.configuration.profilerConfiguration import (
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.workflow import (  # noqa: TC001
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.parser import parse_workflow_config_gracefully
from metadata.ingestion.api.step import Step  # noqa: TC001
from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata  # noqa: TC001
from metadata.pii.types import ClassifiableEntityType  # noqa: TC001
from metadata.profiler.api.models import ProfilerProcessorConfig  # noqa: TC001
from metadata.profiler.source.metadata import ProfilerSourceAndEntity  # noqa: TC001
from metadata.sampler.entity_adapters import (
    EntityAdapter,
    adapter_for,
    adapter_for_pipeline,
)
from metadata.sampler.models import SampleData, SamplerResponse
from metadata.utils.dependency_injector.dependency_injector import (
    DependencyNotFoundError,
    Inject,
    inject,
)
from metadata.utils.logger import profiler_logger
from metadata.utils.service_spec.service_spec import import_sampler_class

if TYPE_CHECKING:
    from metadata.sampler.sampler_interface import SamplerInterface

logger = profiler_logger()


class SamplerProcessor(Processor):
    """Use the profiler interface to fetch the sample data"""

    @inject
    def __init__(
        self,
        config: OpenMetadataWorkflowConfig,
        metadata: OpenMetadata,
        profiler_config_class: Inject[type[ProfilerProcessorConfig]] = None,
    ):
        if profiler_config_class is None:
            raise DependencyNotFoundError(
                "ProfilerProcessorConfig class not found. Please ensure the ProfilerProcessorConfig is properly registered."
            )

        super().__init__()

        self.config = config
        self.metadata = metadata

        self.source_config = self.config.source.sourceConfig.config

        self.profiler_config = profiler_config_class.model_validate(self.config.processor.model_dump().get("config"))

        self._interface_type: str = config.source.type.lower()

        _adapter = adapter_for_pipeline(self.source_config)
        if _adapter is None:
            raise ValueError(
                f"Could not determine service type from config. "
                f"Config type: {type(self.source_config).__name__}, "
                f"Interface type: {self._interface_type}. "
                f"This indicates a configuration parsing issue."
            )
        self.service_type = _adapter.service_type

        self.sampler_class = import_sampler_class(self.service_type, source_type=self._interface_type)

        self._sample_data_config = None
        settings = self.metadata.get_profiler_config_settings()
        if settings:
            profiler_cfg = cast(ProfilerConfiguration, settings.config_value)  # noqa: TC006
            self._sample_data_config = profiler_cfg.sampleDataConfig

    @property
    def name(self) -> str:
        return "Sampler"

    def _run(self, record: ProfilerSourceAndEntity) -> Either[SamplerResponse]:
        """Fetch the sample data and pass it down the pipeline"""
        entity = record.entity
        entity_fqn = entity.fullyQualifiedName.root if entity.fullyQualifiedName else type(entity).__name__
        adapter = adapter_for(entity)
        if adapter is None:
            return Either(
                left=StackTraceError(
                    name=entity_fqn,
                    error=f"Unsupported entity type {type(entity).__name__} for sampling",
                    stackTrace="".join(traceback.format_list(traceback.extract_stack())),
                ),
                right=None,
            )
        if not adapter.get_columns(entity):
            logger.warning(
                "Skipping sampler for %s '%s': no columns found",
                type(entity).__name__,
                entity_fqn,
            )
            return Either(left=None, right=None)
        return self._run_for_entity(entity, entity_fqn, record, adapter)

    def _run_for_entity(
        self, entity: object, entity_fqn: str, record: ProfilerSourceAndEntity, adapter: EntityAdapter
    ) -> Either[SamplerResponse]:
        try:
            sampler_kwargs = adapter.build_sampler_kwargs(
                self.config,
                self.metadata,
                entity,
                self.profiler_config,
                self.source_config,
            )
            if sampler_kwargs is None:
                return Either(
                    left=StackTraceError(
                        name=entity_fqn,
                        error=(
                            f"Could not build sampler context for [{entity_fqn}]. "
                            f"The search index may not be available or the entity has not been indexed yet. "
                            f"Please ensure the Elasticsearch index is properly configured and try reindexing."
                        ),
                        stackTrace="".join(traceback.format_list(traceback.extract_stack())),
                    ),
                    right=None,
                )
            sampler_interface: SamplerInterface = self.sampler_class.create(**sampler_kwargs)
            sample_data = SampleData(
                data=sampler_interface.generate_sample_data(self._sample_data_config),
                store=bool(
                    self.source_config.storeSampleData
                    and (self._sample_data_config is None or self._sample_data_config.storeSampleData)
                ),
            )
            sampler_interface.close()
            return Either(
                right=SamplerResponse(
                    entity=cast("ClassifiableEntityType", entity),
                    sample_data=sample_data,
                )
            )
        except Exception as exc:
            return Either(
                left=StackTraceError(
                    name=entity_fqn,
                    error=f"Unexpected exception processing entity {entity_fqn}: {exc}",
                    stackTrace=traceback.format_exc(),
                ),
                right=None,
            )

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,  # noqa: UP045
    ) -> Step:
        config = parse_workflow_config_gracefully(config_dict)
        return cls(config=config, metadata=metadata)

    def close(self) -> None:
        """Nothing to close"""
