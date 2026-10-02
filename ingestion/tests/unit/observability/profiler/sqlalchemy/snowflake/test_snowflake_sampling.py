import subprocess
import sys
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

import pytest
from snowflake.sqlalchemy import VARIANT
from sqlalchemy import Column, Integer, String
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
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
)
from metadata.generated.schema.type.basic import ProfileSampleType, SamplingMethodType
from metadata.generated.schema.type.samplingConfig import SampleConfigType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.ingestion.source.sqa_types import SQASGeography
from metadata.profiler.interface.sqlalchemy.profiler_interface import (
    SQAProfilerInterface,
)
from metadata.profiler.orm.types.custom_array import CustomArray
from metadata.sampler.models import (
    ProfileSampleConfig,
    SampleConfig,
)
from metadata.sampler.sampler_config import DatabaseSamplerConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.sampler.sqlalchemy.snowflake.sampler import SnowflakeSampler
from metadata.utils.constants import SAMPLE_DATA_MAX_CELL_LENGTH


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

        cls.snowflake_conn = SnowflakeConnection(username="myuser", account="myaccount", warehouse="mywarehouse")

        sampler = SQASampler(
            service_connection_config=cls.snowflake_conn,
            ometa_client=None,
            entity=None,
        )
        cls.sqa_profiler_interface = SQAProfilerInterface(
            cls.snowflake_conn,
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
        use BERNOULLI if sampling method type is not specified.
        """
        sampler = SnowflakeSampler(
            service_connection_config=self.snowflake_conn,
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
            "FROM users AS users_1 TABLESAMPLE bernoulli(50.0))\n "
            'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()

    def test_specify_sampling_method_type(self, sampler_mock):
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
                config=DatabaseSamplerConfig(
                    sample_config=SampleConfig(
                        profileSampleConfig=ProfileSampleConfig(
                            sampleConfigType=SampleConfigType.STATIC,
                            config=StaticSamplingConfig(
                                profileSample=50.0,
                                profileSampleType=ProfileSampleType.PERCENTAGE,
                                samplingMethodType=sampling_method_type,
                            ),
                        )
                    )
                ),
            )
            query: CTE = sampler.get_sample_query(sampler._resolve_sample_config)
            expected_query = (
                'WITH "9bc65c2abec141778ffaa729489f3e87_rnd" AS \n(SELECT users_1.id AS id \n'
                f"FROM users AS users_1 TABLESAMPLE {sampling_method_type.value}(50.0))\n "
                'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
            )
            assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()

    def test_row_sampling(self, sampler_mock):
        """
        use ROW sampling if profile sample type is ROW.
        """
        sampler = SnowflakeSampler(
            service_connection_config=self.snowflake_conn,
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
            "\nFROM users AS users_1 TABLESAMPLE ROW(50.0 ROWS))\n "
            'SELECT "9bc65c2abec141778ffaa729489f3e87_rnd".id \nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()

    def test_sampling_with_partition(self, sampler_mock):
        """
        use specified partition columns.
        """
        sampler = SnowflakeSampler(
            service_connection_config=self.snowflake_conn,
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
            "FROM users AS users_1 TABLESAMPLE bernoulli(50.0) "
            "\nWHERE id IN ('1', '2'))\n SELECT \"9bc65c2abec141778ffaa729489f3e87_rnd\".id "
            '\nFROM "9bc65c2abec141778ffaa729489f3e87_rnd"'
        )
        assert expected_query.casefold() == str(query.compile(compile_kwargs={"literal_binds": True})).casefold()


# The Snowflake driver returns VARIANT, OBJECT and ARRAY values as pretty-printed JSON text.
@pytest.mark.parametrize(
    ("column_type", "fetched", "sampled"),
    [
        (VARIANT, '{\n  "count": 2,\n  "kind": "fixture"\n}', {"count": 2, "kind": "fixture"}),
        (VARIANT, '"plain text"', "plain text"),
        (VARIANT, "42", 42),
        (VARIANT, "not json", "not json"),
        (CustomArray(String), '[\n  "a",\n  "b"\n]', ["a", "b"]),
        (VARIANT, None, None),
        (VARIANT, "[" * (SAMPLE_DATA_MAX_CELL_LENGTH + 1), "[" * (SAMPLE_DATA_MAX_CELL_LENGTH + 1)),
        (VARIANT, "[" * 1500 + "]" * 1500, "[" * 1500 + "]" * 1500),
        (String, '{"kind": "fixture"}', '{"kind": "fixture"}'),
        (
            SQASGeography,
            '{\n  "coordinates": [1, 2],\n  "type": "Point"\n}',
            '{\n  "coordinates": [1, 2],\n  "type": "Point"\n}',
        ),
    ],
)
@patch.object(SQASampler, "build_table_orm", return_value=User)
def test_semi_structured_samples_are_json(_build_table_orm, column_type, fetched, sampled):
    sampler = SnowflakeSampler(
        service_connection_config=SnowflakeConnection(username="myuser", account="myaccount", warehouse="mywarehouse"),
        ometa_client=None,
        entity=Table(id=uuid4(), name="user", columns=[EntityColumn(name=ColumnName("id"), dataType=DataType.INT)]),
    )
    assert sampler._process_sample_value(Column("value", column_type), fetched) == sampled


def test_sampler_modules_import_without_the_snowflake_extra():
    """The Postgres and Timescale samplers import this module, and their installs need not carry Snowflake."""
    script = (
        "import sys\n"
        "class BlockSnowflake:\n"
        "    def find_spec(self, name, path=None, target=None):\n"
        "        if name == 'snowflake' or name.startswith('snowflake.'):\n"
        "            raise ModuleNotFoundError(name)\n"
        "sys.meta_path.insert(0, BlockSnowflake())\n"
        "import metadata.sampler.sqlalchemy.snowflake.sampler\n"
        "import metadata.sampler.sqlalchemy.postgres.sampler\n"
    )
    result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=300, check=False)
    assert result.returncode == 0, result.stderr
