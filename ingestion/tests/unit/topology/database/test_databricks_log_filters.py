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
Tests for the databricks.sql.session log filter helper.
"""

import logging

import pytest

from metadata.ingestion.source.database.databricks import log_filters
from metadata.ingestion.source.database.databricks.log_filters import (
    suppress_user_agent_entry_deprecation_log,
)

DATABRICKS_SESSION_LOGGER = "databricks.sql.session"


@pytest.fixture
def clean_logger():
    target = logging.getLogger(DATABRICKS_SESSION_LOGGER)
    original_filters = list(target.filters)
    original_level = target.level
    had_flag = hasattr(target, log_filters._FILTER_INSTALLED_FLAG)
    flag_value = getattr(target, log_filters._FILTER_INSTALLED_FLAG, None)

    target.filters = []
    if had_flag:
        delattr(target, log_filters._FILTER_INSTALLED_FLAG)

    yield target

    target.filters = original_filters
    target.setLevel(original_level)
    if had_flag:
        setattr(target, log_filters._FILTER_INSTALLED_FLAG, flag_value)
    elif hasattr(target, log_filters._FILTER_INSTALLED_FLAG):
        delattr(target, log_filters._FILTER_INSTALLED_FLAG)


def _emit(logger: logging.Logger, message: str) -> logging.LogRecord:
    return logger.makeRecord(logger.name, logging.WARNING, __file__, 0, message, None, None)


def test_filters_user_agent_entry_message(clean_logger):
    suppress_user_agent_entry_deprecation_log()

    record = _emit(
        clean_logger,
        "Parameter '_user_agent_entry' is deprecated, use 'user_agent_entry' instead",
    )

    assert clean_logger.filters, "Expected the suppression filter to be installed"
    assert all(f.filter(record) is False for f in clean_logger.filters)


def test_unrelated_warning_passes_through(clean_logger):
    suppress_user_agent_entry_deprecation_log()

    record = _emit(clean_logger, "Connection retry: attempt 2 of 3")

    assert all(f.filter(record) is True for f in clean_logger.filters)


def test_logger_level_is_not_modified(clean_logger):
    clean_logger.setLevel(logging.DEBUG)

    suppress_user_agent_entry_deprecation_log()

    assert clean_logger.level == logging.DEBUG


def test_helper_is_idempotent(clean_logger):
    suppress_user_agent_entry_deprecation_log()
    suppress_user_agent_entry_deprecation_log()
    suppress_user_agent_entry_deprecation_log()

    assert len(clean_logger.filters) == 1
