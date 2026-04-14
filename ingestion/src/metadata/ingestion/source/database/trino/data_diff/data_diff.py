"""Trino spec for data diff"""

from typing import Optional, Union

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils import fqn


class TrinoTableParameter(BaseTableParameter):
    """Trino data_diff parameter setter.

    The base get_data_diff_url obtains a connection dict from the
    connection class when available (TrinoConnection.get_connection_dict),
    which may normalize some fields (for example the driver name). That
    dict carries the *service-level* catalog and no schema, but data_diff
    needs the *table-specific* catalog and schema so that the Trino
    session targets the correct catalog for each table in the diff.
    """

    def get_data_diff_url(
        self,
        db_service: DatabaseService,
        table_fqn: str,
        override_url: Optional[Union[str, dict]] = None,
    ) -> Union[str, dict]:
        source_url = super().get_data_diff_url(db_service, table_fqn, override_url)
        if isinstance(source_url, dict):
            # Work on a copy to avoid mutating a dict that might be reused
            source_url = dict(source_url)
            _, catalog, schema, _ = fqn.split(table_fqn)
            source_url["catalog"] = catalog
            source_url["schema"] = schema
        return source_url
