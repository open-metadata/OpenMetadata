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
from typing import Dict, Set

from sqlalchemy.sql.type_api import TypeEngine

from metadata.generated.schema.entity.data.table import DataType
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.types.trino import TrinoArray, TrinoMap, TrinoStruct


class TrinoMapTypes(CommonMapTypes):
    _TYPE_MAP_OVERRIDE = {
        DataType.ARRAY: TrinoArray,
        DataType.MAP: TrinoMap,
        DataType.STRUCT: TrinoStruct,
    }
    _TYPE_MAP = {
        **CommonMapTypes._TYPE_MAP,
        **_TYPE_MAP_OVERRIDE,
    }

    @classmethod
    def map_sqa_to_om_types(cls) -> Dict[TypeEngine, Set[DataType]]:
        """returns an ORM type"""
        # pylint: disable=import-outside-toplevel

        return {
            **CommonMapTypes.map_sqa_to_om_types(),
            **{v: {k} for k, v in cls._TYPE_MAP_OVERRIDE.items()},
        }
