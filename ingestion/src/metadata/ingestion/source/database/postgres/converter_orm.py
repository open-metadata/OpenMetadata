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
Converter logic to transform an OpenMetadata Table Entity for Redshift
to an SQLAlchemy ORM class.
"""

from typing import Dict, Set

from sqlalchemy.sql.sqltypes import TypeEngine

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.ingestion.source.database.postgres.types.money import PostgresMoney
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.converter.converter_registry import converter_registry

_CUSTOM_TYPE_MAP = {DataType.MONEY: PostgresMoney}
_CUSTOM_TYPE_MAP_reversed = {v: {k} for k, v in _CUSTOM_TYPE_MAP.items()}


class PostgrestMapTypes(CommonMapTypes):
    """Postgres type mapper, inherits from CommonMapTypes"""

    def return_custom_type(self, col: Column, table_service_type):
        return _CUSTOM_TYPE_MAP.get(
            col.dataType, super().return_custom_type(col, table_service_type)
        )

    @staticmethod
    def map_sqa_to_om_types() -> Dict[TypeEngine, Set[DataType]]:
        """returns an ORM type"""
        # pylint: disable=import-outside-toplevel

        return {
            **CommonMapTypes.map_sqa_to_om_types(),
            **_CUSTOM_TYPE_MAP_reversed,
        }


converter_registry[DatabaseServiceType.Postgres] = PostgrestMapTypes
