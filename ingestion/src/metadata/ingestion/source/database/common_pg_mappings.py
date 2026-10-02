"""
Common Postgresql mappings
"""

import traceback
from collections.abc import Iterable

from sqlalchemy import String as SqlAlchemyString
from sqlalchemy.dialects.postgresql.base import ischema_names

from metadata.generated.schema.entity.data.table import (
    PartitionIntervalTypes,
    TableType,
)
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import TableNameAndType
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


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
    "m": TableType.MaterializedView,
}


class PgMatviewMixin:
    """
    Mixin for PostgreSQL-compatible connectors (Postgres, Greenplum) that exposes
    materialized views through the view path so that the ``includeViews`` config flag
    controls them correctly.

    Placing the logic here avoids duplicating an identical implementation in every
    pg-compatible connector.  The host supplies ``self.inspector``; it is a property on
    CommonDbSourceService, so it cannot be redeclared here without conflicting with it.
    """

    def query_view_names_and_types(self, schema_name: str) -> Iterable[TableNameAndType]:
        views = [
            TableNameAndType(name=view_name, type_=TableType.View)
            for view_name in self.inspector.get_view_names(schema_name)  # pyright: ignore[reportAttributeAccessIssue]
            or []
        ]
        try:
            matviews = [
                TableNameAndType(name=matview_name, type_=TableType.MaterializedView)
                for matview_name in self.inspector.get_materialized_view_names(schema_name)  # pyright: ignore[reportAttributeAccessIssue]
                or []
            ]
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.warning("Fetching materialized views failed for schema %s due to - %s", schema_name, err)
            matviews = []
        return views + matviews


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
        "citext": SqlAlchemyString,
        "circle": create_sqlalchemy_type("CIRCLE"),
        "line": create_sqlalchemy_type("LINE"),
        "lseg": create_sqlalchemy_type("LSEG"),
        "path": create_sqlalchemy_type("PATH"),
        "pg_lsn": create_sqlalchemy_type("PG_LSN"),
        "pg_snapshot": create_sqlalchemy_type("PG_SNAPSHOT"),
        "tsquery": create_sqlalchemy_type("TSQUERY"),
        "txid_snapshot": create_sqlalchemy_type("TXID_SNAPSHOT"),
        "tid": SqlAlchemyString,
        "xid": SqlAlchemyString,
        "xml": create_sqlalchemy_type("XML"),
        # PostgreSQL range types (used by TimescaleDB for chunk boundaries)
        "int4range": create_sqlalchemy_type("INT4RANGE"),
        "int8range": create_sqlalchemy_type("INT8RANGE"),
        "numrange": create_sqlalchemy_type("NUMRANGE"),
        "tsrange": create_sqlalchemy_type("TSRANGE"),
        "tstzrange": create_sqlalchemy_type("TSTZRANGE"),
        "daterange": create_sqlalchemy_type("DATERANGE"),
    }
)
