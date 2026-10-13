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

from datetime import datetime, timezone

from metadata.ingestion.source.database.sample_data import get_lineage_details


def test_get_lineage_details_falls_back_when_camel_case_columns_are_null():
    details = get_lineage_details(
        {
            "columnsLineage": None,
            "columns_lineage": [
                {
                    "fromColumns": ["service.database.schema.source.id"],
                    "toColumn": "service.database.schema.target.id",
                }
            ],
        },
        None,
        datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    assert details is not None
    assert details.columnsLineage is not None
    assert len(details.columnsLineage) == 1
    assert details.columnsLineage[0].toColumn.root == "service.database.schema.target.id"
