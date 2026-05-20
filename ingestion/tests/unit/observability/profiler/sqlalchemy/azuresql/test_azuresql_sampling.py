from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

import pytest

try:
    import pyodbc  # noqa: F401
except ImportError:
    # skip the test if pyodbc cannnot be imported: either because is not installed or
    # because a broken dynamic library not found
    pytest.skip("pyodbc not properly installed", allow_module_level=True)

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
)
from metadata.generated.schema.entity.services.connections.database.azureSQLConnection import (
    AzureSQLConnection,
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
from metadata.sampler.sqlalchemy.azuresql.sampler import AzureSQLSampler
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

        cls.azuresql_conn = AzureSQLConnection(
            username="myuser",
            password="myaccount",
            database="mywarehouse",
            hostPort="host//foo.bar:1433",
        )

        sampler = SQASampler(
            service_connection_config=cls.azuresql_conn,
            ometa_client=None,
            entity=None,
        )
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.azuresql_conn,
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
        sampler = AzureSQLSampler(
            service_connection_config=self.azuresql_conn,
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
        sampler = AzureSQLSampler(
            service_connection_config=self.azuresql_conn,
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

    def test_temporal_columns_excluded_from_fetch_sample_data(self, sampler_mock):
        """
        Temporal table period columns (GENERATED ALWAYS AS ROW START/END) must be
        excluded from the sample query so that TABLESAMPLE does not fail on temporal
        tables (SQL Server error 13541) and pyodbc does not error on period column types.
        """
        from unittest.mock import MagicMock, patch

        from sqlalchemy.types import DateTime

        sampler = AzureSQLSampler(
            service_connection_config=self.azuresql_conn,
            ometa_client=None,
            entity=self.table_entity,
        )

        valid_from_col = MagicMock()
        valid_from_col.name = "ValidFrom"
        valid_from_col.type = DateTime()

        valid_to_col = MagicMock()
        valid_to_col.name = "ValidTo"
        valid_to_col.type = DateTime()

        id_col = MagicMock()
        id_col.name = "id"
        id_col.type.__class__.__name__ = "Integer"

        columns_passed_to_super = []

        def capture_fetch(*args, **kwargs):
            cols = args[0] if args else kwargs.get("columns")
            if cols:
                columns_passed_to_super.extend(cols)
            from metadata.generated.schema.entity.data.table import TableData

            return TableData(columns=[], rows=[])

        with (
            patch.object(
                sampler,
                "_get_temporal_column_names",
                return_value=frozenset({"ValidFrom", "ValidTo"}),
            ),
            patch.object(
                SQASampler,
                "fetch_sample_data",
                side_effect=capture_fetch,
            ),
        ):
            sampler.fetch_sample_data(columns=[id_col, valid_from_col, valid_to_col])

        passed_names = {col.name for col in columns_passed_to_super}
        assert "ValidFrom" not in passed_names
        assert "ValidTo" not in passed_names
        assert "id" in passed_names

    def test_all_columns_filtered_passes_empty_list_not_original(self, sampler_mock):
        """
        When every column is a temporal period column, sqa_columns is [].
        The empty list must be passed to super(), not the original column list —
        otherwise the filter is bypassed entirely (falsy empty list bug).
        """
        from unittest.mock import MagicMock, patch

        from sqlalchemy.types import DateTime

        sampler = AzureSQLSampler(
            service_connection_config=self.azuresql_conn,
            ometa_client=None,
            entity=self.table_entity,
        )

        valid_from_col = MagicMock()
        valid_from_col.name = "ValidFrom"
        valid_from_col.type = DateTime()

        valid_to_col = MagicMock()
        valid_to_col.name = "ValidTo"
        valid_to_col.type = DateTime()

        received = {}

        def capture_fetch(cols=None):
            received["columns"] = cols
            from metadata.generated.schema.entity.data.table import TableData

            return TableData(columns=[], rows=[])

        with (
            patch.object(
                sampler,
                "_get_temporal_column_names",
                return_value=frozenset({"ValidFrom", "ValidTo"}),
            ),
            patch.object(
                SQASampler,
                "fetch_sample_data",
                side_effect=capture_fetch,
            ),
        ):
            sampler.fetch_sample_data(columns=[valid_from_col, valid_to_col])

        assert received["columns"] == [], "Expected empty list when all columns are filtered, not the original list"

    def test_sampling_with_partition(self, sampler_mock):
        """
        use specified partition columns.
        """
        sampler = AzureSQLSampler(
            service_connection_config=self.azuresql_conn,
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
