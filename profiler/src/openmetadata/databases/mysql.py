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

from typing import Optional

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
)


class MySQLConnectionConfig(SQLConnectionConfig):
    host_port = "localhost:3306"
    scheme = "mysql+pymysql"
    service_type = "MySQL"

    def get_connection_url(self):
        return super().get_connection_url()


class MySQLExpressions(SQLExpressions):
    count_conditional_expr = "COUNT(CASE WHEN {} THEN 1 END) AS _"
    regex_like_pattern_expr = "{} regexp '{}'"


class MySQL(DatabaseCommon):
    config: MySQLConnectionConfig = None
    sql_exprs: MySQLExpressions = MySQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = MySQLConnectionConfig.parse_obj(config_dict)
        return cls(config)
