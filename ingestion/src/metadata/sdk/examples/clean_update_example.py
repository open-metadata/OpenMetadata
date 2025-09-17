"""
Clean SDK usage example - no PUT/PATCH exposed to users
"""
# Import the generated entities (no conflict with SDK classes due to plural naming)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.sdk.client import OpenMetadata
from metadata.sdk.config import OpenMetadataConfig
from metadata.sdk.entities.databases import Databases
from metadata.sdk.entities.glossary_terms import GlossaryTerms
from metadata.sdk.entities.tables import Tables


def main():
    """Demonstrate clean SDK usage without exposing PUT/PATCH details"""

    # Initialize client
    config = OpenMetadataConfig(
        server_url="http://localhost:8585",
        jwt_token="<your-jwt-token>",
        verify_ssl=False,
    )
    client = OpenMetadata(config)

    # Set default client for all entities
    Tables.set_default_client(client)
    Databases.set_default_client(client)
    GlossaryTerms.set_default_client(client)

    # ========== Simple Updates ==========
    # The SDK handles PATCH generation internally

    # Retrieve a table
    table = Tables.retrieve_by_name("prod.database.schema.customers")

    # Modify fields
    table.description = "Customer information table with PII data"
    table.displayName = "Customer Data"

    # Update - SDK automatically uses PATCH internally
    updated_table = Tables.update(table)
    print(f"Updated table: {updated_table.fullyQualifiedName}")

    # ========== Column Updates ==========

    # Get the table
    table = Tables.retrieve_by_name("prod.database.schema.orders")

    # Update column descriptions
    for column in table.columns:
        if column.name == "customer_id":
            column.description = "Foreign key to customers table"
        elif column.name == "order_date":
            column.description = "Date when order was placed"

    # Update - SDK handles the complexity
    updated_table = Tables.update(table)

    # ========== Adding Tags ==========

    # Method 1: Direct tag addition
    Tables.add_tag(table_id=table.id, tag_fqn="PII.Sensitive")

    # Method 2: Through entity update
    table = Tables.retrieve_by_name("prod.database.schema.users")
    if not table.tags:
        table.tags = []

    table.tags.append(
        TagLabel(
            tagFQN="PersonalData.Personal", source="Classification", labelType="Manual"
        )
    )

    updated_table = Tables.update(table)

    # ========== Bulk Operations ==========

    # Update multiple tables efficiently
    tables_to_tier = Tables.list_all(filters={"database": "production"})

    for table in tables_to_tier:
        if "customer" in table.name.lower():
            table.tier = "Tier.Tier1"
            Tables.update(table)

    # ========== Database Updates ==========

    database = Databases.retrieve_by_name("prod.analytics")
    database.description = "Analytics database for reporting"
    database.displayName = "Analytics DB"

    updated_db = Databases.update(database)

    # ========== Creating New Entities ==========

    new_table = CreateTableRequest(
        name="new_metrics",
        displayName="Metrics Table",
        description="Table for tracking business metrics",
        database="prod.analytics.default",
        columns=[
            {
                "name": "metric_id",
                "dataType": "BIGINT",
                "description": "Unique metric identifier",
            },
            {
                "name": "metric_value",
                "dataType": "DOUBLE",
                "description": "Metric value",
            },
        ],
    )

    created_table = Tables.create(new_table)
    print(f"Created table: {created_table.fullyQualifiedName}")

    # ========== Listing with Pagination ==========

    # List with pagination info
    response = Tables.list(limit=10)
    print(f"Found {len(response.entities)} tables")
    print(f"Total available: {response.total}")

    # Process next page if available
    if response.after:
        next_page = Tables.list(limit=10, after=response.after)

    # Get all tables (auto-pagination)
    all_tables = Tables.list_all(fields=["columns", "tags"], batch_size=50)

    # ========== Column-specific Operations ==========

    # Update specific column description
    Tables.update_column_description(
        table_id=table.id,
        column_name="email",
        description="Customer email address (PII - encrypted)",
    )

    # ========== Error Handling ==========

    try:
        table = Tables.retrieve_by_name("non.existent.table")
    except Exception as e:
        print(f"Table not found: {e}")

    # ========== The Clean Approach ==========
    print(
        """
    Key Points of the Clean SDK:

    1. Plural naming (Tables, Databases) avoids conflicts with generated entities
    2. No PUT/PATCH exposed - SDK handles it internally
    3. Simple update pattern: retrieve, modify, update
    4. Specialized methods for common operations (add_tag, update_column_description)
    5. Automatic PATCH generation for efficiency
    6. Clean error handling

    The SDK abstracts all REST API complexity while providing a simple, intuitive interface.
    """
    )


if __name__ == "__main__":
    main()
