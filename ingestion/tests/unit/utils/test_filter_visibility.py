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
"""Tests for filter_visibility helpers used across connector base classes."""

import logging

import pytest

from metadata.ingestion.api.status import Status
from metadata.utils.filter_visibility import (
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


def test_log_filtered_stores_rich_reason_on_status(status, logger, caplog):
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_filtered(
            logger,
            status,
            "Database",
            "BACKUP_DB",
            matched_against="service.BACKUP_DB",
            use_fqn_for_filtering=True,
        )

    assert len(status.filtered) == 1
    name, reason = next(iter(status.filtered[0].items()))
    assert name == "BACKUP_DB"
    assert reason.startswith("Database Filtered Out: ")
    assert "did not pass databaseFilterPattern" in reason
    assert "matched against 'service.BACKUP_DB'" in reason
    assert "useFqnForFiltering=True" in reason


def test_log_filtered_omits_matched_against_when_same_as_name(status, logger, caplog):
    with caplog.at_level(logging.INFO, logger=logger.name):
        log_filtered(logger, status, "Schema", "TEMP", matched_against="TEMP")

    name, reason = next(iter(status.filtered[0].items()))
    assert name == "TEMP"
    assert "matched against" not in reason


def test_log_filtered_works_with_minimal_args(status, logger, caplog):
    with caplog.at_level(logging.INFO, logger=logger.name):
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
