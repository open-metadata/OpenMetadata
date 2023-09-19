"""
Entity metadata tests. Scenarios tested:
    - 
"""
import re

import pytest
from playwright.sync_api import Page, expect

from ingestion.tests.e2e.configs.common import go_to_service
from ingestion.tests.e2e.configs.users.admin import Admin
from ingestion.tests.e2e.conftest import BASE_URL, TIMEOUT


@pytest.mark.order(1)
def test_assert_metadata_ingestion_status_success(redshift_connector, page: Page):
    """Assert that the ingestion status is success"""
    page.set_default_timeout(TIMEOUT)

    redshift_connector.create_service_ingest_metadata(page)
    service_name = redshift_connector.service_name
    go_to_service("Databases", page, service_name)
    page.get_by_text("Ingestions").click()

    # Not best practice. Should use `expect`, though playwright does not have a `wait_until` function
    status = (
        page.get_by_role("row", name=re.compile(f"^{service_name}_metadata_.*"))
        .get_by_test_id("pipeline-status")
        .text_content()
    )
    while status in ("--", "Running"):
        page.reload()
        status = (
            page.get_by_role("row", name=re.compile(f"^{service_name}_metadata_.*"))
            .get_by_test_id("pipeline-status")
            .text_content()
        )

    assert status == "Success"


def test_change_database_owner(redshift_connector, page: Page):
    """..."""
    page.set_default_timeout(TIMEOUT)

    service_name = redshift_connector.service_name
    page.goto(f"{BASE_URL}/")
    Admin().login(page)
    go_to_service("Databases", page, service_name)
    page.get_by_test_id("edit-owner").click()
    # page.get_by_role("tab", name="Users.*").click()
    page.get_by_test_id("owner-select-users-search-bar").click()
    page.get_by_test_id("owner-select-users-search-bar").fill("created-user")
    page.get_by_text("created-user").click()
    expect(
        page.get_by_test_id("owner-label").get_by_test_id("owner-link")
    ).to_have_text("created-user")


def test_data_consumer(redshift_connector, create_data_consumer_user, page: Page):
    """..."""
    page.set_default_timeout(TIMEOUT)

    service_name = redshift_connector.service_name
    user = create_data_consumer_user
    page.goto(f"{BASE_URL}/")
    user.login(page)
    go_to_service("Databases", page, service_name)
    expect(page.get_by_test_id("ingestions")).not_to_be_visible()
    expect(page.get_by_test_id("data-testid")).not_to_be_visible()
    expect(page.get_by_test_id("databases")).to_be_visible()
