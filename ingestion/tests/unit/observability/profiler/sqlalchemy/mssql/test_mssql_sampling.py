from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import Column, Integer
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql.selectable import CTE  # noqa: TC002

from metadata.generated.schema.entity.data.table import Column as EntityColumn
from metadata.generated.schema.entity.data.table import (
    ColumnName,
    DataType,
    PartitionIntervalTypes,
    PartitionProfilerConfig,
    Table,
    TableData,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
)
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.sampler.models import (
    ProfileSampleConfig,
    SampleConfig,
)
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sqlalchemy.mssql.sampler import MssqlSampler
from metadata.sampler.sqlalchemy.sampler import SQASampler


class Base(DeclarativeBase):
    pass


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
            config=DatabaseSamplerConfig(
                sample_config=SampleConfig(
                    profileSampleConfig=ProfileSampleConfig(
                        sampleConfigType=SampleConfigType.STATIC,
                        config=StaticSamplingConfig(
                            profileSample=50.0,
                            profileSampleType=ProfileSampleType.PERCENTAGE,
                        ),
                    )
                )
            ),
        )
        query: CTE = sampler.get_sample_query(sampler._resolve_sample_config)
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id \n'
            "FROM users AS users_1 TABLESAMPLE system(50.0 PERCENT))\n "
            'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()

    def test_row_sampling(self, sampler_mock):
        """
        use ROW sampling if profile sample type is ROW.
        """
        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
            config=DatabaseSamplerConfig(
                sample_config=SampleConfig(
                    profileSampleConfig=ProfileSampleConfig(
                        sampleConfigType=SampleConfigType.STATIC,
                        config=StaticSamplingConfig(
                            profileSample=50,
                            profileSampleType=ProfileSampleType.ROWS,
                        ),
                    )
                )
            ),
        )
        query: CTE = sampler.get_sample_query(sampler._resolve_sample_config)
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id '
            "\nFROM users AS users_1 TABLESAMPLE system(50 ROWS))\n "
            'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()

    def test_sampling_with_partition(self, sampler_mock):
        """
        use specified partition columns.
        """
        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
            config=DatabaseSamplerConfig(
                sample_config=SampleConfig(
                    profileSampleConfig=ProfileSampleConfig(
                        sampleConfigType=SampleConfigType.STATIC,
                        config=StaticSamplingConfig(
                            profileSample=50.0,
                            profileSampleType=ProfileSampleType.PERCENTAGE,
                        ),
                    )
                ),
                partition_details=PartitionProfilerConfig(
                    enablePartitioning=True,
                    partitionColumnName="id",
                    partitionIntervalType=PartitionIntervalTypes.COLUMN_VALUE,
                    partitionValues=["1", "2"],
                ),
            ),
        )
        query: CTE = sampler.get_sample_query(sampler._resolve_sample_config)
        expected_query = (
            'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id \n'
            "FROM users AS users_1 TABLESAMPLE system(50.0 PERCENT) "
            "\nWHERE id IN ('1', '2'))\n SELECT \"9bc65c2abec141778ffaa729489f3e87_rnd\".id "
            '\nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()

    def test_temporal_columns_excluded_from_fetch_sample_data(self, sampler_mock):
        """
        Period columns are catalogued but must stay out of the sample: they are row
        validity bookkeeping rather than user data (issue #21329).
        """
        from unittest.mock import MagicMock

        from sqlalchemy.types import DateTime

        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
        )

        valid_from_col = MagicMock()
        valid_from_col.name = "valid_from"
        valid_from_col.type = DateTime()

        valid_to_col = MagicMock()
        valid_to_col.name = "valid_to"
        valid_to_col.type = DateTime()

        id_col = MagicMock()
        id_col.name = "id"

        columns_passed_to_super = []

        def capture_fetch(*args, **kwargs):
            cols = args[0] if args else kwargs.get("columns")
            if cols:
                columns_passed_to_super.extend(cols)

            return TableData(columns=[], rows=[])

        with (
            patch(
                "metadata.sampler.sqlalchemy.mssql.sampler.get_temporal_column_names",
                return_value=frozenset({"valid_from", "valid_to"}),
            ),
            patch.object(SQASampler, "fetch_sample_data", side_effect=capture_fetch),
        ):
            sampler.fetch_sample_data(columns=[id_col, valid_from_col, valid_to_col])

        passed_names = {col.name for col in columns_passed_to_super}

        assert passed_names == {"id"}

    def test_non_temporal_table_keeps_every_column(self, sampler_mock):
        """A table with no period columns must reach the sampler untouched."""
        from unittest.mock import MagicMock

        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
        )

        id_col = MagicMock()
        id_col.name = "id"
        name_col = MagicMock()
        name_col.name = "name"

        columns_passed_to_super = []

        def capture_fetch(*args, **kwargs):
            cols = args[0] if args else kwargs.get("columns")
            if cols:
                columns_passed_to_super.extend(cols)

            return TableData(columns=[], rows=[])

        with (
            patch(
                "metadata.sampler.sqlalchemy.mssql.sampler.get_temporal_column_names",
                return_value=frozenset(),
            ),
            patch.object(SQASampler, "fetch_sample_data", side_effect=capture_fetch),
        ):
            sampler.fetch_sample_data(columns=[id_col, name_col])

        passed_names = {col.name for col in columns_passed_to_super}

        assert passed_names == {"id", "name"}

    def test_all_columns_filtered_returns_no_sample(self, sampler_mock):
        """
        When the filter empties the column list there is nothing left to sample.
        Handing [] to super() reads as "caller gave me nothing, use them all", which
        puts the period columns straight back into the query.
        """
        from unittest.mock import MagicMock

        sampler = MssqlSampler(
            service_connection_config=self.mssql_conn,
            ometa_client=None,
            entity=self.table_entity,
        )

        valid_from_col = MagicMock()
        valid_from_col.name = "valid_from"

        with (
            patch(
                "metadata.sampler.sqlalchemy.mssql.sampler.get_temporal_column_names",
                return_value=frozenset({"valid_from"}),
            ),
            patch.object(SQASampler, "fetch_sample_data") as super_fetch,
        ):
            table_data = sampler.fetch_sample_data(columns=[valid_from_col])

        assert table_data.columns == []
        assert table_data.rows == []
        super_fetch.assert_not_called()
