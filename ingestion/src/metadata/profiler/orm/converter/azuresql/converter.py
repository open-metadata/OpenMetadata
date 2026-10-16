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
Map Types to convert/cast azuresql related data types to relevant data types
"""

from typing import Any

import sqlalchemy
from sqlalchemy import NVARCHAR, TEXT
from sqlalchemy.sql.sqltypes import TypeEngine

from metadata.generated.schema.entity.data.table import DataType
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.registry import CustomImage, CustomTypes

cast_dict = {
    CustomImage: "VARBINARY(max)",
    TEXT: "VARCHAR(max)",
    NVARCHAR: "NVARCHAR(max)",
}


class AzureSqlMapTypes(CommonMapTypes):
    """
    AzureSql type mapper
    """

    _TYPE_MAP_OVERRIDE = {  # noqa: RUF012
        DataType.TIMESTAMP: CustomTypes.TIMESTAMP.value,
        DataType.MONEY: sqlalchemy.NUMERIC,
        DataType.BIT: sqlalchemy.BOOLEAN,
    }
    _TYPE_MAP = {  # noqa: RUF012
        **CommonMapTypes._TYPE_MAP,
        **_TYPE_MAP_OVERRIDE,
    }

    @staticmethod
    def map_sqa_to_om_types() -> dict[TypeEngine, set[DataType]]:
        """returns an ORM type"""
        # Derived from _TYPE_MAP_OVERRIDE so the forward and reverse maps cannot drift.
        mapping: dict[Any, set[DataType]] = dict(CommonMapTypes.map_sqa_to_om_types())
        for om_type, sqa_type in AzureSqlMapTypes._TYPE_MAP_OVERRIDE.items():
            mapping[sqa_type] = mapping.get(sqa_type, set()) | {om_type}
        return mapping
