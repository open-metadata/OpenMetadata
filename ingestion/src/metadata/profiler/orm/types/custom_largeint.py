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

"""Custom SQLAlchemy type for 128-bit LARGEINT columns."""

from decimal import Decimal

from sqlalchemy import NUMERIC
from sqlalchemy.types import TypeDecorator


class CustomLargeInt(TypeDecorator):
    """Signed 128-bit integer (Doris/StarRocks LARGEINT).

    Doris sends LARGEINT over the MySQL wire protocol as MYSQL_TYPE_STRING,
    and DorisPyMySQLDialect sets supports_native_decimal=True so bare
    sqlalchemy.NUMERIC installs no result processor. Wrapping NUMERIC in a
    TypeDecorator guarantees text values are decoded into exact Decimal values.
    """

    impl = NUMERIC
    cache_ok = True
    quantifiable = True

    @property
    def python_type(self):
        return Decimal

    def process_result_value(self, value, dialect):
        if value is None or isinstance(value, Decimal):
            return value
        if isinstance(value, (int, str)):
            return Decimal(value)
        return value
