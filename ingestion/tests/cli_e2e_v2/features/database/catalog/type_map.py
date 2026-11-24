#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Independent SQLAlchemy -> OM DataType expectations.

`CORE_TYPE_MAP` covers portable SQLAlchemy types; dialect modules extend it with
dialect-specific classes. Resolution walks the MRO, so subclasses inherit parent
entries unless explicitly overridden.
"""

from __future__ import annotations

from sqlalchemy import (
    CHAR,
    JSON,
    TIMESTAMP,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    Integer,
    LargeBinary,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
)

from metadata.generated.schema.entity.data.table import DataType

TypeMap = dict[type, DataType]


# Dialect subclasses (e.g. mysql.JSON, mysql.ENUM) inherit via MRO and don't need
# duplicate entries unless they extend a private base or need a more-specific DataType.
CORE_TYPE_MAP: TypeMap = {
    Integer: DataType.INT,
    BigInteger: DataType.BIGINT,
    SmallInteger: DataType.SMALLINT,
    String: DataType.VARCHAR,
    Text: DataType.TEXT,
    CHAR: DataType.CHAR,
    Date: DataType.DATE,
    DateTime: DataType.DATETIME,
    Time: DataType.TIME,
    TIMESTAMP: DataType.TIMESTAMP,  # via MRO: mysql.TIMESTAMP, pg.TIMESTAMP
    Numeric: DataType.DECIMAL,
    Float: DataType.FLOAT,
    Boolean: DataType.BOOLEAN,  # dialect overrides (e.g. MySQL: TINYINT)
    Enum: DataType.ENUM,  # via MRO: mysql.ENUM, pg.ENUM
    JSON: DataType.JSON,  # via MRO: mysql.JSON, pg.JSON
    LargeBinary: DataType.BLOB,  # via MRO: mysql.BLOB
}


def resolve_om_type(col_type: object, type_map: TypeMap) -> DataType:
    """Return the OM DataType for a SQLAlchemy column-type instance.

    Walks the instance's class MRO, returning the first match in `type_map`.
    Raises ValueError naming the unmapped class when no ancestor matches —
    the dialect map just needs one new line added.
    """
    for cls in type(col_type).__mro__:
        if cls in type_map:
            return type_map[cls]
    raise ValueError(
        f"no OM DataType mapping for SQLAlchemy type {type(col_type).__name__}. Add an entry to the dialect's type map."
    )
