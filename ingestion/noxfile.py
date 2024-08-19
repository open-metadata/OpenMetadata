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


def simple_env(name: str):
    return TestEnv(name, ["test", name], [os.path.join(integration_test_dir, name)])


# Define the Python versions and environments
python_versions = ["3.8", "3.9", "3.10", "3.11"]
envs = [
    simple_env("postgres"),
    simple_env("mysql"),
    simple_env("kafka"),
    simple_env("mssql"),
    simple_env("trino"),
    simple_env("datalake-s3"),
]
other_itegration = TestEnv(
    name="others",
    paths=[
        path
        for path in os.listdir(integration_test_dir)
        if os.path.join(integration_test_dir, path)
        not in chain(*[e.paths for e in envs])
    ],
    extras=[
        "test",
        "databricks",
        "deltalake",
        "oracle",
        "clickhouse",
        "datalake-gcs",
        "pgspider",
        "pii-processor",
        "mlflow",
        "dagster",
        "neo4j",
        "avro",
        "snowflake",
        "domo",
        "looker",
        "lkml"
    ],
)
envs += [other_itegration]
envs += [
    TestEnv(
        name="unit",
        extras=[
            "test",
            "datalake-gcs",
            "bigquery",
            "kafka",
            "trino",
            "pii-processor",
            "hive",
            "domo",
            "looker",
            "lkml",
            "iceberg",
            "doris",
            "deltalake-spark",
            "databricks",
            "bigtable",
            "athena",
            "tableau",
            "mongo",
            "redshift",
            "snowflake",
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
