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
Data Sampler for the PII Workflow
"""
from typing import Optional

from metadata.ingestion.api.steps import Processor
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.processor.core import Profiler
from metadata.profiler.source.metadata import ProfilerSourceAndEntity
from metadata.sampler.models import SamplerResponse


class SamplerProcessor(Processor):
    """Use the profiler interface to fetch the sample data"""

    def _run(self, record: ProfilerSourceAndEntity) -> SamplerResponse:
        """Fetch the sample data and pass it down the pipeline"""
        profiler_runner: Profiler = record.profiler_source.get_profiler_runner(
            record.entity, self.profiler_config
        )

        # We need the sample data for Sample Data or PII Sensitive processing.
        # We'll nullify the Sample Data after the PII processing so that it's not stored.
        if (
            self.source_config.generateSampleData
            or self.source_config.processPiiSensitive
        ):
            sample_data = self.generate_sample_data()
        else:
            sample_data = None

    @classmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        pass

    def close(self) -> None:
        """Nothing to close"""
        pass
