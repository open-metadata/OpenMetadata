import os
from dataclasses import dataclass
from itertools import chain
from typing import List

import nox
from nox import Session

python_versions = ["3.8", "3.9", "3.10", "3.11"]

## HELPERS


@dataclass
class TestEnv:
    name: str
    extras: List[str]
    paths: List[str]

    def install_deps(self, session: Session):
        session.install(f".[{','.join(self.extras)}]")

    def to_dict(self):
        return {
            "name": self.name,
            "extras": self.extras,
            "paths": self.paths,
        }

    @classmethod
    def from_dict(cls, d):
        return cls(
            name=d["name"],
            extras=d["extras"],
            paths=d["paths"],
        )


integration_test_dir = "tests/integration"


def simple_integration_env(name: str):
    return TestEnv(
        f"integration-{name}",
        ["test", name],
        [os.path.join(integration_test_dir, name)],
    )


def pytest_run(session: Session, env: TestEnv):
    session.run(
        "coverage",
        "run",
        "--branch",
        "--rcfile",
        "pyproject.toml",
        "-a",
        "-m",
        "pytest",
        "-c",
        "pyproject.toml",
        f"--junitxml=junit/test-results-{env.name}.xml",
        *[path for path in env.paths],
    )


## TEST ENVIRONMENTS

# Define the Python versions and environments
integration_tests = [
    simple_integration_env(x)
    for x in ("postgres", "mysql", "kafka", "mssql", "trino", "datalake-s3")
]
integration_tests += [
    # TODO: these should be moved to separate integration tests
    TestEnv(
        name="integration-others",
        paths=[
            path
            for path in os.listdir(integration_test_dir)
            if os.path.join(integration_test_dir, path)
            not in chain(*[e.paths for e in integration_tests])
        ],
        extras=[
            # base test dependencies
            "test",
            # integration test dependencies. these should be removed once the tests are refactored
            "athena",
            "avro",
            "bigquery",
            "bigtable",
            "clickhouse",
            "dagster",
            "databricks",
            "datalake-gcs",
            "deltalake",
            "deltalake-spark",
            "domo",
            "doris",
            "hive",
            "iceberg",
            "lkml",
            "looker",
            "mlflow",
            "mongo",
            "amundsen",
            "oracle",
            "pii-processor",
            "redshift",
            "salesforce",
            "snowflake",
            "tableau",
            "trino",
        ],
    )
]
unit_tests = TestEnv(
    name="unit",
    extras=[
        # base test dependencies
        "test",
        # packages tested in unit tests
        "athena",
        "bigquery",
        "bigtable",
        "clickhouse",
        "dagster",
        "databricks",
        "datalake-gcs",
        "deltalake-spark",
        "domo",
        "doris",
        "hive",
        "iceberg",
        "kafka",
        "lkml",
        "looker",
        "mongo",
        "mssql",
        "amundsen",
        "oracle",
        "pii-processor",
        "pgspider",
        "redshift",
        "salesforce",
        "snowflake",
        "tableau",
        "trino",
    ],
    paths=["tests/unit"],
)

e2e_tests = [
    TestEnv(name=name, extras=extras, paths=["tests/cli_e2e/test_cli_" + name + ".py"])
    for (name, extras) in [
        ("bigquery", ["bigquery"]),
        ("dbt_redshift", ["redshift", "dbt"]),
        ("metabase", ["metabase"]),
        ("mssql", ["mssql"]),
        ("mysql", ["mysql"]),
        ("redash", ["redash"]),
        ("snowflake", ["snowflake"]),
        ("tableau", ["tableau"]),
        ("powerbi", ["powerbi"]),
        ("vertica", ["vertica"]),
        ("redshift", ["redshift"]),
        ("quicksight", ["quicksight"]),
        ("datalake_s3", ["datalake-s3"]),
        ("postgres", ["postgres"]),
        ("oracle", ["oracle"]),
        ("athena", ["athena"]),
        ("bigquery_multiple_project", ["bigquery"]),
    ]
]

## SESSIONS


@nox.session(python=python_versions, tags=["integration"])
@nox.parametrize(
    "env",
    [t.to_dict() for t in integration_tests],
    ids=[e.name for e in integration_tests],
)
def integration_tests(session, env: dict):
    env = TestEnv.from_dict(env)
    env.install_deps(session)
    pytest_run(session, env)


@nox.session(python=python_versions, tags=["unit"])
@nox.parametrize("env", [unit_tests.to_dict()], ids=[e.name for e in [unit_tests]])
def unit_tests(session, env: dict):
    env = TestEnv.from_dict(env)
    env.install_deps(session)
    pytest_run(session, env)


@nox.session(python=python_versions, tags=["e2e"])
@nox.parametrize(
    "env",
    [t.to_dict() for t in e2e_tests],
    ids=[e.name for e in e2e_tests],
)
def cli_e2e_test(session, env: dict):
    env = TestEnv.from_dict(env)
    env.install_deps(session)
    pytest_run(session, env)
