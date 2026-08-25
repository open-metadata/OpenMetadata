"""Load test for the test case resources"""

from locust import TaskSet, task

from _openmetadata_testutils.helpers.login_user import login_user

TEST_CASE_RESOURCE_PATH = "/api/v1/dataQuality/testCases"


class TestCaseTasks(TaskSet):
    """Test case resource load test"""

    def _list_test_cases(self):
        """Paginate through the test cases"""
        resp = self.client.get(
            f"{TEST_CASE_RESOURCE_PATH}",
            params={"limit": 10},
            auth=self.bearer,
            name=f"{TEST_CASE_RESOURCE_PATH}?limit=10",
        )
        after = resp.json().get("paging", {}).get("after")
        while after:
            resp = self.client.get(
                f"{TEST_CASE_RESOURCE_PATH}",
                params={"limit": 10, "after": after},
                auth=self.bearer,
                name=f"{TEST_CASE_RESOURCE_PATH}?limit=10",
            )
            after = resp.json().get("paging", {}).get("after")

    @task(2)
    def list_test_cases(self):
        """List test cases. Weighted 2"""
        self._list_test_cases()

    @task
    def stop(self):
        self.interrupt()

    def on_start(self):
        self.bearer = login_user(self.client)
