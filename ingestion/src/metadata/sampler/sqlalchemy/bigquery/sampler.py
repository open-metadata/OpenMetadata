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
Helper module to handle data sampling for the profiler (BigQuery).

This implementation mirrors the base SQA sampler logic and only adds
schema translation for BigQuery (project.dataset qualification). No
other behavior deviates from the base class.
"""
from typing import Dict, List, Optional, Union

from sqlalchemy import Column
from sqlalchemy import Table as SqaTable
from sqlalchemy import inspect as sqa_inspect
from sqlalchemy import text
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
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
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

        # Build selectable from the ORM table
        selectable = self.set_tablesample(self.raw_dataset.__table__)

        # Use schema_translate_map to qualify dataset with project without mutating table schema
        schema_translate_map = None
        try:
            project_name = getattr(self.entity.database, "name", None)
            dataset_name = getattr(selectable, "schema", None)
            if project_name and dataset_name and "." not in dataset_name:
                schema_translate_map = {dataset_name: f"{project_name}.{dataset_name}"}
        except Exception:
            pass

        with self.session_factory() as client:
            entity = selectable if column is None else selectable.c.get(column.key)
            if label is not None:
                query = client.query(entity, label)
            else:
                query = client.query(entity)

            if schema_translate_map:
                query = query.execution_options(
                    schema_translate_map=schema_translate_map
                )

            if self.partition_details:
                query = self.get_partitioned_query(query)
            return query

    def get_sample_query(self, *, column=None) -> Query:
        """Get query for sample data. Mirrors base logic and injects schema translation."""
        # TABLESAMPLE SYSTEM is not supported for views
        if (
            self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE
            and self.raw_dataset_type != TableType.View
        ):
            return self._base_sample_query(column).cte(
                f"{self.get_sampler_table_name()}_sample"
            )

        # Absolute sample size or randomized sample
        with self.session_factory() as client:
            if self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
                rnd = self._base_sample_query(
                    column,
                    (ModuloFn(RandomNumFn(), 100)).label(RANDOM_LABEL),
                ).cte(f"{self.get_sampler_table_name()}_rnd")
                session_query = client.query(rnd)
                return session_query.where(
                    rnd.c.random <= self.sample_config.profileSample
                ).cte(f"{self.get_sampler_table_name()}_sample")

            # Ensure schema translation on counting the base table
            schema_translate_map = None
            try:
                raw_table = self.raw_dataset.__table__
                dataset_name = getattr(raw_table, "schema", None)
                project_name = getattr(self.entity.database, "name", None)
                if project_name and dataset_name and "." not in dataset_name:
                    schema_translate_map = {
                        dataset_name: f"{project_name}.{dataset_name}"
                    }
            except Exception:
                pass

            table_query = client.query(self.raw_dataset)
            if schema_translate_map:
                table_query = table_query.execution_options(
                    schema_translate_map=schema_translate_map
                )
            if self.partition_details:
                table_query = self.get_partitioned_query(table_query)

            session_query = self._base_sample_query(
                column,
                (
                    (ModuloFn(RandomNumFn(), table_query.count())).label(RANDOM_LABEL)
                    if self.sample_config.randomizedSample
                    else None
                ),
            )

            query = (
                session_query.order_by(RANDOM_LABEL)
                if self.sample_config.randomizedSample
                else session_query
            )
            return query.limit(self.sample_config.profileSample).cte(
                f"{self.get_sampler_table_name()}_rnd"
            )

    def fetch_sample_data(self, columns: Optional[List[Column]] = None):
        """Override to ensure schema_translate_map is applied when selecting rows"""
        if self.sample_query:
            return self._fetch_sample_data_from_user_query()

        ds = self.get_dataset()
        if not columns:
            sqa_columns = [col for col in sqa_inspect(ds).c if col.name != RANDOM_LABEL]
        else:
            names = [col.name for col in columns]
            sqa_columns = [
                col
                for col in sqa_inspect(ds).c
                if col.name != RANDOM_LABEL and col.name in names
            ]

        with self.session_factory() as client:
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

            query = client.query(*select_columns).select_from(ds)

            # Apply schema translation for project.dataset if needed
            try:
                raw_table = self.raw_dataset.__table__
                dataset_name = getattr(raw_table, "schema", None)
                project_name = getattr(self.entity.database, "name", None)
                if project_name and dataset_name and "." not in dataset_name:
                    query = query.execution_options(
                        schema_translate_map={
                            dataset_name: f"{project_name}.{dataset_name}"
                        }
                    )
            except Exception:
                pass

            sqa_sample = query.limit(self.sample_limit).all()

        processed_rows = []
        if has_array_columns:
            for row in sqa_sample:
                processed_row = []
                for i, col in enumerate(sqa_columns):
                    value = row[i]
                    if self._handle_array_column(col):
                        processed_row.append(self._process_array_value(value))
                    else:
                        processed_row.append(value)
                processed_rows.append(processed_row)
        else:
            processed_rows = [list(row) for row in sqa_sample]

        return TableData(
            columns=[column.name for column in sqa_columns],
            rows=processed_rows,
        )
