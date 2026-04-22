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
Constants Module for Odoo
"""

from metadata.generated.schema.entity.data.table import DataType

ODOO_TO_OPENMETADATA_TYPE_MAP = {
    "char": DataType.VARCHAR.name,
    "text": DataType.TEXT.name,
    "integer": DataType.INT.name,
    "float": DataType.FLOAT.name,
    "boolean": DataType.BOOLEAN.name,
    "date": DataType.DATE.name,
    "datetime": DataType.DATETIME.name,
    "many2one": DataType.VARCHAR.name,
    "one2many": DataType.ARRAY.name,
    "many2many": DataType.ARRAY.name,
    "selection": DataType.ENUM.name,
    "binary": DataType.BYTES.name,
    "html": DataType.TEXT.name,
    "monetary": DataType.DECIMAL.name,
}
