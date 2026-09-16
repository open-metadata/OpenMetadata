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
"""MSSQL synonym discovery, identifier parsing, and target mapping"""

import traceback
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.engine import Engine

from metadata.ingestion.source.database.mssql.models import (
    MssqlSynonym,
    MssqlSynonymTarget,
    SynonymUnresolvedReason,
)
from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_SYNONYMS
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

DEFAULT_MSSQL_SCHEMA = "dbo"

MAX_SYNONYM_ENTRIES = 5000


def split_sql_server_identifier(raw: str) -> list[str]:
    """
    Split a possibly bracket-quoted T-SQL identifier on unquoted '.' separators.

    Splitting naively on '.' would tear apart a quoted component that legitimately
    contains a dot, which SQL Server permits: [my.db].[dbo].[order.items] is three
    parts, not five. Inside brackets, ']]' is an escaped literal ']'.
    """
    parts: list[str] = []
    current: list[str] = []
    in_bracket = False
    index = 0

    while index < len(raw):
        char = raw[index]
        if in_bracket:
            if char == "]":
                if index + 1 < len(raw) and raw[index + 1] == "]":
                    current.append("]")
                    index += 2
                    continue
                in_bracket = False
            else:
                current.append(char)
        elif char == "[":
            in_bracket = True
        elif char == ".":
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
        index += 1

    parts.append("".join(current))
    return parts


def parse_base_object_name(
    base_object_name: str,
    synonym_database: str,
) -> tuple[MssqlSynonymTarget | None, SynonymUnresolvedReason | None]:
    """
    Normalize sys.synonyms.base_object_name into a three-part target.

    Returns exactly one of (target, None) or (None, reason).

    An omitted schema resolves at runtime to the calling user's default schema,
    which is not knowable at ingestion time; 'dbo' is assumed because it is the
    default for the overwhelming majority of SQL Server principals.
    """
    if not base_object_name or not base_object_name.strip():
        return None, SynonymUnresolvedReason.UNRESOLVED

    parts = split_sql_server_identifier(base_object_name.strip())

    if len(parts) == 4:
        if parts[0] == "":
            parts = parts[1:]
        else:
            return None, SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED

    if len(parts) == 3:
        database, schema_name, table = parts
    elif len(parts) == 2:
        database, (schema_name, table) = synonym_database, parts
    elif len(parts) == 1:
        database, schema_name, table = synonym_database, DEFAULT_MSSQL_SCHEMA, parts[0]
    else:
        return None, SynonymUnresolvedReason.UNRESOLVED

    if not table:
        return None, SynonymUnresolvedReason.UNRESOLVED

    return (
        MssqlSynonymTarget(
            database=database or synonym_database,
            schema_name=schema_name or DEFAULT_MSSQL_SCHEMA,
            table=table,
        ),
        None,
    )


class SynonymMap:
    """
    Target FQN -> alias FQNs, with consumption tracking.

    Bounded by an explicit target cap: the map is built from a whole-service
    sys.synonyms snapshot, so on a pathological catalog it would otherwise grow
    without limit and exhaust memory mid-run.
    """

    def __init__(self, max_entries: int = MAX_SYNONYM_ENTRIES):
        self._max_entries = max_entries
        # Keyed on the case-folded target FQN: SQL Server's default collation is
        # case-insensitive, so `base_object_name` casing routinely disagrees with
        # the target table's actual stored casing, but the FQNs we compare here
        # are case-preserving strings. Folding only the key -- never the alias
        # values stored below -- keeps lookups collation-correct without
        # mangling what actually lands in aliases[].
        self._targets: dict[str, set[str]] = {}
        self._consumed: set[str] = set()
        self._explicit_unresolved: list[tuple[str, str]] = []
        self._cap_warned = False
        self._unresolved_cap_warned = False

    def add(self, target_fqn: str, alias_fqn: str) -> bool:
        key = target_fqn.casefold()
        if key not in self._targets and len(self._targets) >= self._max_entries:
            if not self._cap_warned:
                logger.warning(
                    "Synonym map reached its cap of %d targets; further synonyms are ignored for this run",
                    self._max_entries,
                )
                self._cap_warned = True
            return False
        self._targets.setdefault(key, set()).add(alias_fqn)
        return True

    def aliases_for(self, target_fqn: str) -> list[str] | None:
        """
        Return sorted aliases for a target; marks target as consumed.

        Calling this method signals that the target was ingested and will exclude
        it from unresolved() reporting. Meant to be called exactly once per target
        when it is successfully discovered and added to the catalog.
        """
        key = target_fqn.casefold()
        aliases = self._targets.get(key)
        if not aliases:
            return None
        self._consumed.add(key)
        return sorted(aliases)

    def record_unresolved(self, alias_fqn: str, reason: SynonymUnresolvedReason) -> None:
        if len(self._explicit_unresolved) >= self._max_entries:
            if not self._unresolved_cap_warned:
                logger.warning(
                    "Unresolved synonym list reached its cap of %d; "
                    "further unresolved entries are ignored for this run",
                    self._max_entries,
                )
                self._unresolved_cap_warned = True
            return
        self._explicit_unresolved.append((alias_fqn, reason.value))

    def unresolved(self) -> list[tuple[str, str]]:
        never_consumed = [
            (alias_fqn, SynonymUnresolvedReason.UNRESOLVED.value)
            for target_fqn, aliases in self._targets.items()
            if target_fqn not in self._consumed
            for alias_fqn in sorted(aliases)
        ]
        return self._explicit_unresolved + never_consumed

    def is_empty(self) -> bool:
        return not self._targets


def build_synonym_map(
    engine: Engine,
    database_names: list[str],
    fqn_builder: Callable[[str, str, str], str],
    max_entries: int = MAX_SYNONYM_ENTRIES,
) -> SynonymMap:
    """
    Sweep sys.synonyms across every in-scope database and index by target FQN.

    Runs before any table is produced, because a synonym's target commonly lives
    in a different database than the synonym itself and the alias has to be
    attached to the target's create request.

    A database that cannot be read (dropped mid-run, offline, or no VIEW
    DEFINITION grant) is logged and skipped: partial synonym coverage is better
    than no metadata at all.
    """
    synonym_map = SynonymMap(max_entries=max_entries)

    for database_name in database_names:
        escaped_database = database_name.replace("]", "]]")
        try:
            with engine.connect() as connection:
                rows = connection.execute(text(MSSQL_GET_SYNONYMS.format(database_name=escaped_database))).all()
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning("Could not read synonyms from database [%s]: %s", database_name, exc)
            continue

        for row in rows:
            synonym = MssqlSynonym(
                synonym_schema=row.synonym_schema,
                synonym_name=row.synonym_name,
                base_object_name=row.base_object_name,
            )
            alias_fqn = fqn_builder(database_name, synonym.synonym_schema, synonym.synonym_name)

            target, reason = parse_base_object_name(synonym.base_object_name, database_name)
            if reason is not None or target is None:
                # parse_base_object_name guarantees exactly one of (target, reason) is set;
                # the `target is None` check is here purely so type narrowing lets us treat
                # `target` as non-optional below.
                synonym_map.record_unresolved(alias_fqn, reason or SynonymUnresolvedReason.UNRESOLVED)
                continue

            synonym_map.add(
                target_fqn=fqn_builder(target.database, target.schema_name, target.table),
                alias_fqn=alias_fqn,
            )

    return synonym_map
