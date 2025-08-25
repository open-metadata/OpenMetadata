#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Example implementation of parallel data quality checks for PostgreSQL tables.
This shows how to create concrete adapters for a specific use case.
"""
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from ingestion.parallel.om_adapters import (
    ProcessedRecord,
    ProcessorAdapter,
    Record,
    ShardDescriptor,
    SinkAdapter,
    SourceAdapter,
)
from metadata.generated.schema.api.data.createDataQualityTestCase import (
    CreateDataQualityTestCaseRequest,
)
from metadata.generated.schema.tests.testCase import TestCaseResult, TestCaseStatus
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class PostgresTableSourceAdapter(SourceAdapter):
    """
    Source adapter that discovers PostgreSQL tables and yields records for quality checks.
    Each shard represents a table to be checked.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.connection_config = config.get("connection", {})
        self.schema_filter = config.get("schema_filter", ["public"])
        self.table_filter = config.get("table_filter", [])

    def discover_shards(self) -> List[ShardDescriptor]:
        """Discover all tables to process as shards"""
        conn = psycopg2.connect(
            host=self.connection_config["host"],
            port=self.connection_config.get("port", 5432),
            database=self.connection_config["database"],
            user=self.connection_config["username"],
            password=self.connection_config["password"],
        )

        shards = []
        try:
            with conn.cursor() as cur:
                # Get all tables from specified schemas
                schema_list = ",".join([f"'{s}'" for s in self.schema_filter])
                query = f"""
                    SELECT table_schema, table_name 
                    FROM information_schema.tables 
                    WHERE table_schema IN ({schema_list}) 
                    AND table_type = 'BASE TABLE'
                    ORDER BY table_schema, table_name
                """
                cur.execute(query)

                for row in cur.fetchall():
                    schema, table = row
                    # Apply table filter if specified
                    if self.table_filter and table not in self.table_filter:
                        continue

                    shards.append(
                        ShardDescriptor(
                            type="table",
                            id=f"{schema}.{table}",
                            metadata={
                                "schema": schema,
                                "table": table,
                                "database": self.connection_config["database"],
                            },
                        )
                    )
        finally:
            conn.close()

        return shards

    def iter_records(self, shard: ShardDescriptor) -> Iterable[Record]:
        """
        For data quality, we yield one record per table with metadata.
        In a real implementation, this could yield individual rows for row-level checks.
        """
        schema = shard.metadata["schema"]
        table = shard.metadata["table"]

        conn = psycopg2.connect(
            host=self.connection_config["host"],
            port=self.connection_config.get("port", 5432),
            database=self.connection_config["database"],
            user=self.connection_config["username"],
            password=self.connection_config["password"],
        )

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get table statistics
                stats_query = f"""
                    SELECT 
                        COUNT(*) as row_count,
                        pg_total_relation_size('{schema}.{table}'::regclass) as table_size,
                        COUNT(DISTINCT {col}) as distinct_count_{col}
                    FROM {schema}.{table}
                    CROSS JOIN LATERAL (
                        SELECT column_name as col
                        FROM information_schema.columns
                        WHERE table_schema = '{schema}' 
                        AND table_name = '{table}'
                        LIMIT 1
                    ) cols
                """

                # Simplified - just get row count
                cur.execute(f"SELECT COUNT(*) as row_count FROM {schema}.{table}")
                stats = cur.fetchone()

                # Get column information
                cur.execute(
                    f"""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_schema = '{schema}' AND table_name = '{table}'
                    ORDER BY ordinal_position
                """
                )
                columns = cur.fetchall()

                # Yield a record for this table
                yield Record(
                    record_id=self.generate_record_id(
                        shard, {"table": f"{schema}.{table}"}
                    ),
                    data={
                        "database": self.connection_config["database"],
                        "schema": schema,
                        "table": table,
                        "row_count": stats["row_count"],
                        "columns": columns,
                        "check_timestamp": datetime.utcnow().isoformat(),
                    },
                    metadata={"shard_id": shard.id, "type": "table_metadata"},
                )
        finally:
            conn.close()


class DataQualityProcessor(ProcessorAdapter):
    """
    Processor that runs data quality checks on table metadata.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        self.checks = config.get("checks", ["row_count", "null_check"])
        self.thresholds = config.get(
            "thresholds", {"min_row_count": 0, "max_null_percentage": 10.0}
        )

    def process(self, record: Record) -> ProcessedRecord:
        """Run quality checks and return results"""
        results = []
        data = record.data

        # Row count check
        if "row_count" in self.checks:
            row_count = data["row_count"]
            passed = row_count >= self.thresholds["min_row_count"]
            results.append(
                {
                    "test_name": "row_count_check",
                    "status": "PASSED" if passed else "FAILED",
                    "value": row_count,
                    "threshold": self.thresholds["min_row_count"],
                    "message": f"Table has {row_count} rows",
                }
            )

        # Null check (simplified - would need actual null counts)
        if "null_check" in self.checks:
            # This is a placeholder - real implementation would check actual nulls
            results.append(
                {
                    "test_name": "null_check",
                    "status": "PASSED",
                    "message": "Null check placeholder",
                }
            )

        # Column count check
        column_count = len(data["columns"])
        results.append(
            {
                "test_name": "column_count",
                "status": "PASSED" if column_count > 0 else "FAILED",
                "value": column_count,
                "message": f"Table has {column_count} columns",
            }
        )

        return ProcessedRecord(
            record_id=record.record_id,
            data={
                "table_fqn": f"{data['database']}.{data['schema']}.{data['table']}",
                "test_results": results,
                "summary": {
                    "total_tests": len(results),
                    "passed": sum(1 for r in results if r["status"] == "PASSED"),
                    "failed": sum(1 for r in results if r["status"] == "FAILED"),
                },
                "execution_time": datetime.utcnow().isoformat(),
            },
            metadata=record.metadata,
        )


class OpenMetadataQualitySink(SinkAdapter):
    """
    Sink adapter that writes data quality results to OpenMetadata.
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        super().__init__(config)
        # Initialize OpenMetadata client
        self.metadata = OpenMetadata(
            config={
                "hostPort": self.metadata_server,
                "authProvider": "openmetadata",
                "securityConfig": {"jwtToken": self.api_key},
            }
        )

    def write(self, processed: ProcessedRecord, idempotency_key: str) -> bool:
        """Write test results to OpenMetadata"""
        try:
            table_fqn = processed.data["table_fqn"]

            # Create test cases for each result
            for test_result in processed.data["test_results"]:
                test_case_request = CreateDataQualityTestCaseRequest(
                    name=f"{table_fqn}.{test_result['test_name']}",
                    description=test_result.get("message", ""),
                    entityLink=f"<#E::table::{table_fqn}>",
                    testSuite=f"{table_fqn}.quality_suite",
                    testDefinition=test_result["test_name"],
                    parameterValues=[
                        {
                            "name": "threshold",
                            "value": str(test_result.get("threshold", "")),
                        }
                    ]
                    if "threshold" in test_result
                    else [],
                )

                # Create or update test case
                test_case = self.metadata.create_or_update_data_quality_test_case(
                    test_case_request
                )

                # Add test result
                test_result_data = TestCaseResult(
                    timestamp=int(datetime.utcnow().timestamp() * 1000),
                    testCaseStatus=TestCaseStatus.Success
                    if test_result["status"] == "PASSED"
                    else TestCaseStatus.Failed,
                    testResultValue=[
                        {"name": "value", "value": str(test_result.get("value", ""))}
                    ]
                    if "value" in test_result
                    else [],
                )

                self.metadata.add_test_case_result(
                    test_case_fqn=test_case.fullyQualifiedName,
                    test_case_result=test_result_data,
                )

            return True

        except Exception as e:
            logger.error(f"Failed to write to OpenMetadata: {e}")
            return False


# Example workflow configuration
EXAMPLE_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.examples.postgres_quality_check.PostgresTableSourceAdapter",
        "config": {
            "connection": {
                "host": "postgres.example.com",
                "port": 5432,
                "database": "production",
                "username": "readonly_user",
                "password": "secure_password",
            },
            "schema_filter": ["public", "analytics"],
            "table_filter": [],  # Empty means all tables
        },
    },
    "processor_class": "ingestion.parallel.examples.postgres_quality_check.DataQualityProcessor",
    "processor_config": {
        "checks": ["row_count", "null_check", "column_count"],
        "thresholds": {"min_row_count": 100, "max_null_percentage": 5.0},
    },
    "sink_class": "ingestion.parallel.examples.postgres_quality_check.OpenMetadataQualitySink",
    "sink_config": {},
}


if __name__ == "__main__":
    # Example of how to test locally
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "discover":
        # Test shard discovery
        source = PostgresTableSourceAdapter(
            EXAMPLE_WORKFLOW_CONFIG["source_config"]["config"]
        )
        shards = source.discover_shards()
        print(f"Discovered {len(shards)} shards:")
        for shard in shards[:5]:  # Show first 5
            print(f"  - {shard.id}")
    else:
        print("Usage: python postgres_quality_check.py discover")
