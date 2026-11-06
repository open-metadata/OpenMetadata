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

"""ClickHouse table resolution in its native schema namespace."""

from dataclasses import replace

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table_binding import TableBindingResolution as DefaultTableBindingResolution


class ClickHouseTableBindingResolution(DefaultTableBindingResolution):
    def _normalize_reference(self, reference: TableReference, service_name: str | None) -> TableReference:
        return replace(reference, database=None) if service_name and service_name != "*" else reference


TableBindingResolution = ClickHouseTableBindingResolution
