import pytest

from .integration_base import int_admin_ometa


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()
