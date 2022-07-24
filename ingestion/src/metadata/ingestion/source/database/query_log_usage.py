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
Common Query Log Connector
"""
from datetime import datetime

from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.source.database.usage_source import UsageSource


class QueryLogUsageSource(UsageSource):
    def __init__(self, config: WorkflowSource, metadata_config: OpenMetadataConnection):
        super().__init__(config, metadata_config)
        self.analysis_date = datetime.today().strftime("%Y-%m-%d %H:%M:%S")

    @classmethod
    def create(cls, config_dict, metadata_config: WorkflowConfig):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        return cls(config, metadata_config)
