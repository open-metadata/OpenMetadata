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
"""MySQL test-connection: its checks match its shipped definition."""

import json
from pathlib import Path

from metadata.core.connections.test_connection.check import collect_checks
from metadata.ingestion.source.database.mysql.connection import MYSQL_ERRORS, MySQLChecks

_SEED = (
    Path(__file__).parents[6]
    / "openmetadata-service/src/main/resources/json/data"
    / "testConnections/database/mysql.json"
)


def _check_names():
    checks = MySQLChecks(client=None, schema=None, queries_statement="")
    return {step.value for step in collect_checks(checks)}


def test_mysql_checks_cover_expected_steps():
    assert _check_names() == {
        "CheckAccess",
        "GetSchemas",
        "GetTables",
        "GetViews",
        "GetQueries",
    }


def test_mysql_checks_match_definition_seed():
    definition_steps = {step["name"] for step in json.loads(_SEED.read_text())["steps"]}
    assert _check_names() == definition_steps


def _driver_error(errno: int, message: str) -> Exception:
    """A PyMySQL-style error: numeric code in args[0]."""
    error = Exception()
    error.args = (errno, message)
    return error


def test_error_pack_access_denied():
    diagnosis = MYSQL_ERRORS.classify(_driver_error(1045, "Access denied for user 'x'@'h' (using password: YES)"))
    assert diagnosis is not None
    assert "Authentication" in diagnosis.title


def test_error_pack_unknown_database():
    diagnosis = MYSQL_ERRORS.classify(_driver_error(1049, "Unknown database 'foo'"))
    assert diagnosis is not None
    assert "not found" in diagnosis.title.lower()


def test_error_pack_query_log_denied():
    diagnosis = MYSQL_ERRORS.classify(_driver_error(1142, "SELECT command denied to user 'x' for table 'general_log'"))
    assert diagnosis is not None
    assert "Query history" in diagnosis.title


def test_error_pack_cannot_connect():
    diagnosis = MYSQL_ERRORS.classify(_driver_error(2003, "Can't connect to MySQL server on 'h' ([Errno 111] refused)"))
    assert diagnosis is not None
    assert "reach" in diagnosis.title.lower()


def test_error_pack_caching_sha2_has_no_errno():
    # PyMySQL raises this with the message in args[0], no numeric code.
    diagnosis = MYSQL_ERRORS.classify(Exception("Couldn't receive server's public key"))
    assert diagnosis is not None
    assert "Secure connection" in diagnosis.title


def test_error_pack_unmatched_returns_none():
    assert MYSQL_ERRORS.classify(_driver_error(9999, "novel error")) is None
