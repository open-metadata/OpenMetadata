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
"""Pure profile checks on the Table returned by the SDK."""

from metadata.generated.schema.entity.data.table import ColumnProfile, Table

from ...runtime.expect import Query
from .entities import column, entity_exists


def profile_query(om, fqn: str) -> Query[Table | None]:
    return Query(f"profile for {fqn}", lambda: om.get_latest_table_profile(fqn))


def table_has_row_count(expected: int):
    if isinstance(expected, bool) or not isinstance(expected, int) or expected < 0:
        raise ValueError("row count must be a nonnegative integer")

    def check(table):
        entity_exists(table)
        assert table.profile is not None, "profile missing"
        assert table.profile.rowCount == expected, f"row count: expected {expected}, got {table.profile.rowCount}"

    return check


def column_has_metrics(name: str, **expected):
    unknown = expected.keys() - ColumnProfile.model_fields.keys()
    if not expected or unknown:
        raise ValueError(f"supply known ColumnProfile metrics; unknown={sorted(unknown)}")

    def check(table):
        profile = column(table, name).profile
        assert profile is not None, f"column {name} profile missing"
        for metric, wanted in expected.items():
            actual = getattr(profile, metric)
            assert actual == wanted, f"{name}.{metric}: expected {wanted!r}, got {actual!r}"

    return check
