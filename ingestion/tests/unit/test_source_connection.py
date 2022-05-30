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
from metadata.generated.schema.security.credentials import awsCredentials
from metadata.utils.source_connections import get_connection_args, get_connection_url


class SouceConnectionTest(TestCase):
    def test_databricks_url_without_db(self):
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
        expected_result = (
            "databricks+connector://token:KlivDTACWXKmZVfN1qIM@1.1.1.1:443/default"
        )
        databricks_conn_obj = DatabricksConnection(
            scheme=DatabricksScheme.databricks_connector,
            hostPort="1.1.1.1:443",
            token="KlivDTACWXKmZVfN1qIM",
            database="default",
        )
        assert expected_result == get_connection_url(databricks_conn_obj)

    def test_hive_url(self):
        expected_result = "hive://localhost:10000/default"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive, hostPort="localhost:10000", database="default"
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_custom_auth(self):
        expected_result = "hive://username:password@localhost:10000/default"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            password="password",
            hostPort="localhost:10000",
            database="default",
            connectionArguments={"auth": "CUSTOM"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_with_kerberos_auth(self):
        expected_result = "hive://localhost:10000/default"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            hostPort="localhost:10000",
            database="default",
            connectionArguments={
                "auth": "KERBEROS",
                "kerberos_service_name": "hive",
            },
        )

        assert expected_result == get_connection_url(hive_conn_obj)

    def test_hive_url_with_ldap_auth(self):
        expected_result = "hive://username:password@localhost:10000/default"
        hive_conn_obj = HiveConnection(
            scheme=HiveScheme.hive.value,
            username="username",
            password="password",
            hostPort="localhost:10000",
            database="default",
            connectionArguments={"auth": "LDAP"},
        )
        assert expected_result == get_connection_url(hive_conn_obj)

    def test_trino_url_without_params(self):
        expected_url = "trino://username:pass@localhost:443/catalog"
        trino_conn_obj = TrinoConnection(
            scheme=TrinoScheme.trino,
            hostPort="localhost:443",
            username="username",
            password="pass",
            catalog="catalog",
        )
        assert expected_url == get_connection_url(trino_conn_obj)

    def test_trino_conn_arguments(self):
        # connection arguments without connectionArguments and without proxies
        expected_args = {}
        trino_conn_obj = TrinoConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            catalog="tpcds",
            database="tiny",
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
            database="tiny",
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
            database="tiny",
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
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            proxies={"http": "foo.bar:3128", "http://host.name": "foo.bar:4012"},
            scheme=TrinoScheme.trino,
        )
        conn_args = get_connection_args(trino_conn_obj)
        assert "http_session" in conn_args
        conn_args.pop("http_session")
        assert expected_args == conn_args

    def test_trino_url_with_params(self):
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
        assert expected_url == get_connection_url(vertica_conn_obj)

    def test_druid_url(self):
        expected_url = "druid://localhost:8082/druid/v2/sql"
        druid_conn_obj = DruidConnection(
            scheme=DruidScheme.druid, hostPort="localhost:8082"
        )
        assert expected_url == get_connection_url(druid_conn_obj)

    def test_pinotdb_url(self):
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
            database=None,
        )
        assert expected_url == get_connection_url(mysql_conn_obj)

        # connection arguments with db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306/default"
        mysql_conn_obj = MysqlConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MySQLScheme.mysql_pymysql,
            database="default",
        )
        assert expected_url == get_connection_url(mysql_conn_obj)

    def test_clickhouse_url(self):
        # connection arguments without db
        expected_url = "clickhouse+http://username:@localhost:8123"
        clickhouse_conn_obj = ClickhouseConnection(
            username="username",
            hostPort="localhost:8123",
            scheme=ClickhouseScheme.clickhouse_http,
            database=None,
        )
        assert expected_url == get_connection_url(clickhouse_conn_obj)

        # connection arguments with db
        expected_url = "clickhouse+http://username:@localhost:8123/default"
        clickhouse_conn_obj = ClickhouseConnection(
            username="username",
            hostPort="localhost:8123",
            scheme=ClickhouseScheme.clickhouse_http,
            database="default",
        )
        assert expected_url == get_connection_url(clickhouse_conn_obj)

    def test_mariadb_url(self):
        # connection arguments without db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306"
        mariadb_conn_obj = MariaDBConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MariaDBScheme.mysql_pymysql,
            database=None,
        )
        assert expected_url == get_connection_url(mariadb_conn_obj)

        # connection arguments with db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:3306/default"
        mariadb_conn_obj = MariaDBConnection(
            username="openmetadata_user",
            hostPort="localhost:3306",
            scheme=MariaDBScheme.mysql_pymysql,
            database="default",
        )
        assert expected_url == get_connection_url(mariadb_conn_obj)

    def test_postgres_url(self):
        # connection arguments without db
        expected_url = "postgresql+psycopg2://openmetadata_user:@localhost:5432"
        postgres_conn_obj = PostgresConnection(
            username="openmetadata_user",
            hostPort="localhost:5432",
            scheme=PostgresScheme.postgresql_psycopg2,
            database=None,
        )
        assert expected_url == get_connection_url(postgres_conn_obj)

        # connection arguments witho db
        expected_url = "postgresql+psycopg2://openmetadata_user:@localhost:5432/default"
        postgres_conn_obj = PostgresConnection(
            username="openmetadata_user",
            hostPort="localhost:5432",
            scheme=PostgresScheme.postgresql_psycopg2,
            database="default",
        )
        assert expected_url == get_connection_url(postgres_conn_obj)

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
        assert expected_url == get_connection_url(redshift_conn_obj)

    def test_singleStore_url(self):
        # connection arguments without db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:5432"
        singleStore_conn_obj = SingleStoreConnection(
            username="openmetadata_user",
            hostPort="localhost:5432",
            scheme=SingleStoreScheme.mysql_pymysql,
            database=None,
        )
        assert expected_url == get_connection_url(singleStore_conn_obj)

        # connection arguments with db
        expected_url = "mysql+pymysql://openmetadata_user:@localhost:5432/default"
        singleStore_conn_obj = SingleStoreConnection(
            username="openmetadata_user",
            hostPort="localhost:5432",
            scheme=SingleStoreScheme.mysql_pymysql,
            database="default",
        )
        assert expected_url == get_connection_url(singleStore_conn_obj)

    def test_db2_url(self):
        # connection arguments without db
        expected_url = "db2+ibm_db://openmetadata_user:@localhost:50000"
        db2_conn_obj = Db2Connection(
            scheme=Db2Scheme.db2_ibm_db,
            username="openmetadata_user",
            hostPort="localhost:50000",
            database=None,
        )
        assert expected_url == get_connection_url(db2_conn_obj)

        # connection arguments with db
        expected_url = "db2+ibm_db://openmetadata_user:@localhost:50000/default"
        db2_conn_obj = Db2Connection(
            username="openmetadata_user",
            hostPort="localhost:50000",
            scheme=Db2Scheme.db2_ibm_db,
            database="default",
        )
        assert expected_url == get_connection_url(db2_conn_obj)

    def test_snowflake_url(self):
        # connection arguments without db
        expected_url = "snowflake://coding:Abhi@ue18849.us-east-2.aws?account=ue18849.us-east-2.aws&warehouse=COMPUTE_WH"
        snowflake_conn_obj = SnowflakeConnection(
            scheme=SnowflakeScheme.snowflake,
            username="coding",
            password="Abhi",
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
            database=None,
            connectionArguments=None,
            scheme=MySQLScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args(mysql_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        mysql_conn_obj = MysqlConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=MySQLScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args(mysql_conn_obj)

    def test_clickhouse_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        clickhouse_conn_obj = ClickhouseConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database=None,
            connectionArguments=None,
            scheme=ClickhouseScheme.clickhouse_http,
        )
        assert expected_args == get_connection_args(clickhouse_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        clickhouse_conn_obj = ClickhouseConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=ClickhouseScheme.clickhouse_http,
        )
        assert expected_args == get_connection_args(clickhouse_conn_obj)

    def test_mariadb_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        mariadb_conn_obj = MariaDBConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database=None,
            connectionArguments=None,
            scheme=MariaDBScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args(mariadb_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        mariadb_conn_obj = MariaDBConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=MariaDBScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args(mariadb_conn_obj)

    def test_postgres_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        postgres_conn_obj = PostgresConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database=None,
            connectionArguments=None,
            scheme=PostgresScheme.postgresql_psycopg2,
        )
        assert expected_args == get_connection_args(postgres_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        postgres_conn_obj = PostgresConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=PostgresScheme.postgresql_psycopg2,
        )
        assert expected_args == get_connection_args(postgres_conn_obj)

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
        assert expected_args == get_connection_args(redshift_conn_obj)

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
        assert expected_args == get_connection_args(redshift_conn_obj)

    def test_singleStore_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        singleStore_conn_obj = SingleStoreConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments=None,
            scheme=SingleStoreScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args(singleStore_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        singleStore_conn_obj = SingleStoreConnection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=SingleStoreScheme.mysql_pymysql,
        )
        assert expected_args == get_connection_args(singleStore_conn_obj)

    def test_db2_conn_arguments(self):
        # connection arguments without connectionArguments
        expected_args = {}
        db2_conn_obj = Db2Connection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments=None,
            scheme=Db2Scheme.db2_ibm_db,
        )
        assert expected_args == get_connection_args(db2_conn_obj)

        # connection arguments with connectionArguments
        expected_args = {"user": "user-to-be-impersonated"}
        db2_conn_obj = Db2Connection(
            username="user",
            password=None,
            hostPort="localhost:443",
            database="tiny",
            connectionArguments={"user": "user-to-be-impersonated"},
            scheme=Db2Scheme.db2_ibm_db,
        )
        assert expected_args == get_connection_args(db2_conn_obj)

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
        assert expected_args == get_connection_args(snowflake_conn_obj)

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
        assert expected_args == get_connection_args(snowflake_conn_obj)

    def test_athena_url(self):
        # connection arguments without db
        awsCreds = awsCredentials.AWSCredentials(
            awsAccessKeyId="key", awsRegion="us-east-2", awsSecretAccessKey="secret_key"
        )

        expected_url = "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443?s3_staging_dir=s3athena-postgres&work_group=primary"
        athena_conn_obj = AthenaConnection(
            awsConfig=awsCreds,
            s3StagingDir="s3athena-postgres",
            workgroup="primary",
            scheme=AthenaScheme.awsathena_rest,
        )
        assert expected_url == get_connection_url(athena_conn_obj)

        # connection arguments witho db
        expected_url = "awsathena+rest://key:secret_key@athena.us-east-2.amazonaws.com:443/test?s3_staging_dir=s3athena-postgres&work_group=primary"
        athena_conn_obj = AthenaConnection(
            awsConfig=awsCreds,
            s3StagingDir="s3athena-postgres",
            workgroup="primary",
            scheme=AthenaScheme.awsathena_rest,
        )
        assert expected_url == get_connection_url(athena_conn_obj)

    def test_mssql_url(self):
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
        # connection arguments without db
        expected_url = "presto://admin@localhost:8080/test_catalog"

        presto_conn_obj = PrestoConnection(
            username="admin",
            hostPort="localhost:8080",
            scheme=PrestoScheme.presto,
            catalog="test_catalog",
        )
        assert expected_url == get_connection_url(presto_conn_obj)
