import math

import sqlalchemy as sqa
from pytest import fixture


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


def pytest_collection_modifyitems(session, config, items):
    """Reorder test items to ensure certain files run last."""
    # List of test files that should run last
    last_files = [
        "test_dependency_injector.py",
        # Add other files that should run last here
    ]

    # Get all test items that should run last
    last_items = []
    other_items = []

    for item in items:
        if any(file in item.nodeid for file in last_files):
            last_items.append(item)
        else:
            other_items.append(item)

    # Reorder the items
    items[:] = other_items + last_items
