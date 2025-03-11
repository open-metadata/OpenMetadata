from metadata.generated.schema.entity.data.table import Table
from _openmetadata_testutils.ometa import int_admin_ometa

metadata = int_admin_ometa()
entity = metadata.get_by_name(
    entity=Table, fqn="sample_data.ecommerce_db.shopify.dim_address"
)

if not entity:
    raise ValueError("Table not found")
