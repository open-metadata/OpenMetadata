#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Public ClickZetta table-metric adapter."""

from metadata.profiler.orm.functions.table_metric_computer import (
    ClickzettaTableMetricComputer,
    clickzetta_full_scan_allowed,
)

__all__ = ["ClickzettaTableMetricComputer", "clickzetta_full_scan_allowed"]
