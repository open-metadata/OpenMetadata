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

"""Tests for the URL handed to the data-diff package.

`serviceUrl` is a canonical SQLAlchemy URL, which percent-encodes the username, the password and
the query string. data-diff parses a URI with `dsnparse` and only decodes the password, the host
and the query string, so a percent-encoded username reaches the driver still encoded and
`svc_user@corp.com` authenticates as `svc_user%40corp.com`.

See https://github.com/open-metadata/OpenMetadata/issues/31124.

Every assertion below goes through data-diff's *own* parser rather than a hand-rolled expectation,
so the tests fail if data-diff ever changes what it decodes.
"""

import uuid

import dsnparse
import pytest
from data_diff.databases._connect import CustomParseResult
from sqlalchemy.engine import URL, make_url

from metadata.data_quality.validations.models import TableParameter
from metadata.data_quality.validations.utils import render_url_for_data_diff
from metadata.generated.schema.entity.data.table import (
    Column,
    ColumnName,
    DataType,
    Table,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.ingestion.source.database.snowflake.data_diff.data_diff import (
    SnowflakeTableParameter,
)


def data_diff_parse(url: str) -> CustomParseResult:
    """Parse a URI exactly the way `data_diff.connect_to_table` does."""
    return dsnparse.parse(url, parse_class=CustomParseResult)


def assert_round_trips(url: URL) -> str:
    """Assert data-diff reads back every component of `url` unchanged. Returns the rendered URI."""
    rendered = render_url_for_data_diff(url)
    parsed = data_diff_parse(rendered)

    assert parsed.username == url.username
    assert parsed.password == (str(url.password) if url.password is not None else None)
    assert parsed.host == url.host
    assert parsed.port == url.port
    assert "/".join(parsed.paths) == (url.database or "")
    assert parsed.query == dict(url.query)
    return rendered


class TestRenderUrlForDataDiff:
    """The renderer must survive exactly one encode/decode round trip through data-diff."""

    @pytest.mark.parametrize(
        "url",
        [
            pytest.param(
                URL.create(
                    drivername="snowflake",
                    username="svc_user@corp.com",
                    password="p@ssw0rd/x",
                    host="my_account",
                    database="my_db/my_schema",
                    query={"account": "my_account", "warehouse": "MY WAREHOUSE", "role": "MY ROLE"},
                ),
                id="snowflake-email-username-and-special-password",
            ),
            pytest.param(
                URL.create(
                    drivername="snowflake",
                    username="svc_user@corp.com",
                    host="my_account",
                    database="my_db/my_schema",
                    query={"account": "my_account"},
                ),
                id="username-with-at-sign-and-no-password",
            ),
            pytest.param(
                URL.create(
                    drivername="mssql",
                    username="CORP\\svc_user",
                    password="p@ss:w/rd?#!",
                    host="sql.example.com",
                    port=1433,
                    database="my_db/my_schema",
                ),
                id="windows-domain-username-and-delimiter-heavy-password",
            ),
            pytest.param(
                URL.create(
                    drivername="postgresql",
                    username="100%pure",
                    password="a%b",
                    host="pg.example.com",
                    port=5432,
                    database="my_db",
                ),
                id="literal-percent-in-username-and-password",
            ),
            pytest.param(
                URL.create(
                    drivername="mysql",
                    username="my user",
                    password="my pass",
                    host="mysql.example.com",
                    port=3306,
                    database="my_schema",
                ),
                id="spaces-in-credentials",
            ),
            pytest.param(
                URL.create(
                    drivername="postgresql",
                    username="plain_user",
                    password="plain_password",
                    host="pg.example.com",
                    port=5432,
                    database="my_db",
                ),
                id="nothing-to-encode",
            ),
            pytest.param(
                URL.create(drivername="postgresql", host="pg.example.com", port=5432, database="my_db"),
                id="no-credentials-at-all",
            ),
            pytest.param(
                URL.create(drivername="postgresql", username="only_user", host="pg.example.com"),
                id="username-only-no-password-no-database",
            ),
        ],
    )
    def test_data_diff_reads_back_every_component(self, url: URL) -> None:
        assert_round_trips(url)

    def test_it_stops_double_encoding_the_username(self) -> None:
        """The regression from #31124: data-diff never decodes the username."""
        url = URL.create(
            drivername="snowflake",
            username="svc_user@corp.com",
            password="my_password",
            host="my_account",
            database="my_db/my_schema",
        )

        # What the code used to send: SQLAlchemy encoded the username, data-diff kept it encoded
        assert data_diff_parse(url.render_as_string(hide_password=False)).username == "svc_user%40corp.com"

        assert data_diff_parse(render_url_for_data_diff(url)).username == "svc_user@corp.com"

    def test_it_keeps_the_password_encoded(self) -> None:
        """Decoding the whole URI is the tempting-but-wrong fix: data-diff decodes the password itself.

        A raw `@` or `/` in the password would break `dsnparse`'s credential regex, so the password
        has to stay percent-encoded on the wire.
        """
        url = URL.create(
            drivername="snowflake",
            username="svc_user",
            password="p@ssw0rd/x",
            host="my_account",
            database="my_db/my_schema",
        )

        rendered = render_url_for_data_diff(url)

        assert "p%40ssw0rd%2Fx" in rendered
        assert data_diff_parse(rendered).password == "p@ssw0rd/x"

    @pytest.mark.parametrize("reserved", [":", "/", "?", "#"])
    def test_it_keeps_username_delimiters_encoded_so_the_uri_still_parses(self, reserved: str) -> None:
        """A raw delimiter in the username would move the userinfo/authority boundary.

        data-diff cannot decode these back, but a mangled username beats an unparseable URI.
        """
        url = URL.create(
            drivername="postgresql",
            username=f"svc{reserved}user",
            password="my_password",
            host="pg.example.com",
            port=5432,
            database="my_db",
        )

        parsed = data_diff_parse(render_url_for_data_diff(url))

        assert reserved not in parsed.username
        assert parsed.host == "pg.example.com"
        assert parsed.port == 5432
        assert parsed.password == "my_password"

    def test_it_warns_when_the_username_cannot_be_decoded(self, caplog: pytest.LogCaptureFixture) -> None:
        url = URL.create(drivername="postgresql", username="svc:user", host="pg.example.com", database="my_db")

        with caplog.at_level("WARNING"):
            render_url_for_data_diff(url)

        assert "reserved by the connection URI" in caplog.text

    def test_it_stays_quiet_for_an_ordinary_username(self, caplog: pytest.LogCaptureFixture) -> None:
        url = URL.create(drivername="postgresql", username="svc_user@corp.com", host="pg.example.com")

        with caplog.at_level("WARNING"):
            render_url_for_data_diff(url)

        assert caplog.text == ""


class TestTableParameterDataDiffServiceUrl:
    def test_it_decodes_the_username_of_a_url(self) -> None:
        table_parameter = TableParameter.model_construct(
            serviceUrl="snowflake://svc_user%40corp.com:my_password@my_account/my_db/my_schema",
            path="my_schema.my_table",
            database_service_type=DatabaseServiceType.Snowflake,
            columns=[],
            privateKey=None,
            passPhrase=None,
        )

        parsed = data_diff_parse(table_parameter.data_diff_service_url)

        assert parsed.username == "svc_user@corp.com"
        assert parsed.password == "my_password"

    def test_it_passes_a_connection_dict_through_untouched(self) -> None:
        """Connection dicts skip the URI parser entirely, so data-diff reads their values verbatim."""
        connection_dict = {
            "driver": "mssql",
            "host": "sql.example.com",
            "port": 1433,
            "user": "user@example.com",
            "password": "p@ss/word",
            "database": "my_db",
            "schema": "my_schema",
        }
        table_parameter = TableParameter.model_construct(
            serviceUrl=connection_dict,
            path="my_schema.my_table",
            database_service_type=DatabaseServiceType.AzureSQL,
            columns=[],
            privateKey=None,
            passPhrase=None,
        )

        assert table_parameter.data_diff_service_url is connection_dict

    def test_it_leaves_the_stored_service_url_a_canonical_sqlalchemy_url(self) -> None:
        """`serviceUrl` is re-parsed by `make_url` in the service-specific setters, so it must stay encoded."""
        table_parameter = TableParameter.model_construct(
            serviceUrl="snowflake://svc_user%40corp.com:p%40ss@my_account/my_db/my_schema",
            path="my_schema.my_table",
            database_service_type=DatabaseServiceType.Snowflake,
            columns=[],
            privateKey=None,
            passPhrase=None,
        )

        assert data_diff_parse(table_parameter.data_diff_service_url).username == "svc_user@corp.com"

        assert make_url(table_parameter.serviceUrl).username == "svc_user@corp.com"
        assert make_url(table_parameter.serviceUrl).password == "p@ss"


class TestSnowflakeServiceUrlEndToEnd:
    """The path that produced the `JWT token is invalid` failure reported in #31124."""

    @staticmethod
    def build_service(**overrides) -> DatabaseService:
        connection = SnowflakeConnection(
            username="svc_user@corp.com",
            account="my_account",
            warehouse="MY WAREHOUSE",
            role="MY ROLE",
            **overrides,
        )
        return DatabaseService(
            id=uuid.uuid4(),
            name="snowflake_service",
            serviceType=DatabaseServiceType.Snowflake,
            connection=DatabaseConnection(config=connection),
        )

    @staticmethod
    def build_table() -> Table:
        return Table(
            id=uuid.uuid4(),
            name="my_table",
            fullyQualifiedName="snowflake_service.my_db.my_schema.my_table",
            columns=[Column(name=ColumnName("id"), dataType=DataType.INT)],
        )

    def get_table_parameter(self, service_url: str | None = None, **overrides) -> TableParameter:
        return SnowflakeTableParameter().get(
            self.build_service(**overrides),
            self.build_table(),
            {"id"},
            set(),
            False,
            service_url,
        )

    def test_password_authentication_reaches_data_diff_decoded(self) -> None:
        table_parameter = self.get_table_parameter(password="p@ssw0rd/x")

        parsed = data_diff_parse(table_parameter.data_diff_service_url)

        assert parsed.username == "svc_user@corp.com"
        assert parsed.password == "p@ssw0rd/x"
        assert parsed.host == "my_account"
        assert parsed.paths == ["my_db", "my_schema"]
        assert parsed.query == {
            "account": "my_account",
            "warehouse": "MY WAREHOUSE",
            "role": "MY ROLE",
        }

    def test_private_key_authentication_reaches_data_diff_decoded(self) -> None:
        """Key-pair auth signs a JWT over `ACCOUNT.USER`, so an encoded username is rejected by Snowflake.

        This is the `JWT token is invalid` failure from the issue: the private key is valid, the
        username is not the one the key was registered for.
        """
        table_parameter = self.get_table_parameter(
            service_url="snowflake://svc_user%40corp.com:p%40ssw0rd@my_account/my_default_db",
            password="p@ssw0rd",
            privateKey="-----BEGIN PRIVATE KEY-----\nmy_key\n-----END PRIVATE KEY-----",
            snowflakePrivatekeyPassphrase="my_passphrase",
        )

        parsed = data_diff_parse(table_parameter.data_diff_service_url)

        assert parsed.username == "svc_user@corp.com"
        # the private key wins over the password, which the setter strips from the url
        assert parsed.password is None
        assert table_parameter.privateKey is not None

    def test_an_overridden_service_url_is_decoded_too(self) -> None:
        """`serviceUrl` can be supplied as a test case parameter; it takes the same route."""
        table_parameter = self.get_table_parameter(
            service_url="snowflake://other_user%40corp.com:other%40password@other_account/other_db",
            password="my_password",
        )

        parsed = data_diff_parse(table_parameter.data_diff_service_url)

        assert parsed.username == "other_user@corp.com"
        assert parsed.password == "other@password"
        assert parsed.host == "other_account"
