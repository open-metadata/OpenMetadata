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
OpenMetadata REST Sink implementation for the Data Insight Profiler results
"""

import traceback
from typing import Optional, Union

from metadata.config.common import ConfigModel
from metadata.generated.schema.analytics.reportData import ReportData
from metadata.generated.schema.dataInsight.kpi.basic import KpiResult
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import data_insight_logger

logger = data_insight_logger()


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: Optional[str] = None


class MetadataRestSink(Sink[Entity]):
    """
    Metadata Sink sending the test suite
    to the OM API
    """

    config: MetadataRestSinkConfig
    status: SinkStatus

    def __init__(
        self,
        config: MetadataRestSinkConfig,
        metadata_config: OpenMetadataConnection,
    ):
        super().__init__()
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.metadata = OpenMetadata(self.metadata_config)

    @classmethod
    def create(cls, config_dict: dict, metadata_config: OpenMetadataConnection):
        config = MetadataRestSinkConfig.parse_obj(config_dict)
        return cls(config, metadata_config)

    def get_status(self) -> SinkStatus:
        return self.status

    def close(self) -> None:
        self.metadata.close()

    def write_record(self, record: Union[ReportData, KpiResult]) -> None:
        try:
            if isinstance(record, ReportData):
                self.metadata.add_data_insight_report_data(record)
                logger.info(
                    "Successfully ingested data insight for"
                    f"{record.data.__class__.__name__ if record.data else 'Unknown'}"
                )
                self.status.records_written(
                    f"Data Insight: {record.data.__class__.__name__ if record.data else 'Unknown'}"
                )
            if isinstance(record, KpiResult):
                self.metadata.add_kpi_result(fqn=record.kpiFqn.__root__, record=record)
                logger.info(f"Successfully ingested KPI for {record.kpiFqn}")
                self.status.records_written(f"Data Insight: {record.kpiFqn}")

        except APIError as err:
            if isinstance(record, ReportData):
                logger.debug(traceback.format_exc())
                logger.error(
                    "Failed to sink data insight data for "
                    f"{record.data.__class__.__name__ if record.data else 'Unknown'} - {err}"
                )
                self.status.failure(
                    f"Data Insight: {record.data.__class__.__name__ if record.data else 'Unknown'}"
                )
            if isinstance(record, KpiResult):
                logger.debug(traceback.format_exc())
                logger.error(f"Failed to sink KPI reasults for {record.kpiFqn} - {err}")
                self.status.failure(f"KPI Result: {record.kpiFqn}")
