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
"""Reshape the generic database progress snapshot into the two-tier view: a global
header (``Databases``, ``Schemas``) over the currently-active schemas — each with its
per-leaf-type detail (``Table``, ``StoredProcedure``) — followed by a bounded tail of
recently *finished* schemas (marked done) so a viewer can still answer "how many
tables did schema X bring". DB-family only — the generic registry stays free of
database semantics."""

from typing import Dict, List, Optional, Tuple  # noqa: UP035

from metadata.utils.progress_registry import ProgressNodeSnapshot

DATABASE = "Database"
DATABASE_SCHEMA = "DatabaseSchema"
DEFAULT_ACTIVE_SCHEMA_CAP = 20
DEFAULT_COMPLETED_SCHEMA_CAP = 20

CompletedSchema = Tuple[Tuple[str, ...], ProgressNodeSnapshot]  # noqa: UP006


def to_two_tier(
    generic: Optional[ProgressNodeSnapshot],  # noqa: UP045
    schemas_processed: int,
    global_expected: Dict[str, Optional[int]],  # noqa: UP006,UP045
    completed: Optional[List[CompletedSchema]] = None,  # noqa: UP006,UP045
    active_schema_cap: int = DEFAULT_ACTIVE_SCHEMA_CAP,
    completed_schema_cap: int = DEFAULT_COMPLETED_SCHEMA_CAP,
) -> Optional[ProgressNodeSnapshot]:  # noqa: UP045
    result = None
    if generic is not None:
        databases_expected = global_expected.get(DATABASE, generic.expected)
        schemas_expected = global_expected.get(DATABASE_SCHEMA)
        active = _flatten_active_schemas(generic)
        capped_active = active[:active_schema_cap]
        overflow = len(active) - len(capped_active)
        finished = _completed_schema_nodes(completed or [])[:completed_schema_cap]
        schema_rollup = ProgressNodeSnapshot(
            label="",
            child_type=DATABASE_SCHEMA,
            expected=schemas_expected,
            processed=schemas_processed,
            active=schemas_expected is None or schemas_processed < schemas_expected,
            overflow=overflow,
            children=(*capped_active, *finished),
        )
        result = ProgressNodeSnapshot(
            label="",
            child_type=DATABASE,
            expected=databases_expected,
            processed=generic.processed,
            active=databases_expected is None or generic.processed < databases_expected,
            overflow=0,
            children=(schema_rollup,),
        )
    return result


def _flatten_active_schemas(root: ProgressNodeSnapshot) -> "List[ProgressNodeSnapshot]":  # noqa: UP006
    nodes: List[ProgressNodeSnapshot] = []  # noqa: UP006
    for database in root.children:
        nodes.extend(_schema_node(database.label, schema) for schema in database.children)
    return nodes


def _completed_schema_nodes(completed: "List[CompletedSchema]") -> "List[ProgressNodeSnapshot]":  # noqa: UP006
    nodes: List[ProgressNodeSnapshot] = []  # noqa: UP006
    for ancestors, schema in completed:
        database_label = ancestors[0] if ancestors else ""
        nodes.append(_schema_node(database_label, schema, active=False))
    return nodes


def _schema_node(database_label: str, schema: ProgressNodeSnapshot, active: bool = True) -> ProgressNodeSnapshot:
    label = f"{database_label}.{schema.label}" if database_label else schema.label
    leaf_types = list(dict.fromkeys([*schema.expected_by_type, *schema.processed_by_type]))
    metrics = tuple(
        ProgressNodeSnapshot(
            label="",
            child_type=leaf_type,
            expected=schema.expected_by_type.get(leaf_type),
            processed=schema.processed_by_type.get(leaf_type, 0),
            active=active,
            overflow=0,
            children=(),
        )
        for leaf_type in leaf_types
    )
    return ProgressNodeSnapshot(
        label=label,
        child_type=None,
        expected=None,
        processed=0,
        active=active,
        overflow=0,
        children=metrics,
    )
