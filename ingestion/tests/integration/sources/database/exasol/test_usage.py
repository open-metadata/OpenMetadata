from sqlalchemy import text

from ingestion.tests.integration.sources.database.exasol.base import (
    DB_PORT,
    SCHEMA_NAME,
    TABLE_NAME,
    VIEW_NAME,
    ExasolTestBase,
    wait_for_system_table,
)
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection,
    Tls,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseMetadataConfigType,
)
from metadata.generated.schema.metadataIngestion.databaseServiceQueryUsagePipeline import (
    DatabaseUsageConfigType,
)
from metadata.ingestion.source.database.exasol.queries import EXASOL_SQL_STATEMENT
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.usage import UsageWorkflow


class TestExasolUsage(ExasolTestBase):
    def test_usage_workflow_publishes_stage_data(self, metadata, tmp_path):
        exasol_connection = ExasolConnection(
            username="sys",
            password="exasol",
            hostPort=f"localhost:{DB_PORT}",
            tls=Tls.ignore_certificate,
        )
        workflow_connection = DatabaseConnection(config=exasol_connection).model_dump()
        service_request = CreateDatabaseServiceRequest(
            name=f"docker_test_exasol_{id(self)}",
            serviceType=DatabaseServiceType.Exasol,
            connection=DatabaseConnection(config=exasol_connection),
        )

        service = metadata.create_or_update(data=service_request)
        try:
            metadata_config = {
                "source": {
                    "type": "exasol",
                    "serviceName": service.fullyQualifiedName.root,
                    "serviceConnection": workflow_connection,
                    "sourceConfig": {
                        "config": {
                            "type": DatabaseMetadataConfigType.DatabaseMetadata.value,
                            "includeTables": True,
                            "includeViews": True,
                            "includeDDL": True,
                            "markDeletedTables": True,
                        }
                    },
                },
                "sink": {"type": "metadata-rest", "config": {}},
                "workflowConfig": {
                    "loggerLevel": "DEBUG",
                    "openMetadataServerConfig": metadata.config.model_dump(),
                },
            }

            metadata_workflow = MetadataWorkflow.create(metadata_config)
            metadata_workflow.execute()
            metadata_workflow.raise_from_status()

            with self.engine.begin() as connection:
                connection.execute(
                    text(
                        f"""
                        INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (
                            col_boolean,
                            col_decimal,
                            col_date,
                            col_timestamp,
                            col_timestamp_local,
                            col_char,
                            col_varchar
                        ) VALUES
                        (TRUE, 1.5, '2023-07-13', '2023-07-13 06:04:45', '2023-07-13 04:04:45', 'x', 'y')
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        SELECT
                            col_boolean,
                            col_decimal,
                            col_date,
                            col_timestamp,
                            col_timestamp_local,
                            col_char,
                            col_varchar
                        FROM {SCHEMA_NAME}.{TABLE_NAME}
                        LIMIT 1
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        INSERT INTO {SCHEMA_NAME}.{TABLE_NAME} (
                            col_boolean,
                            col_decimal,
                            col_date,
                            col_timestamp,
                            col_timestamp_local,
                            col_char,
                            col_varchar
                        ) VALUES
                        (TRUE, 2.5, '2023-07-14', '2023-07-14 06:04:45', '2023-07-14 04:04:45', 'z', 'w')
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        CREATE OR REPLACE VIEW {SCHEMA_NAME}.{VIEW_NAME} AS
                        SELECT
                            col_boolean,
                            col_decimal,
                            col_date,
                            col_timestamp,
                            col_timestamp_local,
                            col_char,
                            col_varchar
                        FROM {SCHEMA_NAME}.{TABLE_NAME}
                        """
                    )
                )
                connection.execute(
                    text(
                        f"""
                        SELECT
                            col_boolean,
                            col_decimal,
                            col_date,
                            col_timestamp,
                            col_timestamp_local,
                            col_char,
                            col_varchar
                        FROM {SCHEMA_NAME}.{VIEW_NAME}
                        LIMIT 1
                        """
                    )
                )

            wait_for_system_table(
                self.engine,
                EXASOL_SQL_STATEMENT.format(
                    start_time="2000-01-01 00:00:00",
                    end_time="2999-01-01 00:00:00",
                    filters="",
                    result_limit=10,
                ),
                expected_count=3,
                timeout_seconds=120,
            )

            usage_config = {
                "source": {
                    "type": "exasol-usage",
                    "serviceName": service.fullyQualifiedName.root,
                    "serviceConnection": workflow_connection,
                    "sourceConfig": {
                        "config": {
                            "type": DatabaseUsageConfigType.DatabaseUsage.value,
                            "queryLogDuration": 1,
                            "resultLimit": 10000,
                        }
                    },
                },
                "processor": {"type": "query-parser", "config": {}},
                "stage": {
                    "type": "table-usage",
                    "config": {"filename": str(tmp_path / "exasol_usage")},
                },
                "bulkSink": {
                    "type": "metadata-usage",
                    "config": {"filename": str(tmp_path / "exasol_usage")},
                },
                "workflowConfig": {
                    "loggerLevel": "DEBUG",
                    "openMetadataServerConfig": metadata.config.model_dump(),
                },
            }

            usage_workflow = UsageWorkflow.create(usage_config)
            usage_workflow.execute()
            usage_workflow.raise_from_status()

            table_usage = usage_workflow.steps[1].table_usage
            table_queries = usage_workflow.steps[1].table_queries

            assert table_usage
            assert table_queries

            usage_counts = {table: value.count for (table, _), value in table_usage.items()}
            assert any(TABLE_NAME.lower() in table.lower() for table in usage_counts)
            assert sum(usage_counts.values()) >= 3

            recorded_queries = [
                query for queries in table_queries.values() for query in queries if query.query and query.query.root
            ]
            assert any(
                query.query.root.upper().startswith("SELECT") and TABLE_NAME.lower() in query.query.root.lower()
                for query in recorded_queries
            )
            assert any(
                query.query.root.upper().startswith("SELECT") and VIEW_NAME.lower() in query.query.root.lower()
                for query in recorded_queries
            )
        finally:
            metadata.delete(
                entity=DatabaseService,
                entity_id=service.id,
                recursive=True,
                hard_delete=True,
            )
