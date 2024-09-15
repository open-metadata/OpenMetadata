#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Converter logic to transform an OpenMetadata Table Entity for Snowflake
to an SQLAlchemy ORM class.
"""


from typing import Dict, Set

from sqlalchemy.sql.sqltypes import TypeEngine

from metadata.generated.schema.entity.data.database import databaseService
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.registry import CustomTypes


class SnowflakeMapTypes(CommonMapTypes):
    """Snowflake mapper, inherits from CommonMapTypes"""

    def __init__(self) -> None:
        self._TYPE_MAP.update({DataType.BINARY: CustomTypes.BYTES.value})

    def return_custom_type(self, col: Column, table_service_type):
        if (
            table_service_type == databaseService.DatabaseServiceType.Snowflake
            and col.dataType == DataType.JSON
        ):
            # pylint: disable=import-outside-toplevel
            from snowflake.sqlalchemy import VARIANT

            return VARIANT
        return super().return_custom_type(col, table_service_type)

    @staticmethod
    def map_sqa_to_om_types() -> Dict[TypeEngine, Set[DataType]]:
        """returns an ORM type"""
        # pylint: disable=import-outside-toplevel
        from snowflake.sqlalchemy import VARIANT

        return {
            **CommonMapTypes.map_sqa_to_om_types(),
            VARIANT: {DataType.JSON},
        }
