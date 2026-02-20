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
We can load OpenMetadata from the environment variables
"""

import pytest

from _openmetadata_testutils.ometa import OM_JWT
from metadata.ingestion.ometa.ometa_api import OpenMetadata


class TestOMetaFromEnv:
    """
    Environment-based OpenMetadata initialization tests.
    Tests that OpenMetadata can be loaded from environment variables.
    """

    @pytest.mark.parametrize(
        "env_vars",
        [
            [
                ("OPENMETADATA__connection__hostPort", "http://localhost:8585/api"),
                ("OPENMETADATA__connection__authProvider", "openmetadata"),
                ("OPENMETADATA__connection__securityConfig__jwtToken", OM_JWT),
            ],
            [
                ("OPENMETADATA__CONNECTION__HOSTPORT", "http://localhost:8585/api"),
                ("OPENMETADATA__CONNECTION__AUTHPROVIDER", "openmetadata"),
                ("OPENMETADATA__CONNECTION__SECURITYCONFIG__JWTTOKEN", OM_JWT),
            ],
        ],
    )
    def test_ometa_from_env(self, monkeypatch, env_vars):
        for var, value in env_vars:
            monkeypatch.setenv(var, value)

        ometa = OpenMetadata.from_env()
        assert ometa.health_check()
