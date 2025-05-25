import time

import nox


@nox.session(name="unit", reuse_venv=True, venv_backend="uv|venv")
def unit(session):
    # Install package with test extras
    start = time.time()

    session.install(".[all-dev-env, test-unit]")
    # FIXME: we need to install pip so that spaCy can install its dependencies
    #        we should find a way to avoid this
    session.install("pip")
    duration = time.time() - start
    session.log(f"Virtual env set in {duration:.2f} seconds")
    # Run unit tests
    tests_to_skip = [
        "test_ometa_endpoints.py",
        "test_ometa_mlmodel.py",
        "test_dbt.py",
        "test_sample_usage.py",
        "test_ssl_manager.py",
        "test_usage_filter.py",
        "profiler/test_profiler_partitions.py",
        "profiler/test_workflow.py",
        "workflow",
        "topology",
    ]
    ignore = [f"--ignore=tests/unit/{test}" for test in tests_to_skip]
    session.run(
        "pytest",
        "tests/unit/",
        *ignore,
    )


@nox.session(name="unit-ge", reuse_venv=True, venv_backend="uv|venv")
def unit_ge(session):
    # Install package with test extras
    start = time.time()

    session.install(".[test-unit]")
    # Install Great Expectations with the specific version
    session.install("great_expectations~=0.18.0")
    duration = time.time() - start
    session.log(f"Virtual env set in {duration:.2f} seconds")
    # Run unit tests
    session.run(
        "pytest",
        "tests/unit/great_expectations",
    )


@nox.session(name="integration", venv_backend="uv|venv")
def integration(session: nox.Session):
    # Install package with integration extras
    session.install(".[test]")
    session.install("pytest", "pytest-xdist", "pytest-timeout")
    tests_suites = [
        # "airflow", # Idempotence issue, fails on second run
        "alationsink",
        "automations",
        "cassandra",
        "cockroach",
        "connections",
        # "datalake", requires some extra deps
        # "data_quality", Takes too long!
        # "great_expectations", # Issues with installing on runtime
        "kafka",
        "mongodb",
        # "mysql", Flaky not idempotent tests
        # "ometa", # Takes too long!
        # "orm_profiler", fails
        # "postgres",
        "powerbi",
        "profiler",
        "s3",
        "sources",
        # "sql_server", fails with error pyodbc.Error: ('01000', "[01000] [unixODBC][Driver Manager]Can't open lib 'ODBC Driver 18 for SQL Server' : file not found (0) (SQLDriverConnect)")
        "superset",
        "test_suite",
        # "trino", fails: <pandas.io.sql.SQLTable object at 0x16f05a020>, conn = <sqlalchemy.engine.base.Connection object at 0x16f0587f0>, keys = ['one', 'two', 'three', 'four', 'five']
        # data_iter = <zip object at 0x16f078ec0>
        "workflow",
    ]
    # Set environment variables for integration tests

    not_parallel = [
        "workflow",
        "automations",
        "cockroach",
        "kafka",
        "profiler",  # problem with network dropping see tests.integration.kafka.conftest.docker_network
        "sources",
        "superset",
        "test_suite",
    ]
    for test in not_parallel:
        session.run(
            "pytest",
            "-n",
            "auto",
            "-s",
            f"tests/integration/{test}",
            env={"TC_MAX_TRIES": "40", "TC_POOLING_INTERVAL": "2"},
        )
        exit(1)

    parallizable = [test for test in tests_suites if test not in not_parallel]
    test_paths = [f"tests/integration/{test}" for test in parallizable]
    session.run(
        "pytest",
        "-n",
        "auto",
        *test_paths,
        "--disable-warnings",
        env={"TC_MAX_TRIES": "40", "TC_POOLING_INTERVAL": "2"},
    )

    # for test in parallizable[:5]:
    #     session.run(
    #         "pytest",
    #         "-n",
    #         "auto",
    #         f"tests/integration/{test}",
    #         "--disable-warnings",
    #         env={"TC_MAX_TRIES": "20", "TC_POOLING_INTERVAL": "2"},
    #     )
    # tests = [f"tests/integration/{test}" for test in tests_suites]
    # run tests in parallel


@nox.session(name="integration-parallel", venv_backend="uv|venv")
def integration_parallel(session: nox.Session):
    # Install package with integration extras
    session.install(".[test]")
    session.install("pytest", "pytest-xdist", "pytest-timeout")
    # Tests that require Mysql container
    tests_suites = [
        "automations",
        "connections",
        # "ometa", # Takes too long!
        # "sources",
        "workflow",
    ]

    test_paths = [f"tests/integration/{test}" for test in tests_suites]
    session.run(
        "pytest",
        "-n",
        "auto",
        *test_paths,
        "--disable-warnings",
        env={"TC_MAX_TRIES": "40", "TC_POOLING_INTERVAL": "2"},
    )

    # for test in parallizable[:5]:
    #     session.run(
    #         "pytest",
    #         "-n",
    #         "auto",
    #         f"tests/integration/{test}",
    #         "--disable-warnings",
    #         env={"TC_MAX_TRIES": "20", "TC_POOLING_INTERVAL": "2"},
    #     )
    # tests = [f"tests/integration/{test}" for test in tests_suites]
    # run tests in parallel


# @nox.session(name="lint")
# def lint(session):
#     session.install(".[dev]")
#     session.run("black", "--check", ".")
#     session.run("isort", "--check-only", ".")
#     session.run("mypy", ".")
