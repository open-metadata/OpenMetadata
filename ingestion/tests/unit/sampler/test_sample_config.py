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

import pytest

from metadata.generated.schema.entity.data.table import Table, TableProfilerConfig
from metadata.generated.schema.type.basic import ProfileSampleType
from metadata.generated.schema.type.dynamicSamplingConfig import (
    DynamicSamplingConfig,
    Threshold,
)
from metadata.generated.schema.type.samplingConfig import (
    ProfileSampleConfig,
    SampleConfigType,
)
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.config import get_profile_sample_config
from metadata.sampler.models import SampleConfig


class TestSampleConfigGetConfig:
    def test_returns_static_config(self):
        static = StaticSamplingConfig(profileSample=50.0)
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=static,
            )
        )
        result = sample_config.get_config(StaticSamplingConfig)
        assert isinstance(result, StaticSamplingConfig)

    def test_returns_dynamic_config(self):
        dynamic = DynamicSamplingConfig(
            smartSampling=True,
            thresholds=[
                Threshold(rowCountThreshold=1000, profileSample=10.0),
            ],
        )
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=dynamic,
            )
        )
        result = sample_config.get_config(DynamicSamplingConfig)
        assert isinstance(result, DynamicSamplingConfig)

    def test_returns_none_when_no_profile_sample_config(self):
        sample_config = SampleConfig()
        assert sample_config.get_config(StaticSamplingConfig) is None
        assert sample_config.get_config(DynamicSamplingConfig) is None

    def test_returns_none_when_config_is_none(self):
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=None,
            )
        )
        assert sample_config.get_config(StaticSamplingConfig) is None

    def test_returns_none_when_requesting_wrong_type(self):
        static = StaticSamplingConfig(profileSample=50.0)
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.STATIC,
                config=static,
            )
        )
        assert sample_config.get_config(DynamicSamplingConfig) is None

    def test_returns_none_when_dynamic_but_requesting_static(self):
        dynamic = DynamicSamplingConfig(
            smartSampling=True,
            thresholds=[
                Threshold(rowCountThreshold=500, profileSample=25.0),
            ],
        )
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=dynamic,
            )
        )
        assert sample_config.get_config(StaticSamplingConfig) is None


@pytest.mark.parametrize("randomized_sample", [False, True, None, "absent"])
@pytest.mark.parametrize("table_override", [False, True])
def test_resolved_row_sampling_preserves_randomization(
    randomized_sample: bool | str | None, table_override: bool
) -> None:
    default = None if randomized_sample == "absent" else SampleConfig(randomizedSample=randomized_sample)
    rows = ProfileSampleConfig(
        sampleConfigType=SampleConfigType.STATIC,
        config=StaticSamplingConfig(profileSample=100, profileSampleType=ProfileSampleType.ROWS),
    )
    if default is not None:
        default.profileSampleConfig = rows
    table = Table(
        id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
        name="large_table",
        columns=[],
        tableProfilerConfig=(
            TableProfilerConfig(
                profileSampleConfig=ProfileSampleConfig(
                    sampleConfigType=SampleConfigType.STATIC,
                    config=StaticSamplingConfig(profileSample=200, profileSampleType=ProfileSampleType.ROWS),
                )
            )
            if table_override
            else None
        ),
    )

    resolved = get_profile_sample_config(
        entity=table,
        schema_entity=None,
        database_entity=None,
        entity_config=None,
        default_sample_config=default,
    )

    assert resolved.randomizedSample is (True if default is None else randomized_sample)
    expected_sampling = (
        table.tableProfilerConfig.profileSampleConfig.root if table_override else (rows if default else None)
    )
    assert resolved.profileSampleConfig == expected_sampling
    if default is not None:
        assert default.profileSampleConfig == rows
