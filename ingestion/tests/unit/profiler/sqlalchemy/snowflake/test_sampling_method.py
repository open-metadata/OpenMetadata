from unittest import TestCase
from uuid import uuid4

from sqlalchemy import Column, Integer
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    ProfileSampleType,
    SamplingMethodType,
    Table,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.sampler.sqlalchemy.snowflake.sampler import SnowflakeSampler

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)


class SampleTest(TestCase):
    table_entity = Table(
        id=uuid4(),
        name="user",
        columns=[
            EntityColumn(
                name=ColumnName("id"),
                dataType=DataType.INT,
            ),
        ],
    )

    snowflake_conn = SnowflakeConnection(
        username="myuser", account="myaccount", warehouse="mywarehouse"
    )

    sampler = SQASampler(
        service_connection_config=snowflake_conn,
        ometa_client=None,
        entity=None,
        orm_table=User,
    )
    sqa_profiler_interface = SQAProfilerInterface(
        snowflake_conn, None, table_entity, None, sampler, 5, 43200, orm_table=User
    )
    session = sqa_profiler_interface.session

    def test_omit_sampling_method_type(self):
        """
        use BERNOULLI if sampling method type is not specified.
        """
        sampler = SnowflakeSampler(
            service_connection_config=self.snowflake_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profile_sample_type=ProfileSampleType.PERCENTAGE, profile_sample=50.0
            ),
            orm_table=User,
        )
        query: CTE = sampler.get_sample_query()
        assert "FROM users SAMPLE BERNOULLI" in str(query)

    def test_specify_sampling_method_type(self):
        """
        use specified sampling method type.
        """
        for sampling_method_type in [
            SamplingMethodType.SYSTEM,
            SamplingMethodType.BERNOULLI,
        ]:
            sampler = SnowflakeSampler(
                service_connection_config=self.snowflake_conn,
                ometa_client=None,
                entity=self.table_entity,
                sample_config=SampleConfig(
                    profile_sample_type=ProfileSampleType.PERCENTAGE,
                    profile_sample=50.0,
                    sampling_method_type=sampling_method_type,
                ),
                orm_table=User,
            )
            query: CTE = sampler.get_sample_query()
            assert f"FROM users SAMPLE {sampling_method_type.value}" in str(query)
