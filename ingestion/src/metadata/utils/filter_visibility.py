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
Centralized helpers for logging connector filter visibility.

When users don't see an entity after ingestion (database, schema, table,
dashboard, pipeline, topic, container, mlmodel), they need to be able to
distinguish:

  1. Source-side permissions — the connecting user can't see the object
  2. Filter config — includes/excludes patterns removed it

These helpers emit a consistent "discovered → filtered → kept" trail across
every connector family and end each step with a single FILTER VISIBILITY
REPORT block. The report is the diagnostic anchor: one log block, easy to
grep ("FILTER VISIBILITY REPORT"), containing exactly the information that
isn't derivable from elsewhere.

Memory profile: we deliberately store only the *diff* — discovered count
(int) plus the names of items the filter rejected (plus their reasons).
Visible names and kept names are not stored; they're derivable as counts
and the kept items show up in normal ingestion logs / Status.records.
"""

import logging
from typing import Iterable  # noqa: UP035

from metadata.ingestion.api.status import Status

REPORT_HEADER_PREFIX = "FILTER VISIBILITY REPORT"
_REASON_SUFFIX = "Filtered Out"


def log_discovered(
    logger: logging.Logger,
    status: Status,
    entity_type: str,
    names: Iterable[str],
) -> None:
    """Log the count of entities visible from the source before any filter
    is applied, and record the count on Status so the end-of-step report
    can compute discovered vs. kept. Names are emitted at DEBUG only — the
    actionable diff (what got filtered) lives in log_filtered + the
    end-of-step report; the full visible list would explode logs on large
    catalogs without adding actionable information."""
    name_list = list(names)
    count = len(name_list)
    status.record_discovered(entity_type, count)
    logger.info(
        "Discovered %d %s(s) visible to the ingestion user",
        count,
        entity_type.lower(),
    )
    logger.debug(
        "%s(s) visible to the ingestion user: %s",
        entity_type,
        name_list,
    )


def log_filtered(
    logger: logging.Logger,
    status: Status,
    entity_type: str,
    name: str,
    *,
    matched_against: str | None = None,
    use_fqn_for_filtering: bool | None = None,
) -> None:
    """Log a filter-pattern rejection and record it on Status. The
    reason string stored on Status is rich enough that the end-of-step
    report can reproduce the full diagnostic (which pattern field,
    what was matched against, whether FQN filtering was on) without
    needing to retain any extra state."""
    pattern_field = _pattern_field(entity_type)
    detail_parts = [f"did not pass {pattern_field}"]
    if matched_against is not None and matched_against != name:
        detail_parts.append(f"matched against '{matched_against}'")
    if use_fqn_for_filtering is not None:
        detail_parts.append(f"useFqnForFiltering={use_fqn_for_filtering}")
    detail = ", ".join(detail_parts)

    logger.info("Filtering out %s '%s': %s", entity_type.lower(), name, detail)
    reason = f"{entity_type} {_REASON_SUFFIX}: {detail}"
    status.filter(name, reason)


def log_step_summary(
    logger: logging.Logger,
    status: Status,
    source_name: str,
) -> None:
    """Emit the end-of-step FILTER VISIBILITY REPORT. One log block,
    framed with grep-friendly markers, listing per entity type:
        - count visible to the ingestion user
        - count + names + reasons of everything the filter dropped
        - count that will be published to OpenMetadata
    No-op when there's nothing to report (e.g., a sink-only step)."""
    by_type = _group_filtered_by_entity_type(status)
    entity_types = sorted(set(status.discovered_counts) | set(by_type))
    if not entity_types:
        return

    border = "=" * 70
    lines = [
        "",
        border,
        f" {REPORT_HEADER_PREFIX}: {source_name}",
        border,
    ]
    for entity_type in entity_types:
        lines.extend(_format_entity_section(status, entity_type, by_type.get(entity_type, [])))
    lines.append(border)
    logger.info("\n".join(lines))


def _format_entity_section(
    status: Status,
    entity_type: str,
    filtered_entries: list[tuple[str, str]],
) -> list[str]:
    """Format a single entity type's section of the report. Visible and
    kept are counts only; filtered shows every name + the reason it was
    rejected so the user can diff against their own filterPattern config."""
    pattern_field = _pattern_field(entity_type)
    discovered = status.discovered_counts.get(entity_type)
    filtered_count = len(filtered_entries)
    section = ["", f"{entity_type} ({pattern_field}):"]

    if discovered is not None:
        section.append(f"  Visible to ingestion user: {discovered}")
    section.append(f"  Filtered out ({filtered_count}):")
    if filtered_entries:
        max_name_width = max(len(name) for name, _ in filtered_entries)
        name_pad = min(max_name_width, 50)
        for name, reason in filtered_entries:
            detail = reason.split(": ", 1)[1] if ": " in reason else reason
            section.append(f"    {name:<{name_pad}}  → {detail}")
    if discovered is not None:
        kept = discovered - filtered_count
        section.append(f"  Will be published to OpenMetadata: {kept}")

    return section


def _group_filtered_by_entity_type(status: Status) -> dict[str, list[tuple[str, str]]]:
    """Walk Status.filtered (the existing project-wide accumulator) and
    bucket entries by entity type, parsed from the reason string this
    module wrote. Entries whose reason doesn't follow our convention
    (legacy callers of status.filter) are skipped, not guessed at."""
    by_type: dict[str, list[tuple[str, str]]] = {}
    for entry in status.filtered:
        for name, reason in entry.items():
            entity_type = _entity_type_from_reason(reason)
            if entity_type:
                by_type.setdefault(entity_type, []).append((name, reason))
    return by_type


def _pattern_field(entity_type: str) -> str:
    """Map 'Database' -> 'databaseFilterPattern', preserving the same field
    name connectors use in their YAML config so log messages are
    grep-actionable against the user's config."""
    return f"{entity_type[0].lower()}{entity_type[1:]}FilterPattern"


def _entity_type_from_reason(reason: str) -> str | None:
    """Inverse of the reason string built in log_filtered. Looks for the
    ' Filtered Out' marker so it works for both legacy reasons
    ('Database Filtered Out') and the enriched form
    ('Database Filtered Out: did not pass databaseFilterPattern...')."""
    marker = f" {_REASON_SUFFIX}"
    idx = reason.find(marker)
    if idx > 0:
        return reason[:idx]
    return None
