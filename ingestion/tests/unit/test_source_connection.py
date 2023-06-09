#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from unittest import TestCase

from metadata.generated.schema.entity.services.connections.database.athenaConnection import (
    AthenaConnection,
    AthenaScheme,
)
from metadata.generated.schema.entity.services.connections.database.clickhouseConnection import (
    ClickhouseConnection,
    ClickhouseScheme,
)
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
    DatabricksScheme,
)
from metadata.generated.schema.entity.services.connections.database.db2Connection import (
    Db2Connection,
    Db2Scheme,
)
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidConnection,
    DruidScheme,
)
from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
    HiveScheme,
)
from metadata.generated.schema.entity.services.connections.database.impalaConnection import (
    AuthMechanism,
    ImpalaConnection,
    ImpalaScheme,
)
from metadata.generated.schema.entity.services.connections.database.mariaDBConnection import (
    MariaDBConnection,
    MariaDBScheme,
)
from metadata.generated.schema.entity.services.connections.database.mssqlConnection import (
    MssqlConnection,
    MssqlScheme,
)
from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
    MySQLScheme,
)
from metadata.generated.schema.entity.services.connections.database.oracleConnection import (
    OracleConnection,
    OracleDatabaseSchema,
    OracleScheme,
    OracleServiceName,
)
from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBConnection,
    PinotDBScheme,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
    PostgresScheme,
)
from metadata.generated.schema.entity.services.connections.database.prestoConnection import (
    PrestoConnection,
    PrestoScheme,
)
from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
    RedshiftScheme,
)
from metadata.generated.schema.entity.services.connections.database.singleStoreConnection import (
    SingleStoreConnection,
    SingleStoreScheme,
)
from metadata.generated.schema.entity.services.connections.database.snowflakeConnection import (
    SnowflakeConnection,
    SnowflakeScheme,
)
from metadata.generated.schema.entity.services.connections.database.trinoConnection import (
    TrinoConnection,
    TrinoScheme,
)
from metadata.generated.schema.entity.services.connections.database.verticaConnection import (
    VerticaConnection,
    VerticaScheme,
)
from metadata.generated.schema.entity.services.connections.database.common.commonConfigWithDatabase import (
    ConfigurationSource,
)
from metadata.generated.schema.security.credentials import awsCredentials
from metadata.ingestion.connections.builders import (
    get_connection_args_common,
    get_connection_url_common,
)


# pylint: disable=import-outside-toplevel
class SourceConnectionTest(TestCase):
    def test_databricks_url_without_db(self):
        from metadata.ingestion.source.database.databricks.connection import (
            get_connection_url,
        )

        expected_result = (
            "databricks+connector://token:KlivDTACWXKmZVfN1qIM@1.1.1.1:443"
        )
        databricks_conn_obj = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="1.1.1.1:443",
            token="KlivDTACWXKmZVfN1qIM",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_databricks_url_with_db(self):
        from metadata.ingestion.source.database.databricks.connection import (
            get_connection_url,
        )

        expected_result = (
            "databricks+connector://token:KlivDTACWXKmZVfN1qIM@1.1.1.1:443"
        )
        databricks_conn_obj = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="1.1.1.1:443",
            token="KlivDTACWXKmZVfN1qIM",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_hive_url(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive, hostPort="localhost:10000"
        )
        assert expected_result == get_connection_url(hive_conn_obj)

        expected_http_result = "hive+http://localhost:1000"
        http_conn_obj = HiveConnection(
            scheme=HiveScheme.hive_http, hostPort="localhost:1000"
        )

        assert expected_http_result == get_connection_url(http_conn_obj)

        exptected_https_result = "hive+https://localhost:1000"
        http_conn_obj = HiveConnection(
            scheme=HiveScheme.hive_https, hostPort="localhost:1000"
        )
        assert exptected_https_result == get_connection_url(http_conn_obj)

    def test_hive_url_custom_auth(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://username:password@localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            password="password",
            hostPort="localhost:10000",
            connectionArguments={"auth": "CUSTOM"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

        # Passing @ in username and password
        expected_result = "hive://username%40444:password%40333@localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username@444",
            password="password@333",
            hostPort="localhost:10000",
            connectionArguments={"auth": "CUSTOM"},
        )

        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_conn_options_with_db(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://localhost:10000/test_db?Key=Value"
        hive_conn_obj = HiveConnection(
            hostPort="localhost:10000",
            databaseSchema="test_db",
            connectionOptions={"Key": "Value"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_conn_options_without_db(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://localhost:10000?Key=Value"
        hive_conn_obj = HiveConnection(
            hostPort="localhost:10000",
            connectionOptions={"Key": "Value"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_with_kerberos_auth(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            hostPort="localhost:10000",
            connectionArguments={
                "auth": "KERBEROS",
                "kerberos_service_name": "hive",
            },
        )

        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_with_ldap_auth(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://username:password@localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            password="password",
            hostPort="localhost:10000",
            connectionArguments={"auth": "LDAP"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_without_auth(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://username:password@localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            password="password",
            hostPort="localhost:10000",
            connectionArguments={"customKey": "value"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_without_connection_arguments(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://username:password@localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            password="password",
            hostPort="localhost:10000",
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_without_connection_arguments_pass(self):
        from metadata.ingestion.source.database.hive.connection import (
            get_connection_url,
        )

        expected_result = "hive://username@localhost:10000"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            hostPort="localhost:10000",
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_impala_url(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://localhost:21050"
        impala_conn_obj = ImpalaConnection(
            scheme=ImpalaScheme.impala, hostPort="localhost:21050"
        )
        assert expected_result == get_connection_url(impala_conn_obj)

    def test_impala_url_custom_auth(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://username:password@localhost:21050"
        impala_conn_obj = ImpalaConnection(
            scheme=ImpalaScheme.impala.value,
            username="username",
            password="password",
            hostPort="localhost:21050",
            connectionArguments={"auth": "CUSTOM"},
        )
        assert expected_result == get_connection_url(impala_conn_obj)

        # Passing @ in username and password
        expected_result = "impala://username%40444:password%40333@localhost:21050"
        impala_conn_obj = ImpalaConnection(
            scheme=ImpalaScheme.impala.value,
            username="username@444",
            password="password@333",
            hostPort="localhost:21050",
            connectionArguments={"auth": "CUSTOM"},
        )

        assert expected_result == get_connection_url(impala_conn_obj)

    def test_impala_url_conn_options_with_db(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://localhost:21050/test_db?Key=Value"
        impala_conn_obj = ImpalaConnection(
            hostPort="localhost:21050",
            databaseSchema="test_db",
            connectionOptions={"Key": "Value"},
        )
        assert expected_result == get_connection_url(impala_conn_obj)

    def test_impala_url_conn_options_without_db(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://localhost:21050?Key=Value"
        impala_conn_obj = ImpalaConnection(
            hostPort="localhost:21050",
            connectionOptions={"Key": "Value"},
        )
        assert expected_result == get_connection_url(impala_conn_obj)

    def test_impala_url_with_ldap_auth(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://username:password@localhost:21050"
        impala_conn_obj = ImpalaConnection(
            scheme=ImpalaScheme.impala.value,
            username="username",
            password="password",
            hostPort="localhost:21050",
            connectionArguments={"auth_mechanism": "LDAP"},
        )
        assert expected_result == get_connection_url(impala_conn_obj)

    def test_impala_url_without_connection_arguments(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://username:password@localhost:21050"
        impala_conn_obj = ImpalaConnection(
            scheme=ImpalaScheme.impala.value,
            username="username",
            password="password",
            hostPort="localhost:21050",
        )
        assert expected_result == get_connection_url(impala_conn_obj)

    def test_impala_url_without_connection_arguments_pass(self):
        from metadata.ingestion.source.database.impala.connection import (
            get_connection_url,
        )

        expected_result = "impala://username@localhost:21050"
        impala_conn_obj = ImpalaConnection(
            scheme=ImpalaScheme.impala.value,
            username="username",
            hostPort="localhost:21050",
        )
        assert expected_result == get_connection_url(impala_conn_obj)

    def test_trino_url_without_params(self):
        from metadata.ingestion.source.database.trino.connection import (
            get_connection_url,
        )

        expected_url = "trino://username:pass@localhost:443/catalog"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
        )

        assert expected_url == get_connection_url(trino_conn_obj)

        # Passing @ in username and password
        expected_url = "trino://username%40444:pass%40111@localhost:443/catalog"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username@444",
            password="pass@111",
            catalog="catalog",
        )

        assert expected_url == get_connection_url(trino_conn_obj)

    def test_trino_conn_arguments(self):
        from metadata.ingestion.source.database.trino.connection import (
            get_connection_args,
        )

        # connection arguments without connectionArguments and without proxies
        expected_args = {}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            connectionArguments=None,
            scheme=TrinoScheme.trino,
        )
        assert expected_args == get_connection_args(trino_conn_obj)

        # connection arguments with connectionArguments and without proxies
        expected_args = {"user": "user-to-be-impersonated"}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=TrinoScheme.trino,
        )
        assert expected_args == get_connection_args(trino_conn_obj)

        # connection arguments without connectionArguments and with proxies
        expected_args = {}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            connectionArguments=None,
            proxies={"http": "foo.bar:3128", "http://host.name": "foo.bar:4012"},
            scheme=TrinoScheme.trino,
        )
        conn_args = get_connection_args(trino_conn_obj)
        assert "http_session" in conn_args
        conn_args.pop("http_session")
        assert expected_args == conn_args

        # connection arguments with connectionArguments and with proxies
        expected_args = {"user": "user-to-be-impersonated"}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            connectionArguments={"user": "user-to-be-impersonated"},
            proxies={"http": "foo.bar:3128", "http://host.name": "foo.bar:4012"},
            scheme=TrinoScheme.trino,
        )
        conn_args = get_connection_args(trino_conn_obj)
        assert "http_session" in conn_args
        conn_args.pop("http_session")
        assert expected_args == conn_args

    def test_trino_url_with_params(self):
        from metadata.ingestion.source.database.trino.connection import (
            get_connection_url,
        )

        expected_url = "trino://username:pass@localhost:443/catalog?param=value"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
            params={"param": "value"},
        )
        assert expected_url == get_connection_url(trino_conn_obj)

    def test_trino_with_proxies(self):
        from metadata.ingestion.source.database.trino.connection import (
            get_connection_args,
        )

        test_proxies = {"http": "http_proxy", "https": "https_proxy"}
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
            proxies=test_proxies,
        )
        assert (
            test_proxies
            == get_connection_args(trino_conn_obj).get("http_session").proxies
        )

    def test_trino_without_catalog(self):
        from metadata.ingestion.source.database.trino.connection import (
            get_connection_url,
        )

        # Test trino url without catalog
        expected_url = "trino://username:pass@localhost:443"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
        )

        assert expected_url == get_connection_url(trino_conn_obj)

    def test_vertica_url(self):
        expected_url = (
            "vertica+vertica_python://username:password@localhost:5443/database"
        )
        vertica_conn_obj = VerticaConnection(
            scheme=VerticaScheme.vertica_vertica_python,
            hostPort="localhost:5443",
            username="username",
            password="password",
            database="database",
        )
        assert expected_url == get_connection_url_common(vertica_conn_obj)

        # Passing @ in username and password
        expected_url = "vertica+vertica_python://username%40444:password%40123@localhost:5443/database"
        vertica_conn_obj = VerticaConnection(
            scheme=VerticaScheme.vertica_vertica_python,
            hostPort="localhost:5443",
            username="username@444",
            password="password@123",
            database="database",
        )

        assert expected_url == get_connection_url_common(vertica_conn_obj)

    def test_druid_url(self):
        from metadata.ingestion.source.database.druid.connection import (
            get_connection_url,
        )

        expected_url = "druid://localhost:8082/druid/v2/sql"
        druid_conn_obj = DruidConnection(
            scheme=DruidScheme.druid, hostPort="localhost:8082"
        )

        assert expected_url == get_connection_url(druid_conn_obj)

    def test_pinotdb_url(self):
        from metadata.ingestion.source.database.pinotdb.connection import (
            get_connection_url,
        )

        expected_url = (
            "pinot://localhost:8099/query/sql?controller=http://localhost:9000/"
        )
        pinot_conn_obj = PinotDBConnection(
            scheme=PinotDBScheme.pinot,
            hostPort="localhost:8099",
            pinotControllerHost="http://localhost:9000/",
        )

        assert expected_url == get_connection_url(pinot_conn_obj)

    def test_mysql_url(self):
        # connection arguments without db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306"
        mysql_conn_obj = MysqlConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MySQLScheme.mysql_pymysql,
        )
        assert expected_url == get_connection_url_common(mysql_conn_obj)

        # connection arguments with db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306"
        mysql_conn_obj = MysqlConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MySQLScheme.mysql_pymysql,
        )
        assert expected_url == get_connection_url_common(mysql_conn_obj)

    def test_clickhouse_url(self):
        # connection arguments without db
        expected_url = "clickhouse+http://username:@localhost:8123"
        clickhouse_conn_obj = ClickhouseConnection(
            username="username",
            hostPort="localhost:8123",
            scheme=ClickhouseScheme.clickhouse_http,
            databaseSchema=None,
        )
        assert expected_url == get_connection_url_common(clickhouse_conn_obj)

        # connection arguments with db
        expected_url = "clickhouse+http://username:@localhost:8123/default"
        clickhouse_conn_obj = ClickhouseConnection(
            username="username",
            hostPort="localhost:8123",
            scheme=ClickhouseScheme.clickhouse_http,
            databaseSchema="default",
        )
        assert expected_url == get_connection_url_common(clickhouse_conn_obj)

        expected_url = (
            "clickhouse+http://username:@localhost:8123/default?protocol=https"
        )
        clickhouse_conn_obj = ClickhouseConnection(
            username="username",
            hostPort="localhost:8123",
            scheme=ClickhouseScheme.clickhouse_http,
            connectionOptions=dict(protocol="https"),
            databaseSchema="default",
        )
        assert expected_url == get_connection_url_common(clickhouse_conn_obj)

    def test_mariadb_url(self):
        # connection arguments without db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306"
        mariadb_conn_obj = MariaDBConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MariaDBScheme.mysql_pymysql,
        )
        assert expected_url == get_connection_url_common(mariadb_conn_obj)

        # connection arguments with db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306"
        mariadb_conn_obj = MariaDBConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MariaDBScheme.mysql_pymysql,
        )
        assert expected_url == get_connection_url_common(mariadb_conn_obj)

    def test_postgres_url(self):
        # connection arguments with db
        expected_url = "postgresql+psycopg2://openmetadata_user:@localhost:5432/default"
        postgres_conn_obj = PostgresConnection(
            connectionType=ConfigurationSource(
                username="openmetadata_user",
                hostPort="localhost:5432",
                database="default",
            ),
            
            scheme=PostgresScheme.postgresql_psycopg2,
        )
        assert expected_url == get_connection_url_common(postgres_conn_obj)

    def test_redshift_url(self):
        # connection arguments witho db
        expected_url = "redshift+psycopg2://username:strong_password@cluster.name.region.redshift.amazonaws.com:5439/dev"
        redshift_conn_obj = RedshiftConnection(
            username="username",
            password="strong_password",
            hostPort="cluster.name.region.redshift.amazonaws.com:5439",
            scheme=RedshiftScheme.redshift_psycopg2,
            database="dev",
        )
        assert expected_url == get_connection_url_common(redshift_conn_obj)

    def test_singleStore_url(self):
        # connection arguments without db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:5432"
        singleStore_conn_obj = SingleStoreConnection(
            username="openmetadata_user",
            hostPort="localhost:5432",
            scheme=SingleStoreScheme.mysql_pymysql,
        )
        assert expected_url == get_connection_url_common(singleStore_conn_obj)

        # connection arguments with db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:5432"
        singleStore_conn_obj = SingleStoreConnection(
            username="openmetadata_user",
            hostPort="localhost:5432",
            scheme=SingleStoreScheme.mysql_pymysql,
        )
        assert expected_url == get_connection_url_common(singleStore_conn_obj)

    def test_db2_url(self):
        # connection arguments with db
        expected_url = "db2+ibm_db://openmetadata_user:@localhost:50000/testdb"
        db2_conn_obj = Db2Connection(
            scheme=Db2Scheme.db2_ibm_db,
            username="openmetadata_user",
            hostPort="localhost:50000",
            database="testdb",
        )
        assert expected_url == get_connection_url_common(db2_conn_obj)

    def test_snowflake_url(self):
        # connection arguments without db

        from metadata.ingestion.source.database.snowflake.connection import (
            get_connection_url,
        )

        expected_url = "snowflake://coding:Abhi@ue18849.us-east-2.aws?account=ue18849.us-east-2.aws&warehouse=COMPUTE_WH"
        snowflake_conn_obj = SnowflakeConnection(
            scheme=SnowflakeScheme.snowflake,
            username="coding",
            password="Abhi",
            warehouse="COMPUTE_WH",
            account="ue18849.us-east-2.aws",
        )

        assert expected_url == get_connection_url(snowflake_conn_obj)

    def test_snowflake_url(self):
        from metadata.ingestion.source.database.snowflake.connection import (
            get_connection_url,
        )

        # Passing @ in username and password
        expected_url = "snowflake://coding%40444:Abhi%40123@ue18849.us-east-2.aws?account=ue18849.us-east-2.aws&warehouse=COMPUTE_WH"
        snowflake_conn_obj = SnowflakeConnection(
            scheme=SnowflakeScheme.snowflake,
            username="coding@444",
            password="Abhi@123",
            warehouse="COMPUTE_WH",
            account="ue18849.us-east-2.aws",
        )

        assert expected_url == get_connection_url(snowflake_conn_obj)

        # connection arguments with db
        expected_url = "snowflake://coding:Abhi@ue18849.us-east-2.aws/testdb?account=ue18849.us-east-2.aws&warehouse=COMPUTE_WH"
        snowflake_conn_obj = SnowflakeConnection(
            scheme=SnowflakeScheme.snowflake,
            username="coding",
            password="Abhi",
            database="testdb",
            warehouse="COMPUTE_WH",
            account="ue18849.us-east-2.aws",
        )
        assert expected_url == get_connection_url(snowflake_conn_obj)

    def test_mysql_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        mysql_conn_obj = MysqlConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments=None,
            scheme=MySQLScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args_common(mysql_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        mysql_conn_obj = MysqlConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=MySQLScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args_common(mysql_conn_obj)

    def test_clickhouse_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        clickhouse_conn_obj = ClickhouseConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            databaseSchema=None,
            connectionArguments=None,
            scheme=ClickhouseScheme.clickhouse_http,
        )
        assert expected_args == get_connection_args_common(clickhouse_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        clickhouse_conn_obj = ClickhouseConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            databaseSchema="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=ClickhouseScheme.clickhouse_http,
        )
        assert expected_args == get_connection_args_common(clickhouse_conn_obj)

    def test_mariadb_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        mariadb_conn_obj = MariaDBConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments=None,
            scheme=MariaDBScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args_common(mariadb_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        mariadb_conn_obj = MariaDBConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=MariaDBScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args_common(mariadb_conn_obj)

    def test_postgres_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        postgres_conn_obj = PostgresConnection(
            connectionType=ConfigurationSource(
                username="user",
                password=None,
                hostPort="localhost:443",
                database="postgres",
            ),
            connectionArguments=None,
            scheme=PostgresScheme.postgresql_psycopg2,
        )
        assert expected_args == get_connection_args_common(postgres_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        postgres_conn_obj = PostgresConnection(
            connectionType=ConfigurationSource(
                username="user",
                password=None,
                hostPort="localhost:443",
                database="tiny",
            ),
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=PostgresScheme.postgresql_psycopg2,
        )
        assert expected_args == get_connection_args_common(postgres_conn_obj)

    def test_redshift_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        redshift_conn_obj = RedshiftConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments=None,
            scheme=RedshiftScheme.redshift_psycopg2,
        )
        assert expected_args == get_connection_args_common(redshift_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        redshift_conn_obj = RedshiftConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=RedshiftScheme.redshift_psycopg2,
        )
        assert expected_args == get_connection_args_common(redshift_conn_obj)

    def test_singleStore_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        singleStore_conn_obj = SingleStoreConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments=None,
            scheme=SingleStoreScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args_common(singleStore_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        singleStore_conn_obj = SingleStoreConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=SingleStoreScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args_common(singleStore_conn_obj)

    def test_db2_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        db2_conn_obj = Db2Connection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments=None,
            scheme=Db2Scheme.db2_ibm_db,
            database="testdb",
        )
        assert expected_args == get_connection_args_common(db2_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        db2_conn_obj = Db2Connection(
            username="user",
            password=None,
            hostPort="localhost:443",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=Db2Scheme.db2_ibm_db,
            database="testdb",
        )
        assert expected_args == get_connection_args_common(db2_conn_obj)

    def test_snowflake_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        snowflake_conn_obj = SnowflakeConnection(
            username="user",
            password="test-pwd",
            database="tiny",
            warehouse="COMPUTE_WH",
            scheme=SnowflakeScheme.snowflake,
            account="account.region_name.cloud_service",
        )
        assert expected_args == get_connection_args_common(snowflake_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        snowflake_conn_obj = SnowflakeConnection(
            username="user",
            password="test-pwd",
            database="tiny",
            warehouse="COMPUTE_WH",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=SnowflakeScheme.snowflake,
            account="account.region_name.cloud_service",
        )
        assert expected_args == get_connection_args_common(snowflake_conn_obj)

    def test_athena_url(self):
        from metadata.ingestion.source.database.athena.connection import (
            get_connection_url,
        )

        # connection arguments without db
        awsCreds = awsCredentials.AWSCredentials(
            awsAccessKeyId="key", awsRegion="us-east-2", awsSecretAccessKey="secret_key"
        )

        expected_url = "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443?s3_staging_dir=s3%3A%2F%2Fpostgres%2Finput%2F&work_group=primary"
        athena_conn_obj = AthenaConnection(
            awsConfig=awsCreds,
            s3StagingDir="s3://postgres/input/",
            workgroup="primary",
            scheme=AthenaScheme.awsathena_rest,
        )

        assert expected_url == get_connection_url(athena_conn_obj)

        # connection arguments witho db
        expected_url = "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443?s3_staging_dir=s3%3A%2F%2Fpostgres%2Fintput%2F&work_group=primary"
        athena_conn_obj = AthenaConnection(
            awsConfig=awsCreds,
            s3StagingDir="s3://postgres/intput/",
            workgroup="primary",
            scheme=AthenaScheme.awsathena_rest,
        )
        assert expected_url == get_connection_url(athena_conn_obj)

    def test_mssql_url(self):
        from metadata.ingestion.source.database.mssql.connection import (
            get_connection_url,
        )

        # connection arguments without db
        expected_url = "mssql+pytds://sa:password@localhost:1433"
        mssql_conn_obj = MssqlConnection(
            username="sa",
            password="password",
            hostPort="localhost:1433",
            scheme=MssqlScheme.mssql_pytds,
            database=None,
        )

        assert expected_url == get_connection_url(mssql_conn_obj)

    def test_mssql_url(self):
        from metadata.ingestion.source.database.mssql.connection import (
            get_connection_url,
        )

        # Passing @ in username and password
        expected_url = "mssql+pytds://sa%40123:password%40444@localhost:1433"
        mssql_conn_obj = MssqlConnection(
            username="sa@123",
            password="password@444",
            hostPort="localhost:1433",
            scheme=MssqlScheme.mssql_pytds,
            database=None,
        )

        assert expected_url == get_connection_url(mssql_conn_obj)

        # connection arguments witho db
        expected_url = "mssql+pytds://sa:password@localhost:1433/catalog_test"
        mssql_conn_obj = MssqlConnection(
            username="sa",
            password="password",
            hostPort="localhost:1433",
            scheme=MssqlScheme.mssql_pytds,
            database="catalog_test",
        )
        assert expected_url == get_connection_url(mssql_conn_obj)

    def test_presto_url(self):
        from metadata.ingestion.source.database.presto.connection import (
            get_connection_url,
        )

        # connection arguments without db
        expected_url = "presto://admin@localhost:8080/test_catalog"

        presto_conn_obj = PrestoConnection(
            username="admin",
            hostPort="localhost:8080",
            scheme=PrestoScheme.presto,
            catalog="test_catalog",
        )

        assert expected_url == get_connection_url(presto_conn_obj)

        # Passing @ in username and password
        expected_url = "presto://admin%40333:pass%40111@localhost:8080/test_catalog"

        presto_conn_obj = PrestoConnection(
            username="admin@333",
            password="pass@111",
            hostPort="localhost:8080",
            scheme=PrestoScheme.presto,
            catalog="test_catalog",
        )

        assert expected_url == get_connection_url(presto_conn_obj)

    def test_presto_without_catalog(self):
        from metadata.ingestion.source.database.presto.connection import (
            get_connection_url,
        )

        # Test presto url without catalog
        expected_url = "presto://username:pass@localhost:8080"
        presto_conn_obj = PrestoConnection(
            scheme=PrestoScheme.presto,
            hostPort="localhost:8080",
            username="username",
            password="pass",
        )

        assert expected_url == get_connection_url(presto_conn_obj)

    def test_oracle_url(self):
        from metadata.ingestion.source.database.oracle.connection import (
            get_connection_url,
        )

        # oracle with db
        expected_url = "oracle+cx_oracle://admin:password@localhost:1541/testdb"

        oracle_conn_obj = OracleConnection(
            username="admin",
            password="password",
            hostPort="localhost:1541",
            scheme=OracleScheme.oracle_cx_oracle,
            oracleConnectionType=OracleDatabaseSchema(databaseSchema="testdb"),
        )

        assert expected_url == get_connection_url(oracle_conn_obj)

        # oracle with service name
        expected_url = (
            "oracle+cx_oracle://admin:password@localhost:1541/?service_name=testdb"
        )

        oracle_conn_obj = OracleConnection(
            username="admin",
            password="password",
            hostPort="localhost:1541",
            scheme=OracleScheme.oracle_cx_oracle,
            oracleConnectionType=OracleServiceName(oracleServiceName="testdb"),
        )
        assert expected_url == get_connection_url(oracle_conn_obj)

        # oracle with db & connection options
        expected_url = [
            "oracle+cx_oracle://admin:password@localhost:1541/testdb?test_key_2=test_value_2&test_key_1=test_value_1",
            "oracle+cx_oracle://admin:password@localhost:1541/testdb?test_key_1=test_value_1&test_key_2=test_value_2",
        ]

        oracle_conn_obj = OracleConnection(
            username="admin",
            password="password",
            hostPort="localhost:1541",
            scheme=OracleScheme.oracle_cx_oracle,
            oracleConnectionType=OracleDatabaseSchema(databaseSchema="testdb"),
            connectionOptions=dict(
                test_key_1="test_value_1", test_key_2="test_value_2"
            ),
        )
        assert get_connection_url(oracle_conn_obj) in expected_url

        # oracle with service name & connection options
        expected_url = [
            "oracle+cx_oracle://admin:password@localhost:1541/?service_name=testdb&test_key_2=test_value_2&test_key_1=test_value_1",
            "oracle+cx_oracle://admin:password@localhost:1541/?service_name=testdb&test_key_1=test_value_1&test_key_2=test_value_2",
        ]

        oracle_conn_obj = OracleConnection(
            username="admin",
            password="password",
            hostPort="localhost:1541",
            scheme=OracleScheme.oracle_cx_oracle,
            oracleConnectionType=OracleServiceName(oracleServiceName="testdb"),
            connectionOptions=dict(
                test_key_1="test_value_1", test_key_2="test_value_2"
            ),
        )
        assert get_connection_url(oracle_conn_obj) in expected_url
