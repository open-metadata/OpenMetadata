"""
Examples demonstrating the enhanced Python SDK with improved list operations,
CSV import/export with async and WebSocket support.
"""
import asyncio
import os

from metadata.generated.schema.api.data.createGlossaryTerm import (
    CreateGlossaryTermRequest,
)
from metadata.sdk.client import OpenMetadata
from metadata.sdk.config import OpenMetadataConfig
from metadata.sdk.entities.database import Database
from metadata.sdk.entities.glossary_term import GlossaryTerm
from metadata.sdk.entities.table import Table


async def main():
    """Demonstrate enhanced SDK features"""

    # Initialize client with authentication
    # Option 1: Using configuration object
    config = OpenMetadataConfig(
        server_url="http://localhost:8585",
        jwt_token="<your-jwt-token-here>",  # Bearer token
        verify_ssl=False,  # Set to True in production
    )
    client = OpenMetadata(config)

    # Option 2: Using builder pattern
    config = (
        OpenMetadataConfig.builder()
        .server_url("http://localhost:8585")
        .jwt_token(os.getenv("OPENMETADATA_JWT_TOKEN"))
        .verify_ssl(True)
        .client_timeout(60)
        .build()
    )
    client = OpenMetadata(config)

    # Option 3: Using API key (same as JWT token)
    config = OpenMetadataConfig(
        server_url="http://localhost:8585", api_key=os.getenv("OPENMETADATA_API_KEY")
    )
    client = OpenMetadata(config)

    # Set default client for all entities
    GlossaryTerm.set_default_client(client)
    Table.set_default_client(client)
    Database.set_default_client(client)

    # ========== Enhanced List Operations ==========

    # 1. List with pagination info
    response = GlossaryTerm.list(limit=10, fields=["synonyms", "assets"])
    print(f"Found {len(response.entities)} glossary terms")
    print(f"Total: {response.total}, Next cursor: {response.after}")

    # 2. List all entities (auto-pagination)
    all_terms = GlossaryTerm.list_all(
        fields=["synonyms"], batch_size=50  # Process in batches of 50
    )
    print(f"Total glossary terms in system: {len(all_terms)}")

    # 3. List tables with filters
    tables_response = Table.list(limit=20, filters={"database": "prod_db"})

    # ========== CSV Export with Async Support ==========

    # 1. Simple synchronous export
    csv_data = GlossaryTerm.export_csv("my_glossary").execute()
    print("Exported CSV data:", csv_data[:100])

    # 2. Async export with callback
    exporter = (
        GlossaryTerm.export_csv("my_glossary")
        .with_async()
        .on_complete_callback(lambda data: print(f"Export complete: {len(data)} bytes"))
        .on_error_callback(lambda err: print(f"Export failed: {err}"))
    )

    job_id = exporter.execute()
    print(f"Started async export job: {job_id}")

    # 3. Async export with WebSocket monitoring
    export_result = (
        await GlossaryTerm.export_csv("my_glossary")
        .with_async()
        .with_websocket()
        .wait_completion(timeout_seconds=60)
        .execute_async()
    )

    print(f"Export completed via WebSocket: {len(export_result)} bytes")

    # ========== CSV Import with Async Support ==========

    csv_data = """
    parent,name,displayName,description,synonyms,relatedTerms,references,tags
    ,Customer,Customer,A person or organization that buys goods,"client,buyer",,https://example.com/customer,PII
    ,Revenue,Revenue,Income generated from sales,income,,https://example.com/revenue,Financial
    """

    # 1. Dry run to validate
    validation_result = (
        GlossaryTerm.import_csv("my_glossary")
        .with_data(csv_data)
        .set_dry_run(True)
        .execute()
    )

    print(f"Dry run validation: {validation_result}")

    # 2. Actual import with async
    import_result = (
        await GlossaryTerm.import_csv("my_glossary")
        .with_data(csv_data)
        .set_dry_run(False)
        .with_async()
        .with_websocket()
        .wait_completion(30)
        .on_complete_callback(
            lambda res: print(
                f"Import complete: {res.records_passed} passed, {res.records_failed} failed"
            )
        )
        .execute_async()
    )

    print(f"Import status: {import_result.status}")
    print(f"Records processed: {import_result.records_processed}")
    print(f"Records passed: {import_result.records_passed}")
    print(f"Records failed: {import_result.records_failed}")

    # 3. Import from file
    file_import = (
        await Table.import_csv("prod.default")
        .from_file("/path/to/tables.csv")
        .set_dry_run(False)
        .with_async()
        .with_websocket()
        .wait_completion(60)
        .execute_async()
    )

    # ========== Batch Operations ==========

    # Process all databases in batches
    all_databases = Database.list_all(batch_size=25)

    for db in all_databases:
        print(f"Processing database: {db.name}")

        # Export each database's schema
        await Database.export_csv(
            db.fullyQualifiedName
        ).with_async().with_websocket().execute_async()

    # ========== Combined Fluent Operations ==========

    # Create a new glossary term
    new_term = GlossaryTerm.create(
        CreateGlossaryTermRequest(
            name="DataQuality",
            displayName="Data Quality",
            description="Measures and processes ensuring data accuracy",
            glossary="my_glossary",
            synonyms=["DQ", "Quality"],
        )
    )

    # Add assets to the term
    GlossaryTerm.add_assets(
        term_id=new_term.id,
        asset_ids=["table_id_1", "table_id_2"],
        asset_types=["table", "table"],
    )

    # List all terms with assets
    terms_with_assets = GlossaryTerm.list_all(
        fields=["assets", "relatedTerms"], filters={"hasAssets": True}
    )

    # Export the updated glossary
    export_data = (
        await GlossaryTerm.export_csv("my_glossary")
        .with_async()
        .with_websocket()
        .wait_completion(30)
        .execute_async()
    )

    print(f"Exported {len(export_data)} bytes of glossary data")

    # ========== Error Handling ==========

    try:
        # Import with error handling
        result = (
            await Table.import_csv("test.db")
            .with_data(csv_data)
            .with_async()
            .with_websocket()
            .wait_completion(30)
            .on_error_callback(lambda err: print(f"Import error: {err}"))
            .execute_async()
        )

        if result.records_failed > 0:
            print(f"Some records failed: {result.dry_run_results}")

    except TimeoutError:
        print("Import operation timed out")
    except Exception as e:
        print(f"Import failed: {e}")

    # ========== Parallel Operations ==========

    # Export multiple entities in parallel
    export_tasks = []

    for glossary_name in ["glossary1", "glossary2", "glossary3"]:
        task = (
            GlossaryTerm.export_csv(glossary_name)
            .with_async()
            .with_websocket()
            .wait_completion(60)
            .execute_async()
        )
        export_tasks.append(task)

    # Wait for all exports to complete
    export_results = await asyncio.gather(*export_tasks)

    for i, result in enumerate(export_results):
        print(f"Export {i+1} completed: {len(result)} bytes")


if __name__ == "__main__":
    asyncio.run(main())
