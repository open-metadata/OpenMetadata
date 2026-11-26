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
"""Sampling against physical scalar columns in a designated disposable Oracle database."""

import hashlib
import logging
import os
from collections.abc import Iterator
from unittest.mock import patch
from uuid import uuid4

import oracledb
import pytest
from sqlalchemy import Column as SqaColumn
from sqlalchemy import Integer, String
from sqlalchemy.orm import DeclarativeBase

from metadata.data_quality.validations.models import TableParameter
from metadata.data_quality.validations.table.sqlalchemy.tableDiff import build_sample_where_clause
from metadata.generated.schema.entity.data.table import Column, ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
    OracleServiceName,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseServiceType
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.processor.runner import QueryRunner
from metadata.sampler.models import ProfileSampleConfig, SampleConfig
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sqlalchemy.oracle.sampler import OracleSampler
from metadata.sampler.sqlalchemy.sampler import SQASampler

SALT = "salt"
THRESHOLD = "19999999"


class SampledBase(DeclarativeBase):
    pass


@pytest.fixture(scope="module")
def oracle_sampling_connection() -> Iterator[oracledb.Connection]:
    """Use an explicitly supplied disposable account with CREATE TABLE permission."""
    dsn = os.getenv("ORACLE_SAMPLING_TEST_DSN")
    user = os.getenv("ORACLE_SAMPLING_TEST_USER")
    password = os.getenv("ORACLE_SAMPLING_TEST_PASSWORD")
    if not all((dsn, user, password)):
        pytest.skip("Set ORACLE_SAMPLING_TEST_DSN, ORACLE_SAMPLING_TEST_USER and ORACLE_SAMPLING_TEST_PASSWORD")
    with oracledb.connect(user=user, password=password, dsn=dsn, tcp_connect_timeout=10, retry_count=0) as connection:
        yield connection


@pytest.mark.parametrize(
    "sql_type, prefix, key_columns",
    [
        ("NVARCHAR2(200)", "key", ["key_text"]),
        ("NCHAR(16)", "key", ["key_text"]),
        ("NVARCHAR2(200)", "é東😀", ["key_text"]),
        ("NCHAR(16)", "é東😀", ["key_text"]),
        ("VARCHAR2(200)", "key", ["key_text"]),
        ("VARCHAR2(200)", "key", ["key_number"]),
        ("NVARCHAR2(200)", "key", ["key_number", "key_text"]),
        ("VARCHAR2(4000)", "x" * 3992, ["key_text"]),
        ("NVARCHAR2(2000)", "x" * 1992, ["key_text"]),
    ],
    ids=[
        "nvarchar-ascii",
        "nchar-ascii",
        "nvarchar-unicode",
        "nchar-unicode",
        "varchar-control",
        "integer-control",
        "mixed-composite",
        "varchar-4000-byte-hash",
        "long-national-ascii",
    ],
)
def test_oracle_sampling_matches_utf8_selected_ids(
    oracle_sampling_connection: oracledb.Connection, sql_type: str, prefix: str, key_columns: list[str]
) -> None:
    connection = oracle_sampling_connection
    table_name = f"OM_SAMPLING_{uuid4().hex[:12]}"
    with connection.cursor() as cursor:
        cursor.execute("SELECT value FROM nls_database_parameters WHERE parameter = 'NLS_CHARACTERSET'")
        charset = cursor.fetchone()[0]
        if not prefix.isascii() and charset != "AL32UTF8":
            pytest.skip("Short Unicode parity requires the AL32UTF8 database character set")
        cursor.execute(f"CREATE TABLE {table_name} (id NUMBER, key_number NUMBER, key_text {sql_type})")
        try:
            if sql_type.startswith("N"):
                cursor.setinputsizes(None, None, oracledb.DB_TYPE_NVARCHAR)
            cursor.executemany(
                f"INSERT INTO {table_name} VALUES (:1, :2, :3)",
                [(index, index, f"{prefix}{index:04}") for index in range(400)],
            )
            # Read stored values so fixed-width NCHAR padding is retained in the UTF8 reference.
            cursor.execute(f"SELECT id, key_number, key_text FROM {table_name}")
            stored_rows = cursor.fetchall()
            expected = set()
            for row_id, key_number, key_text in stored_rows:
                values = {"key_number": str(key_number), "key_text": key_text}
                key = "".join(values[name] for name in key_columns) + SALT
                if hashlib.md5(key.encode("utf-8"), usedforsecurity=False).hexdigest()[:8] < THRESHOLD:
                    expected.add(row_id)
            table = TableParameter.model_construct(
                database_service_type=DatabaseServiceType.Oracle,
                columns=[
                    Column(name=ColumnName("key_number"), dataType=DataType.INT),
                    Column(name=ColumnName("key_text"), dataType=DataType.STRING),
                ],
            )
            predicate = build_sample_where_clause(table, key_columns, SALT, THRESHOLD)
            cursor.execute(f"SELECT id FROM {table_name} WHERE {predicate}")
            actual = {row[0] for row in cursor.fetchall()}
            assert 0 < len(expected) < len(stored_rows)
            logging.info(
                "%s: selected=%s, UTF8 reference=%s, difference=%s",
                sql_type,
                len(actual),
                len(expected),
                len(actual ^ expected),
            )
            assert actual == expected
        finally:
            cursor.execute(f"DROP TABLE {table_name} PURGE")


def test_percentage_sample_reads_part_of_the_table_in_every_metric_query(
    oracle_sampling_connection: oracledb.Connection,
) -> None:
    """Issue #37877: the sample filter references no column, so once the metric query
    also counted distinct values Oracle evaluated it once per execution, and each query read
    either every row or none."""
    host_port, service_name = os.environ["ORACLE_SAMPLING_TEST_DSN"].split("/", 1)
    table_name = f"OM_PCT_SAMPLING_{uuid4().hex[:12]}"
    row_count = 400
    with oracle_sampling_connection.cursor() as cursor:
        cursor.execute(f"CREATE TABLE {table_name} (id NUMBER PRIMARY KEY, label VARCHAR2(20))")
        try:
            cursor.executemany(
                f"INSERT INTO {table_name} VALUES (:1, :2)",
                [(index, f"label-{index % 40}") for index in range(row_count)],
            )
            oracle_sampling_connection.commit()
            sampled_table = type(
                "PercentageSampledRows",
                (SampledBase,),
                {
                    "__tablename__": table_name.lower(),
                    "id": SqaColumn(Integer, primary_key=True),
                    "label": SqaColumn(String(20)),
                },
            )
            with patch.object(SQASampler, "build_table_orm", return_value=sampled_table):
                sampler = OracleSampler(
                    service_connection_config=OracleConnection(
                        username=os.environ["ORACLE_SAMPLING_TEST_USER"],
                        password=os.environ["ORACLE_SAMPLING_TEST_PASSWORD"],
                        hostPort=host_port,
                        oracleConnectionType=OracleServiceName(oracleServiceName=service_name),
                        instantClientDirectory="",
                    ),
                    ometa_client=None,
                    entity=Table(
                        id=uuid4(),
                        name=table_name.lower(),
                        columns=[
                            Column(name=ColumnName("id"), dataType=DataType.INT),
                            Column(name=ColumnName("label"), dataType=DataType.VARCHAR),
                        ],
                    ),
                    config=DatabaseSamplerConfig(
                        sample_config=SampleConfig(
                            profileSampleConfig=ProfileSampleConfig(
                                sampleConfigType=SampleConfigType.STATIC,
                                config=StaticSamplingConfig(
                                    profileSample=50, profileSampleType=ProfileSampleType.PERCENTAGE
                                ),
                            )
                        )
                    ),
                )
            label = sampled_table.__table__.c.label
            values_counts = []
            for _ in range(8):
                with sampler.session_factory() as session:
                    runner = QueryRunner(
                        session=session,
                        dataset=sampler.get_dataset(column=label),
                        raw_dataset=sampler.raw_dataset,
                    )
                    row = runner.select_first_from_sample(
                        Metrics.valuesCount.value(label).fn(),
                        Metrics.distinctCount.value(label).fn(),
                    )
                values_counts.append(row.valuesCount)
            sampler.close()
            logging.info("50%% sample of %s rows read %s", row_count, values_counts)
            assert all(0 < count < row_count for count in values_counts), values_counts
        finally:
            cursor.execute(f"DROP TABLE {table_name} PURGE")
