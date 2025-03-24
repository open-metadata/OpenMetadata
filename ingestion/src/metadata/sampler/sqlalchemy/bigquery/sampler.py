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

from sqlalchemy import Column
from sqlalchemy import Table as SqaTable
from sqlalchemy import text
from sqlalchemy.orm import Query

from metadata.generated.schema.entity.data.table import (
    ProfileSampleType,
    Table,
    TableType,
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


class BigQuerySampler(SQASampler):
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
        self.raw_dataset_type: Optional[TableType] = entity.tableType

    def set_tablesample(self, selectable: SqaTable):
        """Set the TABLESAMPLE clause for BigQuery
        Args:
            selectable (Table): Table object
        """
        if (
            self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE
            and self.raw_dataset_type != TableType.View
        ):
            return selectable.tablesample(
                text(f"{self.sample_config.profileSample or 100} PERCENT")
            )

        return selectable

    def _base_sample_query(self, column: Optional[Column], label=None):
        """Base query for sampling

        Args:
            column (Optional[Column]): if computing a column metric only sample for the column
            label (_type_, optional):

        Returns:
        """
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_bigquery import STRUCT

        if column is not None:
            column_parts = column.name.split(".")
            if len(column_parts) > 1:
                # for struct columns (e.g. `foo.bar`) we need to create a new column corresponding to
                # the struct (e.g. `foo`) and then use that in the sample query as the column that
                # will be query is `foo.bar`.
                # e.g. WITH sample AS (SELECT `foo` FROM table) SELECT `foo.bar`
                # FROM sample TABLESAMPLE SYSTEM (n PERCENT)
                column = Column(column_parts[0], STRUCT)
                # pylint: disable=protected-access
                column._set_parent(self.raw_dataset.__table__)
                # pylint: enable=protected-access

        return super()._base_sample_query(column, label=label)

    def get_sample_query(self, *, column=None) -> Query:
        """get query for sample data"""
        # TABLESAMPLE SYSTEM is not supported for views
        if (
            self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE
            and self.raw_dataset_type != TableType.View
        ):
            return self._base_sample_query(column).cte(
                f"{self.get_sampler_table_name()}_sample"
            )

        return super().get_sample_query(column=column)
