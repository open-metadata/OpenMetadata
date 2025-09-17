"""
Examples showing how to update tables and other data assets using the Python SDK
"""
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.sdk.client import OpenMetadata
from metadata.sdk.config import OpenMetadataConfig
from metadata.sdk.entities.database import Database
from metadata.sdk.entities.table import Table


def main():
    """Demonstrate different update approaches for data assets"""

    # Initialize client
    config = OpenMetadataConfig(
        server_url="http://localhost:8585",
        jwt_token="<your-jwt-token>",
        verify_ssl=False,
    )
    client = OpenMetadata(config)

    # Set default client for all entities
    Table.set_default_client(client)
    Database.set_default_client(client)

    # ========== APPROACH 1: Full Update (PUT) ==========
    # This replaces the entire entity

    # First retrieve the table
    table = Table.retrieve_by_name("service.database.schema.my_table")

    # Modify the table object
    table.description = "Updated description for the table"
    table.displayName = "My Updated Table"

    # Update the entire table (PUT operation)
    updated_table = Table.update(entity_id=table.id, entity=table)
    print(f"Updated table via PUT: {updated_table.fullyQualifiedName}")

    # ========== APPROACH 2: Partial Update (PATCH) ==========
    # This only updates specific fields using JSON Patch

    # Update only the description using JSON Patch
    json_patch = [
        {"op": "replace", "path": "/description", "value": "New description via PATCH"},
        {
            "op": "add",
            "path": "/tags/-",  # Append to tags array
            "value": {
                "tagFQN": "PII.Sensitive",
                "source": "Classification",
                "labelType": "Manual",
            },
        },
    ]

    patched_table = Table.patch(entity_id=table.id, json_patch=json_patch)
    print(f"Patched table: {patched_table.fullyQualifiedName}")

    # ========== APPROACH 3: Update Specific Fields ==========
    # Common update scenarios

    # 3a. Update table columns
    table = Table.retrieve_by_name("service.database.schema.my_table")

    # Modify a specific column's description
    for column in table.columns:
        if column.name == "customer_id":
            column.description = "Unique identifier for customers"
            column.dataType = "BIGINT"

    # Save the changes
    updated_table = Table.update(entity_id=table.id, entity=table)

    # 3b. Add tags to a table
    table = Table.retrieve_by_name("service.database.schema.my_table")

    # Add new tags
    new_tag = TagLabel(
        tagFQN="PersonalData.Personal", source="Classification", labelType="Manual"
    )

    if not table.tags:
        table.tags = []
    table.tags.append(new_tag)

    updated_table = Table.update(entity_id=table.id, entity=table)

    # ========== APPROACH 4: Batch Updates ==========
    # Update multiple tables efficiently

    tables_to_update = [
        "service.database.schema.customers",
        "service.database.schema.orders",
        "service.database.schema.products",
    ]

    for table_fqn in tables_to_update:
        # Use PATCH for efficient partial updates
        json_patch = [
            {
                "op": "add",
                "path": "/tags/-",
                "value": {
                    "tagFQN": "Tier.Tier1",
                    "source": "Classification",
                    "labelType": "Manual",
                },
            },
            {"op": "replace", "path": "/tier", "value": "Tier.Tier1"},
        ]

        try:
            table = Table.retrieve_by_name(table_fqn)
            patched = Table.patch(entity_id=table.id, json_patch=json_patch)
            print(f"Updated tier for {table_fqn}")
        except Exception as e:
            print(f"Failed to update {table_fqn}: {e}")

    # ========== APPROACH 5: Complex Column Updates ==========
    # Update column-level metadata

    table = Table.retrieve_by_name("service.database.schema.my_table")

    # Update column tags via PATCH
    column_index = 0  # First column
    json_patch = [
        {
            "op": "add",
            "path": f"/columns/{column_index}/tags",
            "value": [
                {
                    "tagFQN": "PII.Email",
                    "source": "Classification",
                    "labelType": "Manual",
                }
            ],
        },
        {
            "op": "replace",
            "path": f"/columns/{column_index}/description",
            "value": "Customer email address (PII)",
        },
    ]

    patched_table = Table.patch(entity_id=table.id, json_patch=json_patch)
    print(f"Updated column metadata for {patched_table.columns[column_index].name}")

    # ========== Best Practices ==========
    print(
        """
    Best Practices for Updates:

    1. Use PATCH for partial updates:
       - More efficient than PUT
       - Less risk of overwriting other changes
       - Better for concurrent updates

    2. Use PUT for complete replacements:
       - When you need to ensure exact state
       - When removing multiple fields at once
       - When doing major restructuring

    3. Always retrieve latest version before updating:
       - Prevents overwriting concurrent changes
       - Ensures you have current state

    4. Handle conflicts gracefully:
       - Implement retry logic for concurrent updates
       - Use version/timestamp checks if available

    5. Batch updates when possible:
       - Reduces API calls
       - Better performance
       - Use list_all() then update in batches
    """
    )


if __name__ == "__main__":
    main()
