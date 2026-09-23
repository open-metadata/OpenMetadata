#  Copyright 2026 OpenMetadata
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
SQLAlchemy dialect for IBM Informix, over the IBM Informix JDBC driver.

Server compatibility
--------------------
Verified end to end with the pinned 15.0.0.1.1 driver against both
Informix 14.10.FC9W1DE and 15.0.1.0.3: reflection, and median, Q1, Q3, sum,
length and modulo all returning correct values, including against tables created
by a different client (dbaccess) rather than by the connector itself.

Servers older than 14.10 are untested here.

Do not downgrade the driver to the 4.50 line. 4.50 cannot open a table whose
tblspace uses large rowids and rejects it with
"-242 Could not open database table". Only Informix 15 and later produce that
layout -- on 14.10 the same table carries tblspace flags 902 against 15.0.1's
400000902 -- which is why 4.50 appears to work on older servers and fails on new
ones. See the note on the pin below for why the failure is easy to miss.
"""

from sqlalchemy import text
from sqlalchemy.dialects import registry
from sqlalchemy.engine.default import DefaultDialect
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.compiler import SQLCompiler
from sqlalchemy.sql.elements import Null
from sqlalchemy_jdbcapi.dialects.base import JDBCDriverConfig
from sqlalchemy_jdbcapi.dialects.gbase import GBase8sDialect
from sqlalchemy_jdbcapi.jdbc.driver_manager import (
    RECOMMENDED_JDBC_DRIVERS,
    JDBCDriver,
    get_driver_path,
)

from metadata.ingestion.source.database.informix.queries import (
    INFORMIX_GET_VIEW_DEFINITION,
    INFORMIX_GET_VIEW_NAMES,
)

INFORMIX_JDBC_VERSION = "15.0.0.1.1"
BSON_VERSION = "4.11.1"
DEFAULT_INFORMIX_SERVER = "informix"

# The JDBC driver generation must match the server generation. Driver 4.50
# cannot open a table whose tblspace uses "large rowids" -- the layout an
# Informix 15 server gives tables created by a modern client -- and rejects it
# with "-242 Could not open database table". The server negotiates the older
# layout for tables the 4.50 driver creates itself, so that driver reads its own
# tables and nothing else: a self-seeded test passes while every real catalog
# fails silently.
#
# com.ibm.informix:jdbc calls org.bson.BSONObject (Informix's JSON/BSON
# compatibility layer) from getResultSet(), so bson must be on the classpath as
# well. informix-jdbc-complete bundles it, but is only published at 4.50.4.1 --
# the broken generation -- so the 15.x driver is paired with bson explicitly.
RECOMMENDED_JDBC_DRIVERS["informix"] = JDBCDriver(
    group_id="com.ibm.informix",
    artifact_id="jdbc",
    version=INFORMIX_JDBC_VERSION,
)
RECOMMENDED_JDBC_DRIVERS["informix_bson"] = JDBCDriver(
    group_id="org.mongodb",
    artifact_id="bson",
    version=BSON_VERSION,
)


def _informix_jars() -> list[str]:
    """Resolve just the two jars this dialect needs.

    Passing an explicit classpath is not an optimisation. sqlalchemy-jdbcapi
    starts the JVM with every driver in RECOMMENDED_JDBC_DRIVERS when none is
    given -- roughly 190 MB fetched from Maven Central, 155 MB of it Phoenix, to
    run a connector that needs 1.7 MB -- and logs an ERROR for the gbase entry,
    whose published coordinate 404s. On a fresh ingestion container that is a
    long first connection and a failure surface with no relation to Informix.

    The JVM takes the classpath of whichever connector starts it first and keeps
    it for the life of the process, so this only holds when Informix connects first.
    """
    return [str(get_driver_path("informix")), str(get_driver_path("informix_bson"))]


class InformixSQLCompiler(SQLCompiler):
    """Row limits, in the one place Informix accepts them.

    Informix has no LIMIT/OFFSET. The equivalent is SKIP n FIRST m, and it sits
    between SELECT and the column list rather than at the end of the statement,
    so SQLAlchemy's default trailing LIMIT is a syntax error here. Without this
    the profiler cannot run at all: its sampler wraps every table in a limited
    subquery, and each one is rejected before a single metric is computed.

    Order matters and is not the intuitive one -- SKIP and FIRST come *before*
    DISTINCT ("SELECT DISTINCT FIRST 1 x" is a syntax error, "SELECT FIRST 1
    DISTINCT x" is not), hence prepending to super() rather than appending.

    literal_execute renders the counts inline. The JDBC driver rejects a bind
    parameter in this position through prepareStatement, the same way it rejects
    one in a projection.
    """

    def visit_label(self, label, within_columns_clause: bool = False, **kw) -> str:
        """Give a NULL that is itself a SELECT-list item a type.

        Informix rejects a bare NULL there -- "201: A syntax error has occurred"
        -- and the profiler sends one per metric that does not apply to a column,
        so a single date column costs its table every metric in the statement.

        Only a label wrapping the NULL itself qualifies. within_columns_clause
        alone does not: it stays true all the way down, so keying off it rewrites
        the NULL inside "x IS NULL" too, which Informix likes even less.
        """
        if within_columns_clause and isinstance(label.element, Null):
            self._informix_typed_null = True
            try:
                return super().visit_label(label, within_columns_clause=within_columns_clause, **kw)
            finally:
                self._informix_typed_null = False
        return super().visit_label(label, within_columns_clause=within_columns_clause, **kw)

    def visit_null(self, expr, **kw) -> str:
        if getattr(self, "_informix_typed_null", False):
            return "CAST(NULL AS INTEGER)"
        return super().visit_null(expr, **kw)

    def get_select_precolumns(self, select, **kw) -> str:
        limits = ""
        if select._offset_clause is not None:
            limits += f"SKIP {self.process(select._offset_clause, literal_execute=True, **kw)} "
        if select._limit_clause is not None:
            limits += f"FIRST {self.process(select._limit_clause, literal_execute=True, **kw)} "
        return limits + super().get_select_precolumns(select, **kw)

    def visit_bindparam(self, bindparam, within_columns_clause=False, literal_binds=False, **kw) -> str:
        """Render values in the SELECT list inline rather than as parameters.

        Informix's prepareStatement cannot infer a type for a ? in the projection,
        so it assumes character -- and then rejects anything numeric done with it.
        The null-count metric is the clearest case: SUM(CASE WHEN c IS NULL THEN ?
        ELSE ? END) comes back as "Sums and averages cannot be computed for
        character columns", which names neither the parameter nor the real problem.

        literal_execute is SQLAlchemy's own mechanism for this (MSSQL renders TOP
        the same way): the value still goes through its type's literal processor,
        and the statement stays cacheable.
        """
        if within_columns_clause and not literal_binds:
            kw["literal_execute"] = True
        return super().visit_bindparam(
            bindparam, within_columns_clause=within_columns_clause, literal_binds=literal_binds, **kw
        )

    def limit_clause(self, select, **kw) -> str:
        """Consumed by get_select_precolumns; nothing may trail the statement."""
        return ""


class InformixDialect(GBase8sDialect, DefaultDialect):
    """IBM Informix dialect.

    GBase 8s is Informix-derived, so its dialect only differs in the driver
    class and URL scheme. DefaultDialect is mixed in because sqlalchemy-jdbcapi
    pairs GBase8sDialect with SQLAlchemy's abstract Dialect interface, leaving it
    without a usable __init__ -- create_engine() raises "takes no arguments".

    The dialect name must stay "informix": the profiler's @compiles overrides
    for MedianFn, SumFn, LenFn, ModuloFn, ColumnCountFn and ColunNameFn dispatch
    on it, and fall back to generic SQL that Informix rejects if it changes.
    """

    name = "informix"
    driver = "jdbcapi"
    supports_statement_cache = True
    statement_compiler = InformixSQLCompiler

    @classmethod
    def import_dbapi(cls) -> type:
        """Declared explicitly: SQLAlchemy 2.0 warns on the inherited dbapi()."""
        return super().import_dbapi()

    @classmethod
    def get_driver_config(cls) -> JDBCDriverConfig:
        return JDBCDriverConfig(
            driver_class="com.informix.jdbc.IfxDriver",
            jdbc_url_template="jdbc:informix-sqli://{host}:{port}/{database}",
            default_port=9088,
            supports_transactions=True,
            supports_schemas=True,
            supports_sequences=True,
        )

    def get_view_names(self, connection, schema=None, **kw) -> list[str]:
        """List only the views a user created.

        The driver's own listing reports Informix's catalogue views -- sysdomains
        and sysindexes -- as ordinary views. They carry the same owner and type as
        user views, so nothing downstream can tell them apart, and they arrive in
        the catalogue looking like someone's work. Informix reserves tabid below
        100 for its own objects, which is the only reliable separator.
        """
        rows = connection.execute(text(INFORMIX_GET_VIEW_NAMES), {"owner": schema or self.default_schema_name})
        return [row[0] for row in rows]

    def get_view_definition(self, connection, view_name, schema=None, **kw) -> str | None:
        """The SQL behind a view.

        Without this SQLAlchemy raises NotImplementedError and the view is
        catalogued with no definition at all -- no SQL in the UI, and nothing for
        view lineage to read. Informix splits viewtext across rows, so seqno order
        is what reassembles it.
        """
        rows = connection.execute(
            text(INFORMIX_GET_VIEW_DEFINITION),
            {"view_name": view_name, "owner": schema or self.default_schema_name},
        )
        return "".join(row[0] for row in rows if row[0]) or None

    def get_foreign_keys(self, connection, table_name, schema=None, **kw) -> list[dict]:
        """Name the database each foreign key refers to.

        A connector declaring supportsDatabase has its foreign keys resolved
        against `referred_database`, which SQLAlchemy's reflection does not
        produce. Left unset the referred table is looked up as
        "service.None.schema.table", which never matches, so every foreign key is
        dropped -- silently, since the lookup failing is also how the code defers
        a constraint whose target is not ingested yet.

        Informix constraints cannot cross databases, so the referenced database is
        always the one this connection is attached to.
        """
        keys = super().get_foreign_keys(connection, table_name, schema=schema, **kw)
        database = connection.engine.url.database
        for key in keys:
            key.setdefault("referred_database", database)
        return keys

    def get_table_comment(self, connection, table_name, schema=None, **kw) -> dict:
        """Informix has no table comments, so report that rather than raising.

        The engine has no COMMENT ON statement and nothing in the catalogue to
        hold one. Left unimplemented this raises NotImplementedError, which
        ingestion catches -- but logs a warning for every table it reads, so a
        real catalogue produces thousands of lines about a feature that does not
        exist.
        """
        return {"text": None}

    def create_connect_args(self, url: URL) -> tuple[list, dict]:
        """Informix separates URL properties with ':' and then ';', not '?' and
        '&', and requires INFORMIXSERVER -- which is why serverName is mandatory
        in informixConnection.json."""
        config = self.get_driver_config()
        query = dict(url.query or {})
        server = query.pop("INFORMIXSERVER", None) or DEFAULT_INFORMIX_SERVER

        jdbc_url = config.jdbc_url_template.format(
            host=url.host or "localhost",
            port=url.port or config.default_port,
            database=url.database or "",
        )
        jdbc_url = f"{jdbc_url}:INFORMIXSERVER={server}"

        # Without DELIMIDENT, Informix reads "foo" as a string literal rather than
        # as an identifier, so every generated statement carrying a quoted alias is
        # a syntax error -- and SQLAlchemy quotes any identifier that is not all
        # lower case. Metadata ingestion survives that because reflection goes
        # through JDBC DatabaseMetaData rather than SQL, but the profiler emits
        # "uniqueCount", "rowCount", "sizeInBytes" and friends, so every metric on
        # every column fails with a position that points at nothing recognisable.
        # setdefault, so connectionOptions can still turn it off.
        query.setdefault("DELIMIDENT", "y")
        for key, value in query.items():
            jdbc_url += f";{key}={value}"

        driver_args = {}
        if url.username:
            driver_args["user"] = url.username
        if url.password:
            driver_args["password"] = url.password

        return (
            [],
            {
                "jclassname": config.driver_class,
                "url": jdbc_url,
                "driver_args": driver_args or None,
                "jars": _informix_jars(),
            },
        )


registry.register("informix", __name__, "InformixDialect")
