"""Admin user configuration for e2e tests."""

import time
from typing import Optional

from playwright.sync_api import Page, expect


class User:
    def __init__(
        self, username: str, password: str, display_name: Optional[str] = None
    ):
        """Initialize the admin user."""
        self.username = username
        self.password = password
        self.display_name = display_name

    def login(self, page: Page):
        """Login as the user."""
        page.get_by_label("Username or Email").fill(self.username)
        page.get_by_label("Password").fill(self.password)
        page.get_by_role("button", name="Login").click()
        time.sleep(0.5)
        page.reload()
        expect(page.get_by_test_id("app-bar-item-explore")).to_be_visible()

    def delete(self, page: Page):
        """Delete the user."""
        page.get_by_test_id("app-bar-item-settings").click()
        page.get_by_test_id("global-setting-left-panel").get_by_text("Users").click()
        page.get_by_test_id("searchbar").fill(self.display_name)  # type: ignore
        page.get_by_test_id("searchbar").press("Enter")
        page.get_by_role("row", name=self.display_name).get_by_role("button").click()
        page.get_by_test_id("hard-delete").check()
        page.get_by_test_id("confirmation-text-input").fill("DELETE")
        page.get_by_test_id("confirm-button").click()
