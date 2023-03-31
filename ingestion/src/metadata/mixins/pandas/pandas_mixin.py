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
from metadata.data_quality.validations.table.pandas.tableRowInsertedCountToBeBetween import \
    TableRowInsertedCountToBeBetweenValidator
from metadata.generated.schema.entity.data.table import PartitionIntervalType


class PandasInterfaceMixin:
    """Interface mixin grouping shared methods between test suite and profiler interfaces"""

    def get_partitioned_df(self, df):
        """Get partitioned dataframe

        Returns:
            DataFrame
        """
        partition_field = self.table_partition_config.partitionColumnName
        if (
            self.table_partition_config.partitionIntervalType
            == PartitionIntervalType.COLUMN_VALUE
        ):
            return df[
                df[partition_field].isin(self.table_partition_config.partitionValues)
            ]
        if (
            self.table_partition_config.partitionIntervalType
            == PartitionIntervalType.INTEGER_RANGE
        ):
            return df[
                df[partition_field].between(
                    self.table_partition_config.partitionIntegerRangeStart,
                    self.table_partition_config.partitionIntegerRangeEnd,
                )
            ]
        return df[
            df[partition_field]
            >= TableRowInsertedCountToBeBetweenValidator._get_threshold_date(  # pylint: disable=protected-access
                self.table_partition_config.partitionIntervalUnit.value,
                self.table_partition_config.partitionInterval,
            )
        ]
