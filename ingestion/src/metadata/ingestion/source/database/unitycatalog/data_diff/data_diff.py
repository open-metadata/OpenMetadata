"""Unity Catalog spec for data diff - delegates to Databricks connection"""

from metadata.ingestion.source.database.common.data_diff.databricks_base import (
    DatabricksBaseTableParameter,
)


class UnityCatalogTableParameter(DatabricksBaseTableParameter):
    """Unity Catalog table parameter setter - uses Unity Catalog connection
    which is databricks-based for data diff operations"""

    pass
