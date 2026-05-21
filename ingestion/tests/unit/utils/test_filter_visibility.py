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
"""Tests for filter_visibility helpers used across connector base classes.

Three test groups:
  - Behavior: counts, reasons, report formatting, back-compat with legacy
    `Status.filter()` reason strings.
  - Bounded growth: per-entity-type cap on Status.filtered enforced by
    log_filtered; report annotates truncation; counts stay correct.
  - Resilience: helpers swallow all exceptions and never propagate them to
    the connector, even with bad inputs or a broken logger.
"""

import logging
from unittest.mock import MagicMock

import pytest

from metadata.ingestion.api.status import Status
from metadata.utils.filter_visibility import (
    MAX_FILTERED_ENTRIES_PER_TYPE,
    log_discovered,
    log_filtered,
    log_step_summary,
)


@pytest.fixture
def status() -> Status:
    return Status()


@pytest.fixture
def logger() -> logging.Logger:
    return logging.getLogger("test_filter_visibility")


# ---------------------------------------------------------------------------
# Behavior
# ---------------------------------------------------------------------------


def test_log_discovered_records_count_and_emits_info(status, logger, caplog):
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_discovered(logger, status, "Database", ["db1", "db2", "db3"])

    assert status.discovered_counts == {"Database": 3}
    assert any("Discovered 3 database(s) visible to the ingestion user" in r.message for r in caplog.records)


def test_log_discovered_emits_full_list_at_debug(status, logger, caplog):
    with caplog.at_level(logging.DEBUG, logger=logger.name):
        log_discovered(logger, status, "Schema", ["public", "internal"])

    debug_messages = [r.message for r in caplog.records if r.levelno == logging.DEBUG]
    assert any("public" in msg and "internal" in msg for msg in debug_messages)


def test_log_discovered_accumulates_across_calls(status, logger):
    log_discovered(logger, status, "Database", ["db1"])
    log_discovered(logger, status, "Database", ["db2", "db3"])

    assert status.discovered_counts == {"Database": 3}


def test_log_discovered_accepts_generator(status, logger):
    def gen():
        yield from ["a", "b"]

    log_discovered(logger, status, "Topic", gen())

    assert status.discovered_counts == {"Topic": 2}


def test_log_filtered_stores_rich_reason_on_status(status, logger):
    log_filtered(
        logger,
        status,
        "Database",
        "BACKUP_DB",
        matched_against="service.BACKUP_DB",
        use_fqn_for_filtering=True,
    )

    assert status.filtered_counts == {"Database": 1}
    assert len(status.filtered) == 1
    name, reason = next(iter(status.filtered[0].items()))
    assert name == "BACKUP_DB"
    assert reason.startswith("Database Filtered Out: ")
    assert "did not pass databaseFilterPattern" in reason
    assert "matched against 'service.BACKUP_DB'" in reason
    assert "useFqnForFiltering=True" in reason


def test_log_filtered_omits_matched_against_when_same_as_name(status, logger):
    log_filtered(logger, status, "Schema", "TEMP", matched_against="TEMP")

    name, reason = next(iter(status.filtered[0].items()))
    assert name == "TEMP"
    assert "matched against" not in reason


def test_log_filtered_works_with_minimal_args(status, logger):
    log_filtered(logger, status, "Topic", "noisy.topic")

    name, reason = next(iter(status.filtered[0].items()))
    assert name == "noisy.topic"
    assert reason == "Topic Filtered Out: did not pass topicFilterPattern"


def test_log_step_summary_emits_consolidated_report(status, logger, caplog):
    log_discovered(logger, status, "Database", ["a", "b", "c", "d"])
    log_discovered(logger, status, "Schema", ["s1", "s2", "s3"])
    log_filtered(logger, status, "Database", "a", matched_against="svc.a", use_fqn_for_filtering=True)
    log_filtered(logger, status, "Schema", "s1")
    log_filtered(logger, status, "Schema", "s2")

    caplog.clear()
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "snowflake")

    summary = "\n".join(r.message for r in caplog.records)
    assert "FILTER VISIBILITY REPORT: snowflake" in summary
    assert "Database (databaseFilterPattern):" in summary
    assert "Visible to ingestion user: 4" in summary
    assert "Filtered out (1):" in summary
    assert "Will be published to OpenMetadata: 3" in summary
    assert "a" in summary and "did not pass databaseFilterPattern" in summary
    assert "matched against 'svc.a'" in summary

    assert "Schema (schemaFilterPattern):" in summary
    assert "Visible to ingestion user: 3" in summary
    assert "Filtered out (2):" in summary
    assert "Will be published to OpenMetadata: 1" in summary


def test_log_step_summary_handles_filtered_without_discovered(status, logger, caplog):
    log_filtered(logger, status, "Pipeline", "p1")

    caplog.clear()
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "airflow")

    summary = "\n".join(r.message for r in caplog.records)
    assert "Pipeline (pipelineFilterPattern):" in summary
    assert "Filtered out (1):" in summary
    assert "p1" in summary


def test_log_step_summary_noop_when_nothing_to_report(status, logger, caplog):
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "empty_source")

    assert not caplog.records


def test_log_step_summary_skips_unrelated_filter_reasons(status, logger, caplog):
    log_discovered(logger, status, "Database", ["a", "b"])
    status.filter("x", "some other reason that is not from our helper")

    caplog.clear()
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "mixed")

    summary = "\n".join(r.message for r in caplog.records)
    assert "Visible to ingestion user: 2" in summary
    assert "Filtered out (0):" in summary
    assert "Will be published to OpenMetadata: 2" in summary
    assert "some other reason" not in summary


def test_log_step_summary_recognizes_legacy_reason_strings(status, logger, caplog):
    """status.filter() callers predating this helper (e.g., 'Database Filtered Out'
    without a trailing colon) must still be grouped into the right entity-type
    section of the report."""
    log_discovered(logger, status, "Database", ["a", "b"])
    status.filter("a", "Database Filtered Out")

    caplog.clear()
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "legacy")

    summary = "\n".join(r.message for r in caplog.records)
    assert "Database (databaseFilterPattern):" in summary
    assert "Filtered out (1):" in summary
    assert "Will be published to OpenMetadata: 1" in summary


# ---------------------------------------------------------------------------
# Bounded growth — per-entity-type cap
# ---------------------------------------------------------------------------


def test_log_filtered_caps_stored_names_but_preserves_count(status, logger):
    """Past the per-type cap, the true count keeps climbing but the
    name list stops growing — Status.filtered stays bounded."""
    for i in range(MAX_FILTERED_ENTRIES_PER_TYPE + 25):
        log_filtered(logger, status, "Table", f"table_{i}")

    assert status.filtered_counts["Table"] == MAX_FILTERED_ENTRIES_PER_TYPE + 25
    stored = [next(iter(entry.keys())) for entry in status.filtered]
    assert len(stored) == MAX_FILTERED_ENTRIES_PER_TYPE
    assert stored[0] == "table_0"
    assert stored[-1] == f"table_{MAX_FILTERED_ENTRIES_PER_TYPE - 1}"


def test_log_step_summary_annotates_truncation_when_cap_exceeded(status, logger, caplog):
    log_discovered(logger, status, "Table", [f"table_{i}" for i in range(MAX_FILTERED_ENTRIES_PER_TYPE + 200)])
    for i in range(MAX_FILTERED_ENTRIES_PER_TYPE + 200):
        log_filtered(logger, status, "Table", f"table_{i}")

    caplog.clear()
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "huge_catalog")

    summary = "\n".join(r.message for r in caplog.records)
    expected_total = MAX_FILTERED_ENTRIES_PER_TYPE + 200
    expected_overflow = 200
    assert f"Filtered out ({expected_total}):" in summary
    assert (
        f"... and {expected_overflow} more (full list truncated at cap of {MAX_FILTERED_ENTRIES_PER_TYPE})" in summary
    )
    # Kept math must use the TRUE count, not the stored count, or it would be wrong by 200
    assert "Will be published to OpenMetadata: 0" in summary


def test_log_filtered_per_type_cap_is_independent(status, logger):
    """Hitting the cap on one entity type must not affect another."""
    for i in range(MAX_FILTERED_ENTRIES_PER_TYPE + 5):
        log_filtered(logger, status, "Table", f"t_{i}")
    log_filtered(logger, status, "Schema", "tmp")

    stored_tables = [next(iter(e.keys())) for e in status.filtered if next(iter(e.values())).startswith("Table ")]
    stored_schemas = [next(iter(e.keys())) for e in status.filtered if next(iter(e.values())).startswith("Schema ")]
    assert len(stored_tables) == MAX_FILTERED_ENTRIES_PER_TYPE
    assert stored_schemas == ["tmp"]
    assert status.filtered_counts == {"Table": MAX_FILTERED_ENTRIES_PER_TYPE + 5, "Schema": 1}


# ---------------------------------------------------------------------------
# Resilience — observability must never propagate exceptions
# ---------------------------------------------------------------------------


def test_log_discovered_swallows_exceptions_from_logger(status):
    """Even a broken logger must not break ingestion."""
    broken_logger = MagicMock()
    broken_logger.info.side_effect = RuntimeError("logger blew up")

    log_discovered(broken_logger, status, "Database", ["db1", "db2"])

    # The count update happened before the failing info call, so it sticks
    assert status.discovered_counts == {"Database": 2}
    # Helper swallowed the exception and logged a warning on the same logger
    broken_logger.warning.assert_called_once()


def test_log_discovered_swallows_exceptions_from_bad_iterable(status, logger):
    """A connector returning a generator that raises mid-iteration must
    not crash the connector."""

    def exploding_generator():
        yield "ok_name"
        raise RuntimeError("source went away")

    log_discovered(logger, status, "Database", exploding_generator())  # must not raise


def test_log_filtered_swallows_exceptions(status):
    broken_logger = MagicMock()
    broken_logger.info.side_effect = RuntimeError("logger blew up")

    log_filtered(broken_logger, status, "Database", "BACKUP_DB")

    # filtered_counts updated before the failing info call, so it sticks
    assert status.filtered_counts == {"Database": 1}
    broken_logger.warning.assert_called_once()


def test_log_filtered_handles_weird_name_values(status, logger):
    """Bad names — None, empty, non-ASCII, control chars — must not crash."""
    # None as name; matched_against also None
    log_filtered(logger, status, "Table", None)  # type: ignore[arg-type]
    # Empty string
    log_filtered(logger, status, "Table", "")
    # Unicode
    log_filtered(logger, status, "Table", "日本語_table")
    # Control characters
    log_filtered(logger, status, "Table", "tab\there\nnewline")

    # All four counted, none crashed
    assert status.filtered_counts["Table"] == 4


def test_log_step_summary_swallows_exceptions(logger, caplog):
    """A corrupted Status (wrong type for filtered_counts) must not crash close()."""
    broken_status = Status()
    # Inject a value that breaks the report math: int where dict is expected
    broken_status.discovered_counts = "not a dict"  # type: ignore[assignment]

    with caplog.at_level(logging.WARNING, logger=logger.name):
        log_step_summary(logger, broken_status, "broken_source")  # must not raise

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert any("log_step_summary failed" in w.message for w in warnings)


def test_log_step_summary_handles_empty_status_gracefully(status, logger):
    """A source step that never called log_discovered / log_filtered should
    produce no report and no exception (covers sink-only steps)."""
    log_step_summary(logger, status, "no_op")  # must not raise


# ---------------------------------------------------------------------------
# Integration-style — minimal connector base class lifecycle
# ---------------------------------------------------------------------------


def test_end_to_end_helper_lifecycle_produces_correct_report(logger, caplog):
    """Simulate what a real connector's discover-filter-close cycle looks
    like — multiple databases, each with their own schemas and tables —
    and verify the report counts and per-entity-type breakdown end up
    correct after the streaming logs all fire."""
    status = Status()

    # Database-level: 5 visible, 2 filtered
    log_discovered(logger, status, "Database", ["db_a", "db_b", "db_c", "db_d", "db_e"])
    log_filtered(logger, status, "Database", "db_d", matched_against="svc.db_d", use_fqn_for_filtering=True)
    log_filtered(logger, status, "Database", "db_e", matched_against="svc.db_e", use_fqn_for_filtering=True)

    # Schemas: visited per kept database (3 dbs x 4 schemas), 1 filtered per db
    for db in ("db_a", "db_b", "db_c"):
        log_discovered(logger, status, "Schema", [f"{db}.public", f"{db}.audit", f"{db}.tmp", f"{db}.staging"])
        log_filtered(logger, status, "Schema", f"{db}.tmp")

    # Tables: per kept schema (3 dbs x 3 kept schemas x 5 tables), 0 filtered
    for db in ("db_a", "db_b", "db_c"):
        for schema in ("public", "audit", "staging"):
            log_discovered(logger, status, "Table", [f"{db}.{schema}.t{i}" for i in range(5)])

    caplog.clear()
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_step_summary(logger, status, "fake_source")

    summary = "\n".join(r.message for r in caplog.records)
    assert "FILTER VISIBILITY REPORT: fake_source" in summary
    # Database: 5 visible, 2 filtered, 3 kept
    assert "Database (databaseFilterPattern):" in summary
    assert "Visible to ingestion user: 5" in summary
    assert "Filtered out (2):" in summary
    # Schema: 3 dbs x 4 = 12 visible, 3 filtered, 9 kept
    assert "Schema (schemaFilterPattern):" in summary
    assert "Visible to ingestion user: 12" in summary
    assert "Filtered out (3):" in summary
    # Table: 3 x 3 x 5 = 45 visible, 0 filtered, 45 kept
    assert "Table (tableFilterPattern):" in summary
    assert "Visible to ingestion user: 45" in summary
    assert "Filtered out (0):" in summary
    assert "Will be published to OpenMetadata: 45" in summary


def test_end_to_end_close_lifecycle_with_broken_summary_does_not_raise(logger):
    """If log_step_summary somehow propagated (despite internal guard),
    the connector's close() wrappers must catch it. Simulate by calling
    log_step_summary on a Status with corrupted internals and asserting
    no exception escapes."""
    status = Status()
    status.discovered_counts = 12345  # type: ignore[assignment]

    log_step_summary(logger, status, "corrupted")  # must not raise
