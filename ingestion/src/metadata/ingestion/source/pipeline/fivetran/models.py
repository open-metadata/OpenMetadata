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
from pydantic import BaseModel

from metadata.ingestion.source.pipeline.fivetran.fivetran_log import DEFAULT_LOG_SCHEMA


class FivetranPipelineDetails(BaseModel):
    """
    Wrapper Class to combine source & destination
    """

    source: dict
    destination: dict
    group: dict
    connector_id: str
    log_schema: str = DEFAULT_LOG_SCHEMA

    @property
    def pipeline_name(self) -> str:
        return f"{self.group.get('id')}_{self.source.get('id')}"

    @property
    def pipeline_display_name(self) -> str:
        return f"{self.source.get('schema')} <> {self.group.get('name')}"
