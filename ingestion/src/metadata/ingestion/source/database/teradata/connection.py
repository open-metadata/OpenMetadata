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
Source connection handler
"""

from __future__ import annotations

import enum
from typing import TYPE_CHECKING
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.core.connections.test_connection import ErrorPack, Matchers, check, when
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
    list_schemas,
    list_tables,
    list_views,
    run_sql,
)
from metadata.core.connections.test_connection.checks.summary import enumerated
from metadata.core.connections.test_connection.network import NETWORK_ERRORS, probe_or_fail
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataConnection as TeradataConnectionConfig,
)
from metadata.generated.schema.entity.services.connections.database.teradataConnection import (
    TeradataScheme,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
    get_connection_options_dict,
)
from metadata.ingestion.connections.connection import BaseConnection
from metadata.ingestion.source.database.teradata.queries import TERADATA_GET_DATABASE

if TYPE_CHECKING:
    from metadata.core.connections.lifetime import Borrowed
    from metadata.core.connections.test_connection import ChecksProvider
    from metadata.core.connections.test_connection.records import Evidence


# teradatasql raises a single ``OperationalError`` whose message embeds the
# database's own codes, e.g.
#   [Version 20.0.0.65] [Session 1038] [Teradata Database] [Error 8017]
#   [SQLState 28000] The UserId, Password or Account is invalid.
# The driver exposes no ``.errno``/``.sqlstate`` attribute, so the rules below key
# on the bracketed code rather than the prose after it: the codes are stable and
# locale-independent, and the brackets keep a bare number elsewhere in the message
# (a row count, an id) from being read as a code.

# The port teradatasql dials when hostPort carries none. The preflight has to
# probe the same one, or it silently checks the wrong door.
TERADATA_DEFAULT_PORT = 1025


# Only codes whose text has been confirmed against Teradata's own references are
# encoded here; an unmatched error keeps its raw errorLog rather than being given
# a guessed diagnosis.
TERADATA_ERRORS = ErrorPack(
    # SQLState 28000 is the SQL-standard "invalid authorization specification"
    # class. Error 8017 "The UserId, Password or Account is invalid" is the code
    # seen in practice under it, for LOGMECH=TD2 and LOGMECH=LDAP alike. Keying
    # on the class rather than 8017 alone means any other rejection Teradata
    # classifies as an authorization failure is covered without enumerating -
    # or guessing at - codes that have not been observed.
    when(Matchers.contains("[SQLState 28000]")).diagnose(
        "Authentication failed",
        fix="Check the username, password and account, and that the configured logmech "
        "(TD2, LDAP, KRB5, ...) is the one this system expects.",
    ),
    # teradatasql is a Go driver behind cgo, so a network failure it detects
    # itself never surfaces as a Python socket exception - NETWORK_ERRORS matches
    # by exception type and is structurally blind to it. The preflight in
    # check_access catches most of these first, in Python; these two rules are the
    # backstop for whatever still reaches the driver. SQLState 08000 is the
    # SQL-standard "connection exception" class, so the generic rule stays true
    # for any member of it; Error 493 is the observed hostname-lookup case and is
    # ordered first to keep the sharper wording.
    when(Matchers.contains("[Error 493]")).diagnose(
        "Host could not be resolved",
        fix="Check hostPort for typos and that DNS can resolve it from where ingestion runs.",
    ),
    when(Matchers.contains("[SQLState 08000]")).diagnose(
        "Cannot connect to the Teradata system",
        fix="Check hostPort, that the system is running, and that the network, firewall or "
        "IP allow-list permits the connection from where ingestion runs.",
    ),
    when(Matchers.contains("[Error 3802]")).diagnose(
        "Database not found",
        fix="Verify the referenced database exists and that the user can see it.",
    ),
    when(Matchers.contains("[Error 3807]")).diagnose(
        "Object not found",
        fix="Verify the referenced table or view exists and that the user can see it.",
    ),
    when(Matchers.contains("[Error 3523]")).diagnose(
        "Insufficient privileges",
        fix="Grant the user SELECT on the objects the failing step reads "
        "(the dbc.*VX dictionary views for schema, table and view discovery).",
    ),
).including(NETWORK_ERRORS)


class TeradataChecks:
    """Test-connection checks for Teradata."""

    errors = TERADATA_ERRORS

    # Teradata's reserved system databases - skipped when auto-selecting a
    # database to probe, so the table/view checks land on real user data.
    SYSTEM_SCHEMAS = frozenset({"dbc", "sysadmin", "sys_calendar", "syslib", "sysudtlib", "td_sysfnlib"})

    def __init__(self, db: Borrowed[Engine]) -> None:
        self._db = db

    @check(DatabaseStep.CheckAccess)
    def check_access(self) -> Evidence:
        # Not the shared ``ping``: it derives the probe target from the URL and
        # skips the preflight when no port is present. Teradata's hostPort is
        # commonly a bare hostname, so that skip is the normal case, and the DNS
        # or firewall failure then lands inside the Go driver - which reports it
        # as an opaque OperationalError carrying no socket exception for the
        # error pack to match on. Probing the port the driver would dial keeps
        # the failure in Python, where it is diagnosed properly and fails fast.
        client = self._db.client
        if client.url.host:
            probe_or_fail(client.url.host, client.url.port or TERADATA_DEFAULT_PORT)
        return run_sql(client, "SELECT 1", lambda _: "connection established")

    @check(DatabaseStep.GetDatabases)
    def get_databases(self) -> Evidence:
        return run_sql(
            self._db.client,
            TERADATA_GET_DATABASE,
            lambda rows: enumerated(len(rows), "database", DEFAULT_SAMPLE_ROWS),
        )

    @check(DatabaseStep.GetSchemas)
    def get_schemas(self) -> Evidence:
        return list_schemas(self._db.client)

    @check(DatabaseStep.GetTables)
    def get_tables(self) -> Evidence:
        # Teradata has no databaseSchema setting, so the probe schema is always
        # auto-selected from the first non-system database.
        return list_tables(self._db.client, None, self.SYSTEM_SCHEMAS)

    @check(DatabaseStep.GetViews)
    def get_views(self) -> Evidence:
        return list_views(self._db.client, None, self.SYSTEM_SCHEMAS)


class TeradataConnection(BaseConnection[TeradataConnectionConfig, Engine]):
    def _get_client(self) -> Engine:
        """
        Return the SQLAlchemy Engine for Teradata.
        """
        engine = create_generic_db_connection(
            connection=self.service_connection,
            get_connection_url_fn=self.get_connection_url,
            get_connection_args_fn=get_connection_args_common,
        )
        self._on_close(engine.dispose)
        return engine

    @staticmethod
    def get_connection_url(connection: TeradataConnectionConfig) -> str:
        scheme = connection.scheme.value if connection.scheme else TeradataScheme.teradatasql.value
        url = f"{scheme}://{connection.hostPort}/"
        url += f"?user={quote_plus(connection.username)}"
        if connection.password:
            url += f"&password={quote_plus(connection.password.get_secret_value())}"

        # add standard options
        params = "&".join(
            [
                f"{key}={quote_plus(str(getattr(connection, key) if not isinstance(getattr(connection, key), enum.Enum) else getattr(connection, key).value))}"
                for key in ["account", "logdata", "logmech", "tmode"]
                if getattr(connection, key, None)
            ]
        )
        url = f"{url}&{params}"

        # add additional options if specified
        options = get_connection_options_dict(connection)
        if options:
            params = "&".join(
                f"{key}={quote_plus(str(value if not isinstance(value, enum.Enum) else value.value))}"
                for (key, value) in options.items()
                if value
            )
            url = f"{url}&{params}"
        return url

    def checks(self) -> ChecksProvider:
        return TeradataChecks(db=self.borrow())
