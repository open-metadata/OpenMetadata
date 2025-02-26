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
Helper module to handle data sampling
for the profiler
"""

from typing import Dict, Optional, Union

from sqlalchemy import Table, func, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import (
    ProfileSampleType,
    SamplingMethodType,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
)
from metadata.generated.schema.entity.services.connections.database.datalakeConnection import (
    DatalakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT


class SnowflakeSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    # pylint: disable=too-many-arguments
    def __init__(
        self,
        service_connection_config: Union[DatabaseConnection, DatalakeConnection],
        ometa_client: OpenMetadata,
        entity: Table,
        sample_config: Optional[SampleConfig] = None,
        partition_details: Optional[Dict] = None,
        sample_query: Optional[str] = None,
        storage_config: DataStorageConfig = None,
        sample_data_count: Optional[int] = SAMPLE_DATA_DEFAULT_COUNT,
        **kwargs,
    ):
        super().__init__(
            service_connection_config=service_connection_config,
            ometa_client=ometa_client,
            entity=entity,
            sample_config=sample_config,
            partition_details=partition_details,
            sample_query=sample_query,
            storage_config=storage_config,
            sample_data_count=sample_data_count,
            **kwargs,
        )
        self.sampling_method_type = func.bernoulli
        if (
            sample_config
            and sample_config.samplingMethodType == SamplingMethodType.SYSTEM
        ):
            self.sampling_method_type = func.system

    def set_tablesample(self, selectable: Table):
        """Set the TABLESAMPLE clause for Snowflake
        Args:
            selectable (Table): _description_
        """
        if self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
            return selectable.tablesample(
                self.sampling_method_type(self.sample_config.profileSample or 100)
            )

        return selectable.tablesample(
            func.ROW(text(f"{self.sample_config.profileSample or 100} ROWS"))
        )

    def get_sample_query(self, *, column=None) -> CTE:
        """get query for sample data"""
        rnd = self._base_sample_query(column).cte(
            f"{self.get_sampler_table_name()}_rnd"
        )
        query = self.client.query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")
