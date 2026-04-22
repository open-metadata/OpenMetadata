#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""SQLAlchemy -> OM DataType map.

Used by `derive_expected_tables` to build Expected trees directly from the
baseline's SQLAlchemy MetaData. `CORE_TYPE_MAP` covers the portable types
used in `common_baseline.py`; each dialect's expected module extends it
with dialect-specific classes (e.g. `mysql.MEDIUMINT`, `mysql.ENUM`).

Resolution walks the SQLAlchemy type's MRO so subclasses inherit parent
entries unless explicitly overridden.
"""

from __future__ import annotations

from sqlalchemy import (
    CHAR,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    Time,
)

from metadata.generated.schema.entity.data.table import DataType

TypeMap = dict[type, DataType]


CORE_TYPE_MAP: TypeMap = {
    Integer:      DataType.INT,
    BigInteger:   DataType.BIGINT,
    SmallInteger: DataType.SMALLINT,
    String:       DataType.VARCHAR,
    Text:         DataType.TEXT,
    CHAR:         DataType.CHAR,
    Date:         DataType.DATE,
    DateTime:     DataType.DATETIME,
    Time:         DataType.TIME,
    Numeric:      DataType.DECIMAL,
    Float:        DataType.FLOAT,
    Boolean:      DataType.BOOLEAN,  # dialect overrides (e.g. MySQL: TINYINT)
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
        f"no OM DataType mapping for SQLAlchemy type "
        f"{type(col_type).__name__}. Add an entry to the dialect's type map."
    )
