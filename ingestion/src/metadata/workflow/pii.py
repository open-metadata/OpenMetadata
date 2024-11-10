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
Workflow definition for the profiler
"""

from metadata.ingestion.api.steps import Processor
from metadata.pii.processor import PIIProcessor
from metadata.utils.logger import profiler_logger
from metadata.workflow.profiler import ProfilerWorkflow

logger = profiler_logger()


class PIIWorkflow(ProfilerWorkflow):
    """PII workflow implementation. Based on the Profiler logic with different steps"""

    def set_steps(self):
        source_class = self._get_source_class()
        self.source = source_class.create(self.config.model_dump(), self.metadata)

        sink = self._get_sink()
        pii_processor = self._get_pii_processor()

        # OM Source -> sampler -> PII -> Sink
        self.steps = (pii_processor, sink)

    def _get_pii_processor(self) -> Processor:
        return PIIProcessor.create(self.config.model_dump(), self.metadata)

    def _get_sampler_processor(self) -> Processor:
        # TODO
        return ...
