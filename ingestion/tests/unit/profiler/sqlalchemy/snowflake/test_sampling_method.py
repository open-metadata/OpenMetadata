from unittest import TestCase
from unittest.mock import patch
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
from metadata.profiler.api.models import ProfileSampleConfig
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.processor.sampler.sqlalchemy.snowflake.sampler import (
    SnowflakeSampler,
)

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

    with patch.object(
        SQAProfilerInterface, "_convert_table_to_orm_object", return_value=User
    ):
        sqa_profiler_interface = SQAProfilerInterface(
            snowflake_conn, None, table_entity, None, None, None, None, None, 5, 43200
        )
    session = sqa_profiler_interface.session

    def test_omit_sampling_method_type(self):
        """
        use BERNOULLI if sampling method type is not specified.
        """
        sampler = SnowflakeSampler(
            client=self.session,
            table=User,
            profile_sample_config=ProfileSampleConfig(
                profile_sample_type=ProfileSampleType.PERCENTAGE, profile_sample=50.0
            ),
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
                client=self.session,
                table=User,
                profile_sample_config=ProfileSampleConfig(
                    profile_sample_type=ProfileSampleType.PERCENTAGE,
                    profile_sample=50.0,
                    sampling_method_type=sampling_method_type,
                ),
            )
            query: CTE = sampler.get_sample_query()
            assert f"FROM users SAMPLE {sampling_method_type.value}" in str(query)
