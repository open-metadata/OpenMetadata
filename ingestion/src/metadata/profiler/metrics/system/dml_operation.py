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
DML Operation class and mapper
"""

from enum import Enum

from metadata.generated.schema.entity.data.table import DmlOperationType


class DatabaseDMLOperations(Enum):
    """enum of supported DML operation on database engine side"""

    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    MERGE = "MERGE"


DML_OPERATION_MAP = {
    DatabaseDMLOperations.INSERT.value: DmlOperationType.INSERT.value,
    DatabaseDMLOperations.MERGE.value: DmlOperationType.UPDATE.value,
    DatabaseDMLOperations.UPDATE.value: DmlOperationType.UPDATE.value,
    DatabaseDMLOperations.DELETE.value: DmlOperationType.DELETE.value,
}
