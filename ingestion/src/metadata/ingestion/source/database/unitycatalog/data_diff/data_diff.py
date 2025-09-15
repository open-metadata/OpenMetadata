"""Unity Catalog spec for data diff - delegates to Databricks connection"""

from typing import Any, Dict, Optional, Union, cast

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.connections.database.unityCatalogConnection import (
    UnityCatalogConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseService,
)
from metadata.ingestion.source.database.unitycatalog.connection import (
    
)from metadata.ingestion.source.database.databricks.connection import (
    get_connection as databricks_get_connection
)


class UnityCatalogTableParameter(BaseTableParameter):
    """Unity Catalog table parameter setter - uses Unity Catalog connection
    which is databricks-based for data diff operations"""

    def _get_service_connection_config(service_connection_config,
        ) -> Optional[Union[str, dict]]:
        
        return (
                    str(databricks_get_connection(service_connection_config).url)
                    if service_connection_config
                    else None
                )
        