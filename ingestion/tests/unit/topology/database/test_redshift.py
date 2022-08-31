from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.database.redshift import RedshiftSource

mock_snowflake_config = {
    "source": {
        "type": "redshift",
        "serviceName": "local_redshift",
        "serviceConnection": {
            "config": {
                "type": "Redshift",
                "username": "username",
                "password": "password",
                "database": "database",
                "hostPort": "cluster.name.region.redshift.amazonaws.com:5439",
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


RAW_DIST_STYLE = ["KEY(eventid)", "EVEN", "ALL"]

EXPECTED_PARTITION_COLUMNS = [["eventid"], None, None]


class SnowflakeUnitTest(TestCase):
    @patch("metadata.ingestion.source.database.common_db_source.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_snowflake_config)
        self.redshift_source = RedshiftSource.create(
            mock_snowflake_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    def test_partition_parse_columns(self):
        for i in range(len(RAW_DIST_STYLE)):
            assert (
                self.redshift_source._get_partition_key(RAW_DIST_STYLE[i])
                == EXPECTED_PARTITION_COLUMNS[i]
            )
