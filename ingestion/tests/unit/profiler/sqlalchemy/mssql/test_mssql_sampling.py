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
    Table,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.mssql.sampler import MssqlSampler
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

        cls.mssql_conn = MssqlConnection(
            username="myuser",
            password="myaccount",
            database="mywarehouse",
            hostPort="host//foo.bar:5432",
        )

        sampler = SQASampler(
            service_connection_config=cls.mssql_conn,
            ometa_client=None,
            entity=None,
        )
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.mssql_conn,
            None,
            cls.table_entity,
            None,
            sampler,
            5,
            43200,
        )

        cls.session = cls.sqa_profiler_interface.session

    def test_omit_sampling_method_type(self, sampler_mock):
        """
        use percentage sampling.
        """
        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id \n'
            "FROM users AS users_1 TABLESAMPLE system(50.0 PERCENT))\n "
            'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_row_sampling(self, sampler_mock):
        """
        use ROW sampling if profile sample type is ROW.
        """
        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.ROWS, profileSample=50
            ),
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id '
            "\nFROM users AS users_1 TABLESAMPLE system(50 ROWS))\n "
            'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling_with_partition(self, sampler_mock):
        """
        use specified partition columns.
        """
        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE,
                profileSample=50.0,
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
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id \n'
            "FROM users AS users_1 TABLESAMPLE system(50.0 PERCENT) "
            "\nWHERE id IN ('1', '2'))\n SELECT \"9bc65c2abec141778ffaa729489f3e87_rnd\".id "
            '\nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )
