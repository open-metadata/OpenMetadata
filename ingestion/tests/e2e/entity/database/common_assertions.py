"""common database assertions"""

from playwright.sync_api import Page, expect

from ingestion.tests.e2e.configs.common import go_to_service


def assert_change_database_owner(page_context: Page, service_name: str):
    """assert database owner can be changed as expected"""
    go_to_service("Databases", page_context, service_name)
    page_context.get_by_test_id("edit-owner").click()
    page_context.get_by_test_id("owner-select-users-search-bar").click()
    page_context.get_by_test_id("owner-select-users-search-bar").fill("created-user")
    page_context.get_by_text("created-user").click()
    expect(
        page_context.get_by_test_id("owner-label").get_by_test_id("owner-link")
    ).to_have_text("created-user")


def assert_profile_data(
        page_context: Page,
        service_name: str,
        database: str,
        schema: str,
        table: str,
        connector_obj,
    ):
    """Assert profile data have been computed correctly"""
    go_to_service("Databases", page_context, service_name)
    page_context.get_by_role("link", name=database).click()
    page_context.get_by_role("link", name=schema).click()
    page_context.get_by_role("link", name=table, exact=True).click()
    page_context.get_by_text("Profiler & Data Quality").click()
    for card in range(connector_obj.profiler_summary_card_count):
        summary_card = page_context.get_by_test_id("summary-card-container").nth(card)
        description = summary_card.get_by_test_id("summary-card-description").inner_text()
        assert description not in {"0"}


def assert_sample_data_ingestion(
        page_context: Page,
        service_name: str,
        database: str,
        schema: str,
        table: str,
    ):
    """assert sample data are ingested as expected"""
    go_to_service("Databases", page_context, service_name)
    page_context.get_by_role("link", name=database).click()
    page_context.get_by_role("link", name=schema).click()
    page_context.get_by_role("link", name=table, exact=True).click()
    page_context.get_by_text("Sample Data").click()

    expect(page_context.get_by_test_id("sample-data")).to_be_visible()

def assert_pii_column_auto_tagging(
        page_context: Page,
        service_name: str,
        database: str,
        schema: str,
        table: str,
        column: str,
    ):
    """assert pii column auto tagging tagged as expected"""
    go_to_service("Databases", page_context, service_name)
    page_context.get_by_role("link", name=database).click()
    page_context.get_by_role("link", name=schema).click()
    page_context.get_by_role("link", name=table, exact=True).click()

    table_row = page_context.locator(f'tr:has-text("{column}")')
    tag = table_row.locator('td:nth-child(4)')
    expect(tag).to_be_visible()
    assert tag.text_content() in {"Sensitive", "NonSensitive"}