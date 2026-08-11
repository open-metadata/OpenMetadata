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
"""Pure builder: dim/fact/metric rows → SQLAlchemy-shape column dicts that
the standard ``sql_column_handler`` pipeline understands. Every dim, fact and
metric on a Snowflake semantic view surfaces as a Column on the view's Table
entity, tagged in the description with its kind + logical table + expression
+ synonyms + comment."""

from __future__ import annotations

import sqlalchemy.types as sqltypes

from snowflake.sqlalchemy.snowdialect import ischema_names

_ROW_TABLE_IDX = 0
_ROW_NAME_IDX = 1
_ROW_TYPE_IDX = 2
_ROW_EXPR_IDX = 3
_ROW_COMMENT_IDX = 4
_ROW_SYNONYMS_IDX = 5


def build_columns(
    *,
    dimensions: list[tuple],
    facts: list[tuple],
    metrics: list[tuple],
) -> list[dict]:
    """Merge dim/fact/metric rows into SQLAlchemy-shape column dicts.

    Same column name across kinds collapses into one entry whose description
    enumerates every kind. The returned dicts have ``type`` set to a SQLAlchemy
    type instance so ``ColumnTypeParser`` maps to the correct OM DataType and
    ``dataLength`` / ``precision`` / ``scale``.
    """
    merged: dict[str, dict] = {}
    for kind, rows in (("Dimension", dimensions), ("Fact", facts), ("Metric", metrics)):
        for row in rows:
            _accumulate(merged, kind, row)
    return [_to_sqlalchemy_dict(entry) for entry in merged.values()]


def _accumulate(merged: dict[str, dict], kind: str, row: tuple) -> None:
    name = row[_ROW_NAME_IDX]
    if not name:
        return
    entry = merged.setdefault(
        name,
        {
            "name": name,
            "raw_type": row[_ROW_TYPE_IDX],
            "kinds": [],
            "logical_table": row[_ROW_TABLE_IDX] or None,
            "expression": row[_ROW_EXPR_IDX] or None,
            "synonyms": row[_ROW_SYNONYMS_IDX] or None,
            "comment": row[_ROW_COMMENT_IDX] or None,
        },
    )
    entry["kinds"].append(kind)


def _to_sqlalchemy_dict(entry: dict) -> dict:
    stripped_expression = _strip_logical_qualifier(entry["expression"], entry["logical_table"])
    return {
        "name": entry["name"],
        "type": _resolve_sqlalchemy_type(entry["raw_type"]),
        "nullable": True,
        "default": None,
        "autoincrement": False,
        "comment": _build_description(
            kinds=entry["kinds"],
            logical_table=entry["logical_table"],
            expression=stripped_expression,
            synonyms=entry["synonyms"],
            comment=entry["comment"],
        ),
        "system_data_type": entry["raw_type"] or None,
    }


def _resolve_sqlalchemy_type(raw: str | None):
    """Map ``VARCHAR(16777216)`` / ``NUMBER(38,2)`` to an SA type instance so
    downstream ``ColumnTypeParser`` picks up ``dataLength`` / ``precision``
    / ``scale`` from the type object rather than defaulting to 1."""
    if not raw:
        return sqltypes.NullType()
    head = raw.strip().split("(", 1)[0].strip().upper()
    type_class = ischema_names.get(head)
    if type_class is None:
        return sqltypes.NullType()
    args, kwargs = _parse_type_args(raw)
    try:
        return type_class(*args, **kwargs)
    except Exception:
        try:
            return type_class()
        except Exception:
            return sqltypes.NullType()


def _parse_type_args(raw: str) -> tuple[list, dict]:
    if "(" not in raw or not raw.rstrip().endswith(")"):
        return [], {}
    body = raw[raw.index("(") + 1 : raw.rindex(")")].strip()
    if not body:
        return [], {}
    parts = [p.strip() for p in body.split(",")]
    nums: list[int] = []
    for p in parts:
        if not p.isdigit():
            return [], {}
        nums.append(int(p))
    return nums, {}


def _strip_logical_qualifier(expression: str | None, logical_table: str | None) -> str | None:
    """Drop the leading ``logical_table.`` prefix from raw Snowflake semantic
    expressions so the column description reads ``c_region``, not
    ``customers.c_region`` — the qualifier is already carried on
    ``Logical table:`` separately."""
    if not expression or not logical_table:
        return expression
    prefix = f"{logical_table.lower()}."
    lowered = expression.lower()
    idx = 0
    result_chars: list[str] = []
    while idx < len(expression):
        remaining_lower = lowered[idx:]
        if remaining_lower.startswith(prefix):
            idx += len(prefix)
            continue
        result_chars.append(expression[idx])
        idx += 1
    return "".join(result_chars)


def _build_description(
    *,
    kinds: list[str],
    logical_table: str | None,
    expression: str | None,
    synonyms: str | None,
    comment: str | None,
) -> str:
    parts = [f"[{', '.join(kinds)}]"]
    if logical_table:
        parts.append(f"Logical table: {logical_table}.")
    if expression:
        parts.append(f"Expression: {expression}.")
    if synonyms:
        parts.append(f"Synonyms: {synonyms}.")
    if comment:
        parts.append(comment)
    return " ".join(parts)
