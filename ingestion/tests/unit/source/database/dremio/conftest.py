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
Fixtures of the Dremio unit tests
"""

from unittest.mock import MagicMock, patch

import pytest

from metadata.ingestion.source.database.dremio.metadata import DremioSource

from ._fixtures import SOFTWARE_CONFIG, FakeDremio  # noqa: TID252


@pytest.fixture
def make_source():
    """A DremioSource on a FakeDremio, positioned on the service"""

    def build(answers: dict, is_cloud: bool = False, source_config: dict | None = None) -> DremioSource:
        config = {**SOFTWARE_CONFIG, "sourceConfig": {"config": {"type": "DatabaseMetadata", **(source_config or {})}}}
        connection = MagicMock(client=FakeDremio(answers, is_cloud))
        with (
            patch("metadata.ingestion.source.database.dremio.metadata.create_connection", return_value=connection),
            patch.object(DremioSource, "test_connection"),
        ):
            source = DremioSource.create(config, MagicMock())
        source.context.get().database_service = "svc"
        return source

    return build
