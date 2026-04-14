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
Helper module to handle data sampling for the profiler
"""
from sqlalchemy import text

from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.logger import profiler_interface_registry_logger

logger = profiler_interface_registry_logger()


class ImpalaSampler(SQASampler):
    """Impala sampler using SHOW TABLE STATS for efficient row counts."""

    def _get_asset_row_count(self) -> int:
        if self.partition_details:
            return super()._get_asset_row_count()

        try:
            schema = self.raw_dataset.__table__.schema
            table = self.raw_dataset.__tablename__
            with self.session_factory() as session:
                rows = session.execute(
                    text(f"SHOW TABLE STATS `{schema}`.`{table}`")
                ).fetchall()
                total_rows = 0
                for row in rows:
                    row_dict = row._asdict()
                    num_rows = row_dict.get("#Rows") or row_dict.get("#rows")
                    if num_rows is not None and int(num_rows) >= 0:
                        total_rows += int(num_rows)
                if total_rows > 0:
                    return total_rows
        except Exception as exc:
            logger.debug(
                "SHOW TABLE STATS row count failed, " f"falling back to COUNT(*): {exc}"
            )

        return super()._get_asset_row_count()
