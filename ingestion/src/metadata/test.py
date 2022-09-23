import sys

from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.basic import Markdown
from metadata.ingestion.ometa.ometa_api import OpenMetadata

server_config = OpenMetadataConnection(
    hostPort="http://localhost:8585/api",
    securityConfig=OpenMetadataJWTClientConfig(jwtToken="ADMIN_JWT_TOKEN"),
    authProvider=AuthProvider.openmetadata,
)
metadata = OpenMetadata(server_config)

if not metadata.health_check():
    sys.exit(1)

table_fqn = "sample_data.ecommerce_db.shopify.raw_product_catalog"
column_name = "store_address"
desc = "Address of the local convenience store"

table_def: Table = metadata.get_by_name(fqn=table_fqn, entity=Table)

column_defs = []

for column in table_def.columns:
    if column.name.__root__ == column_name:
        column.description = Markdown(__root__=desc)
    column_defs.append(column)

table_request = CreateTableRequest(
    name=table_def.name,
    displayName=table_def.displayName,
    description=table_def.description,
    tableType=table_def.tableType,
    columns=column_defs,
    tableConstraints=table_def.tableConstraints,
    tablePartition=table_def.tablePartition,
    owner=table_def.owner,
    databaseSchema=table_def.databaseSchema,
    tags=table_def.tags,
    viewDefinition=table_def.viewDefinition,
    extension=table_def.extension,
)

metadata.create_or_update(data=table_request)
