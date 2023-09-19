"""Module fixture for data quality e2e tests"""


import pytest
from playwright.sync_api import Browser, expect

from ingestion.tests.e2e.configs.common import create_user
from ingestion.tests.e2e.configs.users.admin import Admin

TIMEOUT = 60000
BASE_URL = "http://localhost:8585"
expect.set_options(timeout=TIMEOUT)


def context(context):
    """Set default timeout for playwright context"""
    context.set_default_timeout(TIMEOUT)
    yield context
    context.close()


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """override default browser context args"""
    return {
        **browser_context_args,
        "base_url": BASE_URL,
        "java_script_enabled": True,
    }


@pytest.fixture(scope="session")
def create_data_consumer_user(browser: Browser):
    """Create a data consumer user"""
    context_ = browser.new_context(
        base_url=BASE_URL,
        java_script_enabled=True,
    )
    page = context_.new_page()
    page.goto("/")
    Admin().login(page)
    data_consumer = create_user(
        page, "data-consumer@example.com", "Data Consumer User", "Data Consumer"
    )
    yield data_consumer
    data_consumer.delete(page)
    context_.close()
