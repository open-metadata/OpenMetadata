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
"""set_catalog quotes the MySQL/MariaDB schema name it switches to."""

from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects.mysql.base import MySQLDialect

from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.mixins.sqalchemy.sqa_mixin import SQAInterfaceMixin


@pytest.mark.parametrize("connection_type", [MysqlConnection, MariaDBConnection])
def test_use_statement_escapes_backticks(connection_type):
    mixin = SQAInterfaceMixin.__new__(SQAInterfaceMixin)
    mixin.service_connection_config = MagicMock(spec=connection_type)
    mixin.table_entity = MagicMock()
    mixin.table_entity.databaseSchema.name = "sch`ema; DROP DATABASE x"
    session = MagicMock()
    session.connection.return_value.dialect = MySQLDialect()

    mixin.set_catalog(session)

    # MySQL doubles a backtick inside a quoted identifier.
    assert str(session.execute.call_args[0][0]) == "USE `sch``ema; DROP DATABASE x`"
