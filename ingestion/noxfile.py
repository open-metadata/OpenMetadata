import os
from dataclasses import dataclass
from itertools import chain
from typing import List

import nox

integration_test_dir = "tests/integration"


@dataclass
class TestEnv:
    name: str
    extras: List[str]
    paths: List[str]


def env_id(env: TestEnv):
    return env.name


def simple_integration_env(name: str):
    return TestEnv(
        f"inteagration-{name}",
        ["test", name],
        [os.path.join(integration_test_dir, name)],
    )


# Define the Python versions and environments
python_versions = ["3.8", "3.9", "3.10", "3.11"]
envs = [
    simple_integration_env("postgres"),
    simple_integration_env("mysql"),
    simple_integration_env("kafka"),
    simple_integration_env("mssql"),
    simple_integration_env("trino"),
    simple_integration_env("datalake-s3"),
]
# TODO: these should be moved to separate integration tests
others = TestEnv(
    name="integration-others",
    paths=[
        path
        for path in os.listdir(integration_test_dir)
        if os.path.join(integration_test_dir, path)
        not in chain(*[e.paths for e in envs])
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
envs += [others]
envs += [
    TestEnv(
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
]


@nox.session(python=python_versions)
@nox.parametrize("env", envs, ids=[e.name for e in envs])
def test(session, env: TestEnv):
    session.install(f".[{','.join(env.extras)}]")
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


@nox.session(python=python_versions)
@nox.parametrize(
    "env",
    [
        TestEnv(
            name=name, extras=extras, paths=["tests/cli_e2e/test_cli_" + name + ".py"]
        )
        for (name, extras) in [
            [
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
    ],
    ids=[e.name for e in envs],
)
def cli_e2e_test(session, env: TestEnv):
    session.install(f".[{','.join(env.extras)}]")
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
