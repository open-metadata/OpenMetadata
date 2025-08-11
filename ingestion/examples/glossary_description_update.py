#!/usr/bin/env python3
"""
Example demonstrating how to properly update glossary term descriptions using OpenMetadata Python SDK.

This example shows the difference between create_or_update() and patch methods for updating
glossary term descriptions, addressing the common issue where create_or_update() doesn't
override existing descriptions due to server-side business rules.
"""

from metadata.generated.schema.api.data.createGlossary import CreateGlossaryRequest
from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.generated.schema.entity.data.glossary import Glossary
from metadata.generated.schema.entity.data.glossaryTerm import GlossaryTerm
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


def main():
    """
    Example showing proper methods for updating glossary term descriptions.
    """
    # Initialize OpenMetadata connection (adjust configuration as needed)
    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(jwtToken="your_jwt_token_here"),
    )
    metadata = OpenMetadata(server_config)

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

        # Now try to update the description - this may not work with create_or_update
        print("\n--- Attempting to update description ---")

        # Method 1: Using patch_description with force=True (RECOMMENDED)
        print("Method 1: Using patch_description(force=True)")
        updated_term = metadata.patch_description(
            entity=GlossaryTerm,
            source=term,
            description="Updated description: Comprehensive data about our customers including demographics and preferences",
            force=True,  # This is key for overriding existing descriptions
        )

        if updated_term:
            print(f"✅ Successfully updated description: {updated_term.description}")
        else:
            print("❌ Failed to update description")

        # Method 2: Using patch with override_metadata=True (ALTERNATIVE)
        print("\nMethod 2: Using patch(override_metadata=True)")
        from copy import deepcopy

        # Get fresh copy of the term
        current_term = metadata.get_by_name(
            entity=GlossaryTerm, fqn=term.fullyQualifiedName
        )

        # Create destination with new description
        destination_term = deepcopy(current_term)
        destination_term.description = Markdown(
            "Final description: Complete customer information dataset"
        )

        final_term = metadata.patch(
            entity=GlossaryTerm,
            source=current_term,
            destination=destination_term,
            override_metadata=True,  # This allows overriding protected fields
        )

        if final_term:
            print(f"✅ Successfully updated description: {final_term.description}")
        else:
            print("❌ Failed to update description")

        # Method 3: create_or_update (MAY NOT WORK for existing descriptions)
        print(
            "\nMethod 3: Using create_or_update (may not override existing descriptions)"
        )
        term_request_updated = CreateGlossaryTermRequest(
            glossary=FullyQualifiedEntityName(glossary.name.root),
            name=EntityName("customer-data"),
            displayName="Customer Data",
            description=Markdown(
                "This description may not override the existing one due to server-side rules"
            ),
        )

        result_term = metadata.create_or_update(term_request_updated)
        print(f"Result description: {result_term.description}")
        print(
            "Note: If the description didn't change, this confirms the server-side protection."
        )

    except Exception as e:
        print(f"Error: {e}")
        print("Make sure OpenMetadata server is running and credentials are correct")


if __name__ == "__main__":
    print("Glossary Term Description Update Example")
    print("=" * 50)
    print()
    print(
        "This example demonstrates three methods for updating glossary term descriptions:"
    )
    print("1. patch_description(force=True) - RECOMMENDED for description updates")
    print("2. patch(override_metadata=True) - Alternative for general metadata updates")
    print(
        "3. create_or_update() - May not work for existing descriptions due to server rules"
    )
    print()

    # Uncomment the next line to run the example
    # main()

    print("To run this example:")
    print("1. Ensure OpenMetadata server is running")
    print("2. Update the server_config with correct hostPort and JWT token")
    print("3. Uncomment the main() call above")
    print("4. Run: python glossary_description_update.py")
