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
"""
Helper module to handle data sampling
for the profiler
"""
import traceback
from typing import Dict, List, Optional, Union

from sqlalchemy import Column
from sqlalchemy import Table as SqaTable
from sqlalchemy import inspect, text
from sqlalchemy.orm import Query

from metadata.generated.schema.entity.data.table import (
    ProfileSampleType,
    Table,
    TableData,
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
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()

RANDOM_LABEL = "random"


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

    def fetch_sample_data(self, columns: Optional[List[Column]] = None) -> TableData:
        """
        Use the sampler to retrieve sample data rows as per limit given by user

        Args:
            columns (Optional[List]): List of columns to fetch
        Returns:
            TableData to be added to the Table Entity
        """
        if self.sample_query:
            return self._fetch_sample_data_from_user_query()

        # Add new RandomNumFn column
        ds = self.get_dataset()
        if not columns:
            sqa_columns = [col for col in inspect(ds).c if col.name != RANDOM_LABEL]
        else:
            # we can't directly use columns as it is bound to self.raw_dataset and not the rnd table.
            # If we use it, it will result in a cross join between self.raw_dataset and rnd table
            names = [col.name for col in columns]
            sqa_columns = [
                col
                for col in inspect(ds).c
                if col.name != RANDOM_LABEL and col.name in names
            ]
        with self.get_client() as client:
            try:
                query = (
                    str(client.query(*sqa_columns)).replace(
                        f"`{ds.__table_args__['schema']}`.`{ds.__tablename__}`",
                        f"`{self.entity.database.name}`.`{ds.__table_args__['schema']}`.`{ds.__tablename__}`",
                    )
                    + f" LIMIT {self.sample_limit}"
                )
                sqa_sample = client.execute(text(query))
            except Exception:
                logger.debug(
                    "Cannot fetch sample data with random sampling. Falling back to 100 rows."
                )
                logger.debug(traceback.format_exc())
                ds_inspect = inspect(self.raw_dataset)
                sqa_columns = list(ds_inspect.c)

                schema = ds_inspect.class_.__table_args__["schema"]
                table = ds_inspect.class_.__tablename__

                query = (
                    str(client.query(*sqa_columns)).replace(
                        f"`{schema}`.`{table}`",
                        f"`{self.entity.database.name}`.`{schema}`.`{table}`",
                    )
                    + f" LIMIT {self.sample_limit}"
                )
                sqa_sample = client.execute(text(query))
            return TableData(
                columns=[column.name for column in sqa_columns],
                rows=[list(row) for row in sqa_sample],
            )
