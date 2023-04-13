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
from typing import Dict, List, Optional, Union, cast

from sqlalchemy import Column, inspect, text
from sqlalchemy.orm import DeclarativeMeta, Query, Session, aliased
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.sqltypes import Enum

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalType,
    PartitionProfilerConfig,
    ProfileSampleType,
    TableData,
)
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.handle_partition import partition_filter_handler
from metadata.utils.sqa_utils import (
    build_query_filter,
    dispatch_to_date_or_datetime,
    get_integer_range_filter,
    get_partition_col_type,
    get_value_filter,
)

RANDOM_LABEL = "random"


def _object_value_for_elem(self, elem):
    """
    we have mapped DataType.ENUM: sqlalchemy.Enum
    if map by default return None,
    we will always get None because there is no enum map to lookup,
    so what we are doing here is basically trusting the database,
    that it will be storing the correct map key and showing directly that on the UI,
    and in this approach we will be only able to display
    what database has stored (i.e the key) and not the actual value of the same!
    """
    return self._object_lookup.get(elem, elem)  # pylint: disable=protected-access


Enum._object_value_for_elem = _object_value_for_elem  # pylint: disable=protected-access


class Sampler:
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(
        self,
        session: Optional[Session],
        table: DeclarativeMeta,
        sample_columns: List[str],
        profile_sample_config: Optional[ProfileSampleConfig] = None,
        partition_details: Optional[Dict] = None,
        profile_sample_query: Optional[str] = None,
    ):
        self.profile_sample = None
        self.profile_sample_type = None
        self.sample_columns = sample_columns
        if profile_sample_config:
            self.profile_sample = profile_sample_config.profile_sample
            self.profile_sample_type = profile_sample_config.profile_sample_type
        self.session = session
        self.table = table
        self._partition_details = partition_details
        self._profile_sample_query = profile_sample_query
        self.sample_limit = 100
        self._sample_rows = None

    @partition_filter_handler(build_sample=True)
    def get_sample_query(self) -> Query:
        if self.profile_sample_type == ProfileSampleType.PERCENTAGE:
            return (
                self.session.query(
                    *[Column(col_name) for col_name in self.sample_columns],
                    (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL)
                )
                .select_from(self.table)
                .suffix_with(
                    f"SAMPLE BERNOULLI ({self.profile_sample or 100})",
                    dialect=Dialects.Snowflake,
                )
                .cte(f"{self.table.__tablename__}_rnd")
            )
        table_query = self.session.query(*[Column(col_name) for col_name in self.sample_columns]).select_from(self.table)
        return (
            self.session.query(
                *[Column(col_name) for col_name in self.sample_columns],
                (ModuloFn(RandomNumFn(), table_query.count())).label(RANDOM_LABEL),
            )
            .select_from(self.table)
            .order_by(RANDOM_LABEL)
            .limit(self.profile_sample)
            .cte(f"{self.table.__tablename__}_rnd")
        )

    def random_sample(self) -> Union[DeclarativeMeta, AliasedClass]:
        """
        Either return a sampled CTE of table, or
        the full table if no sampling is required.
        """
        if self._profile_sample_query:
            return self._fetch_sample_data_with_query_object()

        if not self.profile_sample:
            if self._partition_details:
                return self._partitioned_table()

            return self.table

        # Add new RandomNumFn column
        rnd = self.get_sample_query()
        session_query = self.session.query(rnd)

        # Prepare sampled CTE
        sampled = session_query.where(rnd.c.random <= self.profile_sample).cte(
            f"{self.table.__tablename__}_sample"
        )
        # Assign as an alias
        return aliased(self.table, sampled)

    def fetch_sqa_sample_data(self, sample_columns: Optional[list] = None) -> TableData:
        """
        Use the sampler to retrieve sample data rows as per limit given by user
        :return: TableData to be added to the Table Entity
        """
        if self._profile_sample_query:
            return self._fetch_sample_data_from_user_query()

        # Add new RandomNumFn column
        rnd = self.get_sample_query()
        sqa_columns = [
            col
            for col in inspect(rnd).c
            if col.name != RANDOM_LABEL and col.name in self.sample_columns
        ]

        sqa_sample = (
            self.session.query(*sqa_columns)
            .select_from(rnd)
            .limit(self.sample_limit)
            .all()
        )
        return TableData(
            columns=[column.name for column in sqa_columns],
            rows=[list(row) for row in sqa_sample],
        )

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Returns a table data object using results from query execution"""
        rnd = self.session.execute(f"{self._profile_sample_query}")
        try:
            columns = [col.name for col in rnd.cursor.description]
        except AttributeError:
            columns = list(rnd.keys())
        return TableData(
            columns=columns,
            rows=[list(row) for row in rnd.fetchmany(100)],
        )

    def _fetch_sample_data_with_query_object(self) -> Query:
        """Returns sql alchemy object to use when running profiling"""
        return self.session.query(self.table).from_statement(
            text(f"{self._profile_sample_query}")
        )

    def _partitioned_table(self) -> Query:
        """Return the Query object for partitioned tables"""
        self._partition_details = cast(
            PartitionProfilerConfig, self._partition_details
        )  # satisfying type checker
        partition_field = self._partition_details.partitionColumnName

        type_ = get_partition_col_type(
            partition_field,
            self.table.__table__.c,
        )

        if (
            self._partition_details.partitionIntervalType
            == PartitionIntervalType.COLUMN_VALUE
        ):
            return aliased(
                self.table,
                (
                    self.session.query(*[Column(col_name) for col_name in self.sample_columns])
                    .select_from(self.table)
                    .filter(
                        get_value_filter(
                            Column(partition_field),
                            self._partition_details.partitionValues,
                        )
                    )
                    .subquery()
                ),
            )

        if (
            self._partition_details.partitionIntervalType
            == PartitionIntervalType.INTEGER_RANGE
        ):
            return aliased(
                self.table,
                (
                    self.session.query(*[Column(col_name) for col_name in self.sample_columns])
                    .select_from(self.table)
                    .filter(
                        get_integer_range_filter(
                            Column(partition_field),
                            self._partition_details.partitionIntegerRangeStart,
                            self._partition_details.partitionIntegerRangeEnd,
                        )
                    )
                    .subquery()
                ),
            )

        return aliased(
            self.table,
            (
                self.session.query(*[Column(col_name) for col_name in self.sample_columns])
                .select_from(self.table)
                .filter(
                    build_query_filter(
                        [
                            (
                                Column(partition_field),
                                "ge",
                                dispatch_to_date_or_datetime(
                                    self._partition_details.partitionInterval,
                                    text(
                                        self._partition_details.partitionIntervalUnit.value
                                    ),
                                    type_,
                                ),
                            )
                        ],
                        False,
                    )
                )
                .subquery()
            ),
        )
