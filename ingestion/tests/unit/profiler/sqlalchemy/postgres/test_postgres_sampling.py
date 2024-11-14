from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from metadata.profiler.processor.sampler.sqlalchemy.postgres.sampler import PostgresSampler
from sqlalchemy import Column, Integer
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    ProfileSampleType,
    Table,
)
from metadata.profiler.api.models import ProfileSampleConfig, SamplingMethodType
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.functions.table_metric_computer import TableType
from metadata.utils.partition import PartitionIntervalTypes, PartitionProfilerConfig

from metadata.generated.schema.entity.services.connections.database.postgresConnection import PostgresConnection

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

    psql_conn = PostgresConnection(
        username="test",
        hostPort="localhost:5432",
        database="test",
    )

    with patch.object(
        SQAProfilerInterface, "_convert_table_to_orm_object", return_value=User
    ):
        sqa_profiler_interface = SQAProfilerInterface(
            psql_conn, None, table_entity, None, None, None, None, None, 5, 43200
        )
    session = sqa_profiler_interface.session

    def test_sampling_default(self):
        """
        Test sampling
        """
        sampler = PostgresSampler(
            client=self.session,
            table=User,
            profile_sample_config=ProfileSampleConfig(
                profile_sample_type=ProfileSampleType.PERCENTAGE,
                profile_sample=50.0,
            ),
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            "SELECT users_1.id \nFROM users AS users_1 TABLESAMPLE bernoulli(50.0)"
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling(self):
        """
        Test sampling
        """
        for sampling_method_type in [
            SamplingMethodType.SYSTEM,
            SamplingMethodType.BERNOULLI,
        ]:
            sampler = PostgresSampler(
                client=self.session,
                table=User,
                profile_sample_config=ProfileSampleConfig(
                    profile_sample_type=ProfileSampleType.PERCENTAGE,
                    profile_sample=50.0,
                    sampling_method_type=sampling_method_type,
                ),
            )
            query: CTE = sampler.get_sample_query()
        expected_query = (
            f"SELECT users_1.id \nFROM users AS users_1 TABLESAMPLE {sampling_method_type.value}(50.0)"
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling_with_partition(self):
        """
        Test sampling with partiton.
        """
        sampler = PostgresSampler(
            client=self.session,
            table=User,
            profile_sample_config=ProfileSampleConfig(
                profile_sample_type=ProfileSampleType.PERCENTAGE, profile_sample=50.0
            ),
            partition_details=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName="id",
                partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
                partitionValues=["1", "2"],
            ),
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            "SELECT users_1.id \nFROM users AS users_1 "
            "TABLESAMPLE bernoulli(50.0) \nWHERE id IN ('1', '2')"
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )
