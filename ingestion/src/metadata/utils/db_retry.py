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
Centralized database query retry decorator with exponential backoff and jitter.

Provides a @db_retry decorator for wrapping methods that execute SQL queries
against source databases during metadata ingestion. Retries only on transient
errors (e.g., statement_timeout, deadlocks) identified via SQLSTATE codes and
exception class names — no DB-driver imports required.
"""
import functools
import random
import time
from typing import Any, FrozenSet, Optional

from sqlalchemy.exc import DatabaseError, DBAPIError, OperationalError

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

TRANSIENT_SQLSTATES: FrozenSet[str] = frozenset(
    {
        "57014",  # query_canceled (statement_timeout)
        "57P01",  # admin_shutdown
        "40P01",  # deadlock_detected
        "40001",  # serialization_failure
        "08003",  # connection_does_not_exist
        "08006",  # connection_failure
        "08001",  # sqlclient_unable_to_establish_sqlconnection
    }
)

TRANSIENT_EXCEPTION_NAMES: FrozenSet[str] = frozenset(
    {
        "QueryCanceled",
        "DeadlockDetected",
        "SerializationFailure",
        "AdminShutdown",
    }
)


def is_transient_error(exc: Exception) -> bool:
    """Detect transient database errors via SQLSTATE, exception name, or
    connection invalidation state.

    Uses a three-layer detection strategy that avoids importing any specific
    DB driver (e.g., psycopg2):

    1. SQLSTATE code on the wrapped DBAPI exception (most reliable)
    2. Exception class name of the wrapped DBAPI exception
    3. SQLAlchemy's own connection_invalidated flag
    """
    orig = getattr(exc, "orig", None)
    if orig is not None:
        pgcode = getattr(orig, "pgcode", None)
        if pgcode and pgcode in TRANSIENT_SQLSTATES:
            return True
        if type(orig).__name__ in TRANSIENT_EXCEPTION_NAMES:
            return True

    if isinstance(exc, DBAPIError) and exc.connection_invalidated:
        return True

    return False


def _get_retry_config(source: Any) -> Optional[Any]:
    """Extract the queryRetryConfig from a source's source_config.

    Returns the config object if retry is enabled, None otherwise.
    Navigates source.source_config.queryRetryConfig safely via getattr
    to avoid AttributeError on sources that lack the field.
    """
    source_config = getattr(source, "source_config", None)
    if source_config is None:
        return None
    retry_config = getattr(source_config, "queryRetryConfig", None)
    if retry_config is None:
        return None
    if not getattr(retry_config, "enabled", False):
        return None
    return retry_config


def db_retry(func):
    """Decorator to retry database queries on transient errors.

    Expects the decorated method's first positional argument (``self``) to
    expose a ``source_config`` attribute containing an optional
    ``queryRetryConfig`` with ``enabled``, ``maxRetries``,
    ``initialBackoffSeconds``, and ``maxBackoffSeconds`` fields.

    When retry is disabled or the config is absent, the decorated function
    executes exactly once with zero overhead.
    """

    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        config = _get_retry_config(self)
        if config is None:
            return func(self, *args, **kwargs)

        max_retries = getattr(config, "maxRetries", 3)
        initial_backoff = getattr(config, "initialBackoffSeconds", 2.0)
        max_backoff = getattr(config, "maxBackoffSeconds", 30.0)
        max_attempts = max_retries + 1

        last_exc: Optional[Exception] = None
        for attempt in range(max_attempts):
            try:
                return func(self, *args, **kwargs)
            except (OperationalError, DatabaseError, DBAPIError) as exc:
                if not is_transient_error(exc):
                    raise
                last_exc = exc
                if attempt < max_retries:
                    backoff = min(
                        initial_backoff * (2**attempt),
                        max_backoff,
                    )
                    jitter = random.uniform(0, backoff * 0.1)
                    wait = backoff + jitter
                    logger.warning(
                        "Transient DB error in %s (attempt %d/%d), "
                        "retrying in %.2fs: %s",
                        func.__name__,
                        attempt + 1,
                        max_retries,
                        wait,
                        exc,
                    )
                    time.sleep(wait)
                else:
                    logger.error(
                        "Max retries (%d) exhausted for %s: %s",
                        max_retries,
                        func.__name__,
                        exc,
                    )
        raise last_exc  # type: ignore[misc]

    return wrapper
