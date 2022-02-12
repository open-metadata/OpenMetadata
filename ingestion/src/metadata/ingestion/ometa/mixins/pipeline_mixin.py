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
Mixin class containing Pipeline specific methods

To be used by OpenMetadata class
"""
import logging

from metadata.generated.schema.entity.data.pipeline import Pipeline, PipelineStatus
from metadata.ingestion.ometa.client import REST

logger = logging.getLogger(__name__)


class OMetaPipelineMixin:
    """
    OpenMetadata API methods related to the Pipeline Entity

    To be inherited by OpenMetadata
    """

    client: REST

    def add_pipeline_status(
        self, pipeline: Pipeline, status: PipelineStatus
    ) -> Pipeline:
        """
        Given a pipeline and a PipelineStatus, send it
        to the Pipeline Entity
        """
        resp = self.client.put(
            f"{self.get_suffix(Pipeline)}/{pipeline.id.__root__}/status",
            data=status.json(),
        )
        return Pipeline(**resp)
