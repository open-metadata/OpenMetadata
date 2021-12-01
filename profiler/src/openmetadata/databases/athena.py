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

import os
from datetime import date
from typing import Optional, Tuple
from urllib.parse import quote_plus

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
)


class AthenaConfig(SQLConnectionConfig):
    scheme: str = "awsathena+rest"
    username: Optional[str] = None
    password: Optional[str] = None
    database: Optional[str] = None
    aws_region: str
    s3_staging_dir: str
    work_group: str
    service_type = "BigQuery"

    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username:
            url += f"{quote_plus(self.username)}"
            if self.password:
                url += f":{quote_plus(self.password)}"
        else:
            url += ":"
        url += f"@athena.{self.aws_region}.amazonaws.com:443/"
        if self.database:
            url += f"{self.database}"
        url += f"?s3_staging_dir={quote_plus(self.s3_staging_dir)}"
        url += f"&work_group={self.work_group}"

        return url


class AthenaSQLExpressions(SQLExpressions):
    avg_expr = "AVG(CAST({} as DECIMAL(38, 0)))"
    sum_expr = "SUM(CAST ({} as DECIMAL(38, 0)))"

    def literal_date(self, tdate: date):
        date_string = tdate.strftime("%Y-%m-%d")
        return f"DATE('{date_string}')"


class Athena(DatabaseCommon):
    config: AthenaConfig = None
    sql_exprs: AthenaSQLExpressions = AthenaSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = AthenaConfig.parse_obj(config_dict)
        return cls(config)

    def qualify_table_name(self, table_name: str) -> str:
        return f"`{self.config.database}.{table_name}`"
