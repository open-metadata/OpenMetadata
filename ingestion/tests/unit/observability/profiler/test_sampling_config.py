#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Tests for resolve_static_sampling_config, get_tiered_sample,
_get_asset_row_count, _resolve_profile_sample_config, and tableDiff dynamic sampling."""

from unittest.mock import MagicMock, Mock, patch

import pytest

from metadata.generated.schema.entity.data.table import (
    Column,
    DataType,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.type.basic import (
    ProfileSampleType,
    SamplingMethodType,
)
from metadata.generated.schema.type.dynamicSamplingConfig import (
    DynamicSamplingConfig,
    Threshold,
)
from metadata.generated.schema.type.samplingConfig import (
    ProfileSampleConfig,
    SampleConfigType,
)
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.config import (
    _resolve_profile_sample_config,
    get_tiered_sample,
    resolve_static_sampling_config,
)
from metadata.sampler.models import SampleConfig, TableConfig


class TestResolveStaticSamplingConfig:
    """Tests for resolve_static_sampling_config — the core dynamic→static resolver."""

    def test_none_config_returns_none(self):
        assert resolve_static_sampling_config(sample_config=None) is None

    def test_none_config_with_row_count_returns_none(self):
        assert resolve_static_sampling_config(sample_config=None, row_count=1000) is None

    def test_static_config_returned_as_is(self):
        static = StaticSamplingConfig(
            profileSample=25.0,
            profileSampleType=ProfileSampleType.PERCENTAGE,
        )
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=static,
        )
        result = resolve_static_sampling_config(sample_config=psc)
        assert result is static

    def test_static_config_ignores_row_count(self):
        static = StaticSamplingConfig(
            profileSample=10.0,
            profileSampleType=ProfileSampleType.ROWS,
        )
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=static,
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=999_999)
        assert result is static

    def test_static_config_with_sampling_method(self):
        static = StaticSamplingConfig(
            profileSample=50.0,
            profileSampleType=ProfileSampleType.PERCENTAGE,
            samplingMethodType=SamplingMethodType.BERNOULLI,
        )
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=static,
        )
        result = resolve_static_sampling_config(sample_config=psc)
        assert result.samplingMethodType == SamplingMethodType.BERNOULLI

    def test_dynamic_smart_sampling_delegates_to_tiered(self):
        dynamic = DynamicSamplingConfig(smartSampling=True)
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=dynamic,
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=500_000)
        assert result.profileSample == 50
        assert result.profileSampleType == ProfileSampleType.PERCENTAGE

    def test_dynamic_smart_sampling_ignores_thresholds(self):
        """When smartSampling=True, custom thresholds are ignored."""
        dynamic = DynamicSamplingConfig(
            smartSampling=True,
            thresholds=[
                Threshold(
                    rowCountThreshold=1,
                    profileSample=99.0,
                    profileSampleType=ProfileSampleType.PERCENTAGE,
                ),
            ],
        )
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=dynamic,
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=50_000)
        # smart sampling for <=100K returns 100%, not the custom 99%
        assert result.profileSample == 100

    def test_dynamic_smart_sampling_none_row_count_defaults_to_zero(self):
        dynamic = DynamicSamplingConfig(smartSampling=True)
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=dynamic,
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=None)
        # row_count=0 → <=100K tier → 100%
        assert result.profileSample == 100

    def _make_threshold_config(self, thresholds):
        return ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(
                smartSampling=False,
                thresholds=thresholds,
            ),
        )

    def test_dynamic_thresholds_matches_exact_boundary(self):
        psc = self._make_threshold_config(
            [
                Threshold(rowCountThreshold=1000, profileSample=50.0),
                Threshold(rowCountThreshold=100_000, profileSample=10.0),
            ]
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=100_000)
        assert result.profileSample == 10.0

    def test_dynamic_thresholds_matches_highest_applicable(self):
        psc = self._make_threshold_config(
            [
                Threshold(rowCountThreshold=100, profileSample=80.0),
                Threshold(rowCountThreshold=1000, profileSample=50.0),
                Threshold(rowCountThreshold=10_000, profileSample=20.0),
            ]
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=5_000)
        assert result.profileSample == 50.0

    def test_dynamic_thresholds_above_all(self):
        psc = self._make_threshold_config(
            [
                Threshold(rowCountThreshold=100, profileSample=80.0),
                Threshold(rowCountThreshold=1000, profileSample=50.0),
            ]
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=1_000_000)
        assert result.profileSample == 50.0

    def test_dynamic_thresholds_below_all_returns_none(self):
        psc = self._make_threshold_config(
            [
                Threshold(rowCountThreshold=1000, profileSample=50.0),
                Threshold(rowCountThreshold=10_000, profileSample=20.0),
            ]
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=500)
        assert result is None

    def test_dynamic_thresholds_preserves_sample_type_and_method(self):
        psc = self._make_threshold_config(
            [
                Threshold(
                    rowCountThreshold=100,
                    profileSample=5000,
                    profileSampleType=ProfileSampleType.ROWS,
                    samplingMethodType=SamplingMethodType.SYSTEM,
                ),
            ]
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=200)
        assert result.profileSample == 5000
        assert result.profileSampleType == ProfileSampleType.ROWS
        assert result.samplingMethodType == SamplingMethodType.SYSTEM

    def test_dynamic_thresholds_none_row_count_defaults_to_zero(self):
        psc = self._make_threshold_config(
            [
                Threshold(rowCountThreshold=1, profileSample=90.0),
            ]
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=None)
        # row_count defaults to 0, which is below threshold of 1
        assert result is None

    def test_dynamic_thresholds_single_threshold(self):
        psc = self._make_threshold_config(
            [
                Threshold(rowCountThreshold=500, profileSample=25.0),
            ]
        )
        assert resolve_static_sampling_config(sample_config=psc, row_count=499) is None
        result = resolve_static_sampling_config(sample_config=psc, row_count=500)
        assert result.profileSample == 25.0

    def test_dynamic_thresholds_empty_list_returns_none(self):
        psc = self._make_threshold_config([])
        result = resolve_static_sampling_config(sample_config=psc, row_count=10_000)
        assert result is None

    def test_dynamic_no_smart_no_thresholds_returns_none(self):
        dynamic = DynamicSamplingConfig(smartSampling=False, thresholds=None)
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=dynamic,
        )
        result = resolve_static_sampling_config(sample_config=psc, row_count=10_000)
        assert result is None

    def test_static_type_with_non_static_config_returns_none(self):
        """If sampleConfigType=STATIC but config is not StaticSamplingConfig, return None."""
        dynamic = DynamicSamplingConfig(smartSampling=True)
        psc = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=dynamic,
        )
        result = resolve_static_sampling_config(sample_config=psc)
        assert result is None


class TestGetTieredSample:
    """Tests for get_tiered_sample — the smart sampling tier selection."""

    @pytest.mark.parametrize(
        "row_count,expected_pct",
        [
            (0, 100),
            (1, 100),
            (100_000, 100),
            (100_001, 50),
            (500_000, 50),
            (1_000_000, 50),
            (1_000_001, 10),
            (5_000_000, 10),
            (10_000_000, 10),
            (10_000_001, 5),
            (50_000_000, 5),
            (100_000_000, 5),
            (100_000_001, 1),
            (500_000_000, 1),
            (1_000_000_000, 1),
            (1_000_000_001, 0.1),
            (10_000_000_000, 0.1),
        ],
    )
    def test_tier_boundaries(self, row_count, expected_pct):
        result = get_tiered_sample(row_count)
        assert result.profileSample == expected_pct
        assert result.profileSampleType == ProfileSampleType.PERCENTAGE

    def test_returns_static_sampling_config_type(self):
        result = get_tiered_sample(1)
        assert isinstance(result, StaticSamplingConfig)


class TestBaseGetAssetRowCount:
    """Base SamplerInterface._get_asset_row_count returns 0."""

    def test_default_returns_zero(self):
        from metadata.sampler.sampler_interface import SamplerInterface

        sampler = MagicMock(spec=SamplerInterface)
        sampler._row_count = None
        result = SamplerInterface._get_asset_row_count(sampler)
        assert result == 0

    def test_returns_cached_row_count(self):
        from metadata.sampler.sampler_interface import SamplerInterface

        sampler = MagicMock(spec=SamplerInterface)
        sampler._row_count = 42
        result = SamplerInterface._get_asset_row_count(sampler)
        assert result == 42


class TestSQASamplerGetAssetRowCount:
    """SQASampler._get_asset_row_count dispatches to table_metric_computer_factory."""

    def test_returns_cached_row_count(self):
        from metadata.sampler.sqlalchemy.sampler import SQASampler

        sampler = MagicMock(spec=SQASampler)
        sampler._row_count = 12345
        result = SQASampler._get_asset_row_count(sampler)
        assert result == 12345

    def test_partitioned_table_uses_count_query(self):
        from metadata.sampler.sqlalchemy.sampler import SQASampler

        sampler = MagicMock()
        sampler._row_count = None
        sampler.partition_details = True

        mock_session = MagicMock()
        mock_query = MagicMock()
        mock_query.count.return_value = 999
        mock_session.query.return_value = mock_query
        sampler.get_partitioned_query.return_value = mock_query
        sampler.session_factory.return_value.__enter__ = MagicMock(return_value=mock_session)
        sampler.session_factory.return_value.__exit__ = MagicMock(return_value=False)

        result = SQASampler._get_asset_row_count(sampler)
        assert result == 999

    @patch("metadata.sampler.sqlalchemy.sampler.table_metric_computer_factory")
    def test_uses_metric_computer_factory(self, mock_factory):
        from metadata.sampler.sqlalchemy.sampler import SQASampler

        mock_result = MagicMock()
        mock_result.rowCount = 50_000
        mock_factory.construct.return_value.compute.return_value = mock_result

        sampler = MagicMock()
        sampler._row_count = None
        sampler.partition_details = None

        mock_session = MagicMock()
        mock_session.get_bind.return_value.dialect.name = "postgresql"
        sampler.session_factory.return_value.__enter__ = MagicMock(return_value=mock_session)
        sampler.session_factory.return_value.__exit__ = MagicMock(return_value=False)

        result = SQASampler._get_asset_row_count(sampler)
        assert result == 50_000
        assert sampler._row_count == 50_000

    @patch("metadata.sampler.sqlalchemy.sampler.table_metric_computer_factory")
    def test_returns_zero_when_no_row_count(self, mock_factory):
        from metadata.sampler.sqlalchemy.sampler import SQASampler

        mock_result = MagicMock(spec=[])  # no rowCount attribute
        mock_factory.construct.return_value.compute.return_value = mock_result

        sampler = MagicMock()
        sampler._row_count = None
        sampler.partition_details = None

        mock_session = MagicMock()
        mock_session.get_bind.return_value.dialect.name = "mysql"
        sampler.session_factory.return_value.__enter__ = MagicMock(return_value=mock_session)
        sampler.session_factory.return_value.__exit__ = MagicMock(return_value=False)

        result = SQASampler._get_asset_row_count(sampler)
        assert result == 0


class TestDatalakeSamplerGetAssetRowCount:
    """DatalakeSampler._get_asset_row_count sums dataframe chunks."""

    def test_sums_dataframe_chunks(self):
        from metadata.sampler.pandas.sampler import DatalakeSampler

        sampler = MagicMock(spec=DatalakeSampler)
        sampler._row_count = None

        chunk1 = MagicMock()
        chunk1.index = range(100)
        chunk2 = MagicMock()
        chunk2.index = range(200)
        sampler.raw_dataset.return_value = [chunk1, chunk2]

        result = DatalakeSampler._get_asset_row_count(sampler)
        assert result == 300
        assert sampler._row_count == 300

    def test_returns_zero_on_exception(self):
        from metadata.sampler.pandas.sampler import DatalakeSampler

        sampler = MagicMock(spec=DatalakeSampler)
        sampler._row_count = None
        sampler.raw_dataset.side_effect = Exception("read error")
        sampler.entity = MagicMock()

        result = DatalakeSampler._get_asset_row_count(sampler)
        assert result == 0


class TestNoSQLSamplerGetAssetRowCount:
    """NoSQLSampler._get_asset_row_count calls client.item_count."""

    def test_returns_item_count(self):
        from metadata.sampler.nosql.sampler import NoSQLSampler

        sampler = MagicMock(spec=NoSQLSampler)
        sampler._row_count = None
        sampler.client = MagicMock()
        sampler.client.item_count.return_value = 4500
        sampler.raw_dataset = "my_collection"

        result = NoSQLSampler._get_asset_row_count(sampler)
        assert result == 4500

    def test_returns_default_when_none(self):
        from metadata.sampler.nosql.sampler import NoSQLSampler
        from metadata.utils.constants import SAMPLE_DATA_DEFAULT_COUNT

        sampler = MagicMock(spec=NoSQLSampler)
        sampler._row_count = None
        sampler.client = MagicMock()
        sampler.client.item_count.return_value = None
        sampler.raw_dataset = "my_collection"

        result = NoSQLSampler._get_asset_row_count(sampler)
        assert result == SAMPLE_DATA_DEFAULT_COUNT


class TestResolveProfileSampleConfigHierarchy:
    """Tests for _resolve_profile_sample_config — config hierarchy with backward compat."""

    def test_returns_none_when_all_configs_are_none(self):
        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=None,
            schema_profiler_config=None,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result is None

    def test_entity_config_takes_priority(self):
        entity_cfg = TableConfig(
            fullyQualifiedName="demo",
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=StaticSamplingConfig(
                    profileSample=5.0,
                    profileSampleType=ProfileSampleType.PERCENTAGE,
                ),
            ),
        )
        table_cfg = MagicMock()
        table_cfg.profileSampleConfig = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=StaticSamplingConfig(
                profileSample=99.0,
                profileSampleType=ProfileSampleType.PERCENTAGE,
            ),
        )
        result = _resolve_profile_sample_config(
            entity_config=entity_cfg,
            table_profiler_config=table_cfg,
            schema_profiler_config=None,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result.config.profileSample == 5.0

    def test_falls_through_to_table_profiler_config(self):
        table_cfg = MagicMock()
        table_cfg.profileSampleConfig = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=StaticSamplingConfig(
                profileSample=30.0,
                profileSampleType=ProfileSampleType.PERCENTAGE,
            ),
        )
        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=table_cfg,
            schema_profiler_config=None,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result.config.profileSample == 30.0

    def test_falls_through_to_schema_config(self):
        schema_cfg = MagicMock()
        schema_cfg.profileSampleConfig = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(smartSampling=True),
        )
        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=None,
            schema_profiler_config=schema_cfg,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result.sampleConfigType == SampleConfigType.DYNAMIC

    def test_falls_through_to_database_config(self):
        db_cfg = MagicMock()
        db_cfg.profileSampleConfig = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=StaticSamplingConfig(
                profileSample=15.0,
                profileSampleType=ProfileSampleType.ROWS,
            ),
        )
        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=None,
            schema_profiler_config=None,
            database_profiler_config=db_cfg,
            default_sample_config=None,
        )
        assert result.config.profileSample == 15.0

    def test_falls_through_to_default_sample_config(self):
        default = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=StaticSamplingConfig(
                    profileSample=42.0,
                    profileSampleType=ProfileSampleType.PERCENTAGE,
                ),
            ),
        )
        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=None,
            schema_profiler_config=None,
            database_profiler_config=None,
            default_sample_config=default,
        )
        assert result.config.profileSample == 42.0

    def test_backward_compat_flat_fields(self):
        """When profileSampleConfig is None but flat profileSample is set,
        it should construct a STATIC ProfileSampleConfig."""
        entity_cfg = TableConfig(
            fullyQualifiedName="demo",
            profileSample=75.0,
            profileSampleType=ProfileSampleType.PERCENTAGE,
            samplingMethodType=SamplingMethodType.SYSTEM,
        )
        result = _resolve_profile_sample_config(
            entity_config=entity_cfg,
            table_profiler_config=None,
            schema_profiler_config=None,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result.sampleConfigType == SampleConfigType.STATIC
        assert result.config.profileSample == 75.0
        assert result.config.profileSampleType == ProfileSampleType.PERCENTAGE
        assert result.config.samplingMethodType == SamplingMethodType.SYSTEM

    def test_backward_compat_skips_none_profile_sample(self):
        """If both profileSampleConfig and profileSample are None, skip to next."""
        entity_cfg = TableConfig(fullyQualifiedName="demo")
        db_cfg = MagicMock()
        db_cfg.profileSampleConfig = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.STATIC,
            config=StaticSamplingConfig(
                profileSample=20.0,
                profileSampleType=ProfileSampleType.PERCENTAGE,
            ),
        )
        result = _resolve_profile_sample_config(
            entity_config=entity_cfg,
            table_profiler_config=None,
            schema_profiler_config=None,
            database_profiler_config=db_cfg,
            default_sample_config=None,
        )
        assert result.config.profileSample == 20.0

    def test_root_model_unwrap(self):
        """TableProfilerConfig wraps ProfileSampleConfig in a RootModel.
        _resolve should unwrap it via .root."""
        from metadata.generated.schema.entity.data.table import (
            ProfileSampleConfig as TableProfileSampleConfig,
        )
        from metadata.generated.schema.type.samplingConfig import (
            ProfileSampleConfig as SamplingPSC,
        )

        inner = SamplingPSC(
            sampleConfigType=SampleConfigType.STATIC,
            config=StaticSamplingConfig(
                profileSample=33.0,
                profileSampleType=ProfileSampleType.PERCENTAGE,
            ),
        )
        # table.ProfileSampleConfig is a RootModel wrapping samplingConfig.ProfileSampleConfig
        wrapped = TableProfileSampleConfig(root=inner)

        table_profiler_cfg = MagicMock()
        table_profiler_cfg.profileSampleConfig = wrapped

        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=table_profiler_cfg,
            schema_profiler_config=None,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result.config.profileSample == 33.0

    def test_dynamic_config_propagates_through_hierarchy(self):
        """Dynamic config at schema level should propagate correctly."""
        schema_cfg = MagicMock()
        schema_cfg.profileSampleConfig = ProfileSampleConfig(
            sampleConfigType=SampleConfigType.DYNAMIC,
            config=DynamicSamplingConfig(
                smartSampling=False,
                thresholds=[
                    Threshold(rowCountThreshold=1000, profileSample=10.0),
                ],
            ),
        )
        result = _resolve_profile_sample_config(
            entity_config=None,
            table_profiler_config=None,
            schema_profiler_config=schema_cfg,
            database_profiler_config=None,
            default_sample_config=None,
        )
        assert result.sampleConfigType == SampleConfigType.DYNAMIC
        assert isinstance(result.config, DynamicSamplingConfig)
        assert result.config.thresholds[0].rowCountThreshold == 1000


class TestTableDiffDynamicSampling:
    """Tests for tableDiff.py calculate_nounce and sample_where_clause with dynamic configs."""

    def _make_validator(self, table_profile_config, row_count=10_000):
        from metadata.data_quality.validations.models import (
            TableDiffRuntimeParameters,
            TableParameter,
        )
        from metadata.data_quality.validations.table.sqlalchemy.tableDiff import (
            TableDiffValidator,
        )
        from metadata.generated.schema.tests.testCase import (
            TestCase,
            TestCaseParameterValue,
        )

        validator = TableDiffValidator(
            None,
            TestCase.model_construct(
                parameterValues=[TestCaseParameterValue(name="caseSensitiveColumns", value="false")]
            ),
            None,
        )
        validator.runtime_params = TableDiffRuntimeParameters.model_construct(
            table_profile_config=table_profile_config,
            table1=TableParameter.model_construct(
                database_service_type=DatabaseServiceType.Postgres,
                columns=[
                    Column(name="id", dataType=DataType.STRING),
                ],
                key_columns=["id"],
            ),
            table2=TableParameter.model_construct(
                database_service_type=DatabaseServiceType.Postgres,
                columns=[
                    Column(name="id", dataType=DataType.STRING),
                ],
                key_columns=["id"],
            ),
            keyColumns=["id"],
        )
        validator.get_total_row_count = Mock(return_value=row_count)
        return validator

    def test_calculate_nounce_with_dynamic_smart_sampling(self):
        """Dynamic smart sampling should resolve to a static config and compute nounce."""
        config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=DynamicSamplingConfig(smartSampling=True),
            ),
        )
        # row_count=500_000 → smart sampling tier = 50%
        validator = self._make_validator(config, row_count=500_000)
        max_nounce = 2**32 - 1
        expected = int(max_nounce * 50 / 100)
        assert validator.calculate_nounce() == expected

    def test_calculate_nounce_with_dynamic_thresholds(self):
        """Dynamic thresholds should resolve and compute nounce correctly."""
        config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=DynamicSamplingConfig(
                    smartSampling=False,
                    thresholds=[
                        Threshold(rowCountThreshold=1000, profileSample=25.0),
                    ],
                ),
            ),
        )
        validator = self._make_validator(config, row_count=5_000)
        max_nounce = 2**32 - 1
        expected = int(max_nounce * 25 / 100)
        assert validator.calculate_nounce() == expected

    def test_calculate_nounce_with_dynamic_rows_type(self):
        """Dynamic thresholds with ROWS type should compute nounce based on row fraction."""
        config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=DynamicSamplingConfig(
                    smartSampling=False,
                    thresholds=[
                        Threshold(
                            rowCountThreshold=100,
                            profileSample=500,
                            profileSampleType=ProfileSampleType.ROWS,
                        ),
                    ],
                ),
            ),
        )
        validator = self._make_validator(config, row_count=10_000)
        max_nounce = 2**32 - 1
        expected = int(max_nounce * (500 / 10_000))
        assert validator.calculate_nounce() == expected

    def test_sample_where_clause_with_dynamic_config(self):
        """sample_where_clause should work end-to-end with dynamic config."""
        config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=DynamicSamplingConfig(
                    smartSampling=False,
                    thresholds=[
                        Threshold(rowCountThreshold=100, profileSample=10.0),
                    ],
                ),
            ),
        )
        validator = self._make_validator(config, row_count=5_000)
        with patch("random.choices", Mock(return_value=["a"])):
            result = validator.sample_where_clause()
        # 10% of 2^32-1 = 0x19999999
        assert result[0] == "SUBSTRING(MD5(id || 'a'), 1, 8) < '19999999'"
        assert result[1] == "SUBSTRING(MD5(id || 'a'), 1, 8) < '19999999'"

    def test_sample_where_clause_dynamic_below_threshold_returns_none(self):
        """When row_count is below all thresholds, no sampling should be applied."""
        config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=DynamicSamplingConfig(
                    smartSampling=False,
                    thresholds=[
                        Threshold(rowCountThreshold=10_000, profileSample=10.0),
                    ],
                ),
            ),
        )
        # row_count=500 is below threshold of 10_000 → resolve returns None → no sampling
        validator = self._make_validator(config, row_count=500)
        result = validator.sample_where_clause()
        assert result == (None, None)

    def test_sample_where_clause_dynamic_100pct_returns_none(self):
        """Smart sampling at <=100K rows returns 100% → no where clause needed."""
        config = TableProfilerConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=DynamicSamplingConfig(smartSampling=True),
            ),
        )
        # row_count=50_000 → smart tier = 100% → should return (None, None)
        validator = self._make_validator(config, row_count=50_000)
        result = validator.sample_where_clause()
        assert result == (None, None)
