from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.snowflake import SnowflakeSource

mock_snowflake_config = {
    "source": {
        "type": "snowflake",
        "serviceName": "local_snowflake",
        "serviceConnection": {
            "config": {
                "type": "Snowflake",
                "username": "username",
                "password": "password",
                "database": "database",
                "warehouse": "warehouse",
                "account": "account.region_name.cloud_service",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "no-auth",
        }
    },
}


RAW_CLUSTER_KEY_EXPRS = [
    "LINEAR(c1, c2)",
    "LINEAR(to_date(c1), substring(c2, 0, 10))",
    "LINEAR(v:'Data':id::number)",
    "LINEAR(to_date(substring(c2, 0, 10)))",
    "col",
]

EXPECTED_PARTITION_COLUMNS = [
    ["c1", "c2"],
    ["c1", "c2"],
    ["v"],
    ["c2"],
    ["col"],
]


class SnowflakeUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.common_db_source.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_snowflake_config)
        self.snowflake_source = SnowflakeSource.create(
            mock_snowflake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_partition_parse_columns(self):
        for i in range(len(RAW_CLUSTER_KEY_EXPRS)):
            assert (
                self.snowflake_source.parse_column_name_from_expr(
                    RAW_CLUSTER_KEY_EXPRS[i]
                )
                == EXPECTED_PARTITION_COLUMNS[i]
            )
