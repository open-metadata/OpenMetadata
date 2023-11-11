# Playwright end-to-end tests
https://playwright.dev/python/docs/intro

## Structure
In the `e2e` folder you will find 2 folders and 1 file:
- `conftest.py`: defines some module scope fixture (module here is the  `e2e` folder). All tests will use `init_with_redshift` by default -- ingestin metadata from a redshift service. The ingestion will only happens on the first test execution. The `create_data_consumer_user` allows tests to login as a Data Consumer and perform some actions
- `configs`: holds all the shared configuration. So far we have 2 main classes families (User and Connector) and common functions
- `entity`: holds entity related tests. It contains a subfolder per asset category. In the asset category folder you will find the `common_assertions.py`. This file contains all the common assertions to be ran for that specific asset.

## Install Dependencies and Run Tests
run `make install_e2e_tests`. Run `make run_e2e_tests`, you can also pass arguments such as `make run_e2e_tests ARGS="--browser webkit"` to run tests against webkit browser or `make run_e2e_tests ARGS="--headed --slowmo 100"` to run the tests in slowmo mode and head full.

## Adding a new test
The first step is to define the connector config for your source. this happens in `configs/connectors/<asset category>` folder. For a database connector, you will must ensure your class inherits from `DataBaseConnectorInterface`. You will then need to implement the `get_service()` and `set_connection()`. `get_service` specifies which service to choose from the `<assetCategory>/add-service` page of the webside and `set_connection` the different elements to configure on the connector connection config page. If you are unsure how an element can be accessed on the page you can run `playwright codegen http://localhost:8585/` -- more info [here](https://playwright.dev/python/docs/codegen). By default `DataBaseConnectorInterface` sets `self.supports_profiler_ingestion=True` which will result in the profiler ingestion to run when the test class is executed. You can `self.supports_profiler_ingestion=False` in your specific connector to override this behavior.

e.g.

```python
class DruidConnector(DataBaseConnectorInterface):
    """druid connector"""

    def __init__(self, config):
        super().__init__(config)
        self.supports_profiler_ingestion=False
    
    def set_connection():
        ...

    def get_service():
        ...
```


Once your connector config has been created you will need to add a new test. Simply create a new file in the asset category of your choice (e.g. `entity/database/test_druid.py`). In this file create a new test class and mark this class with `@pytest.mark.usefixtures("setUpClass")` and `@pytest.mark.parametrize("setUpClass", ...)`. The first mark will make sure `setUpClass` fixture is ran before running your tests (this manage the ingestion of metadata and profiler as of Oct-25 2023) and `@pytest.mark.parametrize` will pass the right connector class to the `setUpClass` fixture. The second argument of `@pytest.mark.parametrize` should be as below
```python
[
    {
        "connector_obj": <connectorClassConfig>(
            ConnectorTestConfig(...)
        )
    }
]
```

`ConnectorTestConfig` defines the configuration to use for the test. It has 2 arguments:
- `ingestion`: This allows you to define the different filtering when performing the ingestion. it expects a `ConnectorIngestionTestConfig` which will take 2 arguments:
    - `metadata`: this allows you to define metadata ingestion filters. It take a `IngestionTestConfig` which takes 3 arguments:
        - `database`: it expects an `IngestionFilterConfig` class which takes 2 argumenst:
            - `includes`: a list of str
            - `excludes`: a list of str
        - `schema_`: see `database`
        - `table`: see `database`
    - `profiler`: see `metadata`  
- `validation`: this config can be used when we need to validate expectations against specific entities. As of Oct-25 2023 it is only used in the `assert_profile_data`, `assert_sample_data_ingestion` and `assert_pii_column_auto_tagging` test functions of the profiler. 

Once you have set up your class you can create your test. There are currently (as of Oct-25 2023) 5 assertions that can be performed:
- assert pipeline status are `success`. You can refer to the implementation in the existing test
- `assert_change_database_owner`: assert the owner of a data can be changed
- `assert_profile_data`: assert table profile data summary are visible
- `assert_sample_data_ingestion`: assert sample data are ingested and visible
- `assert_pii_column_auto_tagging`: assert auto PII tagging from the profiler has been performed

Note that in every test method you define the following class attributes are accessible:
- `connector_obj`: `<connectorClassConfig>`` the connector class pass to `setUpClass` in the `@pytest.mark.parametrize`
- `service_name`: `str`` the name of the service that was created for the test
- `metadata_ingestion_status`: `PipelineState` the ingestion status of the metadata pipeline
- `profiler_ingestion_status`: `PipelineState` the ingestion status of the profiler pipeline.

## Test Coverage
| **tests**                   | redshift | druid | hive |
|-----------------------------|:--------:|:-----:|:----:|
| metadata ingestion          |     ✅    |   ✅   |   ✅  |
| profiler ingestion          |     ✅    |   ✅   |   ✅  |
| change DB owner             |     ✅    |   ✅   |   ✅  |
| Table Profiler Summary Data |     ✅    |   ✅   |   ✅  |
| Sample data visible         |     ✅    |   ✅   |   ✅  |
| Profiler PII auto Tag       |     ✅    |   ✅   |   ❌  |