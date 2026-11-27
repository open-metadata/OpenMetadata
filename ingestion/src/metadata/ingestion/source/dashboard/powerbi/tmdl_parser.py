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
"""
Pure-Python Tabular Model Definition Language (TMDL) parser for Power BI.

Exposes both directory-based (`parse_tmdl_directory`) and in-memory
(`parse_tmdl_files`) entry points returning OpenMetadata's `DataModelSchema` IR.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from metadata.ingestion.source.dashboard.powerbi.models import (
    ConnectionFile,
    DataModelSchema,
    DatasetExpression,
    PowerBiColumns,
    PowerBiMeasures,
    PowerBIPartition,
    PowerBiRelationship,
    PowerBiTable,
    PowerBITableSource,
    RemoteArtifacts,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

_TAB_SIZE = 4
_TRIPLE_BACKTICK = "```"
_SEMANTIC_MODEL_SUFFIX = ".semanticmodel"
_REPORT_SUFFIX = ".report"

_OBJECT_PROPERTY_KEYWORDS: dict[str, frozenset[str]] = {
    "measure": frozenset(
        {
            "formatstring",
            "displayfolder",
            "lineagetag",
            "description",
            "ishidden",
            "isprivate",
            "expression",
            "changedproperty",
            "annotation",
            "extendedproperty",
        }
    ),
    "column": frozenset(
        {
            "datatype",
            "formatstring",
            "sourcecolumn",
            "summarizeby",
            "sortbycolumn",
            "datacategory",
            "displayfolder",
            "lineagetag",
            "description",
            "ishidden",
            "iskey",
            "isnullable",
            "isnameinferred",
            "isdatatypeinferred",
            "isavailableinmdx",
            "isdefaultlabel",
            "isdefaultimage",
            "isunique",
            "expression",
            "variation",
            "changedproperty",
            "annotation",
            "extendedproperty",
        }
    ),
    "expression": frozenset(
        {
            "lineagetag",
            "querygroup",
            "description",
            "resulttype",
            "expression",
            "changedproperty",
            "annotation",
            "extendedproperty",
        }
    ),
}


@dataclass
class _ParsedPartition:
    name: str
    partition_type: str = ""
    mode: str | None = None
    expression: str | None = None


@dataclass
class _ParsedTable:
    name: str
    description: str | None = None
    columns: list[PowerBiColumns] = field(default_factory=list)
    measures: list[PowerBiMeasures] = field(default_factory=list)
    partitions: list[_ParsedPartition] = field(default_factory=list)


@dataclass
class _ParseContext:
    tables: list[_ParsedTable] = field(default_factory=list)
    expressions: list[DatasetExpression] = field(default_factory=list)
    relationships: list[PowerBiRelationship] = field(default_factory=list)
    database_name: str | None = None


def _indent_width(line: str) -> int:
    """Measure leading indentation width, treating tabs as `_TAB_SIZE`-column stops."""
    leading = line[: len(line) - len(line.lstrip(" \t"))]
    return len(leading.expandtabs(_TAB_SIZE))


def _dedent_lines(lines: list[str]) -> str:
    """Strip common leading indentation width while preserving inner string literals."""
    non_empty_indents = [_indent_width(line) for line in lines if line.strip()]
    if not non_empty_indents:
        return ""
    min_indent = min(non_empty_indents)
    result: list[str] = []
    for line in lines:
        if not line.strip():
            result.append("")
            continue
        leading_len = len(line) - len(line.lstrip(" \t"))
        expanded_leading = line[:leading_len].expandtabs(_TAB_SIZE)
        trimmed_leading = expanded_leading[min_indent:] if len(expanded_leading) >= min_indent else ""
        result.append(trimmed_leading + line[leading_len:])
    return "\n".join(result).strip("\n")


def _parse_identifier(text: str, *, stop_at_equals: bool = True) -> tuple[str, str]:
    """Parse a TMDL identifier (unquoted or single-quoted with `''` unescaping).

    Returns `(name, remainder)` where `remainder` is stripped of leading whitespace.
    """
    s = text.lstrip(" \t")
    if not s:
        return "", ""
    if s.startswith("'"):
        chars: list[str] = []
        i = 1
        n = len(s)
        while i < n:
            ch = s[i]
            if ch == "'":
                if i + 1 < n and s[i + 1] == "'":
                    chars.append("'")
                    i += 2
                    continue
                return "".join(chars), s[i + 1 :].strip()
            chars.append(ch)
            i += 1
        return "".join(chars), ""

    if stop_at_equals and "=" in s:
        name_part, rest = s.split("=", 1)
        return name_part.strip(), f"={rest}".strip()
    return s.strip(), ""


def _parse_bool(value: str) -> bool | None:
    lowered = value.strip().lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    return None


def _is_object_property_line(stripped: str, owner_kind: str) -> bool:
    """Check whether a line at an object's indent level starts a known TMDL property/sub-block."""
    if stripped.startswith("///"):
        return True
    allowed = _OBJECT_PROPERTY_KEYWORDS.get(owner_kind)
    if not allowed:
        return False
    if ":" in stripped:
        key = stripped.split(":", 1)[0].strip().lower()
        return key in allowed
    first_token = stripped.split(None, 1)[0].lower()
    return first_token in allowed


def _read_backtick_block(lines: list[str], start_idx: int, inline_after_ticks: str) -> tuple[str, int]:
    """Read a triple-backtick verbatim expression block starting at `start_idx`."""
    if _TRIPLE_BACKTICK in inline_after_ticks:
        content, _ = inline_after_ticks.split(_TRIPLE_BACKTICK, 1)
        return content.strip(), start_idx

    collected: list[str] = []
    if inline_after_ticks.strip():
        collected.append(inline_after_ticks)
    idx = start_idx
    n = len(lines)
    while idx < n:
        raw_line = lines[idx]
        if raw_line.strip() == _TRIPLE_BACKTICK:
            return _dedent_lines(collected), idx + 1
        collected.append(raw_line)
        idx += 1
    return _dedent_lines(collected), idx


def _read_expression_value(
    lines: list[str],
    next_idx: int,
    header_indent: int,
    after_equals: str,
    *,
    is_object_expr: bool,
    owner_kind: str = "",
) -> tuple[str, int]:
    """Read an inline, multi-line indented, or triple-backtick expression following `=`."""
    trimmed = after_equals.strip()
    if trimmed.startswith(_TRIPLE_BACKTICK):
        return _read_backtick_block(lines, next_idx, trimmed[len(_TRIPLE_BACKTICK) :])

    if trimmed:
        return trimmed, next_idx

    n = len(lines)
    idx = next_idx
    # Skip leading blank lines only if a deeper-indented expression body actually follows.
    probe = idx
    while probe < n and not lines[probe].strip():
        probe += 1
    if probe >= n:
        return "", next_idx

    first_line = lines[probe]
    first_indent = _indent_width(first_line)
    if first_indent <= header_indent:
        return "", next_idx

    first_stripped = first_line.strip()
    if first_stripped.startswith(_TRIPLE_BACKTICK):
        return _read_backtick_block(lines, probe + 1, first_stripped[len(_TRIPLE_BACKTICK) :])

    expr_base_indent = first_indent
    collected: list[str] = []
    pending_blanks: list[str] = []
    idx = probe

    while idx < n:
        raw_line = lines[idx]
        stripped = raw_line.strip()
        if not stripped:
            pending_blanks.append("")
            idx += 1
            continue

        line_indent = _indent_width(raw_line)
        if is_object_expr:
            if line_indent < expr_base_indent:
                break
            if line_indent == expr_base_indent and collected and _is_object_property_line(stripped, owner_kind):
                break
        elif line_indent <= header_indent:
            break

        if pending_blanks:
            collected.extend(pending_blanks)
            pending_blanks.clear()
        collected.append(raw_line)
        idx += 1

    # Step back before trailing blank lines so doc-comment clearing sees them cleanly.
    end_idx = idx - len(pending_blanks)
    return _dedent_lines(collected), end_idx


_RELATIONSHIP_STR_FIELDS: dict[str, str] = {
    "fromcolumn": "fromColumn",
    "tocolumn": "toColumn",
    "fromcardinality": "fromCardinality",
    "tocardinality": "toCardinality",
    "crossfilteringbehavior": "crossFilteringBehavior",
}


def _apply_bool_flag(obj: Any, attr: str, value: str | None) -> None:
    parsed = True if value is None else _parse_bool(value)
    if parsed is not None:
        setattr(obj, attr, parsed)


def _apply_property(
    owner_kind: str,
    owner_obj: Any,
    key: str,
    value: str | None,
) -> None:
    """Apply a parsed `key: value` or bare boolean flag to the active TMDL object."""
    key_lower = key.lower()
    if owner_kind == "table" and key_lower == "description" and value is not None:
        owner_obj.description = value
    elif owner_kind == "column":
        if key_lower == "datatype" and value is not None:
            owner_obj.dataType = value
        elif key_lower == "description" and value is not None:
            owner_obj.description = value
        elif key_lower == "ishidden":
            _apply_bool_flag(owner_obj, "isHidden", value)
    elif owner_kind == "measure":
        if key_lower == "formatstring" and value is not None:
            owner_obj.formatString = value
        elif key_lower == "description" and value is not None:
            owner_obj.description = value
        elif key_lower == "ishidden":
            _apply_bool_flag(owner_obj, "isHidden", value)
    elif owner_kind == "partition" and key_lower == "mode" and value is not None:
        owner_obj.mode = value
    elif owner_kind == "relationship":
        if key_lower == "isactive":
            _apply_bool_flag(owner_obj, "isActive", value)
        elif value is not None and key_lower in _RELATIONSHIP_STR_FIELDS:
            setattr(owner_obj, _RELATIONSHIP_STR_FIELDS[key_lower], value)


def _parse_tmdl_document(content: str, ctx: _ParseContext) -> None:  # noqa: C901
    """Parse a single TMDL document into `ctx` using an indentation-aware state machine."""
    lines = content.lstrip("\ufeff").splitlines()
    # Stack items: (indent_width, kind, object)
    stack: list[tuple[int, str, Any]] = []
    pending_docs: list[str] = []

    idx = 0
    n = len(lines)
    while idx < n:
        raw_line = lines[idx]
        stripped = raw_line.strip()
        if not stripped:
            pending_docs.clear()
            idx += 1
            continue

        if stripped.startswith("///"):
            doc_text = stripped[4:] if stripped.startswith("/// ") else stripped[3:]
            pending_docs.append(doc_text)
            idx += 1
            continue

        indent = _indent_width(raw_line)
        while stack and stack[-1][0] >= indent:
            stack.pop()

        parent_kind = stack[-1][1] if stack else "root"
        parent_obj = stack[-1][2] if stack else None

        if parent_kind == "ignored":
            pending_docs.clear()
            idx += 1
            continue

        first_token, _, rest_after_token = stripped.partition(" ")
        if "\t" in first_token:
            first_token, _, rest_after_token = stripped.partition("\t")
        token_lower = first_token.lower()

        # Check object declarations (never triggered by `key: value` properties like `column: Year`).
        is_property_colon = first_token.endswith(":")

        if not is_property_colon and parent_kind in ("root", "model"):
            if token_lower == "database":
                db_name, _ = _parse_identifier(rest_after_token, stop_at_equals=False)
                if db_name:
                    ctx.database_name = db_name
                pending_docs.clear()
                stack.append((indent, "database", None))
                idx += 1
                continue

            if token_lower == "model":
                pending_docs.clear()
                stack.append((indent, "model", None))
                idx += 1
                continue

            if token_lower == "table" and rest_after_token.strip():
                doc = "\n".join(pending_docs) if pending_docs else None
                pending_docs.clear()
                table_name, _ = _parse_identifier(rest_after_token, stop_at_equals=False)
                table_obj = _ParsedTable(name=table_name, description=doc)
                ctx.tables.append(table_obj)
                stack.append((indent, "table", table_obj))
                idx += 1
                continue

            if token_lower == "expression" and rest_after_token.strip():
                pending_docs.clear()
                expr_name, remainder = _parse_identifier(rest_after_token, stop_at_equals=True)
                expr_value: str | None = None
                next_idx = idx + 1
                if remainder.startswith("="):
                    expr_value, next_idx = _read_expression_value(
                        lines,
                        next_idx,
                        indent,
                        remainder[1:],
                        is_object_expr=True,
                        owner_kind="expression",
                    )
                expr_obj = DatasetExpression(name=expr_name, expression=expr_value or None)
                ctx.expressions.append(expr_obj)
                stack.append((indent, "expression", expr_obj))
                idx = next_idx
                continue

            if token_lower == "relationship" and rest_after_token.strip():
                pending_docs.clear()
                rel_name, _ = _parse_identifier(rest_after_token, stop_at_equals=False)
                rel_obj = PowerBiRelationship(name=rel_name)
                ctx.relationships.append(rel_obj)
                stack.append((indent, "relationship", rel_obj))
                idx += 1
                continue

            if token_lower in (
                "ref",
                "role",
                "perspective",
                "cultureinfo",
                "querygroup",
                "annotation",
                "extendedproperty",
                "changedproperty",
            ):
                pending_docs.clear()
                stack.append((indent, "ignored", None))
                idx += 1
                continue

        if not is_property_colon and parent_kind == "table" and isinstance(parent_obj, _ParsedTable):
            if token_lower == "column" and rest_after_token.strip():
                doc = "\n".join(pending_docs) if pending_docs else None
                pending_docs.clear()
                col_name, remainder = _parse_identifier(rest_after_token, stop_at_equals=True)
                col_type: str | None = None
                next_idx = idx + 1
                if remainder.startswith("="):
                    col_type = "calculated"
                    _, next_idx = _read_expression_value(
                        lines,
                        next_idx,
                        indent,
                        remainder[1:],
                        is_object_expr=True,
                        owner_kind="column",
                    )
                col_obj = PowerBiColumns(name=col_name, columnType=col_type, description=doc)
                parent_obj.columns.append(col_obj)
                stack.append((indent, "column", col_obj))
                idx = next_idx
                continue

            if token_lower == "measure" and rest_after_token.strip():
                doc = "\n".join(pending_docs) if pending_docs else None
                pending_docs.clear()
                measure_name, remainder = _parse_identifier(rest_after_token, stop_at_equals=True)
                measure_expr: str | None = None
                next_idx = idx + 1
                if remainder.startswith("="):
                    measure_expr, next_idx = _read_expression_value(
                        lines,
                        next_idx,
                        indent,
                        remainder[1:],
                        is_object_expr=True,
                        owner_kind="measure",
                    )
                measure_obj = PowerBiMeasures(
                    name=measure_name,
                    expression=measure_expr or None,
                    description=doc,
                )
                parent_obj.measures.append(measure_obj)
                stack.append((indent, "measure", measure_obj))
                idx = next_idx
                continue

            if token_lower == "partition" and rest_after_token.strip():
                pending_docs.clear()
                part_name, remainder = _parse_identifier(rest_after_token, stop_at_equals=True)
                part_type = remainder[1:].strip().lower() if remainder.startswith("=") else ""
                part_obj = _ParsedPartition(name=part_name, partition_type=part_type)
                parent_obj.partitions.append(part_obj)
                stack.append((indent, "partition", part_obj))
                idx += 1
                continue

            if token_lower in ("hierarchy", "calculationgroup", "annotation", "extendedproperty", "changedproperty"):
                pending_docs.clear()
                stack.append((indent, "ignored", None))
                idx += 1
                continue

        # Sub-blocks inside column/measure/partition/expression/relationship
        if not is_property_colon and token_lower in ("variation", "annotation", "extendedproperty", "changedproperty"):
            pending_docs.clear()
            stack.append((indent, "ignored", None))
            idx += 1
            continue

        # Property expressions (`source = ...` inside partition, `expression = ...` inside measure/expression)
        pending_docs.clear()
        if not is_property_colon and "=" in stripped:
            prop_key, prop_rest = stripped.split("=", 1)
            prop_key_lower = prop_key.strip().lower()
            if parent_kind == "partition" and prop_key_lower == "source" and isinstance(parent_obj, _ParsedPartition):
                expr_text, next_idx = _read_expression_value(
                    lines,
                    idx + 1,
                    indent,
                    prop_rest,
                    is_object_expr=False,
                )
                parent_obj.expression = expr_text or None
                idx = next_idx
                continue
            if (
                parent_kind in ("measure", "expression")
                and prop_key_lower == "expression"
                and isinstance(parent_obj, (PowerBiMeasures, DatasetExpression))
            ):
                expr_text, next_idx = _read_expression_value(
                    lines,
                    idx + 1,
                    indent,
                    prop_rest,
                    is_object_expr=False,
                )
                parent_obj.expression = expr_text or None
                idx = next_idx
                continue

        # Direct Lake `entity` partition nested `source` block (no `=`)
        if parent_kind == "partition" and stripped.lower() == "source":
            stack.append((indent, "ignored", None))
            idx += 1
            continue

        # Standard `key: value` property or bare boolean flag
        if ":" in stripped:
            key_part, val_part = stripped.split(":", 1)
            _apply_property(parent_kind, parent_obj, key_part.strip(), val_part.strip())
        elif " " not in stripped and "\t" not in stripped:
            _apply_property(parent_kind, parent_obj, stripped, None)

        idx += 1


def _build_powerbi_table(parsed: _ParsedTable) -> PowerBiTable:
    """Convert an intermediate `_ParsedTable` to `PowerBiTable`, putting M sources first."""
    partitions: list[PowerBIPartition] = []
    m_sources: list[PowerBITableSource] = []
    other_sources: list[PowerBITableSource] = []

    for part in parsed.partitions:
        table_source = PowerBITableSource(expression=part.expression) if part.expression else None
        partitions.append(
            PowerBIPartition(
                name=part.name,
                mode=part.mode,
                source=table_source,
            )
        )
        if table_source is not None:
            if part.partition_type == "m":
                m_sources.append(table_source)
            else:
                other_sources.append(table_source)

    ordered_sources = m_sources + other_sources
    return PowerBiTable(
        name=parsed.name,
        description=parsed.description,
        columns=parsed.columns or None,
        measures=parsed.measures or None,
        partitions=partitions or None,
        source=ordered_sources or None,
    )


def _parse_platform_json(raw_text: str) -> tuple[str | None, str | None]:
    """Extract `(displayName, logicalId)` from a SemanticModel `.platform` file."""
    try:
        data = json.loads(raw_text.lstrip("\ufeff"))
    except (ValueError, TypeError) as exc:
        logger.debug("Skipping malformed .platform JSON: %s", exc)
        return None, None
    if not isinstance(data, dict):
        return None, None
    raw_metadata = data.get("metadata")
    metadata: dict[str, Any] = raw_metadata if isinstance(raw_metadata, dict) else {}
    artifact_type = metadata.get("type")
    if artifact_type and str(artifact_type).lower() != "semanticmodel":
        return None, None
    raw_config = data.get("config")
    config: dict[str, Any] = raw_config if isinstance(raw_config, dict) else {}
    display_name = metadata.get("displayName")
    logical_id = config.get("logicalId")
    return (
        str(display_name) if display_name else None,
        str(logical_id) if logical_id else None,
    )


def _parse_pbir_dataset_id(raw_text: str) -> str | None:
    """Extract `DatasetId` from a `.Report/definition.pbir` `byConnection` reference."""
    try:
        data = json.loads(raw_text.lstrip("\ufeff"))
    except (ValueError, TypeError) as exc:
        logger.debug("Skipping malformed definition.pbir JSON: %s", exc)
        return None
    if not isinstance(data, dict):
        return None
    dataset_ref = data.get("datasetReference")
    if not isinstance(dataset_ref, dict):
        return None
    by_conn = dataset_ref.get("byConnection")
    if not isinstance(by_conn, dict):
        return None
    dataset_id = by_conn.get("pbiModelDatabaseName") or by_conn.get("semanticModelId") or by_conn.get("datasetId")
    return str(dataset_id) if dataset_id else None


def _normalize_rel_path(path: str) -> str:
    normalized = path.replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    return normalized.lstrip("/")


def parse_tmdl_files(
    files: dict[str, str],
    *,
    model_name: str | None = None,
    logical_id: str | None = None,
    dataset_id: str | None = None,
) -> DataModelSchema | None:
    """Parse an in-memory map of relative file paths -> UTF-8 text into a `DataModelSchema`.

    Accepts `.tmdl` files (`database.tmdl`, `model.tmdl`, `expressions.tmdl`,
    `relationships.tmdl`, `tables/*.tmdl`), `.platform` JSON, and `definition.pbir`.
    """
    if not files:
        return None

    normalized = {_normalize_rel_path(k): v for k, v in files.items() if isinstance(v, str)}
    ctx = _ParseContext()
    platform_name: str | None = None
    platform_logical_id: str | None = None
    pbir_dataset_id: str | None = None

    for rel_path in sorted(normalized):
        lower_path = rel_path.lower()
        basename = lower_path.rsplit("/", 1)[-1]
        content = normalized[rel_path]

        if basename == ".platform":
            p_name, p_logical = _parse_platform_json(content)
            if p_name and not platform_name:
                platform_name = p_name
            if p_logical and not platform_logical_id:
                platform_logical_id = p_logical
        elif basename == "definition.pbir":
            found_id = _parse_pbir_dataset_id(content)
            if found_id and not pbir_dataset_id:
                pbir_dataset_id = found_id
        elif basename.endswith(".tmdl"):
            _parse_tmdl_document(content, ctx)

    tables = [_build_powerbi_table(t) for t in ctx.tables]
    if not tables and not ctx.expressions and not ctx.relationships:
        return None

    resolved_dataset_id = dataset_id or pbir_dataset_id
    connection_file = (
        ConnectionFile(RemoteArtifacts=[RemoteArtifacts(DatasetId=resolved_dataset_id)])
        if resolved_dataset_id
        else None
    )
    resolved_model_name = platform_name or model_name or ctx.database_name
    resolved_logical_id = logical_id or platform_logical_id

    return DataModelSchema(
        tables=tables or None,
        connectionFile=connection_file,
        modelName=resolved_model_name,
        logicalId=resolved_logical_id,
        expressions=ctx.expressions or None,
        relationships=ctx.relationships or None,
    )


def _read_text_file(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError) as exc:
        logger.warning("Skipping unreadable TMDL file %s: %s", path, exc)
        return None


def _find_sibling_pbir(semantic_model_dir: Path, folder_model_name: str | None) -> str | None:
    """Locate a sibling `*.Report/definition.pbir` referencing `semantic_model_dir`."""
    parent = semantic_model_dir.parent
    if not parent.is_dir():
        return None
    resolved_sm = semantic_model_dir.resolve()

    for candidate in sorted(parent.iterdir()):
        if not candidate.is_dir() or not candidate.name.lower().endswith(_REPORT_SUFFIX):
            continue
        pbir_path = candidate / "definition.pbir"
        if not pbir_path.is_file():
            continue
        raw_text = _read_text_file(pbir_path)
        if not raw_text:
            continue
        try:
            data = json.loads(raw_text.lstrip("\ufeff"))
        except (ValueError, TypeError):
            continue
        if not isinstance(data, dict):
            continue
        dataset_ref = data.get("datasetReference")
        if not isinstance(dataset_ref, dict):
            continue

        by_path = dataset_ref.get("byPath")
        if isinstance(by_path, dict) and by_path.get("path"):
            try:
                target = (candidate / str(by_path["path"])).resolve()
            except OSError:
                continue
            if target == resolved_sm:
                return raw_text
            continue

        report_stem = candidate.name[: -len(_REPORT_SUFFIX)]
        if folder_model_name and report_stem.lower() == folder_model_name.lower():
            return raw_text
    return None


def _collect_tmdl_files_from_dir(definition_dir: Path, prefix: str = "") -> dict[str, str]:
    collected: dict[str, str] = {}
    if not definition_dir.is_dir():
        return collected
    for entry in sorted(definition_dir.iterdir()):
        if entry.is_file() and entry.name.lower().endswith(".tmdl"):
            text = _read_text_file(entry)
            if text is not None:
                collected[f"{prefix}{entry.name}"] = text
    return collected


def parse_tmdl_directory(root_dir: Path) -> DataModelSchema | None:
    """Parse a local TMDL / PBIP SemanticModel directory into a `DataModelSchema`.

    Accepts a `*.SemanticModel` directory, a `definition/` directory, or a flat
    directory containing `.tmdl` files (`model.tmdl`, `database.tmdl`, `tables/*.tmdl`).
    """
    root_path = Path(root_dir)
    if not root_path.is_dir():
        return None

    if (root_path / "definition").is_dir():
        semantic_model_dir = root_path
        definition_dir = root_path / "definition"
    elif root_path.name.lower() == "definition":
        semantic_model_dir = root_path.parent
        definition_dir = root_path
    else:
        semantic_model_dir = root_path
        definition_dir = root_path

    folder_model_name = (
        semantic_model_dir.name[: -len(_SEMANTIC_MODEL_SUFFIX)]
        if semantic_model_dir.name.lower().endswith(_SEMANTIC_MODEL_SUFFIX)
        else None
    )

    files: dict[str, str] = {}
    platform_path = semantic_model_dir / ".platform"
    if platform_path.is_file():
        text = _read_text_file(platform_path)
        if text is not None:
            files[".platform"] = text

    files.update(_collect_tmdl_files_from_dir(definition_dir))
    files.update(_collect_tmdl_files_from_dir(definition_dir / "tables", prefix="tables/"))

    if semantic_model_dir != definition_dir or folder_model_name:
        pbir_text = _find_sibling_pbir(semantic_model_dir, folder_model_name)
        if pbir_text is not None:
            files["definition.pbir"] = pbir_text

    return parse_tmdl_files(files, model_name=folder_model_name)
