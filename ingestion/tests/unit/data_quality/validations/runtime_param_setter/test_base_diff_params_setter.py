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
