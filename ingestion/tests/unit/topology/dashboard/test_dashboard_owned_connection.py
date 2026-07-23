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
"""Dashboard sources dispose their BaseConnection owner on close()."""

from unittest.mock import MagicMock

from metadata.ingestion.source.dashboard.dashboard_service import DashboardServiceSource
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.ingestion.source.dashboard.microstrategy.metadata import (
    MicrostrategySource,
)
from metadata.ingestion.source.dashboard.powerbi.metadata import PowerbiSource
from metadata.ingestion.source.dashboard.tableau.metadata import TableauSource


def _source_with_mocked_owner(source_cls):
    source = source_cls.__new__(source_cls)
    source.metadata = MagicMock()
    source._connection = MagicMock()
    source.client = MagicMock()
    source.today = MagicMock()
    return source


def test_looker_close_disposes_owner():
    source = _source_with_mocked_owner(LookerSource)
    source.close()
    source._connection.close.assert_called_once()
    source.metadata.close.assert_called_once()


def test_powerbi_close_disposes_owner():
    source = _source_with_mocked_owner(PowerbiSource)
    source.close()
    source._connection.close.assert_called_once()
    source.metadata.close.assert_called_once()


def test_tableau_close_disposes_owner():
    source = _source_with_mocked_owner(TableauSource)
    source.close()
    source._connection.close.assert_called_once()
    source.metadata.close.assert_called_once()


def test_microstrategy_inherits_base_close():
    assert MicrostrategySource.close is DashboardServiceSource.close
    source = _source_with_mocked_owner(MicrostrategySource)
    source.close()
    source._connection.close.assert_called_once()
