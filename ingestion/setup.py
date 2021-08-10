#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from typing import Dict, Set
import os

from setuptools import setup, find_namespace_packages


def get_version():
    root = os.path.dirname(__file__)
    changelog = os.path.join(root, "CHANGELOG")
    with open(changelog) as f:
        return f.readline().strip()


def get_long_description():
    root = os.path.dirname(__file__)
    with open(os.path.join(root, "../docs/install/setup-ingestion.md")) as f:
        description = f.read()

    description += "\n\nChangelog\n=========\n\n"

    with open(os.path.join(root, "CHANGELOG")) as f:
        description += f.read()

    return description


base_requirements = {
    "elasticsearch>=7.0.0,<8.0.0",
    "commonregex",
    "requests>=2.25.1",
    "click<7.2.0,>=7.1.1",
    "expandvars>=0.6.5"
    "dataclasses>=0.8"
    "typing_extensions>=3.7.4"
    "mypy_extensions>=0.4.3",
    "typing-inspect",
    "pydantic@https://github.com/samuelcolvin/pydantic/archive/refs/tags/v1.7.4.tar.gz#egg=pydantic",
    "pydantic[email]>=1.7.2",
    "google>=3.0.0",
    "google-auth>=1.33.0",
    "python-dateutil>=2.8.1",
    "email-validator>=1.0.3",
    "wheel~=0.36.2",
    "python-jose==3.3.0",
    "okta==1.7.0",
    "en_core_web_sm@https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.0.0/en_core_web_sm-3.0.0.tar.gz#egg=en_core_web"
}
connector_requirements = {
    "sqlalchemy>=1.3.24",
    "sql-metadata~=2.0.0",
    "spacy==3.0.5",
    "requests~=2.25.1"
}
scheduler_requirements = {
    "apns@git+git://github.com/djacobs/PyAPNs.git#egg=apns",
    "simplescheduler@git+https://github.com/StreamlineData/sdscheduler.git#egg=simplescheduler"
}
base_plugins = {
    "pii-tags",
    "query-parser",
    "metadata-usage",
    "file-stage",
    "sql-metadata~=2.0.0",
}
plugins: Dict[str, Set[str]] = {
    "athena": connector_requirements | {"PyAthena[SQLAlchemy]"},
    "bigquery": connector_requirements | {"pybigquery >= 0.6.0"},
    "bigquery-usage": {"google-cloud-logging", "cachetools"},
    "elasticsearch": {"elasticsearch~=7.13.1"},
    "hive": connector_requirements | {"pyhive~=0.6.3", "thrift~=0.13.0", "sasl==0.3.1", "thrift-sasl==0.4.3"},
    "ldap-users": {"ldap3==2.9.1"},
    "mssql": connector_requirements | {"sqlalchemy-pytds>=0.3"},
    "mssql-odbc": connector_requirements | {"pyodbc"},
    "mysql": connector_requirements | {"pymysql>=1.0.2"},
    "oracle": connector_requirements | {"cx_Oracle"},
    "postgres": connector_requirements | {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2"},
    "redshift": connector_requirements | {"sqlalchemy-redshift", "psycopg2-binary", "GeoAlchemy2"},
    "redshift-usage": connector_requirements | {"sqlalchemy-redshift", "psycopg2-binary", "GeoAlchemy2"},
    "scheduler": connector_requirements | scheduler_requirements,
    "snowflake": connector_requirements | {"snowflake-sqlalchemy<=1.2.4"},
    "snowflake-usage": connector_requirements | {"snowflake-sqlalchemy<=1.2.4"},
    "sample-tables": connector_requirements | {"faker~=8.1.1", "pandas~=1.3.1", "email-validator>=1.0.3"}
}

build_options = {"includes": ["_cffi_backend"]}

setup(
    name="metadata",
    version=get_version(),
    url="https://github.com/streamlinedata/metadata",
    author="Metadata Committers",
    license="Apache License 2.0",
    description="Ingestion Framework for  OpenMetadata",
    long_description="Ingestion Framework for  OpenMetadata",
    long_description_content_type="text/markdown",
    python_requires=">=3.8",
    options={"build_exe": build_options},
    package_dir={"": "src"},
    packages=find_namespace_packages(where='src', exclude=['tests*']),
    dependency_links=['git+git://github.com/djacobs/PyAPNs.git#egg=apns',
                      'git+https://github.com/StreamlineData/sdscheduler.git#egg=simplescheduler'],
    entry_points={
        "console_scripts": ["metadata = metadata.cmd:metadata"],
        "metadata.ingestion.source.plugins": [
            "mysql = metadata.ingestion.source.mysql:MySQLSource",
            "postgres = metadata.ingestion.source.postgres:PostgresSource",
            "snowflake = metadata.ingestion.source.snowflake:SnowflakeSource",
            "redshift = metadata.ingestion.source.redshift:RedshiftSource",
            "redshift-sql = metadata.ingestion.source.redshift_sql:RedshiftSQLSource",
            "bigquery = metadata.ingestion.source.bigquery:BigQuerySource",
            "athena = metadata.ingestion.source.athena:AthenaSource",
            "oracle = metadata.ingestion.source.oracle:OracleSource",
            "mssql = metadata.ingestion.source.mssql:SQLServerSource",
            "hive = metadata.ingestion.source.hive:HiveSource",
            "sample-tables = metadata.ingestion.source.sample_data_generator:SampleTableSource",
            "sample-users = metadata.ingestion.source.sample_data_generator:SampleUserSource",
            "metadata-rest-tables = metadata.ingestion.source.metadata_rest:MetadataTablesRestSource",
            "redshift-usage = metadata.ingestion.source.redshift_usage:RedshiftUsageSource",
            "snowflake-usage = metadata.ingestion.source.snowflake_usage:SnowflakeUsageSource",
            "ldap-users = metadata.ingestion.source.ldap_source:LDAPUserSource"
        ],
        "metadata.ingestion.sink.plugins": [
            "file = metadata.ingestion.sink.file:FileSink",
            "console = metadata.ingestion.sink.console:ConsoleSink",
            "metadata-rest-tables = metadata.ingestion.sink.metadata_tables_rest:MetadataTablesRestSink",
            "metadata-rest-users = metadata.ingestion.sink.metadata_users_rest:MetadataUsersRestSink",
            "ldap-rest-users = metadata.ingestion.sink.ldap_add_user:LdapUserRestSink"
        ],
        "metadata.ingestion.processor.plugins": [
            "pii-tags = metadata.ingestion.processor.pii_processor:PIIProcessor",
            "query-parser =  metadata.ingestion.processor.query_parser:QueryParserProcessor",
        ],
        "metadata.ingestion.stage.plugins": [
            "file-stage = metadata.ingestion.stage.file:FileStage",
            "table-usage-stage = metadata.ingestion.stage.table_usage_stage:TableUsageStage"
        ],
        "metadata.ingestion.bulksink.plugins": [
            "elasticsearch = metadata.ingestion.bulksink.elastic_search:ElasticSearchBulkSink",
            "metadata-usage = metadata.ingestion.bulksink.metadata_usage_rest:MetadataUsageBulkSink",
        ],
    },
    install_requires=list(base_requirements),
    extras_require={
        "base": list(base_requirements),
        **{
            plugin: list(dependencies)
            for (plugin, dependencies) in plugins.items()
        },
        "all": list(base_requirements.union(
            *[
                    requirements
                    for plugin, requirements in plugins.items()
                    ]
        )
        )
    }

)
