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
import hashlib
from contextlib import contextmanager
from typing import List, Optional, Union, cast

from sqlalchemy import Column, inspect, text
from sqlalchemy.orm import DeclarativeMeta, Query
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.schema import Table
from sqlalchemy.sql.sqltypes import Enum

from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    ProfileSampleType,
    TableData,
)
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.processor.handle_partition import build_partition_predicate
from metadata.sampler.sampler_interface import SamplerInterface
from metadata.utils.constants import UTF_8
from metadata.utils.helpers import is_safe_sql_query
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()

RANDOM_LABEL = "random"

# Default maximum number of elements to extract from array columns to prevent OOM
DEFAULT_MAX_ARRAY_ELEMENTS = 10


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


class SQASampler(SamplerInterface, SQAInterfaceMixin):
    """
    Generates a sample of the data to not
    run the query in the whole table.

    Args:
        orm_table (Optional[DeclarativeMeta]): ORM Table
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._table = self.build_table_orm(
            self.entity, self.service_connection_config, self.ometa_client
        )
        self._active_sessions = set()

    @property
    def raw_dataset(self):
        return self._table

    def get_client(self):
        """Build the SQA Client"""
        session_factory = create_and_bind_thread_safe_session(self.connection)
        session = session_factory()
        self._active_sessions.add(session)
        return session

    @contextmanager
    def get_client_context(self):
        """Get client as context manager for proper cleanup"""
        session = self.get_client()
        try:
            yield session
        finally:
            if session in self._active_sessions:
                self._active_sessions.remove(session)
            session.close()

    def set_tablesample(self, selectable: Table):
        """Set the tablesample for the table. To be implemented by the child SQA sampler class
        Args:
            selectable (Table): a selectable table
        """
        return selectable

    def _get_max_array_elements(self) -> int:
        """Get the maximum number of array elements from config or use default"""
        if (
            self.sample_config
            and hasattr(self.sample_config, "maxArrayElements")
            and self.sample_config.maxArrayElements
        ):
            return self.sample_config.maxArrayElements
        return DEFAULT_MAX_ARRAY_ELEMENTS

    def _handle_array_column(self, column: Column) -> bool:
        """Check if a column is an array type"""
        # Implement this method in the child classes
        return False

    def _process_array_value(self, value):
        """Process array values to convert numpy arrays to Python lists"""
        import numpy as np  # pylint: disable=import-outside-toplevel

        if isinstance(value, np.ndarray):
            return value.tolist()
        return value

    def _get_slice_expression(self, column: Column):
        """Generate SQL expression to slice array elements at query level
        By default, we return the column as is.
        Child classes can override this method to return a different expression.
        """
        return column

    def _base_sample_query(self, column: Optional[Column], label=None):
        """Base query for sampling

        Args:
            column (Optional[Column]): if computing a column metric only sample for the column
            label (_type_, optional):

        Returns:
        """
        # only sample the column if we are computing a column metric to limit the amount of data scaned
        selectable = self.set_tablesample(self.raw_dataset.__table__)
        client = self.get_client()

        entity = selectable if column is None else selectable.c.get(column.key)
        if label is not None:
            query = client.query(entity, label)
        else:
            query = client.query(entity)

        if self.partition_details:
            query = self.get_partitioned_query(query)
        return query

    def get_sampler_table_name(self) -> str:
        """Get the base name of the SQA table for sampling.
        We use MD5 as a hashing algorithm to generate a unique name for the table
        keeping its length controlled. Otherwise, we ended up having issues
        with names getting truncated when we add the suffixes to the identifiers
        such as _sample, or _rnd.
        """
        encoded_name = self.raw_dataset.__tablename__.encode(UTF_8)
        hash_object = hashlib.md5(encoded_name)
        return hash_object.hexdigest()

    def get_sample_query(self, *, column=None) -> Query:
        """get query for sample data"""
        client = self.get_client()
        if self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
            rnd = self._base_sample_query(
                column,
                (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
            ).cte(f"{self.get_sampler_table_name()}_rnd")
            session_query = client.query(rnd)
            return session_query.where(
                rnd.c.random <= self.sample_config.profileSample
            ).cte(f"{self.get_sampler_table_name()}_sample")

        table_query = client.query(self.raw_dataset)
        if self.partition_details:
            table_query = self.get_partitioned_query(table_query)
        session_query = self._base_sample_query(
            column,
            (ModuloFn(RandomNumFn(), table_query.count())).label(RANDOM_LABEL)
            if self.sample_config.randomizedSample
            else None,
        )
        query = (
            session_query.order_by(RANDOM_LABEL)
            if self.sample_config.randomizedSample
            else session_query
        )
        return query.limit(self.sample_config.profileSample).cte(
            f"{self.get_sampler_table_name()}_rnd"
        )

    def get_dataset(self, column=None, **__) -> Union[DeclarativeMeta, AliasedClass]:
        """
        Either return a sampled CTE of table, or
        the full table if no sampling is required.
        """
        if self.sample_query:
            return self._rdn_sample_from_user_query()

        if not self.sample_config.profileSample or (
            self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE
            and self.sample_config.profileSample == 100
        ):
            if self.partition_details:
                partitioned = self._partitioned_table()
                return partitioned.cte(f"{self.get_sampler_table_name()}_partitioned")

            return self.raw_dataset

        return self.get_sample_query(column=column)

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

        with self.get_client_context() as client:

            # Handle array columns with special query modification
            max_elements = self._get_max_array_elements()
            select_columns = []
            has_array_columns = False

            for col in sqa_columns:
                if self._handle_array_column(col):
                    slice_expression = self._get_slice_expression(col)
                    select_columns.append(slice_expression)
                    logger.debug(
                        f"Limiting array column {col.name} to {max_elements} elements to prevent OOM"
                    )
                    has_array_columns = True
                else:
                    select_columns.append(col)

            # Create query with modified columns
            sqa_sample = (
                client.query(*select_columns)
                .select_from(ds)
                .limit(self.sample_limit)
                .all()
            )

        # Process array columns manually if we used text() expressions
        processed_rows = []
        if has_array_columns:
            for row in sqa_sample:
                processed_row = []
                for i, col in enumerate(sqa_columns):
                    value = row[i]
                    if self._handle_array_column(col):
                        processed_value = self._process_array_value(value)
                        processed_row.append(processed_value)
                    else:
                        processed_row.append(value)
                processed_rows.append(processed_row)
        else:
            processed_rows = [list(row) for row in sqa_sample]
        return TableData(
            columns=[column.name for column in sqa_columns],
            rows=processed_rows,
        )

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Returns a table data object using results from query execution"""
        if not is_safe_sql_query(self.sample_query):
            raise RuntimeError(f"SQL expression is not safe\n\n{self.sample_query}")

        with self.get_client_context() as client:
            rnd = client.execute(f"{self.sample_query}")
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
        if not is_safe_sql_query(self.sample_query):
            raise RuntimeError(f"SQL expression is not safe\n\n{self.sample_query}")

        stmt = text(f"{self.sample_query}")
        stmt = stmt.columns(*list(inspect(self.raw_dataset).c))
        return (
            self.get_client()
            .query(stmt.subquery())
            .cte(f"{self.get_sampler_table_name()}_user_sampled")
        )

    def _partitioned_table(self) -> Query:
        """Return the Query object for partitioned tables"""
        return self.get_partitioned_query()

    def get_partitioned_query(self, query=None) -> Query:
        """Return the partitioned query"""
        self.partition_details = cast(
            PartitionProfilerConfig, self.partition_details
        )  # satisfying type checker
        partition_filter = build_partition_predicate(
            self.partition_details,
            self.raw_dataset.__table__.c,
        )
        if query is not None:
            return query.filter(partition_filter)
        return self.get_client().query(self.raw_dataset).filter(partition_filter)

    def get_columns(self):
        """get columns from entity"""
        return list(inspect(self.raw_dataset).c)

    def close(self):
        """Close the connection"""
        for session in self._active_sessions:
            session.close()
        self.connection.pool.dispose()
