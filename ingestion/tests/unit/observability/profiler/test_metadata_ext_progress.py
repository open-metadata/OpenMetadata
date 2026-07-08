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

"""Progress counting for the no-serviceName profiler source path."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from metadata.profiler.source.metadata_ext import OpenMetadataSourceExt
from metadata.profiler.source.profiler_source_interface import ProfilerSourceInterface


def _make_ext_source(table_names):
    source = OpenMetadataSourceExt.__new__(OpenMetadataSourceExt)
    source.metadata = MagicMock()
    source.metadata.get_profiler_config_settings.return_value = None
    source.config = SimpleNamespace(source=SimpleNamespace(type="mysql", serviceName=None))
    source.get_database_names = lambda: ["db"]
    source.get_schema_names = lambda: ["schema"]
    source.get_table_names = lambda schema: iter(table_names)
    source._get_fields = lambda: ["columns"]
    source.import_profiler_interface = lambda: lambda *a, **k: MagicMock(spec=ProfilerSourceInterface)
    return source


class TestMetadataExtProgress:
    def test_tracks_and_reconciles_resolved_tables(self):
        source = _make_ext_source(table_names=["t1", "t2", "missing"])

        with (
            patch(
                "metadata.profiler.source.metadata_ext.fqn.search_database_from_es",
                return_value=SimpleNamespace(fullyQualifiedName=SimpleNamespace(root="svc.db")),
            ),
            patch(
                "metadata.profiler.source.metadata_ext.fqn.search_table_from_es",
                side_effect=lambda **kw: None if kw["table_name"] == "missing" else MagicMock(),
            ),
        ):
            records = list(OpenMetadataSourceExt._iter(source))

        assert len(records) == 2
        assert source.progress_tracking.registry.global_counters() == [("Table", 2, 2)]
