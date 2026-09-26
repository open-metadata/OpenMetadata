#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Owned BigQuery datasets in the two configured E2E projects.

BigQuery cannot run in a disposable container, so isolation comes from one fresh
dataset per test (labelled, with a table-expiration safety net) inside projects
the E2E service account may write to. Nothing outside an owned dataset is mutated.
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import google.auth
import sqlalchemy_bigquery as bq
from google.api_core.exceptions import GoogleAPICallError
from google.cloud import bigquery
from google.oauth2 import service_account
from sqlalchemy import create_engine, text
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_fixed

from ..runtime.ci import mask_secrets
from ..server import Env
from .baseline import build_bigquery_baseline, qualified_dataset

if TYPE_CHECKING:
    from collections.abc import Iterator

    from sqlalchemy.engine import Engine

    from ..features.database.source import SqlSourceBaseline

logger = logging.getLogger(__name__)

PRIMARY_PROJECT_ENV = "E2E_BQ_PROJECT_ID"
SECONDARY_PROJECT_ENV = "E2E_BQ_PROJECT_ID2"
# The CLI expands ${VARS} in the raw YAML before parsing, so the key it reads must stay on one line.
CLI_PRIVATE_KEY_ENV = "E2E_BQ_CLI_PRIVATE_KEY"
AUTH_ENV = "E2E_BQ_AUTH"
SERVICE_ACCOUNT_AUTH = "service_account"
ADC_AUTH = "adc"
_CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform"
DATASET_LABELS = {"owner": "cli-e2e-v2"}
# Leaked tables expire even if teardown never runs; empty datasets are removed by label.
_TABLE_EXPIRATION_MS = 24 * 60 * 60 * 1000
_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


@dataclass(frozen=True)
class BigQueryProject:
    project_id: str
    env_key: str
    client: bigquery.Client = field(repr=False)
    admin_engine: Engine = field(repr=False)


@dataclass(frozen=True)
class BigQueryInstance:
    primary: BigQueryProject
    secondary: BigQueryProject
    location: str
    auth: str = SERVICE_ACCOUNT_AUTH

    def project(self, project_id: str) -> BigQueryProject:
        for project in (self.primary, self.secondary):
            if project.project_id == project_id:
                return project
        raise ValueError("Project is not one of the configured E2E projects")


def auth_mode() -> str:
    """`service_account` (CI) reads E2E_BQ_* key variables; `adc` uses Application Default Credentials."""
    mode = Env(AUTH_ENV, default=SERVICE_ACCOUNT_AUTH).get()
    if mode not in (SERVICE_ACCOUNT_AUTH, ADC_AUTH):
        raise ValueError(f"{AUTH_ENV} must be {SERVICE_ACCOUNT_AUTH!r} or {ADC_AUTH!r}")
    return mode


def _credentials_info() -> dict[str, str]:
    private_key = Env("E2E_BQ_PRIVATE_KEY").get().replace("\\n", "\n")
    private_key_id = Env("E2E_BQ_PRIVATE_KEY_ID").get()
    mask_secrets(private_key, private_key_id)
    return {
        "type": "service_account",
        "project_id": Env(PRIMARY_PROJECT_ENV).get(),
        "private_key_id": private_key_id,
        "private_key": private_key,
        "client_email": Env("E2E_BQ_CLIENT_EMAIL").get(),
        "token_uri": "https://oauth2.googleapis.com/token",
    }


def _restore_environment(previous: dict[str, str | None]) -> None:
    for key, value in previous.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def _open_project(
    cleanup: ExitStack, env_key: str, credentials, engine_args: dict[str, Any], location: str
) -> BigQueryProject:
    project_id = Env(env_key).get()
    client = bigquery.Client(project=project_id, credentials=credentials, location=location)
    cleanup.callback(client.close)
    engine = create_engine(f"bigquery://{project_id}", location=location, **engine_args)
    cleanup.callback(engine.dispose)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
    return BigQueryProject(project_id, env_key, client, engine)


@contextmanager
def bigquery_account() -> Iterator[BigQueryInstance]:
    """Authenticate both configured projects and export the CLI key, restoring the environment on exit."""
    location = Env("E2E_BQ_LOCATION", default="US").get()
    auth = auth_mode()
    with ExitStack() as cleanup:
        if auth == ADC_AUTH:
            credentials, _ = google.auth.default(scopes=[_CLOUD_PLATFORM_SCOPE])
            engine_args: dict[str, Any] = {}
        else:
            info = _credentials_info()
            credentials = service_account.Credentials.from_service_account_info(info)
            engine_args = {"credentials_info": info}
            cli_key = info["private_key"].replace("\n", "\\n")
            mask_secrets(cli_key)
            cleanup.callback(_restore_environment, {CLI_PRIVATE_KEY_ENV: os.environ.get(CLI_PRIVATE_KEY_ENV)})
            os.environ[CLI_PRIVATE_KEY_ENV] = cli_key
        primary = _open_project(cleanup, PRIMARY_PROJECT_ENV, credentials, engine_args, location)
        secondary = _open_project(cleanup, SECONDARY_PROJECT_ENV, credentials, engine_args, location)
        if primary.project_id == secondary.project_id:
            raise ValueError("E2E_BQ_PROJECT_ID and E2E_BQ_PROJECT_ID2 must name different projects")
        logger.info("BigQuery E2E projects authenticated; auth=%s location=%s", auth, location)
        yield BigQueryInstance(primary, secondary, location, auth)


@dataclass
class BigQuerySource:
    project: BigQueryProject
    dataset: str
    baseline: SqlSourceBaseline
    _closed: bool = field(default=False, init=False, repr=False)

    @property
    def project_id(self) -> str:
        return self.project.project_id

    @property
    def qualified(self) -> str:
        return qualified_dataset(self.project_id, self.dataset)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("BigQuery source has already been closed")

    def _table(self, name: str):
        self.require_active()
        return self.baseline.metadata.tables[f"{self.dataset}.{name}"]

    def run(
        self,
        statement: str,
        *,
        client: bigquery.Client | None = None,
        parameters: tuple[bigquery.ScalarQueryParameter, ...] = (),
    ) -> bigquery.QueryJob:
        """Run one statement against this dataset and wait for it; `client` selects the billing project."""
        self.require_active()
        config = bigquery.QueryJobConfig(query_parameters=list(parameters))
        job = (client or self.project.client).query(statement, job_config=config)
        job.result()
        return job

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned dataset."""
        self._table(name)
        self.run(f"DROP TABLE {self.qualified}.{name}")

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one declared column by primary key in this owned dataset."""
        target_column = self._table(table).c[column]
        value_type = target_column.type.compile(dialect=bq.BigQueryDialect())
        job = self.run(
            f"UPDATE {self.qualified}.{table} SET {column} = @value WHERE id = @key",
            parameters=(
                bigquery.ScalarQueryParameter("value", value_type, value),
                bigquery.ScalarQueryParameter("key", "INT64", key),
            ),
        )
        if job.num_dml_affected_rows != 1:
            raise ValueError(f"Expected one {table} row for key {key}, found {job.num_dml_affected_rows}")

    def set_description(self, table: str, description: str) -> None:
        self._table(table)
        self.run(f"ALTER TABLE {self.qualified}.{table} SET OPTIONS(description={_string_literal(description)})")


def _string_literal(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def _seed_source(source: BigQuerySource) -> None:
    with source.project.admin_engine.begin() as connection:
        source.baseline.metadata.create_all(connection, checkfirst=False)
        for seed in source.baseline.seeds:
            table = source.baseline.metadata.tables[f"{source.dataset}.{seed.table_name}"]
            # One multi-row INSERT is one DML job; executemany would issue a job per row.
            connection.execute(table.insert().values(seed.rows))
    for statement in source.baseline.ddl:
        source.run(statement)


def _delete_dataset(project: BigQueryProject, dataset: str) -> None:
    project.client.delete_dataset(f"{project.project_id}.{dataset}", delete_contents=True)


@contextmanager
def fresh_bigquery_source(project: BigQueryProject, location: str) -> Iterator[BigQuerySource]:
    """Create and seed one fresh dataset; attempt deletion even on partial setup failure."""
    dataset = f"e2e_bq_{uuid.uuid4().hex}"
    if not _IDENTIFIER.match(dataset):
        raise ValueError("generated dataset name is not a plain identifier")
    source = BigQuerySource(project, dataset, build_bigquery_baseline(project.project_id, dataset))
    definition = bigquery.Dataset(f"{project.project_id}.{dataset}")
    definition.location = location
    definition.labels = DATASET_LABELS
    definition.default_table_expiration_ms = _TABLE_EXPIRATION_MS
    try:
        with ExitStack() as cleanup:
            project.client.create_dataset(definition, exists_ok=False)
            cleanup.callback(_delete_dataset, project, dataset)
            _seed_source(source)
            logger.info("Owned BigQuery dataset=%s.%s", project.project_id, dataset)
            yield source
    finally:
        source._closed = True


def wait_for_jobs_visible(project: BigQueryProject, location: str, job_ids: list[str], *, timeout: float = 300) -> None:
    """Block until INFORMATION_SCHEMA.JOBS lists every job, so system metrics cannot read a stale view."""
    region = f"region-{location.lower()}"
    query = (
        f"SELECT job_id FROM `{project.project_id}`.`{region}`.INFORMATION_SCHEMA.JOBS "
        "WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY) AND job_id IN UNNEST(@ids)"
    )
    config = bigquery.QueryJobConfig(query_parameters=[bigquery.ArrayQueryParameter("ids", "STRING", job_ids)])
    wanted = set(job_ids)

    def visible():
        seen = {row.job_id for row in project.client.query(query, job_config=config).result()}
        assert wanted <= seen, f"jobs not yet visible in {region} INFORMATION_SCHEMA.JOBS: {sorted(wanted - seen)}"

    Retrying(
        retry=retry_if_exception_type((AssertionError, GoogleAPICallError)),
        stop=stop_after_delay(timeout),
        wait=wait_fixed(5),
        reraise=True,
    )(visible)
