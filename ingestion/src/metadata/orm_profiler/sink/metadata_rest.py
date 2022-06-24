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
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.api.common import Entity
from metadata.ingestion.api.sink import Sink, SinkStatus
from metadata.ingestion.ometa.client import APIError
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.orm_profiler.api.models import ProfilerResponse
from metadata.utils.logger import profiler_logger

logger = profiler_logger()


class MetadataRestSinkConfig(ConfigModel):
    api_endpoint: str = None


class MetadataRestSink(Sink[Entity]):
    """
    Metadata Sink sending the profiler
    and tests results to the OM API
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

    def write_record(self, record: ProfilerResponse) -> None:
        try:
            self.metadata.ingest_table_profile_data(
                table=record.table, table_profile=[record.profile]
            )

            if record.record_tests:
                if record.profile.profileQuery and record.profile.profileSample:
                    self.metadata.update_profile_query(
                        fqn=record.table.fullyQualifiedName.__root__,
                        profileQuery=record.profile.profileQuery,
                        profileSample=record.profile.profileSample,
                    )
                if record.profile.profileSample and not record.profile.profileQuery:
                    self.metadata.update_profile_sample(
                        fqn=record.table.fullyQualifiedName.__root__,
                        profile_sample=record.profile.profileSample,
                    )
                if record.profile.profileQuery and not record.profile.profileSample:
                    self.metadata.update_profile_query(
                        fqn=record.table.fullyQualifiedName.__root__,
                        profileQuery=record.profile.profileQuery,
                    )
                for table_test in record.record_tests.table_tests:
                    self.metadata.add_table_test(
                        table=record.table, table_test=table_test
                    )

                for col_test in record.record_tests.column_tests:
                    self.metadata.add_column_test(table=record.table, col_test=col_test)

            if record.sample_data:
                self.metadata.ingest_table_sample_data(
                    table=record.table, sample_data=record.sample_data
                )

            logger.info(
                f"Successfully ingested profiler & test data for {record.table.fullyQualifiedName.__root__}"
            )
            self.status.records_written(
                f"Table: {record.table.fullyQualifiedName.__root__}"
            )

        except APIError as err:
            logger.error(
                f"Failed to sink profiler & test data for {record.table.fullyQualifiedName.__root__} - {err}"
            )
            logger.debug(traceback.format_exc())
            self.status.failure(f"Table: {record.table.fullyQualifiedName.__root__}")
