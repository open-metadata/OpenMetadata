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
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.security.credentials.gcpCredentials import GCPCredentials
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
)
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.functions.table_metric_computer import TableType
from metadata.sampler.models import SampleConfig
from metadata.sampler.sqlalchemy.bigquery.sampler import BigQuerySampler
from metadata.sampler.sqlalchemy.sampler import SQASampler

Base = declarative_base()

# This is a bogus private key for testing purposes
PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDMGwM93kIt3D4r4+dWAGdoTboSaZcFLhsG1lvnZlYEpnZoFo1M
ek7laRKDUW3CkdTlSid9p4/RTs9SYKuuXvNKNSLApHUeR2zgKBIHYTGGv1t1bEWc
ohVeqr7w8HkFr9LV4qxgFEWBBd3QYncY/Y1iZgTtbmMiUxJN9vj/kuH0xQIDAQAB
AoGAPDqAY2JRrwy9v9/ZpPQrj4jYLpS//sRTL1pT9l2pZmfkquR0v6ub2nB+CQgf
VnoIE70lGBw5AS+7V/i00JiuO6GP/MWWqxKdc5McjBGYDIb+9gQ/DrryVDHsqgGX
iZrWr7rIrpGsbCB2xt2HPpKR7D9IpI8FA+EEU9fIPfETM6ECQQDv69L78zdijSNk
CYx70dVHqCiDZT5RbkJqDmQwKabIGXBqZLTM+7ZAHotq0EXGc5BvQGyIMso/qIOs
Wq3imi3dAkEA2ci4xEzj5guQcGxoVcxfGm+M/VqXLuw/eW1sYdOp52OwdDywxG+I
6tpm5ByVowhqT8PHDJVOy8GEV9QNw0Y4CQJBAJiyn/rJJlPr/j1aMnZP642KwhY2
pr4PDegQNsXMjKDISBr+82+POMSAbD1UR0RyItgbybe5k62GZB+bKxaRCGUCQEVj
l8MrwH0eeCHp2IBlwnN40VIz1/GiYkL9I0g0GXFZKPKQF74uz1AM0DWkCeVNHBpY
BYaz18xB1znonY33RIkCQQDE3wAWxFrvr582J12qJkE4enmNhRJFdcSREDX54d/5
VEhPQF0i0tUU7Fl071hcYaiQoZx4nIjN+NG6p5QKbl6k
-----END RSA PRIVATE KEY-----"""


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)


@patch.object(SQASampler, "build_table_orm", return_value=User)
class SampleTest(TestCase):
    @classmethod
    @patch.object(SQASampler, "build_table_orm", return_value=User)
    def setUpClass(cls, sampler_mock) -> None:
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

        cls.bq_conn = BigQueryConnection(
            credentials=GCPCredentials(
                gcpConfig=GcpCredentialsValues(
                    type="service_account",
                    projectId="myproject",
                    privateKeyId="mykey",
                    privateKey=PRIVATE_KEY,
                    clientEmail="myclientemail",
                    clientId="myclientid",
                    clientX509CertUrl="https://www.googleapis.com/oauth2/v1/certs",
                )
            )
        )

        cls.sampler = SQASampler(
            service_connection_config=cls.bq_conn,
            ometa_client=None,
            entity=None,
        )
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.bq_conn,
            None,
            cls.table_entity,
            None,
            cls.sampler,
            5,
            43200,
        )
        cls.session = cls.sqa_profiler_interface.session

    def test_sampling(self, sampler_mock):
        """
        Test sampling
        """
        sampler = BigQuerySampler(
            service_connection_config=self.bq_conn,
            ometa_client=None,
            entity=self.table_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
            table_type=TableType.Regular,
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            "SELECT users_1.id \nFROM users AS users_1 TABLESAMPLE system(50.0 PERCENT)"
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling_for_views(self, sampler_mock):
        """
        Test view sampling
        """
        view_entity = Table(
            id=uuid4(),
            name="user",
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                ),
            ],
            tableType=TableType.View,
        )

        sampler = BigQuerySampler(
            service_connection_config=self.bq_conn,
            ometa_client=None,
            entity=view_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users.id AS id, ABS(RANDOM()) * 100 %% 100 AS random \n'
            'FROM users)\n SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id, "9bc65c2abec141778ffaa729489f3e87_rnd".random \n'
            'FROM "9bc65c2abec141778ffaa729489f3e87_rnd" \nWHERE "9bc65c2abec141778ffaa729489f3e87_rnd".random <= 50.0'
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling_view_with_partition(self, sampler_mock):
        """
        Test view sampling with partition
        """
        view_entity = Table(
            id=uuid4(),
            name="user",
            columns=[
                EntityColumn(
                    name=ColumnName("id"),
                    dataType=DataType.INT,
                ),
            ],
            tableType=TableType.View,
        )

        sampler = BigQuerySampler(
            service_connection_config=self.bq_conn,
            ometa_client=None,
            entity=view_entity,
            sample_config=SampleConfig(
                profileSampleType=ProfileSampleType.PERCENTAGE, profileSample=50.0
            ),
            partition_details=PartitionProfilerConfig(
                enablePartitioning=True,
                partitionColumnName="id",
                partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
                partitionValues=["1", "2"],
            ),
            table_type=TableType.View,
        )
        query: CTE = sampler.get_sample_query()
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users.id AS id, ABS(RANDOM()) * 100 %% 100 AS random \n'
            "FROM users \nWHERE id in ('1', '2'))\n SELECT \"9bc65c2abec141778ffaa729489f3e87_rnd\".id, \"9bc65c2abec141778ffaa729489f3e87_rnd\".random \n"
            'FROM "9bc65c2abec141778ffaa729489f3e87_rnd" \nWHERE "9bc65c2abec141778ffaa729489f3e87_rnd".random <= 50.0'
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )

    def test_sampling_with_partition(self, sampler_mock):
        """
        Test sampling with partiton.
        """
        sampler = BigQuerySampler(
            service_connection_config=self.bq_conn,
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
            "TABLESAMPLE system(50.0 PERCENT) \nWHERE id IN ('1', '2')"
        )
        assert (
            expected_query.casefold()
            == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()
        )
