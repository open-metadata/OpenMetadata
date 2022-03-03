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
OpenMetadata REST Sink implementation for the ORM Profiler results
"""
import traceback

from metadata.config.common import ConfigModel
from metadata.ingestion.api.common import Entity, WorkflowContext
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig
from metadata.orm_profiler.api.models import ProfilerResponse
from metadata.orm_profiler.utils import logger

logger = logger()


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestSink(Sink[Entity]):

    config: MetadataRestSinkConfig
    status: SinkStatus

    def __init__(
        self,
        ctx: WorkflowContext,
        config: MetadataRestSinkConfig,
        metadata_config: MetadataServerConfig,
    ):
        super().__init__(ctx)
        self.config = config
        self.metadata_config = metadata_config
        self.status = SinkStatus()
        self.wrote_something = False
        self.metadata = OpenMetadata(self.metadata_config)

    @classmethod
    def create(
        cls, config_dict: dict, metadata_config_dict: dict, ctx: WorkflowContext
    ):
        config = MetadataRestSinkConfig.parse_obj(config_dict)
        metadata_config = MetadataServerConfig.parse_obj(metadata_config_dict)
        return cls(ctx, config, metadata_config)

    def get_status(self) -> SinkStatus:
        return self.status

    def close(self) -> None:
        self.metadata.close()

    def write_record(self, record: ProfilerResponse) -> None:
        try:
            self.metadata.ingest_table_profile_data(
                table=record.table, table_profile=[record.profile]
            )

            if record.record_tests:
                for table_test in record.record_tests.table_tests:
                    self.metadata.add_table_test(
                        table=record.table, table_test=table_test
                    )

                for col_test in record.record_tests.column_tests:
                    self.metadata.add_column_test(table=record.table, col_test=col_test)

            logger.info(
                f"Successfully ingested profiler & test data for {record.table.fullyQualifiedName}"
            )
            self.status.records_written(f"Table: {record.table.fullyQualifiedName}")

        except APIError as err:
            logger.error(
                f"Failed to sink profiler & test data for {record.table.fullyQualifiedName} - {err}"
            )
            logger.debug(traceback.print_exc())
            self.status.failure(f"Table: {record.table.fullyQualifiedName}")
