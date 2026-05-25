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

"""Test DataDiff parameter setter functionality"""

import uuid
from unittest.mock import patch

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseConnection,
    DatabaseService,
    DatabaseServiceType,
)


def test_get_data_diff_table_path_oracle_denormalization():
    """Test Oracle table path generation with proper denormalization (lowercase to uppercase)"""
    table_fqn = "oracle_service.testdb.schema_name.table_name"
    service_type = DatabaseServiceType.Oracle

    result = BaseTableParameter.get_data_diff_table_path(table_fqn, service_type)

    # Oracle should denormalize names (lowercase to uppercase)
    expected = "SCHEMA_NAME.TABLE_NAME"
    assert result == expected


def test_get_data_diff_table_path_oracle_denormalization_fallback():
    """Test Oracle table path generation with denormalization error fallback"""
    table_fqn = "oracle_service.testdb.schema_name.table_name"
    service_type = DatabaseServiceType.Oracle

    with patch(
        "metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter.make_url"
    ) as mock_make_url:
        mock_make_url.side_effect = Exception("Dialect error")

        result = BaseTableParameter.get_data_diff_table_path(table_fqn, service_type)

        # Should fallback to original names without denormalization
        expected = "schema_name.table_name"
        assert result == expected


def test_get_data_diff_table_path_mysql_no_denormalization():
    """Test MySQL table path generation (no denormalization needed)"""
    table_fqn = "mysql_service.testdb.schema_name.table_name"
    service_type = DatabaseServiceType.Mysql

    result = BaseTableParameter.get_data_diff_table_path(table_fqn, service_type)

    # MySQL should preserve original case
    expected = "schema_name.table_name"
    assert result == expected


def test_get_data_diff_url_mysql_includes_database():
    """Test MySQL URL generation includes the database (schema in FQN) in the path.

    This is required because data_diff library requires MySQL URLs to specify a database.
    See: https://github.com/open-metadata/OpenMetadata/issues/24641
    """
    mysql_connection = MysqlConnection(
        hostPort="localhost:3306",
        username="testuser",
    )

    db_service = DatabaseService(
        id=uuid.uuid4(),
        name="mysql_test_service",
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(config=mysql_connection),
    )

    table_fqn = "mysql_test_service.default.zxk.test_table"

    param_setter = BaseTableParameter()
    with patch.object(
        param_setter,
        "_get_service_connection_config",
        return_value="mysql+pymysql://testuser:pass@localhost:3306/",
    ):
        result = param_setter.get_data_diff_url(db_service, table_fqn)

    assert result == "mysql://testuser:pass@localhost:3306/zxk"


def test_trino_get_data_diff_url_sets_catalog_and_schema_from_fqn():
    """Trino data_diff URL must carry the table-specific catalog and schema.

    TrinoConnection.get_connection_dict() returns a dict with the
    service-level catalog and no schema. TrinoTableParameter must
    override these with values from the table FQN so data_diff opens
    a session against the correct catalog.

    This test also guards against regressions where the underlying
    service-level dict is mutated in place, which would cause the
    catalog/schema from one table FQN to leak into another.
    """
    from metadata.ingestion.source.database.trino.data_diff.data_diff import (
        TrinoTableParameter,
    )

    db_service = DatabaseService(
        id=uuid.uuid4(),
        name="trino_service",
        serviceType=DatabaseServiceType.Trino,
        connection=DatabaseConnection(
            config=TrinoConnection(
                hostPort="localhost:8080",
                username="trino",
            )
        ),
    )

    # Simulate the service-level connection dict returned by TrinoConnection.get_connection_dict()
    service_level_dict = {
        "driver": "trino",
        "host": "trino-test",
        "port": 8080,
        "user": "trino",
        "catalog": "default_catalog",
        "schema": None,
    }

    param_setter = TrinoTableParameter()
    with patch.object(
        param_setter,
        "_get_service_connection_config",
        return_value=service_level_dict,
    ):
        # First table: catalog and schema from its FQN
        result1 = param_setter.get_data_diff_url(
            db_service,
            "trino_service.iceberg_nlm.sharp_datastore.pni_foundry_riser_all_segments",
        )
        # Second table: use the same service-level dict, but with a different FQN
        result2 = param_setter.get_data_diff_url(
            db_service,
            "trino_service.other_catalog.other_schema.other_table",
        )

    # The returned objects should be dicts derived from, but not mutating, the service-level dict
    assert isinstance(result1, dict)
    assert isinstance(result2, dict)
    assert result1 is not service_level_dict
    assert result2 is not service_level_dict
    assert result1 is not result2

    # Each call must apply catalog/schema from its own FQN
    assert result1["catalog"] == "iceberg_nlm"
    assert result1["schema"] == "sharp_datastore"
    assert result2["catalog"] == "other_catalog"
    assert result2["schema"] == "other_schema"

    # And the original service-level dict must remain unchanged
    assert service_level_dict["catalog"] == "default_catalog"
    assert service_level_dict["schema"] is None
