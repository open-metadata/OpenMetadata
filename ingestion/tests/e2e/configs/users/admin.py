"""Admin user configuration for e2e tests."""

from ingestion.tests.e2e.configs.users.user import User


class Admin(User):
    def __init__(self, username="admin", password="admin"):
        """Initialize the admin user."""
        super().__init__(username, password)
