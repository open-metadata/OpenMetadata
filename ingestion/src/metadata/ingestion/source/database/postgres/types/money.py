#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Custom sqlalchemy type for Postgres MONEY type
"""


from sqlalchemy.dialects.postgresql import MONEY
from sqlalchemy.sql.sqltypes import String

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class PostgresMoney(MONEY):
    """Wrapper for Postgres MONEY type"""

    impl = String
    cache_ok = True

    @property
    def quantifiable(self):
        return True

    @staticmethod
    def compile_as_float(expr: str) -> str:
        return f"(({expr})::numeric::float8)"
