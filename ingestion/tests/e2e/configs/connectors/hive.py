"""MySQL connector for e2e tests"""

import os

from playwright.sync_api import Page, expect

from .interface import DataBaseConnectorInterface


class HiveConnector(DataBaseConnectorInterface):
    def get_service(self, page: Page):
        """get service from the service page"""
        page.get_by_test_id("Hive").click()

    def set_connection(self, page):
        """Set connection for redshift service"""
        page.locator("[id=\"root\\/hostPort\"]").fill(os.environ["E2E_HIVE_HOST_PORT"])
        expect(page.locator("[id=\"root\\/hostPort\"]")).to_have_value(
            os.environ["E2E_HIVE_HOST_PORT"]
        )

        page.locator("[id=\"root\\/metastoreConnection__oneof_select\"]").select_option("2")