import math
from unittest.mock import patch

import sqlalchemy as sqa
from pytest import fixture

# Ensure the DependencyContainer is initialized in every pytest-xdist worker.
# metadata/__init__.py registers critical singletons (MetricRegistry, SourceLoader,
# ProfilerResolver, etc.) into the DependencyContainer.  Without this import, xdist
# workers whose first collected test only imports sub-modules may never trigger
# __init__.py, causing @inject-decorated functions to raise DependencyNotFoundError.
import metadata  # noqa: F401

# Prevent unit tests from connecting to the OpenMetadata server.
# There are two code paths that trigger HTTP calls to localhost:8585:
#   1. OpenMetadata.__init__() → validate_versions() → GET /system/version
#   2. create_ometa_client() → health_check() → GET /system/version
# Unit tests don't need either — they test transformation logic.
# TODO: Once topology/workflow/profiler tests are migrated from TestCase to pytest,
#       replace these with a session-scoped fixture.
_mock_validate = patch(
    "metadata.ingestion.ometa.ometa_api.OpenMetadata.validate_versions"
)
_mock_validate.start()

_mock_health = patch("metadata.ingestion.ometa.ometa_api.OpenMetadata.health_check")
_mock_health.start()


@fixture(scope="session")
def worker_id(request):
    """Fallback worker_id fixture for when pytest-xdist is not installed.

    When xdist is active, request.config.workerinput contains the worker id.
    Otherwise, return "master" (single-process mode).
    """
    if hasattr(request.config, "workerinput"):
        return request.config.workerinput["workerid"]
    return "master"


@fixture(scope="session", autouse=True)
def register_sqlite_math_functions():
    """
    Register custom math functions for SQLite used in unit tests.

    SQLite doesn't have built-in SQRT function, so we register Python's math.sqrt
    to make it available for all SQLite connections in tests.

    This runs automatically for all unit tests (autouse=True) and only once
    per test session (scope="session").
    """

    def safe_sqrt(x):
        """
        Safe square root that handles floating-point precision issues.

        When computing variance using AVG(x*x) - AVG(x)*AVG(x), floating-point
        precision can result in slightly negative values (e.g., -1e-15) when
        the true variance is zero. This function treats near-zero negative
        values as zero, matching the behavior in stddev.py:254-256.
        """
        if x is None:
            return None
        if x < 0:
            if abs(x) < 1e-10:
                return 0.0
            raise ValueError(f"Cannot compute square root of negative number: {x}")
        return math.sqrt(x)

    @sqa.event.listens_for(sqa.engine.Engine, "connect")
    def register_functions(dbapi_conn, connection_record):
        if "sqlite" in str(type(dbapi_conn)):
            dbapi_conn.create_function("SQRT", 1, safe_sqrt)

    yield

    # Clean up event listener after tests
    sqa.event.remove(sqa.engine.Engine, "connect", register_functions)


def pytest_pycollect_makeitem(collector, name, obj):
    try:
        if obj.__name__ in ("TestSuiteSource", "TestSuiteInterfaceFactory"):
            return []
        if obj.__base__.__name__ in ("BaseModel", "Enum"):
            return []
    except AttributeError:
        pass
