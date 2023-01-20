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

import os
from typing import Dict, Set

from setuptools import find_namespace_packages, setup


def get_long_description():
    root = os.path.dirname(__file__)
    with open(os.path.join(root, "README.md")) as f:
        description = f.read()
    return description


base_requirements = {
    "commonregex",
    "idna<3,>=2.5",
    "mypy_extensions>=0.4.3",
    "typing-inspect",
    "pydantic~=1.9.0",
    "email-validator>=1.0.3",
    "google>=3.0.0",
    "google-auth>=1.33.0",
    "python-dateutil>=2.8.1",
    "wheel~=0.36.2",
    "python-jose==3.3.0",
    "sqlalchemy>=1.4.0",
    "requests>=2.23",
    "cryptography",
    "Jinja2>=2.11.3",
    "PyYAML",
    "jsonschema",
    "sqllineage==1.3.7",
    "antlr4-python3-runtime==4.9.2",
    "boto3~=1.19.12",
    "botocore==1.22.12",
    "avro-python3==1.10.2",
    "grpcio-tools==1.48.2",
    # compatibility requirements for 3.7
    "typing-compat~=0.1.0",
    "importlib-metadata~=4.12.0",  # From airflow constraints
    "croniter~=1.3.0",
    "requests-aws4auth==1.1.2",
    "pymysql>=1.0.2",
    "cached-property==1.5.2",
    "pandas==1.3.5",
    "chardet==4.0.0",
}


datalake_common = {
    "pandas==1.3.5",
    "pyarrow==6.0.1",
}

plugins: Dict[str, Set[str]] = {
    "airflow": {
        "apache-airflow==2.3.3"
    },  # Same as ingestion container. For development.
    "airflow-container-1.10.15": {"markupsafe==2.0.1 ", "requests==2.23.0"},
    "amundsen": {"neo4j~=4.4.0"},
    "athena": {"PyAthena[SQLAlchemy]"},
    "atlas": {},
    "azuresql": {"pyodbc"},
    "bigquery": {
        "grpcio==1.50.0",
        "sqlalchemy-bigquery>=1.2.2",
        "pyarrow~=6.0.1",
        "google-cloud-datacatalog==3.6.2",
    },
    "bigquery-usage": {"google-cloud-logging", "cachetools"},
    "docker": {"python_on_whales==0.34.0"},
    "backup": {"boto3~=1.19.12", "azure-identity", "azure-storage-blob"},
    "dagster": {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2", "dagster_graphql"},
    "datalake-s3": {
        "s3fs==0.4.2",
        "boto3~=1.19.12",
        *datalake_common,
    },
    "datalake-gcs": {
        "google-cloud-storage==1.43.0",
        "gcsfs==2022.5.0",
        *datalake_common,
    },
    "dbt": {"google-cloud", "boto3", "google-cloud-storage==1.43.0"},
    "druid": {"pydruid>=0.6.2"},
    "elasticsearch": {"elasticsearch==7.13.1", "requests-aws4auth==1.1.2"},
    "glue": {"boto3~=1.19.12"},
    "dynamodb": {"boto3~=1.19.12"},
    "sagemaker": {"boto3~=1.19.12"},
    "hive": {
        "pyhive~=0.6.5",
        "thrift~=0.13.0",
        "sasl==0.3.1",
        "thrift-sasl==0.4.3",
        "presto-types-parser==0.0.2",
    },
    "kafka": {
        "confluent_kafka==1.8.2",
        "fastavro>=1.2.0",
        "avro-python3==1.10.2",
        "avro==1.11.1",
        "grpcio-tools",
        "protobuf",
    },
    "kinesis": {"boto3~=1.19.12"},
    "redpanda": {
        "confluent_kafka==1.8.2",
        "fastavro>=1.2.0",
        "avro-python3==1.10.2",
        "avro==1.11.1",
        "grpcio-tools",
        "protobuf",
    },
    "ldap-users": {"ldap3==2.9.1"},
    "looker": {"looker-sdk>=22.20.0"},
    "mssql": {"sqlalchemy-pytds>=0.3"},
    "pymssql": {"pymssql==2.2.5"},
    "mssql-odbc": {"pyodbc"},
    "mysql": {"pymysql>=1.0.2"},
    "oracle": {"cx_Oracle", "oracledb==1.0.3"},
    "powerbi": {"msal==1.17.0"},
    "presto": {"pyhive~=0.6.3"},
    "trino": {"trino[sqlalchemy]"},
    "postgres": {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2"},
    "redash": {"redash-toolbelt==0.1.8"},
    "redshift": {"sqlalchemy-redshift==0.8.9", "psycopg2-binary", "GeoAlchemy2"},
    "redshift-usage": {
        "sqlalchemy-redshift==0.8.9",
        "psycopg2-binary",
        "GeoAlchemy2",
    },
    "snowflake": {"snowflake-sqlalchemy~=1.4.3"},
    "snowflake-usage": {"snowflake-sqlalchemy~=1.4.3"},
    "superset": {},
    "tableau": {"tableau-api-lib==0.1.50"},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5"},
    "webhook-server": {},
    "salesforce": {"simple_salesforce~=1.11.4"},
    "okta": {"okta~=2.3.0"},
    "mlflow": {"mlflow-skinny~=1.26.1"},
    "sklearn": {"scikit-learn==1.0.2"},
    "db2": {"ibm-db-sa==0.3.8"},
    "clickhouse": {"clickhouse-driver==0.2.5", "clickhouse-sqlalchemy==0.2.3"},
    "databricks": {"sqlalchemy-databricks==0.1.0"},
    "singlestore": {"pymysql>=1.0.2"},
    "azure-sso": {"msal~=1.17.0"},
    "deltalake": {"delta-spark~=2.2.0"},
    "great-expectations": {"great-expectations~=0.15.0"},
    "pinotdb": {"pinotdb~=0.3.11"},
    "nifi": {},
    "domo": {"pydomo~=0.3.0.5"},
    "datalake-azure": {
        "azure-storage-blob~=12.14.1",
        "azure-identity~=1.12.0",
        "adlfs==2022.2.0",
        *datalake_common,
    },
}
dev = {
    "datamodel-code-generator==0.13.4",
    "black==22.3.0",
    "pycln==1.3.2",
    "docker",
    "google-cloud-storage==1.43.0",
    "twine",
}
test = {
    "isort==5.10.1",
    "pre-commit",
    "pylint",
    "pytest==7.0.0",
    "pytest-cov",
    "pytest-order",
    "coverage",
    # sklearn integration
    "scikit-learn==1.0.2",
    "pandas==1.3.5",
    # great_expectations tests
    "great-expectations~=0.15.0",
    # Airflow tests
    "apache-airflow==2.3.3",
    # Domo test
    "pydomo~=0.3.0.5",
    # mock boto3 functions
    "moto==4.0.8",
    # amundsen
    "neo4j~=4.4.0",
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-ingestion",
    version="0.13.1.7",
    url="https://open-metadata.org/",
    author="OpenMetadata Committers",
    license="Apache License 2.0",
    description="Ingestion Framework for OpenMetadata",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    python_requires=">=3.7",
    options={"build_exe": build_options},
    package_dir={"": "src"},
    package_data={"metadata.examples": ["workflows/*.yaml"]},
    zip_safe=False,
    dependency_links=[],
    project_urls={
        "Documentation": "https://docs.open-metadata.org/",
        "Source": "https://github.com/open-metadata/OpenMetadata",
    },
    packages=find_namespace_packages(where="./src", exclude=["tests*"]),
    namespace_package=["metadata"],
    entry_points={
        "console_scripts": ["metadata = metadata.cmd:metadata"],
        "apache_airflow_provider": [
            "provider_info = airflow_provider_openmetadata:get_provider_config"
        ],
    },
    install_requires=list(base_requirements),
    extras_require={
        "base": list(base_requirements),
        "dev": list(dev),
        "test": list(test),
        "data-insight": list(plugins["elasticsearch"]),
        **{plugin: list(dependencies) for (plugin, dependencies) in plugins.items()},
        "all": list(
            base_requirements.union(
                *[
                    requirements
                    for plugin, requirements in plugins.items()
                    if plugin
                    not in {
                        "airflow",
                        "airflow-container-1.10.15",
                        "db2",
                        "great-expectations",
                    }
                ]
            )
        ),
    },
)
