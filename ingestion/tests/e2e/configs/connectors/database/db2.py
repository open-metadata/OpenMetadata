"""Redshift connector for e2e tests"""

import os

from playwright.sync_api import Page, expect

from .interface import DataBaseConnectorInterface


class Db2Connector(DataBaseConnectorInterface):
    """db2 connector"""

    def get_service(self, page: Page):
        """get service from the service page"""
        page.get_by_test_id("Db2").click()

    def set_connection(self, page):
        """Set connection for redshift service"""
        page.get_by_label("Username*").fill(os.environ["E2E_DB2_USERNAME"])
        expect(page.get_by_label("Username*")).to_have_value(
            os.environ["E2E_DB2_USERNAME"]
        )

        page.get_by_label("Password").fill(os.environ["E2E_DB2_PASSWORD"])
        expect(page.get_by_label("Password")).to_have_value(
            os.environ["E2E_DB2_PASSWORD"]
        )

        page.get_by_label("Host and Port*").fill(os.environ["E2E_DB2_HOST_PORT"])
        expect(page.get_by_label("Host and Port*")).to_have_value(
            os.environ["E2E_DB2_HOST_PORT"]
        )

        page.get_by_label("database*").fill(os.environ["E2E_DB2_DATABASE"])
        expect(page.get_by_label("database*")).to_have_value(
            os.environ["E2E_DB2_DATABASE"]
        )
