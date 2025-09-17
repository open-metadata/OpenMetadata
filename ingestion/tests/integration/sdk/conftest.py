"""
Minimal conftest for SDK integration tests.
Override the parent conftest to avoid testcontainers dependency.
"""
import pytest

from _openmetadata_testutils.ometa import int_admin_ometa


@pytest.fixture(scope="session")
def metadata():
    """Provide authenticated OpenMetadata client"""
    return int_admin_ometa()