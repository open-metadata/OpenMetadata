#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Read one small owned catalog; multiple paginated API calls are not atomic."""

from dataclasses import dataclass

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.storedProcedure import StoredProcedure
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.fqn import quote_name


@dataclass(frozen=True)
class CatalogSnapshot:
    service: DatabaseService | None
    databases: tuple[Database, ...] = ()
    schemas: tuple[DatabaseSchema, ...] = ()
    tables: tuple[Table, ...] = ()
    procedures: tuple[StoredProcedure, ...] = ()

    def entities(self, entity: type) -> tuple:
        return {
            DatabaseService: (self.service,) if self.service is not None else (),
            Database: self.databases,
            DatabaseSchema: self.schemas,
            Table: self.tables,
            StoredProcedure: self.procedures,
        }[entity]

    def find(self, entity: type, fqn: str):
        return next((item for item in self.entities(entity) if model_str(item.fullyQualifiedName) == fqn), None)


def read_catalog(om, service_name: str) -> CatalogSnapshot:
    service_fqn = quote_name(service_name)
    service = om.get_by_name(entity=DatabaseService, fqn=service_fqn)
    if service is None:
        return CatalogSnapshot(None)
    databases = tuple(om.list_all_entities(entity=Database, params={"service": service_fqn}, limit=1000))
    schemas = tuple(
        schema
        for database in databases
        for schema in om.list_all_entities(
            entity=DatabaseSchema, params={"database": model_str(database.fullyQualifiedName)}, limit=1000
        )
    )
    tables = []
    procedures = []
    for schema in schemas:
        params = {"databaseSchema": model_str(schema.fullyQualifiedName)}
        tables.extend(
            om.list_all_entities(entity=Table, params=params, fields=["tags", "owners", "columns"], limit=1000)
        )
        procedures.extend(om.list_all_entities(entity=StoredProcedure, params=params, limit=1000))
    return CatalogSnapshot(service, databases, schemas, tuple(tables), tuple(procedures))
