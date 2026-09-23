"""
Test the Informix connector: connection URL construction, SSL policy,
test-connection step coverage, source wiring, the scoped JDBC classpath, and the
catalogue lookup that restores Informix's large-object types.
"""

import json
from collections import OrderedDict
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import VARCHAR, cast, select
from sqlalchemy import column as sa_column
from sqlalchemy.engine.url import make_url

from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType
from metadata.generated.schema.entity.services.connections.database.informixConnection import (
    InformixConnection as InformixConnectionConfig,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.security.ssl.verifySSLConfig import SslMode
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.column_type_parser import ColumnTypeParser
from metadata.ingestion.source.database.informix.connection import (
    InformixConnection,
    get_connection_url,
)
from metadata.ingestion.source.database.informix.dialect import InformixDialect
from metadata.ingestion.source.database.informix.metadata import (
    MAX_CACHED_SCHEMAS,
    InformixSource,
)
from metadata.ingestion.source.database.informix.queries import (
    INFORMIX_DRIVER_CONVERTIBLE_EXTENDED_TYPES,
    INFORMIX_GET_DRIVER_UNFRIENDLY_COLUMNS,
)
from metadata.ingestion.source.database.sql_column_handler import SqlColumnHandlerMixin
from metadata.profiler.interface.sqlalchemy.informix.profiler_interface import (
    InformixProfilerInterface,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.functions.modulo import ModuloFn
from metadata.profiler.orm.functions.random_num import RandomNumFn
from metadata.profiler.orm.registry import is_blob
from metadata.profiler.processor.handle_partition import RANDOM_LABEL
from metadata.sampler.sqlalchemy.informix.sampler import InformixSampler, LVarchar
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.service_spec.service_spec import BaseSpec

TEST_CONNECTION_JSON = (
    Path(__file__).parents[5]
    / "openmetadata-service/src/main/resources/json/data/testConnections/database/informix.json"
)

# Steps test_connection_db_common supplies from the generic inspector.
COMMON_STEPS = {"CheckAccess", "GetSchemas", "GetTables", "GetViews"}

# Informix coltype codes for the four large-object types.
COLTYPE_BYTE = 11
COLTYPE_TEXT = 12
COLTYPE_OPAQUE = 41

COLTYPE_CHAR = 0
COLTYPE_VARCHAR = 13
COLTYPE_LVARCHAR = 40

# Rows shaped like INFORMIX_GET_COLUMN_TYPES returns:
# (tabname, colname, basetype, collength, xtype).
LOB_ROWS = [
    ("t", "c_byte", COLTYPE_BYTE, 56, None),
    ("t", "c_text", COLTYPE_TEXT, 56, None),
    ("t", "c_clob", COLTYPE_OPAQUE, 72, "clob"),
    ("t", "c_blob", COLTYPE_OPAQUE, 72, "blob"),
]

# collength means two different things depending on the type: VARCHAR packs an
# optional reserved minimum into the high byte, CHAR and LVARCHAR do not and are
# the only ones that may exceed 255.
WIDTH_ROWS = [
    ("t", "a_char", COLTYPE_CHAR, 10, None),
    ("t", "b_char", COLTYPE_CHAR, 300, None),
    ("t", "c_vchar", COLTYPE_VARCHAR, 50, None),
    ("t", "d_vchar", COLTYPE_VARCHAR, 2610, None),
    ("t", "e_lvchar", COLTYPE_LVARCHAR, 1000, None),
]


def flattened(rows):
    """How the JDBC driver reports every one of them."""
    return [{"name": row[1], "type": VARCHAR(2147483647)} for row in rows]


def unsized(rows):
    """How the driver reports string columns: right type, no length at all."""
    return [{"name": row[1], "type": VARCHAR()} for row in rows]


def config(**overrides) -> InformixConnectionConfig:
    base = {
        "hostPort": "db.local:9088",
        "database": "spike",
        "username": "informix",
        "password": "in4mix",
        "serverName": "informix",
    }
    base.update(overrides)
    return InformixConnectionConfig(**base)


class TestConnectionUrl:
    def test_url_carries_informixserver(self):
        """serverName is required by the schema because the driver demands it."""
        assert get_connection_url(config()) == "informix://informix:in4mix@db.local:9088/spike?INFORMIXSERVER=informix"

    def test_password_special_characters_are_escaped(self):
        """':' or '@' in a password silently truncates an unescaped URL."""
        assert "informix:p%40ss%3Aw%2Frd%3Fx@db.local" in get_connection_url(config(password="p@ss:w/rd?x"))

    def test_connection_options_are_appended(self):
        assert "DELIMIDENT=y" in get_connection_url(config(connectionOptions={"DELIMIDENT": "y"}))


class TestSslPolicy:
    def test_require_enables_ssl(self):
        assert "SSLCONNECTION=true" in get_connection_url(config(sslMode=SslMode.require))

    @pytest.mark.parametrize("mode", [None, SslMode.disable])
    def test_disable_and_unset_are_plaintext(self, mode):
        assert "SSLCONNECTION" not in get_connection_url(config(sslMode=mode))

    @pytest.mark.parametrize("mode", [SslMode.allow, SslMode.prefer])
    def test_opportunistic_modes_are_plaintext(self, mode):
        """The driver has no opportunistic mode; allow/prefer permit plaintext."""
        assert "SSLCONNECTION" not in get_connection_url(config(sslMode=mode))

    @pytest.mark.parametrize("mode", [SslMode.verify_ca, SslMode.verify_full])
    def test_verify_modes_refuse_rather_than_downgrade(self, mode):
        """A verifying mode must never quietly become an unverified channel."""
        with pytest.raises(NotImplementedError):
            get_connection_url(config(sslMode=mode))


class TestTestConnection:
    @pytest.mark.skipif(not TEST_CONNECTION_JSON.exists(), reason="service resources not on disk")
    def test_every_declared_step_is_covered(self):
        """
        Guards drift between informix.json and the code. A step declared in the
        JSON with nothing to run it reports as a failure in the UI.
        """
        declared = {s["name"] for s in json.loads(TEST_CONNECTION_JSON.read_text())["steps"]}

        with (
            patch("metadata.ingestion.source.database.informix.connection.test_connection_db_common") as common,
            patch.object(InformixConnection, "client", new=object()),
        ):
            InformixConnection(config()).test_connection(metadata=OpenMetadata.__new__(OpenMetadata))

        supplied = set(common.call_args.kwargs["queries"])
        assert declared == COMMON_STEPS | supplied, "informix.json steps and the steps the connector runs have diverged"


class TestServiceSpec:
    def test_service_spec_resolves(self):
        """
        BaseSpec resolves connectors purely by import path. A rename or a missing
        service_spec.py fails only at ingestion time, never at import time.
        """
        spec = BaseSpec.get_for_source(service_type=ServiceType.Database, source_type="informix")
        assert spec.metadata_source_class == "metadata.ingestion.source.database.informix.metadata.InformixSource"
        assert spec.connection_class == "metadata.ingestion.source.database.informix.connection.InformixConnection"
        assert (
            spec.profiler_class
            == "metadata.profiler.interface.sqlalchemy.informix.profiler_interface.InformixProfilerInterface"
        )

    def test_rejects_foreign_connection_config(self):
        cockroach = {
            "type": "cockroach",
            "serviceName": "x",
            "serviceConnection": {
                "config": {
                    "type": "Cockroach",
                    "username": "u",
                    "authType": {"password": "p"},
                    "hostPort": "localhost:26257",
                    "database": "c",
                }
            },
            "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
        }
        with pytest.raises(InvalidSourceException):
            InformixSource.create(cockroach, OpenMetadata.__new__(OpenMetadata))


class TestClasspath:
    def test_classpath_is_scoped_to_informix_jars(self):
        """
        Without an explicit ``jars`` list sqlalchemy-jdbcapi starts the JVM with
        every recommended driver -- ~190MB, and a 404 on the gbase coordinate.
        """
        with patch(
            "metadata.ingestion.source.database.informix.dialect.get_driver_path",
            side_effect=lambda name: Path(f"/cache/{name}.jar"),
        ) as get_path:
            _, kwargs = InformixDialect().create_connect_args(make_url("informix://u:p@h:9088/db?INFORMIXSERVER=srv"))

        assert [c.args[0] for c in get_path.call_args_list] == ["informix", "informix_bson"]
        assert kwargs["jars"] == ["/cache/informix.jar", "/cache/informix_bson.jar"]


def build_source(rows):
    """An InformixSource whose catalogue lookup returns ``rows``."""
    source = InformixSource.__new__(InformixSource)
    source._column_overrides_cache = OrderedDict()
    connection = MagicMock()
    connection.execute.return_value.fetchall.return_value = rows
    return source, connection


def correct_columns(rows, columns, table="t", schema="informix"):
    source, connection = build_source(rows)
    with (
        patch.object(InformixSource, "connection", property(lambda self: connection)),
        patch.object(SqlColumnHandlerMixin, "_get_columns_internal", return_value=columns),
    ):
        return source._get_columns_internal(schema, table, "db", MagicMock())


class TestLargeObjectTypes:
    """
    Informix reports BYTE, TEXT, CLOB and BLOB to JDBC all as
    VARCHAR(2147483647). These guard the catalogue lookup that restores them.
    """

    def test_each_large_type_is_restored(self):
        corrected = correct_columns(LOB_ROWS, flattened(LOB_ROWS))
        resolved = {
            column["name"]: (ColumnTypeParser.get_column_type(column["type"]), column["system_data_type"])
            for column in corrected
        }
        assert resolved == {
            "c_byte": ("BYTES", "BYTE"),
            "c_text": ("TEXT", "TEXT"),
            "c_clob": ("CLOB", "CLOB"),
            "c_blob": ("BLOB", "BLOB"),
        }

    def test_every_restored_type_is_skipped_by_the_profiler(self):
        """The point of restoring the type: is_blob() must then recognise it."""
        for column in correct_columns(LOB_ROWS, flattened(LOB_ROWS)):
            om_type = DataType(ColumnTypeParser.get_column_type(column["type"]))
            assert is_blob(om_type), f"{column['name']} resolved to {om_type}, which is not skipped"

    def test_boolean_is_not_treated_as_a_large_object(self):
        """
        BOOLEAN shares coltype 41 with the smart large objects. Matching on 41
        alone would make every boolean column unprofilable.
        """
        corrected = correct_columns(
            [("t", "c_bool", COLTYPE_OPAQUE, 1, "boolean")], [{"name": "c_bool", "type": VARCHAR()}]
        )
        assert "system_data_type" not in corrected[0]
        assert ColumnTypeParser.get_column_type(corrected[0]["type"]) == "VARCHAR"

    def test_not_null_columns_are_still_recognised(self):
        """coltype carries flags above the low byte: BYTE NOT NULL arrives as 267."""
        corrected = correct_columns(
            [("t", "c_byte", 267 % 256, 56, None)], [{"name": "c_byte", "type": VARCHAR(2147483647)}]
        )
        assert corrected[0]["system_data_type"] == "BYTE"

    def test_unrelated_columns_are_untouched(self):
        corrected = correct_columns(
            [("t", "c_byte", COLTYPE_BYTE, 56, None)],
            [{"name": "age", "type": VARCHAR()}, {"name": "c_byte", "type": VARCHAR(2147483647)}],
        )
        assert "system_data_type" not in corrected[0]
        assert corrected[1]["system_data_type"] == "BYTE"

    def test_declared_width_is_restored(self):
        """The driver reports no length for string columns, and OM then reads 1."""
        corrected = correct_columns(WIDTH_ROWS, unsized(WIDTH_ROWS))
        assert {c["name"]: c["type"].length for c in corrected} == {
            "a_char": 10,
            "b_char": 300,
            "c_vchar": 50,
            "d_vchar": 50,
            "e_lvchar": 1000,
        }

    def test_the_two_collength_encodings_are_told_apart(self):
        """Masking the wrong type corrupts silently rather than failing.

        VARCHAR(50,10) stores 50 + 10*256 and needs masking; CHAR(300) stores 300
        and must not be masked, or it becomes a plausible-looking 44.
        """
        rows = [("t", "wide", COLTYPE_CHAR, 300, None), ("t", "reserved", COLTYPE_VARCHAR, 2610, None)]
        widths = {c["name"]: c["type"].length for c in correct_columns(rows, unsized(rows))}
        assert widths == {"wide": 300, "reserved": 50}

    def test_large_objects_are_not_given_a_width(self):
        """Their collength describes the descriptor, not the data."""
        corrected = correct_columns(LOB_ROWS, flattened(LOB_ROWS))
        assert all(getattr(c["type"], "length", None) != 56 for c in corrected)

    def test_catalogue_failure_degrades_instead_of_raising(self):
        """Reflection still works without the lookup; the types are just coarser."""
        source = InformixSource.__new__(InformixSource)
        source._column_overrides_cache = OrderedDict()
        connection = MagicMock()
        connection.execute.side_effect = RuntimeError("no privilege on syscolumns")
        columns = [{"name": "age", "type": VARCHAR()}]

        with (
            patch.object(InformixSource, "connection", property(lambda self: connection)),
            patch.object(SqlColumnHandlerMixin, "_get_columns_internal", return_value=columns),
        ):
            assert source._get_columns_internal("informix", "t", "db", MagicMock()) == columns

    def test_schema_cache_is_bounded(self):
        source, connection = build_source([])
        with patch.object(InformixSource, "connection", property(lambda self: connection)):
            for index in range(MAX_CACHED_SCHEMAS + 25):
                source._column_overrides("db", f"schema_{index}")

        assert len(source._column_overrides_cache) == MAX_CACHED_SCHEMAS
        assert ("db", "schema_0") not in source._column_overrides_cache

    def test_schema_is_looked_up_once(self):
        source, connection = build_source([])
        with patch.object(InformixSource, "connection", property(lambda self: connection)):
            for _ in range(5):
                source._column_overrides("db", "informix")

        assert connection.execute.call_count == 1

    def test_each_database_is_looked_up_separately(self):
        """Almost every Informix database owns its tables as "informix".

        Keying the cache on the schema name alone answers every database with
        the first one's columns, so a CLOB in the second database keeps the
        VARCHAR(2147483647) the driver reported and the profiler then tries to
        GROUP BY it.
        """
        source, connection = build_source([])
        with patch.object(InformixSource, "connection", property(lambda self: connection)):
            source._column_overrides("first_db", "informix")
            source._column_overrides("second_db", "informix")

        assert connection.execute.call_count == 2


def build_interface(om_columns):
    interface = InformixProfilerInterface.__new__(InformixProfilerInterface)
    interface.table_entity = SimpleNamespace(
        name=ColumnName(root="t"),
        columns=[Column(name=ColumnName(root=name), dataType=data_type) for name, data_type in om_columns],
    )
    return interface


class TestProfilerInterface:
    def test_large_object_columns_are_skipped(self):
        interface = build_interface(
            [
                ("age", DataType.INT),
                ("c_byte", DataType.BYTES),
                ("c_text", DataType.TEXT),
                ("c_clob", DataType.CLOB),
                ("c_blob", DataType.BLOB),
                ("nm", DataType.VARCHAR),
            ]
        )
        orm = [SimpleNamespace(name=n) for n in ("age", "c_byte", "c_text", "c_clob", "c_blob", "nm")]

        with patch.object(SQAProfilerInterface, "get_columns", return_value=orm):
            assert [c.name for c in interface.get_columns()] == ["age", "nm"]

    def test_tables_without_large_objects_are_unchanged(self):
        interface = build_interface([("age", DataType.INT), ("nm", DataType.VARCHAR)])
        orm = [SimpleNamespace(name="age"), SimpleNamespace(name="nm")]

        with patch.object(SQAProfilerInterface, "get_columns", return_value=orm):
            assert interface.get_columns() == orm

    def test_rejected_query_drops_one_column_not_the_run(self):
        """The backstop for an Informix type the type-based skip doesn't know."""
        interface = InformixProfilerInterface.__new__(InformixProfilerInterface)
        result = interface._programming_error_static_metric(
            SimpleNamespace(table_name="t"),
            SimpleNamespace(name="odd"),
            RuntimeError("Blobs are not allowed in this expression"),
            None,
            None,
        )
        assert result is None


def build_sampler(unfriendly, *, raises=False):
    """A sampler whose catalogue lookup returns (column, castable) pairs."""
    sampler = InformixSampler.__new__(InformixSampler)
    sampler._table = SimpleNamespace(__table__=SimpleNamespace(name="t", schema="informix"))
    sampler._driver_unfriendly = None

    connection = MagicMock()
    if raises:
        connection.connect.side_effect = RuntimeError("catalogue unreachable")
    else:
        conn = connection.connect.return_value.__enter__.return_value
        conn.execute.return_value.fetchall.return_value = [(name, int(ok)) for name, ok in unfriendly]
    sampler.connection = connection
    return sampler


class TestSampler:
    def test_columns_that_cannot_be_cast_are_left_out(self):
        sampler = build_sampler([("d_opaque", False), ("d_row", False), ("d_set", False)])
        orm = [SimpleNamespace(name=n) for n in ("id", "d_opaque", "d_distinct", "d_row", "d_set", "d_plain")]

        with patch.object(SQASampler, "get_columns", return_value=orm):
            assert [c.name for c in sampler.get_columns()] == ["id", "d_distinct", "d_plain"]

    def test_castable_columns_are_kept(self):
        """A cast recovers the data, so the column must survive the column list.

        Dropping it would be the easy fix and would lose exactly the columns
        that tend to matter most.
        """
        sampler = build_sampler([("d_tagged", True), ("d_opaque", False)])
        orm = [SimpleNamespace(name=n) for n in ("id", "d_tagged", "d_opaque")]

        with patch.object(SQASampler, "get_columns", return_value=orm):
            assert [c.name for c in sampler.get_columns()] == ["id", "d_tagged"]

    def test_tables_without_them_are_unchanged(self):
        sampler = build_sampler([])
        orm = [SimpleNamespace(name="id"), SimpleNamespace(name="nm")]

        with patch.object(SQASampler, "get_columns", return_value=orm):
            assert sampler.get_columns() == orm

    def test_unreadable_catalogue_still_samples(self):
        """Degrade to the old behaviour rather than losing the table entirely.

        Most tables have no such column, so attempting the sample is better than
        refusing to sample because the type lookup failed.
        """
        sampler = build_sampler([], raises=True)
        orm = [SimpleNamespace(name="id")]

        with patch.object(SQASampler, "get_columns", return_value=orm):
            assert sampler.get_columns() == orm

    def test_the_catalogue_is_read_once_per_table(self):
        sampler = build_sampler([("d_opaque", False)])
        orm = [SimpleNamespace(name="id")]

        with patch.object(SQASampler, "get_columns", return_value=orm):
            for _ in range(5):
                sampler.get_columns()

        assert sampler.connection.connect.call_count == 1

    def test_tables_needing_no_cast_use_the_base_implementation(self):
        """The override only earns its keep on the rare table that needs it."""
        sampler = build_sampler([("d_opaque", False)])

        with patch.object(SQASampler, "fetch_sample_data", return_value="base") as base:
            assert sampler.fetch_sample_data(None) == "base"
        base.assert_called_once()

    def test_cast_renders_as_lvarchar(self):
        """The cast has to name a type Informix accepts, or every sample fails."""
        compiled = str(select(cast(sa_column("body"), LVarchar()).label("body")).compile(dialect=InformixDialect()))
        assert "CAST(body AS LVARCHAR)" in compiled

    def test_boolean_stays_sampleable(self):
        """BOOLEAN is an extended type on coltype 41, like the opaque types.

        Dropping it from the convertible list would silently stop sampling every
        boolean column on the server -- the same trap c_bool guards in the
        profiler tests.
        """
        assert set(INFORMIX_DRIVER_CONVERTIBLE_EXTENDED_TYPES) == {"lvarchar", "boolean", "blob", "clob"}

    def test_distinct_types_are_judged_by_their_source(self):
        """A distinct type behaves as whatever it was built from.

        Over LVARCHAR the driver returns it; over an opaque type it fails just
        like the opaque type does. Its own name and mode say neither.
        """
        assert "b.extended_id = x.source" in INFORMIX_GET_DRIVER_UNFRIENDLY_COLUMNS
        assert "NVL(b.name, x.name)" in INFORMIX_GET_DRIVER_UNFRIENDLY_COLUMNS

    def test_sampling_does_not_call_a_random_function(self):
        """Informix has no RANDOM(), RAND(), or per-row DBINFO value.

        The default compilation emits ABS(RANDOM()) * 100, which Informix
        rejects with "674: Routine (random) can not be resolved" -- and that
        kills every profiler metric that samples. rowid is not a way out: it
        raises "857: Rowids do not exist on table" on fragmented tables.
        """
        compiled = str(select(ModuloFn(RandomNumFn(), 100).label(RANDOM_LABEL)).compile(dialect=InformixDialect()))
        # The label is called "random"; what must not appear is a call to it.
        assert "RANDOM(" not in compiled.upper()
        assert "MOD(0," in compiled

    def test_castability_comes_from_syscasts(self):
        """Whether a column can be recovered is the server's answer, not a guess."""
        assert "syscasts" in INFORMIX_GET_DRIVER_UNFRIENDLY_COLUMNS
        assert "'lvarchar'" in INFORMIX_GET_DRIVER_UNFRIENDLY_COLUMNS
