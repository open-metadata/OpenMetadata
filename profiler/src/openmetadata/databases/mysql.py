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
