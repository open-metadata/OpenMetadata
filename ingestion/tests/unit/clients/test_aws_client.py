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
"""
Test AWS Client region validation
"""

import pytest

from metadata.clients.aws_client import VALID_AWS_REGIONS, AWSClient
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials


class TestAWSClientRegionValidation:
    """Validate AWS region validation in AWSClient"""

    def test_valid_regions_sourced_from_botocore(self):
        assert isinstance(VALID_AWS_REGIONS, set)
        assert len(VALID_AWS_REGIONS) > 0
        assert "us-east-1" in VALID_AWS_REGIONS
        assert "eu-west-1" in VALID_AWS_REGIONS

    @pytest.mark.parametrize(
        "region",
        [
            "us-east-1",
            "us-west-2",
            "eu-west-1",
            "ap-southeast-1",
            "us-gov-west-1",
            "cn-north-1",
        ],
    )
    def test_valid_regions_accepted(self, region):
        config = AWSCredentials(awsRegion=region)
        client = AWSClient(config)
        assert client.config.awsRegion == region

    @pytest.mark.parametrize(
        "invalid_region",
        [
            "us-west-2b",
            "us-east-1a",
            "eu-west-1c",
            "ap-southeast-1b",
        ],
    )
    def test_availability_zone_rejected(self, invalid_region):
        config = AWSCredentials(awsRegion=invalid_region)
        with pytest.raises(ValueError, match="Invalid AWS Region"):
            AWSClient(config)

    @pytest.mark.parametrize(
        "invalid_region",
        [
            "invalid-region",
            "us-east",
            "east-1",
        ],
    )
    def test_arbitrary_string_rejected(self, invalid_region):
        config = AWSCredentials(awsRegion=invalid_region)
        with pytest.raises(ValueError, match="Invalid AWS Region"):
            AWSClient(config)

    def test_error_message_contains_invalid_value(self):
        config = AWSCredentials(awsRegion="us-west-2b")
        with pytest.raises(ValueError, match="us-west-2b"):
            AWSClient(config)

    def test_availability_zone_error_includes_hint(self):
        config = AWSCredentials(awsRegion="us-west-2b")
        with pytest.raises(ValueError, match="availability zone"):
            AWSClient(config)

    def test_non_az_error_omits_az_hint(self):
        config = AWSCredentials(awsRegion="invalid-region")
        with pytest.raises(ValueError, match="Invalid AWS Region") as exc_info:
            AWSClient(config)
        assert "availability zone" not in str(exc_info.value)

    def test_none_config_accepted(self):
        client = AWSClient(None)
        assert client.config is None

    def test_all_valid_regions_accepted(self):
        for region in VALID_AWS_REGIONS:
            config = AWSCredentials(awsRegion=region)
            client = AWSClient(config)
            assert client.config.awsRegion == region
