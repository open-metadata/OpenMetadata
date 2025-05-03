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
    PartitionIntervalTypes,
    PartitionProfilerConfig,
    ProfileSampleType,
    SamplingMethodType,
    Table,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.postgres.sampler import PostgresSampler
from metadata.sampler.sqlalchemy.sampler import SQASampler

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)


@patch.object(SQASampler, "build_table_orm", return_value=User)
class SampleTest(TestCase):
    @classmethod
    @patch.object(SQASampler, "build_table_orm", return_value=User)
    def setUpClass(cls, sampler_mock):
        cls.table_entity = Table(
            id=uuid4(),
            name="user",
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                ),
            ],
        )

        cls.psql_conn = PostgresConnection(
            username="test",
            hostPort="localhost:5432",
            database="test",
        )

        cls.sampler = SQASampler(
            service_connection_config=cls.psql_conn,
            ometa_client=None,
            entity=None,
        )
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.psql_conn,
            None,
            cls.table_entity,
            None,
            cls.sampler,
            5,
            43200,
        )
        cls.session = cls.sqa_profiler_interface.session

    def test_sampling_default(self, sampler_mock):
        """
        Test sampling
        """
        sampler = PostgresSampler(
            service_connection_config=self.psql_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE,
                profileSample=50.0,
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

    def test_sampling(self, sampler_mock):
        """
        Test sampling
        """
        for sampling_method_type in [
            SamplingMethodType.SYSTEM,
            SamplingMethodType.BERNOULLI,
        ]:
            sampler = PostgresSampler(
                service_connection_config=self.psql_conn,
                ometa_client=None,
                entity=self.table_entity,
                sample_config=SampleConfig(
                    profileSampleType=ProfileSampleType.PERCENTAGE,
                    profileSample=50.0,
                    samplingMethodType=sampling_method_type,
                ),
            )
            query: CTE = sampler.get_sample_query()
        expected_query = f"SELECT users_1.id \nFROM users AS users_1 TABLESAMPLE {sampling_method_type.value}(50.0)"
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling_with_partition(self, sampler_mock):
        """
        Test sampling with partiton.
        """
        sampler = PostgresSampler(
            service_connection_config=self.psql_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
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
