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
Bigquery runner file
"""
import traceback

from sqlalchemy.orm import Query

from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.logger import query_runner_logger

logger = query_runner_logger()


class BigQueryQueryRunner(QueryRunner):  # pylint: disable=too-few-public-methods
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def _get_schema_translate_map(self):
        """
        Build schema_translate_map for BigQuery if needed.
        Maps bare dataset to project.dataset using the current connection's database as project.
        """
        try:
            dataset_name = getattr(self.raw_dataset.__table__, "schema", None)
            project_name = self.raw_dataset.__table_args__.get(
                "bigquery_database", None
            )
            if project_name and dataset_name and "." not in dataset_name:
                return {dataset_name: f"{project_name}.{dataset_name}"}
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"Error getting bigquery schema translate map: {exc}")

        return None

    def _build_query(self, *entities, **kwargs):  # type: ignore[override]
        query = super()._build_query(*entities, **kwargs)

        schema_translate_map = self._get_schema_translate_map()
        if schema_translate_map:
            return query.execution_options(schema_translate_map=schema_translate_map)

        return query

    def select_first_from_query(self, query: Query):
        """Given a query object, return the first row

        Args:
            query (Query): query object
        """
        # Apply BigQuery schema translation when needed
        schema_translate_map = self._get_schema_translate_map()
        if schema_translate_map:
            query = query.execution_options(schema_translate_map=schema_translate_map)
        return query.first()

    def select_all_from_query(self, query: Query):
        """Given a query object, return all the rows

        Args:
            query (Query): query object
        """
        # Apply BigQuery schema translation when needed
        schema_translate_map = self._get_schema_translate_map()
        if schema_translate_map:
            query = query.execution_options(schema_translate_map=schema_translate_map)
        return query.all()
