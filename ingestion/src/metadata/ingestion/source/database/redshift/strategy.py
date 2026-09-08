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
How the Redshift source reads one database's metadata.

Almost every database is read the way it always has been: the source connects to
it and reflects it through the dialect. A database created from a datashare is
the exception - the server refuses a connection to it, so reflection is not
available at all and its metadata has to come from the cross-database catalog
views instead.

The two are expressed as strategies over the same interface so that the walk in
``metadata.py`` stays single-flow: it picks a strategy once per database and
never asks again which kind of database it is looking at.
"""

from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import TYPE_CHECKING, cast

from sqlalchemy import sql
from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import TableType
from metadata.ingestion.source.database.common_db_source import (
    CommonDbSourceService,
    TableNameAndType,
)
from metadata.ingestion.source.database.redshift.datashare import (
    RedshiftDatashareCatalog,
)
from metadata.ingestion.source.database.redshift.queries import (
    REDSHIFT_GET_ALL_RELATION_INFO,
)
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin

if TYPE_CHECKING:
    from sqlalchemy.engine.interfaces import ReflectedColumn

    from metadata.ingestion.source.database.redshift.incremental_table_processor import (
        RedshiftIncrementalTableProcessor,
    )
    from metadata.ingestion.source.database.redshift.metadata import RedshiftSource

STANDARD_TABLE_TYPES = {
    "r": TableType.Regular,
    "e": TableType.External,
    "v": TableType.View,
    "m": TableType.MaterializedView,
}


class RedshiftMetadataStrategy(ABC):
    """The reads that differ between a connectable database and a datashare one.

    Everything else - filtering, the topology walk, entity building - is common
    and stays in the source.
    """

    #: Whether stored procedures can be listed for this database. Only false for
    #: a database read over the connection to a *different* one, where a query
    #: that is not scoped by database name reports the wrong database's objects.
    supports_stored_procedures: bool = True

    def __init__(self, source: "RedshiftSource") -> None:
        self.source = source

    @abstractmethod
    def schema_names(self) -> Iterable[str]:
        """Schemas of the database currently being walked."""

    @abstractmethod
    def table_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        """Tables of one schema, with the type each one should be created as."""

    @abstractmethod
    def columns(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType,
    ) -> "list[ReflectedColumn]":
        """Column dictionaries in the shape reflection returns them."""

    @abstractmethod
    def table_description(self, schema_name: str, table_name: str, inspector: Inspector) -> str | None:
        """Table comment, or None when the source does not report one."""

    @abstractmethod
    def schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        """View definition or DDL, or None when it is not readable."""


class BaseStrategy(RedshiftMetadataStrategy):
    """Read a database the source is connected to.

    Reflection through the dialect, which is what every Redshift database that
    accepts a connection has always been read with.

    The base implementations are called on the OSS classes explicitly rather than
    through ``super()``: the source's own methods are the ones that delegate here,
    so resolving them dynamically would come straight back.
    """

    def schema_names(self) -> Iterable[str]:
        return CommonDbSourceService.get_raw_database_schema_names(self.source)

    def table_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        source = self.source
        source._set_constraint_details(schema_name)

        result = source.connection.execute(
            sql.text(
                REDSHIFT_GET_ALL_RELATION_INFO.format(
                    view_filter=(
                        "OR c.relkind IN ('v', 'm')"
                        if source.source_config.includeViews
                        else "AND c.relkind NOT IN ('v', 'm')"
                    )
                )
            ),
            {"schema": schema_name},
        )

        if source.incremental.enabled:
            # Set by `_set_incremental_table_processor` before the database is yielded,
            # so it is always present by the time a schema is walked.
            processor = cast("RedshiftIncrementalTableProcessor", source.incremental_table_processor)
            result = [
                (name, relkind)
                for name, relkind in result
                if name in processor.get_not_deleted(schema_name=schema_name)
            ]

        return [
            TableNameAndType(name=name, type_=STANDARD_TABLE_TYPES.get(relkind, TableType.Regular))
            for name, relkind in result
        ]

    def columns(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType,
    ) -> "list[ReflectedColumn]":
        return SqlColumnHandlerMixin._get_columns_internal(
            self.source, schema_name, table_name, db_name, inspector, table_type
        )

    def table_description(self, schema_name: str, table_name: str, inspector: Inspector) -> str | None:
        return CommonDbSourceService.get_table_description(schema_name, table_name, inspector)

    def schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        return CommonDbSourceService.get_schema_definition(self.source, table_type, table_name, schema_name, inspector)


class DatashareStrategy(RedshiftMetadataStrategy):
    """Read a database created from a datashare, which refuses a connection.

    Every read is a cross-database catalog query issued over the connection to a
    local database and scoped to this database by name. Reflection is not
    reachable, so anything the catalog views do not carry - constraints, view
    definitions, DDL, stored procedures - is reported as absent rather than
    picked up from the local database the queries happen to run on.
    """

    supports_stored_procedures = False

    def __init__(
        self,
        source: "RedshiftSource",
        database_name: str,
        schema_names: list[str],
        catalog: RedshiftDatashareCatalog,
    ) -> None:
        super().__init__(source)
        self.database_name = database_name
        # Read once while claiming the database, which is also what proves the
        # catalog views can see inside it.
        self._schema_names = schema_names
        self.catalog = catalog
        # Keyed by schema as well, so that tables of another schema being
        # processed in parallel keep their own remarks.
        self._table_remarks: dict[tuple[str, str], str | None] = {}

    def schema_names(self) -> Iterable[str]:
        return self._schema_names

    def table_names_and_types(self, schema_name: str) -> list[TableNameAndType]:
        # Constraints are not exposed across databases; clearing the map keeps the
        # last connected schema's constraints from being attached to these tables.
        self.source.constraint_details = {}
        tables = self.catalog.get_tables(self.database_name, schema_name)
        self._table_remarks.update({(schema_name, table.name): table.remarks for table in tables})
        return [
            TableNameAndType(name=table.name, type_=table.table_type)
            for table in tables
            if self.source.source_config.includeViews or table.table_type != TableType.View
        ]

    def columns(
        self,
        schema_name: str,
        table_name: str,
        db_name: str,
        inspector: Inspector,
        table_type: TableType,
    ) -> "list[ReflectedColumn]":
        return self.catalog.get_columns(self.database_name, schema_name, table_name)  # pyright: ignore[reportReturnType]

    def table_description(self, schema_name: str, table_name: str, inspector: Inspector) -> str | None:
        return self._table_remarks.get((schema_name, table_name))

    def schema_definition(
        self,
        table_type: TableType,
        table_name: str,
        schema_name: str,
        inspector: Inspector,
    ) -> str | None:
        """View definitions and DDL are not readable across databases."""
        return None
