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
Converter logic to transform an OpenMetadata Table Entity for Redshift
to an SQLAlchemy ORM class.
"""

from typing import Dict, Set

from sqlalchemy.sql.sqltypes import TypeEngine

from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services import databaseService
from metadata.profiler.orm.converter.common import CommonMapTypes


class RedshiftMapTypes(CommonMapTypes):
    """Redshift mapper, inherits from CommonMapTypes"""

    def __init__(self) -> None:
        self._TYPE_MAP.update({DataType.GEOMETRY: DataType.GEOMETRY.value})

    def return_custom_type(self, col: Column, table_service_type):
        if (
            table_service_type == databaseService.DatabaseServiceType.Redshift
            and col.dataType == DataType.GEOMETRY
        ):
            # pylint: disable=import-outside-toplevel
            from sqlalchemy_redshift.dialect import GEOMETRY

            return GEOMETRY
        return super().return_custom_type(col, table_service_type)

    @staticmethod
    def map_sqa_to_om_types() -> Dict[TypeEngine, Set[DataType]]:
        """returns an ORM type"""
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_redshift.dialect import GEOMETRY

        return {
            **CommonMapTypes.map_sqa_to_om_types(),
            GEOMETRY: {DataType.GEOMETRY},
        }
