#!/usr/bin/env python3
"""
Test script to compare bulk API vs sequential table creation performance
"""
import time
from typing import List

from metadata.generated.schema.api.data.bulkCreateTable import BulkCreateTable
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def create_sample_tables(count: int, schema_fqn: str) -> List[CreateTableRequest]:
    """Create sample table requests for testing"""
    tables = []
    for i in range(count):
        columns = [
            Column(
                name=f"id_{i}",
                dataType=DataType.INT,
            ),
            Column(
                name=f"name_{i}",
                dataType=DataType.VARCHAR,
                dataLength=100,
            ),
            Column(
                name=f"created_at_{i}",
                dataType=DataType.TIMESTAMP,
            ),
        ]

        table = CreateTableRequest(
            name=f"test_bulk_table_{i}",
            databaseSchema=schema_fqn,
            columns=columns,
        )
        tables.append(table)

    return tables


def test_sequential_creation(metadata: OpenMetadata, tables: List[CreateTableRequest]):
    """Test sequential table creation (one by one)"""
    print(f"\n=== Testing Sequential Creation ({len(tables)} tables) ===")
    start = time.time()

    success_count = 0
    for table in tables:
        try:
            metadata.create_or_update(data=table)
            success_count += 1
        except Exception as e:
            print(f"Error creating table {table.name}: {e}")

    duration = time.time() - start
    print(f"Sequential: {success_count}/{len(tables)} tables in {duration:.2f}s")
    print(f"Average: {duration/len(tables):.3f}s per table")
    return duration


def test_bulk_creation(metadata: OpenMetadata, tables: List[CreateTableRequest]):
    """Test bulk table creation"""
    print(f"\n=== Testing Bulk Creation ({len(tables)} tables) ===")
    start = time.time()

    bulk_request = BulkCreateTable(
        tables=tables,
        dryRun=False,
    )

    try:
        result = metadata.bulk_create_or_update_tables(bulk_request)
        duration = time.time() - start

        print(f"Bulk API: {result.numberOfRowsPassed}/{result.numberOfRowsProcessed} tables in {duration:.2f}s")
        print(f"Average: {duration/len(tables):.3f}s per table")
        print(f"Status: {result.status}")

        if result.numberOfRowsFailed > 0:
            print(f"\nFailed requests:")
            for failed in result.failedRequest or []:
                print(f"  - {failed.message}")

        return duration
    except Exception as e:
        print(f"Error in bulk creation: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main test function"""
    # Configure OpenMetadata connection
    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api"
    )
    metadata = OpenMetadata(server_config)

    # You'll need to update this with your actual database schema FQN
    schema_fqn = "sample_data.ecommerce_db.shopify"  # Change this to your Redshift schema

    # Test with different batch sizes
    test_sizes = [10, 50, 100]

    for size in test_sizes:
        print(f"\n{'='*60}")
        print(f"Testing with {size} tables")
        print(f"{'='*60}")

        # Create sample tables
        tables = create_sample_tables(size, schema_fqn)

        # Test bulk creation
        bulk_time = test_bulk_creation(metadata, tables)

        # Clean up tables for next test
        print(f"\nCleaning up test tables...")
        for table in tables:
            try:
                entity = metadata.get_by_name(
                    entity=metadata.generated.schema.entity.data.table.Table,
                    fqn=f"{schema_fqn}.{table.name}"
                )
                if entity:
                    metadata.delete(
                        entity=metadata.generated.schema.entity.data.table.Table,
                        entity_id=entity.id,
                        hard_delete=True
                    )
            except:
                pass

        print(f"\n{'='*60}\n")

    print("\nTest completed!")


if __name__ == "__main__":
    main()
