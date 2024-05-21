import pytest

from .integration_base import int_admin_ometa
from testcontainers.core.config import testcontainers_config


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


def pytest_pycollect_makeitem(collector, name, obj):
    try:
        if obj.__base__.__name__ in ("BaseModel", "Enum"):
            return []
    except AttributeError:
        pass


@pytest.fixture(scope="session", autouse=True)
def config_testcontatiners():
    testcontainers_config.max_tries = 10
