#!/usr/bin/env python3
"""
Example demonstrating how to properly update protected fields across various OpenMetadata entities.

This example shows the difference between create_or_update() and patch methods for updating
entity fields that are protected by server-side business rules. The create_or_update() method
may not override certain existing fields across various entity types for data integrity reasons.

Examples include:
- Glossary term descriptions
- Database descriptions  
- Table descriptions
- Other protected metadata fields
"""

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    Markdown,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def demonstrate_glossary_term_updates(metadata: OpenMetadata):
    """
    Example showing proper methods for updating glossary term descriptions.
    """
    print("=== Glossary Term Example ===")
    
    # Create a glossary first
    glossary_request = CreateGlossaryRequest(
        name=EntityName("example-glossary"),
        displayName="Example Glossary",
        description=Markdown("Example glossary for demonstration"),
    )

    try:
        # Create or get existing glossary
        glossary = metadata.create_or_update(glossary_request)
        print(f"Created/Updated glossary: {glossary.name}")

        # Create a glossary term with initial description
        term_request = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("customer-data"),
            displayName="Customer Data",
            description=Markdown("Initial description: Data related to customers"),
        )

        # This will work for new terms
        term = metadata.create_or_update(term_request)
        print(f"Created term: {term.name} with description: {term.description}")

        # Method 1: Using patch_description with force=True (RECOMMENDED)
        print("\nMethod 1: Using patch_description(force=True)")
        updated_term = metadata.patch_description(
            entity=GlossaryTerm,
            source=term,
            description="Updated description: Comprehensive customer information and related data",
            force=True  # Key parameter for overriding existing descriptions
        )
        if updated_term:
            print(f"✅ Successfully updated description to: {updated_term.description}")
        else:
            print("❌ Failed to update description using patch_description")

        # Method 2: Using patch with override_metadata=True (ALTERNATIVE)
        print("\nMethod 2: Using patch(override_metadata=True)")
        current_term = metadata.get_by_name(
            entity=GlossaryTerm, fqn=term.fullyQualifiedName
        )
        if current_term:
            # Create a copy with the updated description
            updated_term_data = current_term.model_copy(deep=True)
            updated_term_data.description = Markdown(
                "Final description: All customer-related data and metadata"
            )

            patched_term = metadata.patch(
                entity=GlossaryTerm,
                source=current_term,
                destination=updated_term_data,
                override_metadata=True  # Allows overriding protected fields
            )
            if patched_term:
                print(f"✅ Successfully patched description to: {patched_term.description}")
            else:
                print("❌ Failed to update description using patch")

    except Exception as e:
        print(f"❌ Error in glossary example: {e}")


def demonstrate_database_updates(metadata: OpenMetadata):
    """
    Example showing updates for database descriptions (another common protected field).
    """
    print("\n=== Database Example ===")
    
    try:
        # Assume we have a database service already created
        # Create a database with initial description
        db_request = CreateDatabaseRequest(
            name=EntityName("example_database"),
            description="Initial database description",
            service=FullyQualifiedEntityName("your-service-name")  # Replace with actual service
        )
        
        # Note: This example assumes you have a service created
        # database = metadata.create_or_update(db_request)
        # print(f"Database created: {database.name}")
        
        print("Database example requires existing service - see glossary example for complete flow")
        
    except Exception as e:
        print(f"Database example: {e}")


def main():
    """
    Main function demonstrating proper methods for updating protected entity fields.
    """
    # Initialize OpenMetadata connection (adjust configuration as needed)
    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="your_jwt_token_here"),
    )
    metadata = OpenMetadata(server_config)

    print("OpenMetadata Entity Field Update Examples")
    print("=" * 50)
    print("This example demonstrates the correct approach for updating")
    print("protected fields across various OpenMetadata entities.\n")

    print("Key Points:")
    print("- create_or_update() may not override existing protected fields")  
    print("- Use patch_description(force=True) for description updates")
    print("- Use patch(override_metadata=True) for general metadata updates")
    print("- These patterns work across various entity types\n")

    # Demonstrate with glossary terms (most common case)
    demonstrate_glossary_term_updates(metadata)
    
    # Show that the same principles apply to other entities
    demonstrate_database_updates(metadata)

    print("\n" + "=" * 50)
    print("Summary:")
    print("- ✅ Use patch methods with appropriate parameters for protected fields")
    print("- ✅ These patterns apply to glossary terms, databases, tables, and other entities")  
    print("- ✅ Always handle exceptions appropriately in production code")
    print("- ❌ Don't rely on create_or_update() to override protected existing fields")


if __name__ == "__main__":
    main()
