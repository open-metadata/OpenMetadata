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
"""Owned Glue databases and S3 prefixes in the configured Athena account.

Athena cannot run in a disposable container, so isolation comes from one fresh Glue database per
test (`e2e_athena_<uuid>`, parameter `owner=cli-e2e-v2`) whose tables live under one fresh S3
prefix. Cleanup deletes exactly that database's tables, the database and the objects under that
prefix, on success and on failure. Nothing outside an owned database or prefix is touched.
"""

from __future__ import annotations

import logging
import re
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any
from urllib.parse import quote_plus

import boto3
from sqlalchemy import create_engine, text

from ..server import Env
from .baseline import (
    DATABASE_DESCRIPTION,
    build_athena_baseline,
    create_table_ddl,
    create_view_sql,
    insert_sql,
    render_value,
)

if TYPE_CHECKING:
    from collections.abc import Iterator

    from sqlalchemy.engine import Engine

    from .baseline import AthenaBaseline

logger = logging.getLogger(__name__)

REGION_ENV = "E2E_ATHENA_REGION"
STAGING_DIR_ENV = "E2E_ATHENA_S3STAGINGDIR"
WORKGROUP_ENV = "E2E_ATHENA_WORKGROUP"
# Optional: where owned table data lives. Defaults to a `cli-e2e-v2/` prefix in the staging bucket,
# which the identity can already write because Athena stores its query results there.
DATA_ROOT_ENV = "E2E_ATHENA_DATA_ROOT"
DATABASE_PARAMETERS = {"owner": "cli-e2e-v2"}
DATABASE_PREFIX = "e2e_athena_"
_OWNED_DATABASE = re.compile(rf"^{DATABASE_PREFIX}[0-9a-f]{{32}}$")
_S3_URI = re.compile(r"^s3://(?P<bucket>[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9])(?:/(?P<key>.*))?$")


@dataclass(frozen=True)
class S3Location:
    bucket: str
    prefix: str  # empty or ends with "/"

    @classmethod
    def parse(cls, uri: str) -> S3Location:
        match = _S3_URI.match(uri)
        if match is None:
            raise ValueError(f"Not an s3:// URI: {uri!r}")
        key = match.group("key") or ""
        return cls(match.group("bucket"), key if not key or key.endswith("/") else f"{key}/")

    def child(self, name: str) -> S3Location:
        if not name or "/" in name:
            raise ValueError(f"Invalid S3 path segment {name!r}")
        return S3Location(self.bucket, f"{self.prefix}{name}/")

    @property
    def uri(self) -> str:
        return f"s3://{self.bucket}/{self.prefix}"


def default_data_root(staging_dir: str) -> S3Location:
    return S3Location(S3Location.parse(staging_dir).bucket, "cli-e2e-v2/")


@dataclass(frozen=True)
class AthenaInstance:
    region: str
    workgroup: str
    data_root: S3Location
    glue: Any = field(repr=False)
    s3: Any = field(repr=False)
    engine: Engine = field(repr=False)

    def run(self, statement: str) -> list[tuple]:
        """Run one Athena statement and wait for it; returns the rows a query produces."""
        with self.engine.connect() as connection:
            result = connection.execute(text(statement))
            return [tuple(row) for row in result] if result.returns_rows else []


def _engine(region: str, staging_dir: str, workgroup: str) -> Engine:
    # Credentials come from the default AWS chain, exactly as the CLI's awsConfig resolves them.
    return create_engine(
        f"awsathena+rest://@athena.{region}.amazonaws.com:443/default"
        f"?s3_staging_dir={quote_plus(staging_dir)}&work_group={quote_plus(workgroup)}"
    )


@contextmanager
def athena_account() -> Iterator[AthenaInstance]:
    """Open Glue, S3 and Athena clients for the configured region and prove a query runs."""
    region = Env(REGION_ENV).get()
    staging_dir = Env(STAGING_DIR_ENV).get()
    workgroup = Env(WORKGROUP_ENV).get()
    data_root_uri = Env(DATA_ROOT_ENV, required=False).get()
    data_root = S3Location.parse(data_root_uri) if data_root_uri else default_data_root(staging_dir)
    if not data_root.prefix:
        raise ValueError(f"{DATA_ROOT_ENV} must name a prefix, not a bucket root")
    session = boto3.Session(region_name=region)
    with ExitStack() as cleanup:
        engine = _engine(region, staging_dir, workgroup)
        cleanup.callback(engine.dispose)
        instance = AthenaInstance(region, workgroup, data_root, session.client("glue"), session.client("s3"), engine)
        assert instance.run("SELECT 1") == [(1,)]
        logger.info("Athena E2E account ready; region=%s workgroup=%s", region, workgroup)
        yield instance


def _require_owned_database(name: str) -> str:
    if not _OWNED_DATABASE.match(name):
        raise ValueError(f"{name!r} is not a suite-owned Glue database")
    return name


@dataclass
class AthenaSource:
    instance: AthenaInstance
    database: str
    location: S3Location
    baseline: AthenaBaseline
    _closed: bool = field(default=False, init=False, repr=False)

    def require_active(self) -> None:
        if self._closed:
            raise ValueError("Athena source has already been closed")

    def run(self, statement: str) -> list[tuple]:
        self.require_active()
        return self.instance.run(statement)

    def qualified(self, table: str) -> str:
        self.baseline.table(table)
        return f'"{self.database}"."{table}"'

    def drop_table(self, name: str) -> None:
        """Drop a declared table in this owned database; its files stay under the owned prefix."""
        self.baseline.table(name)
        self.run(f"DROP TABLE `{self.database}`.`{name}`")

    def set_value(self, table: str, key: int, column: str, value: Any) -> None:
        """Update one column by `id` in a declared Iceberg table, the only format Athena can UPDATE."""
        declared = self.baseline.table(table)
        target = next((item for item in declared.columns if item.name == column), None)
        if target is None:
            raise KeyError(column)
        before = self.run(f"SELECT COUNT(*) FROM {self.qualified(table)} WHERE id = {int(key)}")
        if before != [(1,)]:
            raise ValueError(f"Expected one {table} row for key {key}, found {before[0][0]}")
        self.run(
            f'UPDATE {self.qualified(table)} SET "{column}" = {render_value(value, target.hive_type)} '
            f"WHERE id = {int(key)}"
        )

    def set_table_comment(self, table: str, comment: str) -> None:
        self.baseline.table(table)
        escaped = comment.replace("'", "''")
        self.run(f"ALTER TABLE `{self.database}`.`{table}` SET TBLPROPERTIES ('comment'='{escaped}')")


def _seed_source(source: AthenaSource) -> None:
    for table in source.baseline.tables:
        location = source.location.child(table.name).uri
        source.run(create_table_ddl(table, database=source.database, location=location))
        source.run(insert_sql(table, database=source.database))
    for view in source.baseline.views:
        source.run(create_view_sql(view, database=source.database))


def _delete_prefix(s3: Any, location: S3Location, database: str) -> None:
    if not location.prefix.endswith(f"/{_require_owned_database(database)}/"):
        raise ValueError(f"Refusing to delete a prefix the suite does not own: {location.uri}")
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=location.bucket, Prefix=location.prefix):
        keys = [{"Key": item["Key"]} for item in page.get("Contents", [])]
        if keys:
            s3.delete_objects(Bucket=location.bucket, Delete={"Objects": keys, "Quiet": True})


def _delete_database(glue: Any, database: str) -> None:
    _require_owned_database(database)
    paginator = glue.get_paginator("get_tables")
    for page in paginator.paginate(DatabaseName=database):
        for table in page.get("TableList", []):
            glue.delete_table(DatabaseName=database, Name=table["Name"])
    glue.delete_database(Name=database)


@contextmanager
def fresh_athena_source(instance: AthenaInstance) -> Iterator[AthenaSource]:
    """Create and seed one owned Glue database; remove it and its S3 prefix even on partial setup failure."""
    database = _require_owned_database(f"{DATABASE_PREFIX}{uuid.uuid4().hex}")
    location = instance.data_root.child(database)
    source = AthenaSource(instance, database, location, build_athena_baseline())
    try:
        with ExitStack() as cleanup:
            # Registered first, so they also run when database creation itself fails halfway.
            cleanup.callback(_delete_prefix, instance.s3, location, database)
            instance.glue.create_database(
                DatabaseInput={
                    "Name": database,
                    "Description": DATABASE_DESCRIPTION,
                    "LocationUri": location.uri,
                    "Parameters": DATABASE_PARAMETERS,
                }
            )
            cleanup.callback(_delete_database, instance.glue, database)
            _seed_source(source)
            logger.info("Owned Athena database=%s location=%s", database, location.uri)
            yield source
    finally:
        source._closed = True
