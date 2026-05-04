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
and _get_asset_row_count across sampler subclasses."""

from unittest.mock import MagicMock, patch

import pytest

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
from metadata.sampler.config import get_tiered_sample, resolve_static_sampling_config



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
        psc = self._make_threshold_config([
            Threshold(rowCountThreshold=1000, profileSample=50.0),
            Threshold(rowCountThreshold=100_000, profileSample=10.0),
        ])
        result = resolve_static_sampling_config(sample_config=psc, row_count=100_000)
        assert result.profileSample == 10.0

    def test_dynamic_thresholds_matches_highest_applicable(self):
        psc = self._make_threshold_config([
            Threshold(rowCountThreshold=100, profileSample=80.0),
            Threshold(rowCountThreshold=1000, profileSample=50.0),
            Threshold(rowCountThreshold=10_000, profileSample=20.0),
        ])
        result = resolve_static_sampling_config(sample_config=psc, row_count=5_000)
        assert result.profileSample == 50.0

    def test_dynamic_thresholds_above_all(self):
        psc = self._make_threshold_config([
            Threshold(rowCountThreshold=100, profileSample=80.0),
            Threshold(rowCountThreshold=1000, profileSample=50.0),
        ])
        result = resolve_static_sampling_config(sample_config=psc, row_count=1_000_000)
        assert result.profileSample == 50.0

    def test_dynamic_thresholds_below_all_returns_none(self):
        psc = self._make_threshold_config([
            Threshold(rowCountThreshold=1000, profileSample=50.0),
            Threshold(rowCountThreshold=10_000, profileSample=20.0),
        ])
        result = resolve_static_sampling_config(sample_config=psc, row_count=500)
        assert result is None

    def test_dynamic_thresholds_preserves_sample_type_and_method(self):
        psc = self._make_threshold_config([
            Threshold(
                rowCountThreshold=100,
                profileSample=5000,
                profileSampleType=ProfileSampleType.ROWS,
                samplingMethodType=SamplingMethodType.SYSTEM,
            ),
        ])
        result = resolve_static_sampling_config(sample_config=psc, row_count=200)
        assert result.profileSample == 5000
        assert result.profileSampleType == ProfileSampleType.ROWS
        assert result.samplingMethodType == SamplingMethodType.SYSTEM

    def test_dynamic_thresholds_none_row_count_defaults_to_zero(self):
        psc = self._make_threshold_config([
            Threshold(rowCountThreshold=1, profileSample=90.0),
        ])
        result = resolve_static_sampling_config(sample_config=psc, row_count=None)
        # row_count defaults to 0, which is below threshold of 1
        assert result is None

    def test_dynamic_thresholds_single_threshold(self):
        psc = self._make_threshold_config([
            Threshold(rowCountThreshold=500, profileSample=25.0),
        ])
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
