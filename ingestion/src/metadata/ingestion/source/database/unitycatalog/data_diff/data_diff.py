"""Unity Catalog spec for data diff"""

from typing import Optional, Union, cast
from urllib.parse import urlparse

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.source.database.unitycatalog.connection import (
    get_sqlalchemy_connection,
)
from metadata.profiler.orm.registry import Dialects
from metadata.utils import fqn


class UnityCatalogTableParameter(BaseTableParameter):
    """Unity Catalog table parameter setter for data diff operations"""

    @staticmethod
    def get_data_diff_url(
        db_service: DatabaseService,
        table_fqn: str,
        override_url: Optional[Union[str, dict]] = None,
    ) -> Union[str, dict]:
        """Get the connection URL for Unity Catalog data diff operations"""

        if override_url:
            return override_url

        # Use Unity Catalog's existing SQLAlchemy connection logic
        connection_config = cast(UnityCatalogConnection, db_service.connection.config)
        engine = get_sqlalchemy_connection(connection_config)
        source_url = str(engine.url)

        # Apply the same URL processing as base class
        url = urlparse(source_url)
        # Remove the driver name from the URL because data-diff doesn't support it
        kwargs = {"scheme": url.scheme.split("+")[0]}

        service, database, schema, table = fqn.split(table_fqn)

        # Handle Unity Catalog path requirements
        # Unity Catalog uses catalog.schema format, similar to Snowflake
        if hasattr(db_service.connection.config, "supportsDatabase"):
            kwargs["path"] = f"/{database}"

        # For Unity Catalog (Databricks-based), include both catalog and schema in path
        if (
            kwargs["scheme"] in {Dialects.MSSQL, Dialects.Snowflake, Dialects.Trino}
            or "databricks" in kwargs["scheme"]
        ):
            kwargs["path"] = f"/{database}/{schema}"

        return url._replace(**kwargs).geturl()
