"""Load test for the test case result resources"""
from datetime import datetime, timedelta

from locust import TaskSet, task

from _openmetadata_testutils.helpers.login_user import login_user

TEST_CASE_RESULT_RESOURCE_PATH = "/api/v1/dataQuality/testCases/testCaseResults"
TEST_CASE_RESOURCE_PATH = "/api/v1/dataQuality/testCases"


class TestCaseResultTasks(TaskSet):
    """Test case result resource load test"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_cases = []

    def _list_test_case_results(self, start_ts: int, end_ts: int, days_range: str):
        """List test case results for a given time range

        Args:
            start_ts (int): start timestamp
            end_ts (int): end timestamp
            range (str):
        """
        for test_case in self.test_cases:
            fqn = test_case.get("fullyQualifiedName")
            if fqn:
                self.client.get(
                    f"{TEST_CASE_RESULT_RESOURCE_PATH}/{fqn}",
                    params={  # type: ignore
                        "startTs": start_ts,
                        "endTs": end_ts,
                    },
                    auth=self.bearer,
                    name=f"{TEST_CASE_RESULT_RESOURCE_PATH}/[fqn]/{days_range}",
                )

    @task(3)
    def list_test_case_results_30_days(self):
        """List test case results for the last 30 days. Weighted 3"""
        now = datetime.now()
        last_30_days = int((now - timedelta(days=30)).timestamp() * 1000)
        self._list_test_case_results(
            last_30_days, int(now.timestamp() * 1000), "30_days"
        )

    @task(2)
    def list_test_case_results_60_days(self):
        """List test case results for the last 60 days. Weighted 2"""
        now = datetime.now()
        last_60_days = int((now - timedelta(days=60)).timestamp() * 1000)
        self._list_test_case_results(
            last_60_days, int(now.timestamp() * 1000), "60_days"
        )

    @task
    def list_test_case_results_180_days(self):
        """List test case results for the last 180 days"""
        now = datetime.now()
        last_180_days = int((now - timedelta(days=180)).timestamp() * 1000)
        self._list_test_case_results(
            last_180_days, int(now.timestamp() * 1000), "180_days"
        )

    @task
    def stop(self):
        self.interrupt()

    def on_start(self):
        """Get a list of test cases to fetch results for"""
        self.bearer = login_user(self.client)
        resp = self.client.get(
            f"{TEST_CASE_RESOURCE_PATH}",
            params={"limit": 100},
            auth=self.bearer,
            name=f"{TEST_CASE_RESOURCE_PATH}?limit=100",
        )
        json = resp.json()
        self.test_cases = json.get("data", [])
