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
Test TTL Cache
"""
import time
from unittest.mock import patch

import pytest

from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.ingestion.ometa.client import REST, LimitsException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.ometa.ttl_cache import TTLCache


def test_ttl_cache():
    """Check we can add objects to the cache and they expire after the TTL"""

    cache = TTLCache(ttl=1)

    # Set a value
    cache.add("test")
    assert "test" in cache

    # Delete the value
    cache.delete("test")
    assert "test" not in cache

    # Set a value
    cache.add("test")
    assert "test" in cache

    # Wait for the TTL to expire
    time.sleep(5)

    # Value should not be in the cache
    assert "test" not in cache


def test_ometa_ttl_cache():
    """ometa works well with TTL Cache"""

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        enableVersionValidation=False,
        authProvider=AuthProvider.openmetadata,
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=CustomSecretStr("token")),
    )
    metadata = OpenMetadata(server_config)

    def limits_exc(*_, **__):
        raise LimitsException("Mock limits exception")

    with patch.object(REST, "_one_request", side_effect=limits_exc):
        with pytest.raises(LimitsException) as exc_info:
            metadata.get_by_name(entity=Table, fqn="random")

        assert str(exc_info.value) == "Mock limits exception"

        with pytest.raises(LimitsException) as exc_info:
            metadata.get_by_name(entity=Table, fqn="random")

        assert (
            str(exc_info.value)
            == "Skipping request - limits reached for /tables/name/random"
        )
