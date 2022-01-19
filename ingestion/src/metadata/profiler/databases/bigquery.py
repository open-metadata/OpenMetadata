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

from metadata.ingestion.source.bigquery import BigQueryConfig
from metadata.profiler.common.database_common import DatabaseCommon, SQLExpressions


class BigquerySQLExpressions(SQLExpressions):
    stddev_expr = "STDDEV_POP({})"
    regex_like_pattern_expr = "REGEXP_CONTAINS({expr}, r'{}')"


class Bigquery(DatabaseCommon):
    config: BigQueryConfig = None
    sql_exprs: BigquerySQLExpressions = BigquerySQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = BigQueryConfig.parse_obj(config_dict)
        return cls(config)

    def qualify_table_name(self, table_name: str, schema_name: str) -> str:
        return f"`{self.config.database}.{table_name}`"
