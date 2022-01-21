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

from metadata.ingestion.source.snowflake import SnowflakeConfig
from metadata.profiler.common.database_common import (
    DatabaseCommon,
    SQLExpressions,
    register_custom_type,
)
from metadata.profiler.profiler_metadata import SupportedDataType

register_custom_type(
    ["VARCHAR", "CHAR", "CHARACTER", "STRING", "TEXT"],
    SupportedDataType.TEXT,
)

register_custom_type(
    [
        "NUMBER",
        "INT",
        "INTEGER",
        "BIGINT",
        "SMALLINT",
        "TINYINT",
        "BYTEINT",
        "FLOAT",
        "FLOAT4",
        "FLOAT8",
        "DOUBLE",
        "DOUBLE PRECISION",
        "REAL",
    ],
    SupportedDataType.NUMERIC,
)

register_custom_type(
    [
        "DATE",
        "DATETIME",
        "TIME",
        "TIMESTAMP",
        "TIMESTAMP_LTZ",
        "TIMESTAMP_NTZ",
        "TIMESTAMP_TZ",
    ],
    SupportedDataType.TIME,
)


class SnowflakeSQLExpressions(SQLExpressions):
    count_conditional_expr = "COUNT(CASE WHEN {} THEN 1 END) AS _"
    regex_like_pattern_expr = "{} regexp '{}'"


class Snowflake(DatabaseCommon):
    config: SnowflakeConfig = None
    sql_exprs: SnowflakeSQLExpressions = SnowflakeSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = SnowflakeConfig.parse_obj(config_dict)
        return cls(config)
