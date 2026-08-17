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
import re
from typing import TYPE_CHECKING
from urllib.parse import quote_plus

from sqlalchemy.engine import Engine

from metadata.core.connections.test_connection import ErrorPack, check, when
from metadata.core.connections.test_connection.checks.database import (
    DEFAULT_SAMPLE_ROWS,
    DatabaseStep,
    list_schemas,
    list_tables,
    list_views,
    ping,
    run_sql,
)
from metadata.core.connections.test_connection.checks.summary import enumerated
from metadata.core.connections.test_connection.classifier import chain_text
from metadata.core.connections.test_connection.network import NETWORK_ERRORS
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
    from metadata.core.connections.test_connection.classifier import Matcher
    from metadata.core.connections.test_connection.records import Evidence


# teradatasql raises a single ``OperationalError`` whose message embeds the
# database's own codes, e.g.
#   [Version 20.0.0.65] [Session 1038] [Teradata Database] [Error 8017]
#   [SQLState 28000] The UserId, Password or Account is invalid.
# The driver exposes no ``.errno``/``.sqlstate`` attribute, so both codes have to
# be read back out of the text - but the codes themselves are stable and
# locale-independent, unlike the message that follows them.
_ERROR_CODE = re.compile(r"\[error (\d+)\]")
_SQL_STATE = re.compile(r"\[sqlstate ([0-9a-z]+)\]")


def _codes(pattern: re.Pattern[str], error: BaseException) -> set[str]:
    return set(pattern.findall(chain_text(error)))


def _error(*codes: int) -> Matcher:
    """Match a Teradata message code, e.g. ``[Error 3802]``."""
    wanted = {str(code) for code in codes}
    return lambda error: bool(_codes(_ERROR_CODE, error) & wanted)


def _sqlstate(*states: str) -> Matcher:
    """Match a Teradata SQLState, e.g. ``[SQLState 28000]``."""
    wanted = {state.lower() for state in states}
    return lambda error: bool(_codes(_SQL_STATE, error) & wanted)


# Only codes whose text has been confirmed against Teradata's own references are
# encoded here; an unmatched error keeps its raw errorLog rather than being given
# a guessed diagnosis.
TERADATA_ERRORS = ErrorPack(
    # SQLState 28000 is the SQL-standard "invalid authorization specification"
    # class; Teradata reports every bad-credential variant under it (Error 8017
    # "The UserId, Password or Account is invalid" being the common one). Keying
    # on the state rather than 8017 alone also covers the LDAP/Kerberos logmech
    # rejections, which carry their own message codes.
    when(_sqlstate("28000")).diagnose(
        "Authentication failed",
        fix="Check the username, password and account, and that the configured logmech "
        "(TD2, LDAP, KRB5, ...) is the one this system expects.",
    ),
    when(_error(3802)).diagnose(
        "Database not found",
        fix="Verify the referenced database exists and that the user can see it.",
    ),
    when(_error(3807)).diagnose(
        "Object not found",
        fix="Verify the referenced table or view exists and that the user can see it.",
    ),
    when(_error(3523)).diagnose(
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
        return ping(self._db.client)

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
