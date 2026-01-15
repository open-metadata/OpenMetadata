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
from typing import Callable, cast

from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import (
    TableRowInsertedCountToBeBetweenValidator,
)
from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
)
from metadata.readers.dataframe.models import DatalakeTableSchemaWrapper
from metadata.sampler.models import ProfileSampleType
from metadata.sampler.sampler_interface import SampleConfig
from metadata.utils.datalake.datalake_utils import (
    DatalakeColumnWrapper,
    fetch_dataframe_generator,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class PandasInterfaceMixin:
    """Interface mixin grouping shared methods between test suite and profiler interfaces"""

    def get_partitioned_df(
        self, partition_details: PartitionProfilerConfig, raw_dataset: Callable
    ) -> Callable:
        """Get partitioned dataframe

        Args:
            raw_dataset: Callable generating the dataframes

        Returns:
            Generator of partitioned dataframes
        """

        def yield_df_partitions():
            dfs = raw_dataset
            if (
                self.table_partition_config.partitionIntervalType
                == PartitionIntervalTypes.COLUMN_VALUE
            ):
                for df in dfs():
                    yield df[
                        df[self.table_partition_config.partitionColumnName].isin(
                            self.table_partition_config.partitionValues
                        )
                    ]
            elif (
                self.table_partition_config.partitionIntervalType
                == PartitionIntervalTypes.INTEGER_RANGE
            ):
                for df in dfs():
                    yield df[
                        df[self.table_partition_config.partitionColumnName].between(
                            self.table_partition_config.partitionIntegerRangeStart,
                            self.table_partition_config.partitionIntegerRangeEnd,
                        )
                    ]
            elif (
                self.table_partition_config.partitionIntervalType
                in {
                    PartitionIntervalTypes.INGESTION_TIME,
                    PartitionIntervalTypes.TIME_UNIT,
                }
                and self.table_partition_config.partitionIntervalUnit
                and self.table_partition_config.partitionInterval
            ):
                for df in dfs():
                    yield df[
                        df[self.table_partition_config.partitionColumnName]
                        >= TableRowInsertedCountToBeBetweenValidator._get_threshold_date(  # pylint: disable=protected-access
                            (
                                self.table_partition_config.partitionIntervalUnit.value
                                if self.table_partition_config.partitionIntervalUnit
                                else "DAY"
                            ),
                            self.table_partition_config.partitionInterval or 1,
                        )
                    ]
            else:
                logger.warning(
                    "Partition interval type not recognized or missing necessary details. "
                    "Returning unpartitioned dataframes."
                )
                yield from dfs()

        self.table_partition_config = cast(PartitionProfilerConfig, partition_details)
        return yield_df_partitions

    def get_sampled_query_dataframe(
        self, sample_query: str | None, raw_dataset: Callable
    ) -> Callable:
        """Get sampled dataframe based on user query

        Args:
            sample_query: User-defined query to sample data

        Returns:
            Generator of sampled dataframes
        """

        def yield_sampled_dfs():
            dfs = raw_dataset
            for df in dfs():
                yield df.query(sample_query)

        return yield_sampled_dfs

    def get_sampled_dataframe(
        self, raw_dataset: Callable, sample_config: SampleConfig
    ) -> Callable:
        """Get sampled dataframe based on profiler config

        Returns:
            DatalakeColumnWrapper with sampled dataframe generator
        """

        def yield_sampled_dfs():
            dfs = raw_dataset
            if sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
                # Sampling based on percentage of rows will be applied to each dataframe chunk
                # to ensure consistent efficiency across large dataset. Other option would be to
                # either concatenate all dataframes (may cause OOM) or perform 2 passes (one to count rows,
                # another to sample) which would be less efficient.
                try:
                    percentage = sample_config.profileSample or 100
                    for df in dfs():
                        yield df.sample(frac=percentage / 100)
                except Exception as exc:
                    logger.error(
                        f"Error sampling dataframes based on percentage {sample_config.profileSample}: {exc}"
                    )
            elif sample_config.profileSampleType == ProfileSampleType.ROWS:
                try:
                    rows = sample_config.profileSample or 0
                    streamed_rows = 0
                    for df in dfs():
                        yield df.sample(n=rows)
                        streamed_rows += len(df)
                        if streamed_rows >= rows:
                            break
                except Exception as exc:
                    logger.error(
                        f"Error sampling dataframes based on rows {sample_config.profileSample}: {exc}"
                    )
            else:
                logger.warning(
                    "Sample type not recognized. Returning un-sampled dataframes."
                )
                yield from dfs()

        return yield_sampled_dfs

    def get_dataframes(
        self, service_connection_config, client, table
    ) -> DatalakeColumnWrapper:
        """
        Return the datalake column wrapper. The object has a dataframes argument which gives access
        to the generator to iterate over the dataframes. The generator will be re create at each call of
        DatalakeColumnWrapper.dataframes

        Args:
            service_connection_config: Datalake connection config
            client: Datalake client
            table: Table entity
        Returns:
            DatalakeColumnWrapper
        """
        data = fetch_dataframe_generator(
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
            return data
        raise TypeError(f"Couldn't fetch {table.name.root}")
