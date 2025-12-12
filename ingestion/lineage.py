import json
import random
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
    AuthProvider,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.type.entityLineage import EntitiesEdge
from metadata.generated.schema.type.entityReference import EntityReference

# Setup OpenMetadata connection
security_config = OpenMetadataJWTClientConfig(
    jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJvcGVuLW1ldGFkYXRhLm9yZyIsInN1YiI6ImluZ2VzdGlvbi1ib3QiLCJyb2xlcyI6WyJJbmdlc3Rpb25Cb3RSb2xlIl0sImVtYWlsIjoiaW5nZXN0aW9uLWJvdEBvcGVuLW1ldGFkYXRhLm9yZyIsImlzQm90Ijp0cnVlLCJ0b2tlblR5cGUiOiJCT1QiLCJpYXQiOjE3NjMzODM5NTYsImV4cCI6bnVsbH0.Rcj8mm-qbg1Z-L-KTlwzFAYP66eG7nEo-3MCWwnCw4xh5rWlBUx9HdioyW_QmaBSojHT1pajEv-qyv_JRojhkDPZtVU9_UkISzZ4HlXRmUNeCSIGeqgVMQwNrrzKVogD2pCVp6y7CgbVD6cD2nVgT9txZbU-V5jo3SpJMmdeFr-uj3azlu3lgUEuelcnIePW1cMKPO2cbM9aEXC6SyEwFjlsWRUypNWB3EpC4nvHvgX_c_spdTGe4ZUNVDE2jLM7SA3nf2wQqjCuclnv7-IQJeIbtNIBL9gfjamc3gJtyT0Ab2uYHvny7tkAI48MeSV9mI5IwkT4jw0tUaxvoDFjoA"
)
server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    securityConfig=security_config,
    authProvider=AuthProvider.openmetadata,
)
metadata = OpenMetadata(server_config)

# Check connection
try:
    metadata.health_check()
    print("Connected to OpenMetadata server successfully!")
except Exception as e:
    print(f"Failed to connect to OpenMetadata server: {e}")
    exit(1)

def fetch_all_tables():
    """Fetch all tables using list_all_entities API"""
    print("Fetching all tables...")
    tables = list(metadata.list_all_entities(
        entity=Table,
        fields=["id", "fullyQualifiedName"]
    ))
    print(f"Found {len(tables)} tables")
    return tables

def create_lineage_between_tables(tables):
    """Create lineage relationships between tables"""
    if len(tables) < 2:
        print("Not enough tables to create lineage")
        return
    
    total_lineage_created = 0
    
    # Create a sample lineage network where each table can have multiple downstream tables
    for i, source_table in enumerate(tables):
        # Choose a random number of target tables (1-3)
        num_targets = min(random.randint(1, 3), len(tables) - 1)
        
        # Select random target tables (different from source)
        potential_targets = [t for t in tables if t.id != source_table.id]
        if not potential_targets:
            continue
            
        target_tables = random.sample(potential_targets, min(num_targets, len(potential_targets)))
        
        for target_table in target_tables:
            try:
                # Create lineage request
                lineage_request = AddLineageRequest(
                    edge=EntitiesEdge(
                        fromEntity=EntityReference(id=source_table.id, type="table"),
                        toEntity=EntityReference(id=target_table.id, type="table"),
                    )
                )
                
                # Add lineage
                created_lineage = metadata.add_lineage(data=lineage_request)
                total_lineage_created += 1
                print(f"Created lineage: {source_table.fullyQualifiedName} -> {target_table.fullyQualifiedName}")
            except Exception as e:
                print(f"Error creating lineage between {source_table.fullyQualifiedName} and {target_table.fullyQualifiedName}: {e}")
    
    print(f"Total lineage relationships created: {total_lineage_created}")

def create_complex_lineage_pattern():
    """Create more complex lineage patterns like diamond pattern"""
    tables = fetch_all_tables()
    if len(tables) < 4:
        print("Not enough tables to create complex lineage patterns")
        return
    
    # Create a diamond pattern (A -> B, A -> C, B -> D, C -> D)
    try:
        # Select 4 random tables for the diamond pattern
        diamond_tables = random.sample(tables, 4)
        A, B, C, D = diamond_tables
        
        # Create the diamond pattern
        patterns = [
            (A, B), # A -> B
            (A, C), # A -> C
            (B, D), # B -> D
            (C, D)  # C -> D
        ]
        
        for source, target in patterns:
            lineage_request = AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=source.id, type="table"),
                    toEntity=EntityReference(id=target.id, type="table"),
                )
            )
            metadata.add_lineage(data=lineage_request)
        
        print(f"Created diamond lineage pattern: {A.fullyQualifiedName} -> ({B.fullyQualifiedName}, {C.fullyQualifiedName}) -> {D.fullyQualifiedName}")
    except Exception as e:
        print(f"Error creating complex lineage pattern: {e}")

def main():
    """Main function to execute the lineage creation"""
    tables = fetch_all_tables()
    if not tables:
        print("No tables found. Please make sure tables exist in OpenMetadata.")
        return
    
    # Create random lineage between tables
    create_lineage_between_tables(tables)
    
    # Create complex lineage patterns
    create_complex_lineage_pattern()
    
    print("Lineage creation completed!")

if __name__ == "__main__":
    main()
