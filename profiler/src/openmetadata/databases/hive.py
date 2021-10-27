import json
from typing import Optional

from pyhive import hive  # noqa: F401
from pyhive.sqlalchemy_hive import HiveDate, HiveDecimal, HiveTimestamp

from openmetadata.common.database_common import (
    DatabaseCommon,
    SQLConnectionConfig,
    SQLExpressions,
    register_custom_type,
)
from openmetadata.profiler.profiler_metadata import SupportedDataType

register_custom_type([HiveDate, HiveTimestamp], SupportedDataType.TIME)
register_custom_type([HiveDecimal], SupportedDataType.NUMERIC)


class HiveConfig(SQLConnectionConfig):
    scheme = "hive"
    auth_options: Optional[str] = None
    service_type = "Hive"

    def get_connection_url(self):
        url = super().get_connection_url()
        if self.auth_options is not None:
            return f"{url};{self.auth_options}"
        else:
            return url


class HiveSQLExpressions(SQLExpressions):
    stddev_expr = "STDDEV_POP({})"
    regex_like_pattern_expr = "cast({} as string) rlike '{}'"


class Hive(DatabaseCommon):
    config: HiveConfig = None
    sql_exprs: HiveSQLExpressions = HiveSQLExpressions()

    def __init__(self, config):
        super().__init__(config)
        self.config = config

    @classmethod
    def create(cls, config_dict):
        config = HiveConfig.parse_obj(config_dict)
        return cls(config)
