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
Tests for databricks-sqlalchemy migration changes
"""

from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksScheme,
)
from metadata.ingestion.source.database.databricks.metadata import (
    ARRAY,
    MAP,
    STRUCT,
    _type_map,
)


class TestDatabricksScheme:
    """Verify the scheme enum reflects the new databricks-sqlalchemy package"""

    def test_scheme_value(self):
        assert DatabricksScheme.databricks.value == "databricks"


EXPECTED_TYPES = [
    "boolean",
    "tinyint",
    "smallint",
    "int",
    "bigint",
    "float",
    "double",
    "string",
    "varchar",
    "char",
    "date",
    "timestamp",
    "decimal",
    "binary",
    "struct",
    "array",
    "map",
    "void",
    "interval",
    "uniontype",
]


class TestTypeMap:
    """Verify _type_map is self-contained and covers all expected Databricks types"""

    def test_all_expected_types_present(self):
        for type_name in EXPECTED_TYPES:
            assert type_name in _type_map, f"Missing type '{type_name}' in _type_map"

    def test_complex_types_are_custom(self):
        assert _type_map["struct"] is STRUCT
        assert _type_map["array"] is ARRAY
        assert _type_map["map"] is MAP

    def test_all_values_are_types(self):
        for type_name, type_cls in _type_map.items():
            assert isinstance(type_cls, type) or callable(type_cls), (
                f"_type_map['{type_name}'] is not a type or callable: {type_cls}"
            )


class TestDatabricksBaseDefaultScheme:
    """Verify DatabricksBaseTableParameter uses the new default scheme"""

    def test_default_scheme(self):
        from metadata.ingestion.source.database.common.data_diff.databricks_base import (
            DatabricksBaseTableParameter,
        )

        class FakeConfig:
            hostPort = "host:443"  # noqa: N815
            token = "secret"

        result = DatabricksBaseTableParameter._get_service_connection_config(FakeConfig())
        assert result is not None
        assert "databricks+connector" not in result


class TestDatabricksPipelineConnectionUrl:
    """Verify pipeline connection URL uses new scheme"""

    def test_url_scheme(self):
        from metadata.generated.schema.entity.services.connections.database.databricks.personalAccessToken import (
            PersonalAccessToken,
        )
        from metadata.generated.schema.entity.services.connections.pipeline.databricksPipelineConnection import (
            DatabricksPipelineConnection,
        )
        from metadata.ingestion.source.pipeline.databrickspipeline.connection import (
            get_connection_url,
        )

        conn = DatabricksPipelineConnection(
            hostPort="workspace.cloud.databricks.com:443",
            authType=PersonalAccessToken(token="dapi123"),
        )
        url = get_connection_url(conn)
        assert url.startswith("databricks://")
        assert "databricks+connector" not in url
        assert url == "databricks://workspace.cloud.databricks.com:443"
