"""
Entity profiler tests. Scenarios tested:
    - 
"""
import re
import time

from playwright.sync_api import Page

from ingestion.tests.e2e.configs.common import go_to_service


def test_assert_profiler_ingestion_status_success(redshift_connector, page: Page):
    """test profiler ingestion status"""

    service_name = redshift_connector.service_name
    redshift_connector.create_profiler_workflow(page)
    go_to_service("Databases", page, service_name)
    page.get_by_text("Ingestions").click()

    # Not best practice. Should use `expect`, though playwright does not have a `wait_until` function
    status = (
        page.get_by_role("row", name=re.compile(f"^{service_name}_profiler_.*"))
        .get_by_test_id("pipeline-status")
        .text_content()
    )
    while status in ("--", "Running"):
        time.sleep(2)
        page.reload()
        status = (
            page.get_by_role("row", name=re.compile(f"{service_name}_profiler_.*"))
            .get_by_test_id("pipeline-status")
            .text_content()
        )

    assert status == "Success"
