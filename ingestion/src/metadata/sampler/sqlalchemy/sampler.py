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
from typing import List, Optional, Union, cast

from sqlalchemy import Column, TableSample, inspect, select, text
from sqlalchemy.orm import Query
from sqlalchemy.orm.util import AliasedClass
from sqlalchemy.schema import Table
from sqlalchemy.sql.sqltypes import Enum

from metadata.generated.schema.entity.data.table import (
    PartitionProfilerConfig,
    TableData,
)
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.dynamicSamplingConfig import DynamicSamplingConfig
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.ingestion.connections.session import create_and_bind_thread_safe_session
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin
from metadata.profiler.interface.sqlalchemy.stored_statistics_profiler import Metrics
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.functions.table_metric_computer import (
    ROW_COUNT,
    table_metric_computer_factory,
)
from metadata.profiler.processor.handle_partition import build_partition_predicate
from metadata.profiler.processor.runner import QueryRunner
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
        orm_table (Optional[type]): ORM Table
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._table = self.build_table_orm(
            self.entity, self.service_connection_config, self.ometa_client
        )
        self.session_factory = create_and_bind_thread_safe_session(self.connection)

    @property
    def raw_dataset(self):
        return self._table

    def get_client(self):
        """Build the SQA Client"""
        return self.session_factory()

    def set_tablesample(self, static: StaticSamplingConfig, selectable: Table):
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

    def _base_sample_query(
        self,
        selectable: Union[Table, TableSample],
        column: Optional[Column],
        label=None,
    ):
        """Base query for sampling

        Args:
            column (Optional[Column]): if computing a column metric only sample for the column
            label (_type_, optional):

        Returns:
        """
        with self.session_factory() as client:
            entity = selectable if column is None else selectable.c.get(column.key)
            if label is not None:
                query = client.query(entity, label)
            else:
                query = client.query(entity)

            if self.partition_details:
                query = self.get_partitioned_query(query)
            return query

    def _get_sample_config(self) -> Optional[StaticSamplingConfig]:
        """Get the sampling config from the sample config object"""
        static: Optional[StaticSamplingConfig] = self.sample_config.get_config(
            StaticSamplingConfig
        )
        dynamic: Optional[DynamicSamplingConfig] = self.sample_config.get_config(
            DynamicSamplingConfig
        )
        if dynamic:
            row_count = self._get_asset_row_count()
            if not dynamic.smartSampling and dynamic.thresholds is not None:
                for threshold in sorted(
                    dynamic.thresholds, key=lambda t: t.rowCountThreshold, reverse=True
                ):
                    if row_count >= threshold.rowCountThreshold:
                        static = StaticSamplingConfig(
                            profileSample=threshold.profileSample,
                            profileSampleType=threshold.profileSampleType,
                            samplingMethodType=threshold.samplingMethodType,
                        )
            if dynamic.smartSampling:
                static = self._get_tiered_sample(row_count)

        return static

    def _get_asset_row_count(self) -> int:
        """Get the row count for the table.
        Uses the table_metric_computer_factory which dispatches to database-specific
        system tables (pg_class, information_schema, sys.partitions, etc.) when a
        dialect-specific computer is registered, otherwise falls back to naive COUNT(*).
        When partition details are set, always uses COUNT(*) to respect the filter.
        """
        if self._row_count is not None:
            return self._row_count

        if self.partition_details:
            with self.session_factory() as client:
                query = client.query(self.raw_dataset)
                query = self.get_partitioned_query(query)
                return query.count()

        with self.session_factory() as session:
            runner = QueryRunner(
                session=session,
                dataset=self.raw_dataset,
                raw_dataset=self.raw_dataset,
            )
            computer = table_metric_computer_factory.construct(
                session.get_bind().dialect.name,
                runner=runner,
                metrics=[Metrics.rowCount],
                conn_config=self.service_connection_config,
                entity=self.entity,
            )
            result = computer.compute()
            if result and hasattr(result, ROW_COUNT):
                row_count = getattr(result, ROW_COUNT)
                if row_count is not None:
                    self._row_count = int(row_count)
                    return self._row_count
            # this will cause the sampler to fallback to 100% sampling
            return 0

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

    def get_sample_query(self, static: StaticSamplingConfig, *, column=None) -> Query:
        """get query for sample data"""
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)
        with self.session_factory() as client:
            if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
                rnd = self._base_sample_query(
                    selectable,
                    column,
                    (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
                ).cte(f"{self.get_sampler_table_name()}_rnd")
                session_query = client.query(rnd)
                return session_query.where(rnd.c.random <= static.profileSample).cte(
                    f"{self.get_sampler_table_name()}_sample"
                )

            table_query = client.query(self.raw_dataset)
            if self.partition_details:
                table_query = self.get_partitioned_query(table_query)
            session_query = self._base_sample_query(
                selectable,
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
            return query.limit(static.profileSample if static else None).cte(
                f"{self.get_sampler_table_name()}_rnd"
            )

    def get_dataset(self, column=None, **__) -> Union[type, AliasedClass]:
        """
        Either return a sampled CTE of table, or
        the full table if no sampling is required.
        """
        if self.sample_query:
            return self._rdn_sample_from_user_query()

        static = self._get_sample_config()

        if (
            not static
            or not static.profileSample
            or (
                static.profileSampleType == ProfileSampleType.PERCENTAGE
                and static.profileSample == 100
            )
        ):
            if self.partition_details:
                return self._partitioned_table()

            return self.raw_dataset

        return self.get_sample_query(static, column=column)

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

        with self.session_factory() as client:

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

        # Process rows: handle array columns and truncate large text values
        # to prevent OOM in downstream processing.
        processed_rows = []
        for row in sqa_sample:
            processed_row = []
            for i, col in enumerate(sqa_columns):
                value = row[i]
                if has_array_columns and self._handle_array_column(col):
                    value = self._process_array_value(value)
                processed_row.append(self._truncate_cell(value))
            processed_rows.append(processed_row)
        return TableData(
            columns=[column.name for column in sqa_columns],
            rows=processed_rows,
        )

    def _fetch_sample_data_from_user_query(self) -> TableData:
        """Returns a table data object using results from query execution"""
        if not is_safe_sql_query(self.sample_query):
            raise RuntimeError(f"SQL expression is not safe\n\n{self.sample_query}")

        with self.session_factory() as client:
            rnd = client.execute(text(f"{self.sample_query}"))
        try:
            columns = [col.name for col in rnd.cursor.description]
        except AttributeError:
            columns = list(rnd.keys())
        return TableData(
            columns=columns,
            rows=[
                [self._truncate_cell(cell) for cell in row]
                for row in rnd.fetchmany(100)
            ],
        )

    def _rdn_sample_from_user_query(self) -> Query:
        """Returns sql alchemy object to use when running profiling"""
        if not is_safe_sql_query(self.sample_query):
            raise RuntimeError(f"SQL expression is not safe\n\n{self.sample_query}")

        stmt = text(f"{self.sample_query}")
        stmt = stmt.columns(*list(inspect(self.raw_dataset).c))

        with self.session_factory() as client:
            return client.query(stmt.subquery()).cte(
                f"{self.get_sampler_table_name()}_user_sampled"
            )

    def _partitioned_table(self):
        """Return a CTE for partitioned tables.

        Build the CTE using Core select() so it does not require an active Session.
        """
        self.partition_details = cast(PartitionProfilerConfig, self.partition_details)
        partition_filter = build_partition_predicate(
            self.partition_details,
            self.raw_dataset.__table__.c,
        )
        stmt = select(self.raw_dataset).where(partition_filter)
        return stmt.cte(f"{self.get_sampler_table_name()}_partitioned")

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

        # Return a Core select so callers do not require an active Session
        return select(self.raw_dataset).where(partition_filter)

    def get_columns(self):
        """get columns from entity"""
        return list(inspect(self.raw_dataset).c)

    def close(self):
        """Close the connection"""
        try:
            self.connection.pool.dispose()
        except Exception as e:
            logger.warning(f"Error disposing connection pool: {e}")

    def __del__(self):
        """Destructor to ensure cleanup when object is garbage collected"""
        try:
            self.close()
        except Exception:
            # Ignore errors during cleanup in destructor
            pass
