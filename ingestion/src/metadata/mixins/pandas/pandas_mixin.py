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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
import random
from typing import cast

from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator,
)
from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
)
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.utils.datalake.datalake_utils import fetch_dataframe
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class PandasInterfaceMixin:
    """Interface mixin grouping shared methods between test suite and profiler interfaces"""

    def get_partitioned_df(self, dfs):
        """Get partitioned dataframe

        Returns:
            DataFrame
        """
        self.table_partition_config = cast(
            PartitionProfilerConfig, self.table_partition_config
        )
        partition_field = self.table_partition_config.partitionColumnName
        if (
            self.table_partition_config.partitionIntervalType
            == PartitionIntervalTypes.COLUMN_VALUE
        ):
            return [
                df[
                    df[partition_field].isin(
                        self.table_partition_config.partitionValues
                    )
                ]
                for df in dfs
            ]
        if (
            self.table_partition_config.partitionIntervalType
            == PartitionIntervalTypes.INTEGER_RANGE
        ):
            return [
                df[
                    df[partition_field].between(
                        self.table_partition_config.partitionIntegerRangeStart,
                        self.table_partition_config.partitionIntegerRangeEnd,
                    )
                ]
                for df in dfs
            ]
        return [
            df[
                df[partition_field]
                >= TableRowInsertedCountToBeBetweenValidator._get_threshold_date(  # pylint: disable=protected-access
                    self.table_partition_config.partitionIntervalUnit.value,
                    self.table_partition_config.partitionInterval,
                )
            ]
            for df in dfs
        ]

    def get_dataframes(self, service_connection_config, client, table):
        """
        returns sampled ometa dataframes
        """
        data = fetch_dataframe(
            config_source=service_connection_config.configSource,
            client=client,
            file_fqn=DatalakeTableSchemaWrapper(
                key=table.name.root,
                bucket_name=table.databaseSchema.name,
                file_extension=table.fileFormat,
                separator=None,
            ),
        )
        if data:
            random.shuffle(data)
            return data
        raise TypeError(f"Couldn't fetch {table.name.root}")
