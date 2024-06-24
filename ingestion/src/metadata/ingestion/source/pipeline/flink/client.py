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
Client to interact with flink apis
"""

from typing import List, Optional

from metadata.generated.schema.entity.services.connections.pipeline.flinkConnection import (
    FlinkConnection,
)
from metadata.ingestion.ometa.client import REST, ClientConfig
from metadata.ingestion.source.pipeline.flink.models import (
    FlinkPipeline,
    FlinkPipelineList,
)
from metadata.utils.constants import AUTHORIZATION_HEADER
from metadata.utils.helpers import clean_uri
from metadata.utils.ssl_registry import get_verify_ssl_fn


class FlinkClient:
    """
    Client to interact with flink apis
    """

    def __init__(self, config: FlinkConnection):
        self.config = config
        get_verify_ssl = get_verify_ssl_fn(config.verifySSL)
        client_config: ClientConfig = ClientConfig(
            base_url=clean_uri(self.config.hostPort),
            api_version="",
            auth_header=AUTHORIZATION_HEADER,
            auth_token=lambda: ("no_token", 0),
            verify=get_verify_ssl(config.sslConfig),
        )
        self.client = REST(client_config)

    def get_jobs(self) -> Optional[List[FlinkPipelineList]]:
        response = self.client.get("jobs/overview")
        return FlinkPipelineList(**response)

    def get_pipeline_info(self, pipeline_id: str) -> FlinkPipeline:
        response = self.client.get(f"jobs/{pipeline_id}")
        return FlinkPipeline(**response)
