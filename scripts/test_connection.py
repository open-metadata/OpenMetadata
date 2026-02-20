#!/usr/bin/env python3
"""Test connection to OpenMetadata."""
import sys

# Read token from file
with open("/Users/harsha/Code/OpenMetadata/scripts/token.txt") as f:
    token = f.read().strip()

print(f"Token length: {len(token)}")
print("Connecting to OpenMetadata...")

from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    securityConfig=OpenMetadataJWTClientConfig(jwtToken=token),
)

print("Created config, initializing client...")
metadata = OpenMetadata(server_config)
print("Client initialized!")

# Test a simple API call
print("Testing API call...")
from metadata.generated.schema.entity.services.databaseService import DatabaseService
services = metadata.list_all_entities(entity=DatabaseService, limit=5)
count = 0
for svc in services:
    print(f"  Found service: {svc.name}")
    count += 1
    if count >= 3:
        break

print("Connection successful!")
