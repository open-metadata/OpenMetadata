"""Base class for Databricks-based data diff implementations"""

from typing import Optional, Union

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils import fqn


class DatabricksBaseTableParameter(BaseTableParameter):
    """Base class for Databricks-based table parameter setters.

    The connection class builds a service-level dict; data_diff resolves a two-part
    ``schema.table`` path against the connection's catalog, so each side of the diff
    needs the catalog and schema of its own table.
    """

    def get_data_diff_url(
        self,
        db_service: DatabaseService,
        table_fqn: str,
        override_url: Optional[Union[str, dict]] = None,  # noqa: UP007, UP045
    ) -> Union[str, dict]:  # noqa: UP007
        source_url = super().get_data_diff_url(db_service, table_fqn, override_url)
        if isinstance(source_url, dict):
            # Work on a copy to avoid mutating a dict that might be reused
            source_url = dict(source_url)
            _, catalog, schema, _ = fqn.split(table_fqn)
            source_url["catalog"] = catalog
            source_url["schema"] = schema
        return source_url
