#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Resolve IOMETE observability connections from the attached table."""

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.iometeConnection import IometeConnection
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.profiler_utils import get_context_entities


def copy_connection_for_table(
    config: IometeConnection, table: Table | None, metadata: OpenMetadata
) -> IometeConnection:
    """Select the physical catalog before any source session is initialized."""
    if table is None:
        raise ValueError("IOMETE table must resolve to a target database before connecting")
    _, database, _ = get_context_entities(entity=table, metadata=metadata)
    if database is None:
        raise ValueError("IOMETE table must resolve to a target database before connecting")
    target_catalog = model_str(database.name)
    # Unconfigured ingestion labels the driver's default catalog as "default".
    if not config.catalog and target_catalog == "default":
        return config.model_copy(deep=True)
    return config.model_copy(deep=True, update={"catalog": target_catalog})
