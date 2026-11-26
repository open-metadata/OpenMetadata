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
Converter logic to transform an OpenMetadata Table Entity for MariaDB
to an SQLAlchemy ORM class.
"""

from typing import Any

from sqlalchemy.sql.sqltypes import TypeEngine

from metadata.generated.schema.entity.data.table import DataType
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.registry import CustomTypes


class MariaDBMapTypes(CommonMapTypes):
    """MariaDB type mapper.

    MariaDB drivers return TIME columns as ``timedelta``/``int`` rather than
    ``datetime.time``, so TIME is remapped to ``CustomTime`` whose
    ``result_processor`` converts those values back to ``datetime.time``.

    The override uses the class-level ``_TYPE_MAP`` copy pattern (see
    ``mssql/converter.py`` / ``azuresql/converter.py`` / ``trino/converter.py``)
    so the parent ``CommonMapTypes._TYPE_MAP`` is never mutated: a previous
    ``__init__``-based ``self._TYPE_MAP.update(...)`` leaked the TIME override
    process-wide to every dialect sharing the base map (BigQuery, Redshift,
    Snowflake, ClickZetta and the ``defaultdict`` fallback services).
    """

    _TYPE_MAP_OVERRIDE = {  # noqa: RUF012
        DataType.TIME: CustomTypes.TIME.value,
    }
    _TYPE_MAP = {  # noqa: RUF012
        **CommonMapTypes._TYPE_MAP,
        **_TYPE_MAP_OVERRIDE,
    }

    @staticmethod
    def map_sqa_to_om_types() -> dict[TypeEngine, set[DataType]]:
        """returns an ORM type"""
        # Derived from _TYPE_MAP_OVERRIDE so the forward and reverse maps cannot drift.
        # Without this, a MariaDB TIME column's SQA type (CustomTime) is not a key in the
        # reverse map and `metric_filter` silently ignores the global metricConfiguration
        # entry for DataType.TIME.
        mapping: dict[Any, set[DataType]] = dict(CommonMapTypes.map_sqa_to_om_types())
        for om_type, sqa_type in MariaDBMapTypes._TYPE_MAP_OVERRIDE.items():
            mapping[sqa_type] = mapping.get(sqa_type, set()) | {om_type}
        return mapping
