"""Redshift connector for e2e tests"""

import os

from playwright.sync_api import Page, expect

from .interface import DataBaseConnectorInterface


class DruidConnector(DataBaseConnectorInterface):
    """db2 connector"""
    def get_service(self, page: Page):
        """get service from the service page"""
        page.get_by_test_id("Druid").click()

    def set_connection(self, page):
        """Set connection for redshift service"""
        page.get_by_label("Host and Port*").fill(os.environ["E2E_DRUID_HOST_PORT"])
        expect(page.get_by_label("Host and Port*")).to_have_value(
            os.environ["E2E_DRUID_HOST_PORT"]
        )
