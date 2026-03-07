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
Ssrs integration test fixtures
"""
import pytest


@pytest.fixture(scope="module")
def ssrs_service():
    """
    Set up and tear down a Ssrs service for integration testing.
    TODO: Configure testcontainers or mock server.
    Provide a Docker image via scaffold --docker-image to auto-generate this.
    """
    yield None
