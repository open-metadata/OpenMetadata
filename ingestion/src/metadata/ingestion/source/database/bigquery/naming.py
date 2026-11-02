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
"""BigQuery query-reference normalization."""

from dataclasses import replace

from metadata.domain.table_reference import TableReference
from metadata.entity_resolution.table import TableServiceBinding
from metadata.ingestion.source.database.bigquery.resolution import resolve_bigquery_reference
from metadata.ingestion.source.database.bigquery.sharding import strip_partition_decorator


def normalize_table_reference(reference: TableReference) -> TableReference:
    return replace(reference, table=strip_partition_decorator(reference.table))


def table_service_binding(service_name: str) -> TableServiceBinding:
    return TableServiceBinding(service_name, normalize_table_reference, resolve_bigquery_reference)
