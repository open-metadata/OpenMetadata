"""Module fixture for data quality e2e tests"""


import pytest
from playwright.sync_api import Browser, expect, Page

from ingestion.tests.e2e.configs.common import create_user, go_to_service
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


@pytest.fixture(scope="function")
def admin_page_context(page: Page):
    page.goto("/")
    Admin().login(page)
    yield page
    page.close()


@pytest.fixture(scope="class")
def setUpClass(browser: Browser, request): # pylint: disable=invalid-name
    """set up class for ingestion pipelines"""
    context_ = browser.new_context(base_url=BASE_URL)
    page = context_.new_page()
    page.goto(f"{BASE_URL}/")
    Admin().login(page)

    connector_obj = request.param["connector_obj"]
    request.cls.connector_obj = connector_obj

    # create service and ingest metadata
    connector_obj.create_service_ingest_metadata(page)
    request.cls.service_name = connector_obj.service_name
    page.get_by_text("Ingestions").click()
    # Not best practice. Should use `expect`, though playwright does not have a `wait_until` function
    # we'll make a call to the API to get the pipeline status and check if it's success
    request.cls.metadata_ingestion_status = connector_obj.get_pipeline_status(
        f"{connector_obj.service_name}.{connector_obj.metadata_ingestion_pipeline_fqn}"
    )

    if connector_obj.supports_profiler_ingestion:
        connector_obj.create_profiler_workflow(page)
        go_to_service("Databases", page, connector_obj.service_name)
        page.get_by_text("Ingestions").click()

        # Not best practice. Should use `expect`, though playwright does not have a `wait_until` function
        # we'll make a call to the API to get the pipeline status and check if it's success
        request.cls.profiler_ingestion_status = connector_obj.get_pipeline_status(
            f"{connector_obj.service_name}.{connector_obj.profiler_ingestion_pipeline_fqn}"
        )
    else:
        request.cls.profiler_ingestion_status = None

    yield
    connector_obj.delete_service(page)
    context_.close()
