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
"""
Microsoft Fabric connection defaults
"""

import pytest

from metadata.generated.schema.entity.services.connections.database.microsoftFabricConnection import (
    MicrosoftFabricConnection,
)
from metadata.generated.schema.type.filterPattern import FilterPattern
from metadata.utils.filters import filter_by_schema

# A service created in the UI stores this default, and its new ingestion pipelines start from it
DEFAULT_SCHEMA_FILTER = FilterPattern.model_validate(
    MicrosoftFabricConnection.model_fields["schemaFilterPattern"].default
)


def test_the_default_schema_filter_leaves_out_the_internal_schema():
    """Every Warehouse and Lakehouse has `_rsc`, an internal schema that is always empty"""
    assert filter_by_schema(DEFAULT_SCHEMA_FILTER, "_rsc")


@pytest.mark.parametrize("schema", ["queryinsights", "dbo", "qa_crm"])
def test_the_default_schema_filter_keeps_queried_schemas(schema):
    """queryinsights holds the query history views, which reports such as Power BI dataflows read"""
    assert not filter_by_schema(DEFAULT_SCHEMA_FILTER, schema)
