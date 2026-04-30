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

from sqlalchemy import inspect, or_, text

from metadata.profiler.orm.registry import FLOAT_SET
from metadata.profiler.processor.handle_partition import RANDOM_LABEL
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.sampler.sqlalchemy.stats_utils import get_row_count_from_show_stats
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class TrinoSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    def __init__(self, *args, **kwargs):
        # pylint: disable=import-outside-toplevel
        from trino.sqlalchemy.dialect import TrinoDialect  # noqa: PLC0415

        TrinoDialect._json_deserializer = None

        super().__init__(*args, **kwargs)

    def _get_asset_row_count(self) -> int:
        if self.partition_details:
            return super()._get_asset_row_count()

        try:
            schema = self.raw_dataset.__table__.schema
            table = self.raw_dataset.__tablename__
            with self.session_factory() as session:
                result = get_row_count_from_show_stats(session, schema, table)
                if result is not None:
                    return result
        except Exception as exc:
            logger.debug(f"SHOW STATS row count failed, falling back to COUNT(*): {exc}")

        return super()._get_asset_row_count()

    def _base_sample_query(self, selectable, column, label=None):
        sqa_columns = [col for col in inspect(self.raw_dataset).c if col.name != RANDOM_LABEL]
        entity = selectable if column is None else column
        with self.get_client() as client:
            return client.query(entity, label).where(
                or_(*[text(f'is_nan("{cols.name}") = False') for cols in sqa_columns if type(cols.type) in FLOAT_SET])
            )
