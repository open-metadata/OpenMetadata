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
Map Types to convert/cast mssql related data types to relevant data types
"""

from typing import Dict, Set  # noqa: UP035

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


class MssqlMapTypes(CommonMapTypes):
    """
    Mssql type mapper
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
    def map_sqa_to_om_types() -> Dict[TypeEngine, Set[DataType]]:  # noqa: UP006
        """returns an ORM type"""
        common = CommonMapTypes.map_sqa_to_om_types()
        return {
            **common,
            sqlalchemy.NUMERIC: common[sqlalchemy.NUMERIC] | {DataType.MONEY},
            sqlalchemy.BOOLEAN: common[sqlalchemy.BOOLEAN] | {DataType.BIT},
        }
