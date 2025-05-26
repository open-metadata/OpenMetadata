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


from sqlalchemy import NVARCHAR, TEXT

from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.registry import CustomImage, CustomTypes, DataType

cast_dict = {
    CustomImage: "VARBINARY(max)",
    TEXT: "VARCHAR(max)",
    NVARCHAR: "NVARCHAR(max)",
}


class AzureSqlMapTypes(CommonMapTypes):
    """
    AzureSql type mapper
    """

    def __init__(self) -> None:
        self._TYPE_MAP.update(
            {
                DataType.TIMESTAMP: CustomTypes.TIMESTAMP.value,
            }
        )
