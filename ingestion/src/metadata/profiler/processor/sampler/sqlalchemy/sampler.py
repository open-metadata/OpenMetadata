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
import traceback
from typing import List, Optional, Union, cast

from sqlalchemy import Column, inspect, text
from sqlalchemy.orm import DeclarativeMeta, Query, aliased
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.sql.sqltypes import Enum

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    PartitionProfilerConfig,
    ProfileSampleType,
    TableData,
)
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.registry import Dialects
from metadata.profiler.processor.handle_partition import partition_filter_handler
from metadata.profiler.processor.sampler.sampler_interface import SamplerInterface
from metadata.utils.helpers import is_safe_sql_query
from metadata.utils.logger import profiler_interface_registry_logger
from metadata.utils.sqa_utils import (
    build_query_filter,
    dispatch_to_date_or_datetime,
    get_integer_range_filter,
    get_partition_col_type,
    get_value_filter,
)

logger = profiler_interface_registry_logger()

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


class SQASampler(SamplerInterface):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def _base_sample_query(self, column: Optional[Column], label=None):
        """Base query for sampling

        Args:
            column (Optional[Column]): if computing a column metric only sample for the column
            label (_type_, optional):

        Returns:
        """
        # only sample the column if we are computing a column metric to limit the amount of data scaned
        entity = self.table if column is None else column
        if label is not None:
            return self.client.query(entity, label)
        return self.client.query(entity)

    @partition_filter_handler(build_sample=True)
    def get_sample_query(self, *, column=None) -> Query:
        """get query for sample data"""
        if self.profile_sample_type == ProfileSampleType.PERCENTAGE:
            rnd = (
                self._base_sample_query(
                    column,
                    (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
                )
                .suffix_with(
                    f"SAMPLE BERNOULLI ({self.profile_sample or 100})",
                    dialect=Dialects.Snowflake,
                )
                .cte(f"{self.table.__tablename__}_rnd")
            )
            session_query = self.client.query(rnd)
            return session_query.where(rnd.c.random <= self.profile_sample).cte(
                f"{self.table.__tablename__}_sample"
            )

        table_query = self.client.query(self.table)
        session_query = self._base_sample_query(
            column,
            (ModuloFn(RandomNumFn(), table_query.count())).label(RANDOM_LABEL),
        )
        return (
            session_query.order_by(RANDOM_LABEL)
            .limit(self.profile_sample)
            .cte(f"{self.table.__tablename__}_rnd")
        )

    def random_sample(self, ccolumn=None) -> Union[DeclarativeMeta, AliasedClass]:
        """
        Either return a sampled CTE of table, or
        the full table if no sampling is required.
        """
        if self._profile_sample_query:
            return self._rdn_sample_from_user_query()

        if not self.profile_sample or int(self.profile_sample) == 100:
            if self._partition_details:
                return self._partitioned_table()

            return self.table

        # Add new RandomNumFn column
        sampled = self.get_sample_query(column=ccolumn)

        # Assign as an alias
        return aliased(self.table, sampled)

    def fetch_sample_data(self, columns: Optional[List[Column]] = None) -> TableData:
        """
        Use the sampler to retrieve sample data rows as per limit given by user

        Args:
            columns (Optional[List]): List of columns to fetch
        Retunrs:
            TableData to be added to the Table Entity
        """
        if self._profile_sample_query:
            return self._fetch_sample_data_from_user_query()

        # Add new RandomNumFn column
        rnd = self.get_sample_query()
        if not columns:
            sqa_columns = [col for col in inspect(rnd).c if col.name != RANDOM_LABEL]
        else:
            # we can't directly use columns as it is bound to self.table and not the rnd table.
            # If we use it, it will result in a cross join between self.table and rnd table
            names = [col.name for col in columns]
            sqa_columns = [
                col
                for col in inspect(rnd).c
                if col.name != RANDOM_LABEL and col.name in names
            ]

        try:
            sqa_sample = (
                self.client.query(*sqa_columns)
                .select_from(rnd)
                .limit(self.sample_limit)
                .all()
            )
        except Exception:
            logger.debug(
                "Cannot fetch sample data with random sampling. Falling back to 100 rows."
            )
            logger.debug(traceback.format_exc())
            sqa_columns = list(inspect(self.table).c)
            sqa_sample = (
                self.client.query(*sqa_columns).select_from(self.table).limit(100).all()
            )

        return TableData(
            columns=[column.name for column in sqa_columns],
            rows=[list(row) for row in sqa_sample],
        )

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Returns a table data object using results from query execution"""
        if not is_safe_sql_query(self._profile_sample_query):
            raise RuntimeError(
                f"SQL expression is not safe\n\n{self._profile_sample_query}"
            )

        rnd = self.client.execute(f"{self._profile_sample_query}")
        try:
            columns = [col.name for col in rnd.cursor.description]
        except AttributeError:
            columns = list(rnd.keys())
        return TableData(
            columns=columns,
            rows=[list(row) for row in rnd.fetchmany(100)],
        )

    def _rdn_sample_from_user_query(self) -> Query:
        """Returns sql alchemy object to use when running profiling"""
        if not is_safe_sql_query(self._profile_sample_query):
            raise RuntimeError(
                f"SQL expression is not safe\n\n{self._profile_sample_query}"
            )

        return self.client.query(self.table).from_statement(
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
            == PartitionIntervalTypes.COLUMN_VALUE
        ):
            return aliased(
                self.table,
                (
                    self.client.query(self.table)
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
            == PartitionIntervalTypes.INTEGER_RANGE
        ):
            return aliased(
                self.table,
                (
                    self.client.query(self.table)
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
                self.client.query(self.table)
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
