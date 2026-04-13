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

from metadata.generated.schema.type.dynamicSamplingConfig import (
    DynamicSamplingConfig,
    Threshold,
)
from metadata.generated.schema.type.samplingConfig import (
    ProfileSampleConfig,
    SampleConfigType,
)
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
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
        assert result is static

    def test_returns_dynamic_config(self):
        dynamic = DynamicSamplingConfig(
            smartSampling=True,
            thresholds=[
                Threshold(
                    rowCountThreshold=1000, profileSample=10.0
                ),
            ],
        )
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=dynamic,
            )
        )
        result = sample_config.get_config(DynamicSamplingConfig)
        assert result is dynamic

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
                Threshold(
                    rowCountThreshold=500, profileSample=25.0
                ),
            ],
        )
        sample_config = SampleConfig(
            profileSampleConfig=ProfileSampleConfig(
                sampleConfigType=SampleConfigType.DYNAMIC,
                config=dynamic,
            )
        )
        assert sample_config.get_config(StaticSamplingConfig) is None
