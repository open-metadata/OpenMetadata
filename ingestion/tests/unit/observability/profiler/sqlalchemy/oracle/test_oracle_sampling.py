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

"""Oracle percentage sampling keeps its per-row random filter in a query block Oracle does not merge."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import Column, Integer, String
from sqlalchemy.dialects import oracle
from sqlalchemy.orm import DeclarativeBase

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import ColumnName, DataType, Table
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
    OracleServiceName,
)
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.models import ProfileSampleConfig, SampleConfig
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sqlalchemy.oracle.sampler import OracleSampler
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.service_spec.service_spec import import_sampler_class


class Base(DeclarativeBase):
    pass


class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    first_name = Column(String(50))


def oracle_sampler(profile_sample: float, sample_type: ProfileSampleType) -> OracleSampler:
    with patch.object(SQASampler, "build_table_orm", return_value=Customer):
        return OracleSampler(
            service_connection_config=OracleConnection(
                username="reader",
                password="secret",
                hostPort="localhost:1521",
                oracleConnectionType=OracleServiceName(oracleServiceName="FREEPDB1"),
                instantClientDirectory="",
            ),
            ometa_client=None,
            entity=Table(
                id=uuid4(),
                name="customers",
                columns=[
                    EntityColumn(name=ColumnName("id"), dataType=DataType.INT),
                    EntityColumn(name=ColumnName("first_name"), dataType=DataType.VARCHAR),
                ],
            ),
            config=DatabaseSamplerConfig(
                sample_config=SampleConfig(
                    profileSampleConfig=ProfileSampleConfig(
                        sampleConfigType=SampleConfigType.STATIC,
                        config=StaticSamplingConfig(profileSample=profile_sample, profileSampleType=sample_type),
                    )
                )
            ),
        )


@pytest.mark.parametrize("column", [None, Customer.__table__.c.first_name], ids=["table", "column"])
def test_percentage_sample_draws_its_random_value_in_an_unmerged_query_block(column):
    sampler = oracle_sampler(50.0, ProfileSampleType.PERCENTAGE)

    query = sampler.get_sample_query(sampler._resolve_sample_config, column=column)
    sql = str(query.compile(dialect=oracle.dialect(), compile_kwargs={"literal_binds": True}))
    random_block, sample_query = sql.split("\n SELECT ", 1)

    assert random_block.split("(", 1)[1].startswith("SELECT /*+ NO_MERGE */ ")
    assert "DBMS_RANDOM.VALUE" in random_block
    assert "random <= 50.0" in sample_query


def test_oracle_profiler_and_test_suite_use_the_oracle_sampler():
    assert import_sampler_class(ServiceType.Database, "oracle") is OracleSampler
