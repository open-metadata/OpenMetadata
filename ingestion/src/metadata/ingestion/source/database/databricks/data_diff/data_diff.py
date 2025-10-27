"""Databricks spec for data diff - uses Databricks connection"""

from metadata.ingestion.source.database.common.data_diff.databricks_base import (
    DatabricksBaseTableParameter,
)


class DatabricksTableParameter(DatabricksBaseTableParameter):
    """Databricks table parameter setter - uses Databricks connection
    which is databricks-based for data diff operations"""

    pass
