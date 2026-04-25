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
Unit tests for metadata.utils.db_retry
"""
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import DatabaseError, DBAPIError, OperationalError

from metadata.utils.db_retry import (
    TRANSIENT_EXCEPTION_NAMES,
    TRANSIENT_SQLSTATES,
    _get_retry_config,
    db_retry,
    is_transient_error,
)

# ---------------------------------------------------------------------------
# Helpers to build realistic SQLAlchemy-wrapped exceptions
# ---------------------------------------------------------------------------


def _make_orig(pgcode=None, cls_name=None):
    """Build a fake DBAPI exception with optional pgcode and class name."""
    if cls_name:
        exc_type = type(cls_name, (Exception,), {})
    else:
        exc_type = type("GenericDBAPIError", (Exception,), {})
    orig = exc_type("transient failure")
    if pgcode is not None:
        orig.pgcode = pgcode
    return orig


def _make_operational_error(pgcode=None, cls_name=None):
    orig = _make_orig(pgcode=pgcode, cls_name=cls_name)
    return OperationalError("test", {}, orig)


def _make_database_error(pgcode=None, cls_name=None):
    orig = _make_orig(pgcode=pgcode, cls_name=cls_name)
    return DatabaseError("test", {}, orig)


def _make_source(enabled=True, max_retries=3, initial_backoff=0.01, max_backoff=0.05):
    """Build a mock source object with a queryRetryConfig on source_config."""
    retry_config = MagicMock()
    retry_config.enabled = enabled
    retry_config.maxRetries = max_retries
    retry_config.initialBackoffSeconds = initial_backoff
    retry_config.maxBackoffSeconds = max_backoff

    source = MagicMock()
    source.source_config.queryRetryConfig = retry_config
    return source


# ---------------------------------------------------------------------------
# is_transient_error
# ---------------------------------------------------------------------------


class TestIsTransientError:
    @pytest.mark.parametrize("pgcode", sorted(TRANSIENT_SQLSTATES))
    def test_transient_sqlstate_detected(self, pgcode):
        exc = _make_operational_error(pgcode=pgcode)
        assert is_transient_error(exc) is True

    @pytest.mark.parametrize("cls_name", sorted(TRANSIENT_EXCEPTION_NAMES))
    def test_transient_exception_name_detected(self, cls_name):
        exc = _make_operational_error(cls_name=cls_name)
        assert is_transient_error(exc) is True

    def test_non_transient_sqlstate_rejected(self):
        exc = _make_operational_error(pgcode="42P01")
        assert is_transient_error(exc) is False

    def test_non_transient_exception_name_rejected(self):
        exc = _make_operational_error(cls_name="UndefinedTable")
        assert is_transient_error(exc) is False

    def test_connection_invalidated_detected(self):
        orig = _make_orig()
        exc = DBAPIError("test", {}, orig, connection_invalidated=True)
        assert is_transient_error(exc) is True

    def test_connection_not_invalidated_rejected(self):
        orig = _make_orig()
        exc = DBAPIError("test", {}, orig, connection_invalidated=False)
        assert is_transient_error(exc) is False

    def test_plain_exception_rejected(self):
        assert is_transient_error(ValueError("unrelated")) is False

    def test_sqlstate_takes_priority_over_name(self):
        exc = _make_operational_error(pgcode="57014", cls_name="SomeOtherName")
        assert is_transient_error(exc) is True


# ---------------------------------------------------------------------------
# _get_retry_config
# ---------------------------------------------------------------------------


class TestGetRetryConfig:
    def test_returns_config_when_enabled(self):
        source = _make_source(enabled=True)
        result = _get_retry_config(source)
        assert result is not None
        assert result.enabled is True

    def test_returns_none_when_disabled(self):
        source = _make_source(enabled=False)
        assert _get_retry_config(source) is None

    def test_returns_none_when_no_source_config(self):
        source = MagicMock(spec=[])
        assert _get_retry_config(source) is None

    def test_returns_none_when_no_retry_config(self):
        source = MagicMock()
        source.source_config = MagicMock(spec=[])
        assert _get_retry_config(source) is None

    def test_returns_none_when_source_config_is_none(self):
        source = MagicMock()
        source.source_config = None
        assert _get_retry_config(source) is None


# ---------------------------------------------------------------------------
# @db_retry decorator
# ---------------------------------------------------------------------------


class TestDbRetryDecorator:
    def test_no_retry_when_disabled(self):
        source = _make_source(enabled=False)
        call_count = 0

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                nonlocal call_count
                call_count += 1
                return "ok"

        result = Service().fetch_data()
        assert result == "ok"
        assert call_count == 1

    def test_no_retry_when_config_missing(self):
        call_count = 0

        class Service:
            source_config = None

            @db_retry
            def fetch_data(self):
                nonlocal call_count
                call_count += 1
                return "ok"

        result = Service().fetch_data()
        assert result == "ok"
        assert call_count == 1

    @patch("metadata.utils.db_retry.time.sleep")
    def test_single_retry_success(self, mock_sleep):
        source = _make_source(max_retries=3, initial_backoff=0.01, max_backoff=0.05)
        call_count = 0

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    raise _make_operational_error(pgcode="57014")
                return "recovered"

        result = Service().fetch_data()
        assert result == "recovered"
        assert call_count == 2
        assert mock_sleep.call_count == 1

    @patch("metadata.utils.db_retry.time.sleep")
    def test_max_retries_exhausted(self, mock_sleep):
        source = _make_source(max_retries=2, initial_backoff=0.01, max_backoff=0.05)

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                raise _make_operational_error(pgcode="57014")

        with pytest.raises(OperationalError):
            Service().fetch_data()
        assert mock_sleep.call_count == 2

    def test_non_transient_error_not_retried(self):
        source = _make_source(max_retries=3)
        call_count = 0

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                nonlocal call_count
                call_count += 1
                raise _make_operational_error(pgcode="42P01")

        with pytest.raises(OperationalError):
            Service().fetch_data()
        assert call_count == 1

    def test_non_sqlalchemy_error_not_caught(self):
        source = _make_source(max_retries=3)

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                raise ValueError("unrelated")

        with pytest.raises(ValueError, match="unrelated"):
            Service().fetch_data()

    @patch("metadata.utils.db_retry.time.sleep")
    def test_exponential_backoff_values(self, mock_sleep):
        source = _make_source(max_retries=3, initial_backoff=1.0, max_backoff=10.0)

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                raise _make_operational_error(pgcode="40P01")

        with pytest.raises(OperationalError):
            Service().fetch_data()

        assert mock_sleep.call_count == 3
        for i, call in enumerate(mock_sleep.call_args_list):
            wait = call[0][0]
            base = min(1.0 * (2**i), 10.0)
            assert base <= wait <= base + base * 0.1

    @patch("metadata.utils.db_retry.time.sleep")
    def test_backoff_capped_at_max(self, mock_sleep):
        source = _make_source(max_retries=5, initial_backoff=10.0, max_backoff=15.0)

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                raise _make_operational_error(pgcode="57014")

        with pytest.raises(OperationalError):
            Service().fetch_data()

        for call in mock_sleep.call_args_list:
            wait = call[0][0]
            assert wait <= 15.0 + 15.0 * 0.1

    @patch("metadata.utils.db_retry.time.sleep")
    def test_database_error_retried(self, mock_sleep):
        source = _make_source(max_retries=2, initial_backoff=0.01, max_backoff=0.05)
        call_count = 0

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    raise _make_database_error(pgcode="40P01")
                return "recovered"

        result = Service().fetch_data()
        assert result == "recovered"
        assert call_count == 2

    @patch("metadata.utils.db_retry.time.sleep")
    def test_connection_invalidated_retried(self, mock_sleep):
        source = _make_source(max_retries=2, initial_backoff=0.01, max_backoff=0.05)
        call_count = 0

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    orig = _make_orig()
                    raise DBAPIError("test", {}, orig, connection_invalidated=True)
                return "recovered"

        result = Service().fetch_data()
        assert result == "recovered"
        assert call_count == 2

    def test_preserves_function_metadata(self):
        source = _make_source()

        class Service:
            source_config = source.source_config

            @db_retry
            def my_special_query(self):
                """Custom docstring."""
                return "ok"

        svc = Service()
        assert svc.my_special_query.__name__ == "my_special_query"
        assert svc.my_special_query.__doc__ == "Custom docstring."

    @patch("metadata.utils.db_retry.time.sleep")
    def test_passes_args_and_kwargs(self, mock_sleep):
        source = _make_source(max_retries=1, initial_backoff=0.01, max_backoff=0.05)
        call_count = 0

        class Service:
            source_config = source.source_config

            @db_retry
            def fetch_data(self, schema, table, limit=10):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    raise _make_operational_error(pgcode="57014")
                return (schema, table, limit)

        result = Service().fetch_data("public", "users", limit=50)
        assert result == ("public", "users", 50)
        assert call_count == 2
