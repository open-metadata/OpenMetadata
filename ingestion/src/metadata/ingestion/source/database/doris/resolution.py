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

"""
Doris table resolution.

Doris qualifies a name with its catalog: the definitions of views and materialized views reference
`internal`.`db`.`t`, `internal` being the catalog of Doris's own tables. The connector ingests that catalog
as the service's database, `databaseName` or `default`, so the `internal` part of a reference stands for
that database. Any other catalog name is left as is
(ADR:2026-11-13-doris-internal-catalog-names-the-service-database).
"""

import traceback
from dataclasses import replace

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableBindingResolution as DefaultTableBindingResolution
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import utils_logger
from metadata.utils.lru_cache import LRU_CACHE_SIZE, LRUCache

logger = utils_logger()

# Catalog names are case sensitive in Doris: only `internal` names the internal catalog
INTERNAL_CATALOG = "internal"
DEFAULT_DATABASE = "default"

internal_database_cache: LRUCache[str] = LRUCache(LRU_CACHE_SIZE)


def get_internal_database(metadata: OpenMetadata, service_name: str) -> str | None:
    """The database a Doris service ingests its internal catalog as, or None when the service cannot be read"""
    try:
        return internal_database_cache.get(service_name)
    except KeyError:
        pass
    try:
        service: DatabaseService | None = metadata.get_by_name(entity=DatabaseService, fqn=service_name)
        if service is None:
            raise ValueError("service not found")  # noqa: TRY301 -- same failure path as an unreadable service
        database = service.connection.config.databaseName or DEFAULT_DATABASE
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.warning(
            "Could not read the database name of Doris service '%s', its `%s` references stay unresolved: %s",
            service_name,
            INTERNAL_CATALOG,
            exc,
        )
        return None
    internal_database_cache.put(service_name, database)
    return database


class DorisTableBindingResolution(DefaultTableBindingResolution):
    def _normalize_reference(self, reference: TableReference, service_name: str | None) -> TableReference:
        # Without a service there is no database to map the internal catalog to
        if reference.database != INTERNAL_CATALOG or not service_name or service_name == "*":
            return reference
        database = get_internal_database(self.metadata, service_name)
        return replace(reference, database=database) if database else reference


TableBindingResolution = DorisTableBindingResolution
