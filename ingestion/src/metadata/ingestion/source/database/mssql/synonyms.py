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
Resolve SQL Server synonyms so lineage can reach the objects they alias.

Synonyms are commonly used as an abstraction layer: a view in one database reads
`DM_Core.dbo.vAccount`, which is a synonym for `DM_Master.dbo.vAccount`. A synonym
is neither a table nor a view, so it is never ingested as an entity, and that
reference resolves to nothing in OpenMetadata - the lineage edge is dropped.

Rewriting synonym references to the objects they point at, before the SQL reaches
the lineage parser, restores those edges without adding alias entities to the
catalog. Rewriting is always fail-open: any SQL we cannot parse or rewrite is
handed on unchanged, so the worst case is the behaviour we had before.

sqlglot is available because collate-sqllineage, a direct dependency, pins it.
"""

import re
from dataclasses import dataclass

import sqlglot
from sqlglot import exp

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TSQL_DIALECT = "tsql"

# Splits a multipart name into its parts, bracket-quoted or bare. A bracketed part
# may itself contain dots, so we cannot simply split on ".".
_OBJECT_NAME_PART = re.compile(r"\[(?P<quoted>[^\]]*)]|(?P<bare>[^.\[\]]+)")

# Identifiers T-SQL accepts unquoted. Anything else keeps its brackets when rendered.
_PLAIN_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_@#$]*$")

# server.database.schema.object - a linked server has no counterpart in OpenMetadata
_LINKED_SERVER_PARTS = 4


@dataclass(frozen=True)
class ObjectName:
    """A database object addressed by its three-part name."""

    database: str
    schema: str
    name: str

    @property
    def key(self) -> tuple[str, str, str]:
        """Case-insensitive lookup key. SQL Server object names are case-insensitive."""
        return (self.database.lower(), self.schema.lower(), self.name.lower())


def split_object_name(raw_name: str) -> list[str]:
    """Split a multipart SQL Server name into its parts, stripping any brackets."""
    return [
        match.group("quoted") if match.group("quoted") is not None else match.group("bare")
        for match in _OBJECT_NAME_PART.finditer(raw_name or "")
    ]


def parse_base_object_name(base_object_name: str, database: str, schema: str) -> ObjectName | None:
    """Resolve a synonym's base_object_name to a three-part name.

    Parts omitted in the synonym definition default to the database and schema the
    synonym itself lives in, which is how SQL Server resolves them. Four-part names
    point at a linked server and have no counterpart in OpenMetadata.
    """
    parts = split_object_name(base_object_name)
    if len(parts) >= _LINKED_SERVER_PARTS:
        logger.debug(f"Skipping synonym for linked-server object [{base_object_name}]: not ingested by OpenMetadata")
        return None
    if len(parts) == 3:
        return ObjectName(database=parts[0], schema=parts[1], name=parts[2])
    if len(parts) == 2:
        return ObjectName(database=database, schema=parts[0], name=parts[1])
    if len(parts) == 1:
        return ObjectName(database=database, schema=schema, name=parts[0])
    logger.debug(f"Could not read the base object of a synonym from [{base_object_name}]")
    return None


def _to_identifier(value: str) -> exp.Identifier:
    return exp.to_identifier(value, quoted=not _PLAIN_IDENTIFIER.match(value))


class SynonymResolver:
    """Maps synonyms to the objects they alias, and rewrites SQL that references them."""

    def __init__(self) -> None:
        self._synonyms: dict[tuple[str, str, str], ObjectName] = {}
        self.skipped = 0

    def add(self, database: str, schema: str, synonym: str, base_object_name: str) -> None:
        """Register a single synonym. Unresolvable base objects are counted and skipped."""
        base_object = parse_base_object_name(base_object_name, database, schema)
        if base_object is None:
            self.skipped += 1
            return
        self._synonyms[ObjectName(database=database, schema=schema, name=synonym).key] = base_object

    def is_empty(self) -> bool:
        """No synonyms means no rewriting, and no parsing cost, for the vast majority of servers."""
        return not self._synonyms

    def __len__(self) -> int:
        return len(self._synonyms)

    def rewrite(self, sql: str | None, database: str | None, schema: str | None) -> str | None:
        """Return `sql` with every synonym reference replaced by its base object.

        `database` and `schema` are those of the object owning the SQL; they resolve
        one- and two-part references the way SQL Server would. The original SQL is
        returned unchanged when there is nothing to rewrite or when anything fails.
        """
        if not sql or self.is_empty():
            return sql
        try:
            return self._rewrite(sql, database, schema)
        except Exception as exc:
            logger.debug(f"Leaving SQL unchanged, synonyms could not be resolved in it: {exc}")
            return sql

    def _rewrite(self, sql: str, database: str | None, schema: str | None) -> str:
        expression = sqlglot.parse_one(sql, dialect=TSQL_DIALECT)
        # A CTE is addressed like a table, so an identically named synonym must not win
        cte_names = {cte.alias_or_name.lower() for cte in expression.find_all(exp.CTE)}
        replaced = 0
        for table in expression.find_all(exp.Table):
            base_object = self._base_object_of(table, database, schema, cte_names)
            if base_object is None:
                continue
            table.set("catalog", _to_identifier(base_object.database))
            table.set("db", _to_identifier(base_object.schema))
            table.set("this", _to_identifier(base_object.name))
            replaced += 1
        if not replaced:
            return sql
        logger.debug(f"Resolved {replaced} synonym reference(s) for lineage")
        return expression.sql(dialect=TSQL_DIALECT)

    def _base_object_of(
        self,
        table: exp.Table,
        database: str | None,
        schema: str | None,
        cte_names: set[str],
    ) -> ObjectName | None:
        """The object a table reference aliases, or None when it is not a synonym."""
        if not isinstance(table.this, exp.Identifier):
            return None
        name = table.name
        table_database = table.catalog or database
        table_schema = table.db or schema
        unqualified_cte = not table.catalog and not table.db and name.lower() in cte_names
        if not name or not table_database or not table_schema or unqualified_cte:
            return None
        return self._synonyms.get(ObjectName(database=table_database, schema=table_schema, name=name).key)
