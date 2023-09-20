# Playwright end-to-end tests
https://playwright.dev/python/docs/intro

## Structure
In the `e2e` folder you will find 2 folders and 1 file:
- `conftest.py`: defines some module scope fixture (module here is the  `e2e` folder). All tests will use `init_with_redshift` by default -- ingestin metadata from a redshift service. The ingestion will only happens on the first test execution. The `create_data_consumer_user` allows tests to login as a Data Consumer and perform some actions
- `configs`: holds all the shared configuration. So far we have 2 main classes families (User and Connector) and common functions
- `entity`: holds entity related tests. It contains a subfolder per source.

## Install Dependencies and Run Tests
run `make install_e2e_tests`. Run `make run_e2e_tests`, you can also pass arguments such as `make run_e2e_tests ARGS="--browser webkit"` to run tests against webkit browser or `make run_e2e_tests ARGS="--headed --slowmo 100"` to run the tests in slowmo mode and head full.

