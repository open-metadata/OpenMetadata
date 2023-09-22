"""common navigation functions"""

import random
import string

from playwright.sync_api import Page, expect

from ingestion.tests.e2e.configs.users.user import User

BASE_URL = "http://localhost:8585"


def go_to_service(service_type: str, page: Page, service_name: str):
    """navigate to the given service page

    Args:
        service_type (str): service type
        page (Page): playwright page
        service_name (str): service name
    """
    page.get_by_test_id("app-bar-item-settings").click()
    page.get_by_text(service_type).click()
    page.get_by_test_id(f"service-name-{service_name}").click()


def create_user(page: Page, email: str, display_name: str, role: str) -> User:
    """create a user

    Args:
        page (Page): playwright page
        email (str): user email
        display_name (str): user display name
        role (str): user role

    Returns:
        _type_: User
    """
    page.get_by_test_id("app-bar-item-settings").click()
    page.get_by_test_id("global-setting-left-panel").get_by_text("Users").click()
    page.get_by_test_id("add-user").click()
    page.get_by_test_id("email").click()
    page.get_by_test_id("email").fill(email)
    expect(page.get_by_test_id("email")).to_have_value(email)
    page.get_by_test_id("displayName").fill(display_name)
    expect(page.get_by_test_id("displayName")).to_have_value(display_name)

    password = "".join(random.choice(string.ascii_uppercase) for _ in range(3))
    password += "".join(random.choice(string.digits) for _ in range(3))
    password += "".join(random.choice(string.ascii_lowercase) for _ in range(3))
    password += "".join(random.choice("%^&*#@$!)(?") for _ in range(3))
    page.get_by_label("Create Password").check()
    page.get_by_placeholder("Enter Password").fill(password)
    expect(page.get_by_placeholder("Enter Password")).to_have_value(password)
    page.get_by_placeholder("Confirm Password").fill(password)
    expect(page.get_by_placeholder("Confirm Password")).to_have_value(password)

    page.get_by_test_id("roles-dropdown").locator("div").nth(1).click()
    page.get_by_text(role).click()
    page.get_by_test_id("save-user").click()
    return User(email, password, display_name)
