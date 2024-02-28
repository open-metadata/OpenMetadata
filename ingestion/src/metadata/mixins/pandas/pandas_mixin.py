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
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""
import math
import random
from typing import cast

from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator,
)
from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
    ProfileSampleType,
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

    def return_ometa_dataframes_sampled(
        self, service_connection_config, client, table, profile_sample_config
    ):
        """
        returns sampled ometa dataframes
        """
        data = fetch_dataframe(
            config_source=service_connection_config.configSource,
            client=client,
            file_fqn=DatalakeTableSchemaWrapper(
                key=table.name.__root__,
                bucket_name=table.databaseSchema.name,
                file_extension=table.fileFormat,
            ),
        )
        if data:
            random.shuffle(data)
            # sampling data based on profiler config (if any)
            if hasattr(profile_sample_config, "profile_sample"):
                if (
                    profile_sample_config.profile_sample_type
                    == ProfileSampleType.PERCENTAGE
                ):
                    return [
                        df.sample(
                            frac=profile_sample_config.profile_sample / 100,
                            random_state=random.randint(0, 100),
                            replace=True,
                        )
                        for df in data
                    ]
                if profile_sample_config.profile_sample_type == ProfileSampleType.ROWS:
                    sample_rows_per_chunk: int = math.floor(
                        profile_sample_config.profile_sample / len(data)
                    )
                    return [
                        df.sample(
                            n=sample_rows_per_chunk,
                            random_state=random.randint(0, 100),
                            replace=True,
                        )
                        for df in data
                    ]
            return data
        raise TypeError(f"Couldn't fetch {table.name.__root__}")
