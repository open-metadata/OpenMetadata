"""
Common Postgresql mappings
"""

from sqlalchemy import String as SqlAlchemyString
from sqlalchemy.dialects.postgresql.base import ischema_names

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    TableType,
)
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type

INTERVAL_TYPE_MAP = {
    "list": PartitionIntervalTypes.COLUMN_VALUE,
    "hash": PartitionIntervalTypes.COLUMN_VALUE,
    "range": PartitionIntervalTypes.TIME_UNIT,
}

RELKIND_MAP = {
    "r": TableType.Regular,
    "p": TableType.Partitioned,
    "f": TableType.Foreign,
    "v": TableType.View,
}

GEOMETRY = create_sqlalchemy_type("GEOMETRY")
POINT = create_sqlalchemy_type("POINT")
POLYGON = create_sqlalchemy_type("POLYGON")

ischema_names.update(
    {
        "geometry": GEOMETRY,
        "point": POINT,
        "polygon": POLYGON,
        "box": create_sqlalchemy_type("BOX"),
        "bpchar": SqlAlchemyString,
        "circle": create_sqlalchemy_type("CIRCLE"),
        "line": create_sqlalchemy_type("LINE"),
        "lseg": create_sqlalchemy_type("LSEG"),
        "path": create_sqlalchemy_type("PATH"),
        "pg_lsn": create_sqlalchemy_type("PG_LSN"),
        "pg_snapshot": create_sqlalchemy_type("PG_SNAPSHOT"),
        "tsquery": create_sqlalchemy_type("TSQUERY"),
        "txid_snapshot": create_sqlalchemy_type("TXID_SNAPSHOT"),
        "xid": SqlAlchemyString,
        "xml": create_sqlalchemy_type("XML"),
    }
)
