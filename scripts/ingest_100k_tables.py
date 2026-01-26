#!/usr/bin/env python3
"""
Script to ingest 100k tables into OpenMetadata for testing distributed indexing.
"""

import argparse
import concurrent.futures
import sys
import time
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import (
    CreateDatabaseServiceRequest,
)
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
    BasicAuth,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)


def create_metadata_client(server_url: str, token: str) -> OpenMetadata:
    """Create OpenMetadata client."""
    server_config = OpenMetadataConnection(
        hostPort=server_url,
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=token),
    )
    return OpenMetadata(server_config)


def create_service(metadata: OpenMetadata, service_name: str) -> DatabaseService:
    """Create or get database service."""
    # Check if service exists
    existing = metadata.get_by_name(entity=DatabaseService, fqn=service_name)
    if existing:
        print(f"Using existing service: {service_name}")
        return existing

    # Create new service
    service = CreateDatabaseServiceRequest(
        name=service_name,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="test",
                authType=BasicAuth(password="test"),
                hostPort="localhost:3306",
            )
        ),
    )
    created = metadata.create_or_update(service)
    print(f"Created service: {service_name}")
    return created


def create_database(metadata: OpenMetadata, service_fqn: str, db_name: str):
    """Create or get database."""
    fqn = f"{service_fqn}.{db_name}"
    from metadata.generated.schema.entity.data.database import Database

    existing = metadata.get_by_name(entity=Database, fqn=fqn)
    if existing:
        print(f"Using existing database: {fqn}")
        return existing

    db = CreateDatabaseRequest(name=db_name, service=service_fqn)
    created = metadata.create_or_update(db)
    print(f"Created database: {fqn}")
    return created


def create_schema(metadata: OpenMetadata, database_fqn: str, schema_name: str):
    """Create or get schema."""
    fqn = f"{database_fqn}.{schema_name}"
    from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema

    existing = metadata.get_by_name(entity=DatabaseSchema, fqn=fqn)
    if existing:
        print(f"Using existing schema: {fqn}")
        return existing

    schema = CreateDatabaseSchemaRequest(name=schema_name, database=database_fqn)
    created = metadata.create_or_update(schema)
    print(f"Created schema: {fqn}")
    return created


def create_tables_batch(
    metadata: OpenMetadata, schema_fqn: str, start_idx: int, count: int
) -> int:
    """Create a batch of tables."""
    created_count = 0
    columns = [
        Column(name="id", dataType=DataType.BIGINT, description="Primary key"),
        Column(name="name", dataType=DataType.VARCHAR, dataLength=255),
        Column(name="description", dataType=DataType.TEXT),
        Column(name="created_at", dataType=DataType.TIMESTAMP),
        Column(name="updated_at", dataType=DataType.TIMESTAMP),
        Column(name="status", dataType=DataType.VARCHAR, dataLength=50),
        Column(name="metadata", dataType=DataType.JSON),
    ]

    for i in range(start_idx, start_idx + count):
        table_name = f"test_table_{i:06d}"
        try:
            table = CreateTableRequest(
                name=table_name,
                databaseSchema=schema_fqn,
                columns=columns,
                description=f"Test table {i} for distributed indexing benchmark",
            )
            metadata.create_or_update(table)
            created_count += 1
        except Exception as e:
            print(f"Error creating table {table_name}: {e}")

    return created_count


def ingest_tables(
    server_url: str,
    token: str,
    total_tables: int = 100000,
    batch_size: int = 100,
    workers: int = 10,
):
    """Ingest tables into OpenMetadata."""
    print(f"Starting ingestion of {total_tables} tables...", flush=True)
    print(f"Server: {server_url}", flush=True)
    print(f"Batch size: {batch_size}, Workers: {workers}", flush=True)
    print("-" * 60, flush=True)

    # Create main client for setup
    print("Creating metadata client...", flush=True)
    metadata = create_metadata_client(server_url, token)
    print("Client created!", flush=True)

    # Create service, database, and schema
    service_name = "scale_test_service"
    db_name = "scale_test_db"
    schema_name = "scale_test_schema"

    service = create_service(metadata, service_name)
    database = create_database(metadata, service_name, db_name)
    schema = create_schema(metadata, f"{service_name}.{db_name}", schema_name)
    schema_fqn = f"{service_name}.{db_name}.{schema_name}"

    print("-" * 60)
    print(f"Creating {total_tables} tables in {schema_fqn}")
    print("-" * 60)

    start_time = time.time()
    total_created = 0

    # Create batches
    batches = []
    for start_idx in range(0, total_tables, batch_size):
        count = min(batch_size, total_tables - start_idx)
        batches.append((start_idx, count))

    # Process batches with thread pool
    def process_batch(batch_info):
        start_idx, count = batch_info
        # Each worker needs its own client
        worker_metadata = create_metadata_client(server_url, token)
        return create_tables_batch(worker_metadata, schema_fqn, start_idx, count)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_batch, batch): batch for batch in batches}

        completed = 0
        for future in concurrent.futures.as_completed(futures):
            batch = futures[future]
            try:
                created = future.result()
                total_created += created
                completed += 1

                # Progress update every 10 batches
                if completed % 10 == 0:
                    elapsed = time.time() - start_time
                    rate = total_created / elapsed if elapsed > 0 else 0
                    print(
                        f"Progress: {total_created}/{total_tables} tables "
                        f"({100*total_created/total_tables:.1f}%) - "
                        f"{rate:.1f} tables/sec"
                    )
            except Exception as e:
                print(f"Batch {batch} failed: {e}")

    elapsed = time.time() - start_time
    rate = total_created / elapsed if elapsed > 0 else 0

    print("-" * 60)
    print(f"Ingestion complete!")
    print(f"Total tables created: {total_created}")
    print(f"Time elapsed: {elapsed:.1f} seconds")
    print(f"Average rate: {rate:.1f} tables/sec")
    print("-" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Ingest tables into OpenMetadata for scale testing"
    )
    parser.add_argument(
        "--server",
        default="http://localhost:8585/api",
        help="OpenMetadata server URL",
    )
    parser.add_argument(
        "--token",
        required=True,
        help="JWT token for authentication",
    )
    parser.add_argument(
        "--tables",
        type=int,
        default=100000,
        help="Number of tables to create (default: 100000)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for table creation (default: 100)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=10,
        help="Number of parallel workers (default: 10)",
    )

    args = parser.parse_args()

    ingest_tables(
        server_url=args.server,
        token=args.token,
        total_tables=args.tables,
        batch_size=args.batch_size,
        workers=args.workers,
    )


if __name__ == "__main__":
    main()
