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
"""Strict authenticated reads of persisted table samples."""

from metadata.generated.schema.entity.data.table import Table
from metadata.ingestion.ometa.client import APIError

from ...runtime.expect import Query


def sample_query(om, table: Table) -> Query[Table | None]:
    endpoint = f"{om.get_suffix(Table)}/{table.id.root}/sampleData"

    def read():
        try:
            response = om.client.get(endpoint)
        except APIError as error:
            if error.code == 404:
                return None
            raise
        return Table.model_validate(response)

    return Query(f"samples for {table.fullyQualifiedName.root}", read)
