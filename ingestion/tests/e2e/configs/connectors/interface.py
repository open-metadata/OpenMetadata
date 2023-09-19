"""connectors interface"""

import random
import re
import string
from abc import ABC, abstractmethod
from typing import List

from playwright.sync_api import Page, expect

from ingestion.tests.e2e.configs.users.admin import Admin

BASE_URL = "http://localhost:8585"


class DataBaseConnectorInterface(ABC):
    """Interface for connectors class for e2e tests"""

    def __init__(self, schema_filters: List[str] = [], table_filters: List[str] = []):
        """Initialize the connector"""
        self.schema_filters = list(schema_filters)
        self.table_filters = list(table_filters)
        self.service_type = "Databases"
        self.service_name = None

    def _check_and_handle_workflow(self, page: Page, type_: str):
        try:
            expect(
                page.get_by_role(
                    "row", name=re.compile(f"{self.service_name}_{type_}_.*")
                ).get_by_test_id("re-deploy-btn")
            ).to_be_visible(timeout=1000)
        except (TimeoutError, AssertionError):
            page.get_by_role(
                "row", name=re.compile(f"{self.service_name}_{type_}_.*")
            ).get_by_test_id("deploy").click()
        finally:
            expect(
                page.get_by_role(
                    "row", name=re.compile(f"{self.service_name}_{type_}_.*")
                ).get_by_test_id("re-deploy-btn")
            ).to_be_visible()

    @abstractmethod
    def get_service(self, page: Page):
        """get service from the service page"""
        raise NotImplementedError

    @abstractmethod
    def set_connection(self, page: Page):
        """Set connection for redshift service"""
        raise NotImplementedError

    @staticmethod
    def generate_service_name():
        """Generate a random service name"""
        chinese_char = "".join([chr(random.randint(0x4E00, 0x9FBF)) for _ in range(3)])
        cyrillic_char = "".join([chr(random.randint(1072, 1104)) for _ in range(3)])
        return (
            "".join(random.choices(string.ascii_lowercase, k=10))
            + chinese_char
            + cyrillic_char
            + "_-1"
        )

    def _set_schema_filter(self, page: Page):
        """Set schema filter for redshift service"""
        for schema in self.schema_filters:
            page.locator('xpath=//*[@id="root/schemaFilterPattern/includes"]').fill(
                schema
            )

    def _set_table_filter(self, page: Page):
        """Set schema filter for redshift service"""
        for table in self.table_filters:
            page.locator('[id="root\\/tableFilterPattern\\/includes"]').fill(table)

    def create_service_ingest_metadata(self, page: Page):
        """Ingest redshift service data"""
        page.goto(f"{BASE_URL}/")
        Admin().login(page)
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_text(self.service_type).click()
        page.get_by_test_id("add-service-button").click()
        self.get_service(page)
        page.get_by_test_id("next-button").click()
        self.service_name = self.generate_service_name()
        page.get_by_test_id("service-name").fill(self.service_name)
        expect(page.get_by_test_id("service-name")).to_have_value(self.service_name)
        page.get_by_test_id("next-button").click()
        self.set_connection(page)
        page.get_by_test_id("submit-btn").click()
        page.get_by_test_id("add-ingestion-button").click()
        self._set_schema_filter(page)
        page.get_by_test_id("submit-btn").click()
        page.get_by_test_id("deploy-button").click()
        page.get_by_test_id("view-service-button").click()
        page.get_by_test_id("ingestions").click()
        self._check_and_handle_workflow(page, "metadata")
        return self.service_name

    def create_profiler_workflow(self, page: Page):
        """create profiler workflow"""
        page.goto(f"{BASE_URL}/")
        Admin().login(page)
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_text("Databases").click()
        page.get_by_test_id(f"service-name-{self.service_name}").click()
        page.get_by_text("Ingestions").click()
        page.get_by_test_id("add-new-ingestion-button").click()
        page.get_by_text("Add Profiler Ingestion").click()
        page.locator(
            "div:nth-child(5) > div > div:nth-child(2) > .form-group > .ant-row > div:nth-child(2) > .ant-select > .ant-select-selector > .ant-select-selection-overflow"
        ).click()
        self._set_table_filter(page)
        page.locator('[id="root\\/processPiiSensitive"]').click()
        page.get_by_test_id("submit-btn").click()
        page.get_by_test_id("deploy-button").click()
        page.get_by_test_id("view-service-button").click()
        page.get_by_test_id("ingestions").click()
        self._check_and_handle_workflow(page, "profiler")

    def delete_service(self, page: Page):
        """Delete service"""
        page.goto(f"{BASE_URL}/")
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_text("Databases").click()
        page.get_by_test_id(f"service-name-{self.service_name}").click()
        page.get_by_test_id("manage-button").click()
        page.get_by_test_id("delete-button-title").click()
        page.get_by_test_id("confirmation-text-input").fill("DELETE")
        expect(page.get_by_test_id("confirmation-text-input")).to_have_value("DELETE")
        page.get_by_test_id("confirm-button").click()
