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
import logging

from metadata.ingestion.source.postgres import PostgresConfig
from metadata.profiler.common.database_common import DatabaseCommon, SQLExpressions

logger = logging.getLogger(__name__)


class PostgresSQLExpressions(SQLExpressions):
    regex_like_pattern_expr: str = "{} ~* '{}'"


class Postgres(DatabaseCommon):
    config: PostgresConfig = None
    sql_exprs: PostgresSQLExpressions = PostgresSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = PostgresConfig.parse_obj(config_dict)
        return cls(config)

    def qualify_table_name(self, table_name: str, schema_name: str) -> str:
        if schema_name:
            return f'"{schema_name}"."{table_name}"'
        return f'"{table_name}"'

    def qualify_column_name(self, column_name: str):
        return f'"{column_name}"'
