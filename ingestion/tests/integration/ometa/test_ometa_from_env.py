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

from _openmetadata_testutils.ometa import OM_JWT
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def test_ometa_from_env(monkeypatch):
    # Set environment variables
    monkeypatch.setenv(
        "OPENMETADATA__connection__hostPort", "http://localhost:8585/api"
    )
    monkeypatch.setenv("OPENMETADATA__connection__authProvider", "openmetadata")
    monkeypatch.setenv("OPENMETADATA__connection__securityConfig__jwtToken", OM_JWT)

    ometa = OpenMetadata.from_env()
    assert ometa.health_check()
