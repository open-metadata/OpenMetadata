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

"""ClickHouse table resolution in its native schema namespace."""

from dataclasses import replace

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableBindingResolution, TableLookup
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.ingestion.ometa.utils import model_str
from metadata.utils import fqn


class ClickHouseTableBindingResolution(TableBindingResolution):
    def _normalize_reference(self, reference: TableReference, service_name: str | None) -> TableReference:
        return replace(reference, database=None) if service_name and service_name != "*" else reference

    def resolve(
        self,
        reference: TableReference,
        *,
        service_name: str | None = None,
        fields: tuple[str, ...] = (),
        include: str | None = None,
        lookup: TableLookup = TableLookup.CATALOG,
    ) -> tuple[Table, ...]:
        if service_name and service_name != "*":
            return super().resolve(reference, service_name=service_name, fields=fields, include=include, lookup=lookup)
        if "*" in reference.table:
            return ()
        if include in ("all", "deleted"):
            raise ValueError("Search-assisted resolution supports active entities only")
        filters = [{"term": {"name.keyword": reference.table}}]
        if reference.schema:
            filters.append({"term": {"databaseSchema.name.keyword": reference.schema}})
        scopes = [{"term": {"serviceType": "Clickhouse"}}]
        scopes.append(
            {"term": {"database.name.keyword": reference.database}} if reference.database else {"match_all": {}}
        )
        names = self.metadata.search_filtered_fqns(
            Table, {"query": {"bool": {"filter": filters, "should": scopes, "minimum_should_match": 1}}}
        )
        tables = []
        for name in dict.fromkeys(names):
            table = (
                self.metadata.get_by_name(Table, name, fields=list(fields))
                if fields
                else self.metadata.get_by_name(Table, name)
            )
            if table is None or table.deleted or model_str(table.fullyQualifiedName) != name:
                raise ValueError("Table changed during candidate search; resolution incomplete")
            _, database, schema, table_name = fqn.split(name)
            if table_name.lower() != reference.table.lower() or (
                reference.schema and schema.lower() != reference.schema.lower()
            ):
                continue
            if (
                not reference.database
                or database.lower() == reference.database.lower()
                or table.serviceType == DatabaseServiceType.Clickhouse
            ):
                tables.append(table)
        return tuple(tables)
