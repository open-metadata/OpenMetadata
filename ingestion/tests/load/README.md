## Adding a new resource to load tests
Add a new `*.py` file to `test_resources/tasks`. The naming does not matter, but we use the resource name as defined in Java, but separated by `_` (e.g. `TestCaseResource` becomes `test_case_tasks.py`).

In your newly created file, you'll need to import at minimum 1 package
```python
from locust import task, TaskSet
```
`task` will be used as a decorator to define our task that will run as part of our load test. `TaskSet` wil be inherited by our task set class.

Here is an example of a locust task definition. The integer argument in `@task` will give a specific weigth to the task (i.e. increasing its probability to be ran)
```
class TestCaseResultTasks(TaskSet):
    """Test case result resource load test"""

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
                    params={ # type: ignore
                        "startTs": start_ts,
                        "endTs": end_ts,
                    },
                    auth=self.bearer,
                    name=f"{TEST_CASE_RESULT_RESOURCE_PATH}/[fqn]/{days_range}"
                )

    @task(3)
    def list_test_case_results_30_days(self):
        """List test case results for the last 30 days. Weighted 3"""
        now = datetime.now()
        last_30_days = int((now - timedelta(days=30)).timestamp() * 1000)
        self._list_test_case_results(last_30_days, int(now.timestamp() * 1000), "30_days")
```

Notice how we use `self.client.get` to perform the request. This is provided by locust `HttpSession`. If the request needs to be authenticated, you can use `auth=self.bearer`. You will need to first define `self.bearer`, you can achieve this using the `on_start` hook from locust.

```python
from _openmetadata_testutils.helpers.login_user import login_user

class TestCaseResultTasks(TaskSet):
    """Test case result resource load test"""
    [...]

    def on_start(self):
        """Get a list of test cases to fetch results for"""
        self.bearer = login_user(self.client)
        resp = self.client.get(f"{TEST_CASE_RESOURCE_PATH}", params={"limit": 100}, auth=self.bearer)
        json = resp.json()
        self.test_cases = json.get("data", [])
```

**IMPORTANT**
You MUST define a `def stop(self)` methodd in your `TaskSet` class as shown below so that control is given back to the parent user class.

```python
class TestCaseResultTasks(TaskSet):
    """Test case result resource load test"""
    [...]

    @task
    def stop(self):
        self.interrupt()
```
 
If your request contains a parameter (i.e. `/api/v1/dataQuality/testCases/testCaseResults/{fqn}`) you can name your request so all the request sent you will be grouped together like this

```python
self.client.get(
    f"{TEST_CASE_RESULT_RESOURCE_PATH}/{fqn}",
    params={ # type: ignore
        "startTs": start_ts,
        "endTs": end_ts,
    },
    auth=self.bearer,
    name=f"{TEST_CASE_RESULT_RESOURCE_PATH}/[fqn]/{days_range}"
)
```

Notice the argument `name=f"{TEST_CASE_RESULT_RESOURCE_PATH}/[fqn]/{days_range}"`, this will define under which name the requests will be grouped. Example of statistics summary below grouped by the request `name`

```csv
Type,Name,Request Count,Failure Count,Median Response Time,Average Response Time,Min Response Time,Max Response Time,Average Content Size,Requests/s,Failures/s,50%,66%,75%,80%,90%,95%,98%,99%,99.9%,99.99%,100%
GET,/api/v1/dataQuality/testCases/testCaseResults/[fqn]/60_days,3510,0,13,16.2354597524217,5.146791999997902,100.67633299999557,84567.57407407407,49.30531562959204,0.0,13,17,20,21,28,35,45,56,92,100,100
```

As a final step in `test_resources/manifest.yaml` add the resources, the metrics and the thresholds you want to test.

```yaml
/api/v1/dataQuality/testCases/testCaseResults/[fqn]/30_days:
  type: GET
  99%: 100

/api/v1/dataQuality/testCases/testCaseResults/[fqn]/60_days:
  type: GET
  99%: 100
```

This will test that our GET request for the defined resources are running 99% of the time in less than 100 milliseconds (0.1 seconds).

Below is a list of all the metrics you can use:
- Request Count
- Failure Count
- Median Response Time
- Average Response Time
- Min Response Time
- Max Response Time
- Average Content Size
- Requests/s
- Failures/s
- 50%
- 66%
- 75%
- 80%
- 90%
- 95%
- 98%
- 99%
- 99.9%
- 99.99%
- 100%
