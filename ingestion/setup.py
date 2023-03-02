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

"""
Python Dependencies
"""

import os
from typing import Dict, Set

from setuptools import find_namespace_packages, setup


def get_long_description():
    root = os.path.dirname(__file__)
    with open(os.path.join(root, "README.md"), encoding="UTF-8") as file:
        description = file.read()
    return description


# Add here versions required for multiple plugins
VERSIONS = {
    "airflow": "apache-airflow==2.3.3",
    "avro-python3": "avro-python3~=1.10",
    "boto3": "boto3>=1.20,<2.0",  # No need to add botocore separately. It's a dep from boto3
    "geoalchemy2": "GeoAlchemy2~=0.12",
    "google-cloud-storage": "google-cloud-storage==1.43.0",
    "great-expectations": "great-expectations~=0.15.0",
    "grpc-tools": "grpcio-tools==1.47.2",
    "msal": "msal~=1.2",
    "neo4j": "neo4j~=5.3.0",
    "pandas": "pandas==1.3.5",
    "pyarrow": "pyarrow~=8.0",
    "pydomo": "pydomo~=0.3",
    "pymysql": "pymysql>=1.0.2",
    "pyodbc": "pyodbc>=4.0.35,<5",
    "scikit-learn": "scikit-learn~=1.0",  # Python 3.7 only goes up to 1.0.2
}

COMMONS = {
    "datalake": {VERSIONS["boto3"], VERSIONS["pandas"], VERSIONS["pyarrow"]},
    "hive": {
        "presto-types-parser>=0.0.2",
        "pyhive~=0.6",
    },
    "kafka": {
        "avro~=1.11",
        VERSIONS["avro-python3"],
        "confluent_kafka==1.8.2",
        "fastavro>=1.2.0",
        # Due to https://github.com/grpc/grpc/issues/30843#issuecomment-1303816925
        # we use v1.47.2 https://github.com/grpc/grpc/blob/v1.47.2/tools/distrib/python/grpcio_tools/grpc_version.py#L17
        VERSIONS[
            "grpc-tools"
        ],  # grpcio-tools already depends on grpcio. No need to add separately
        "protobuf",
    },
}


base_requirements = {
    "antlr4-python3-runtime==4.9.2",
    VERSIONS["avro-python3"],  # Used in sample data
    VERSIONS["boto3"],  # Required in base for the secrets manager
    "cached-property==1.5.2",
    "chardet==4.0.0",
    "croniter~=1.3.0",
    "cryptography",
    "commonregex",
    "email-validator>=1.0.3",
    "google>=3.0.0",
    "google-auth>=1.33.0",
    VERSIONS["grpc-tools"],  # Used in sample data
    "idna<3,>=2.5",
    "importlib-metadata~=4.12.0",  # From airflow constraints
    "Jinja2>=2.11.3",
    "jsonschema",
    "mypy_extensions>=0.4.3",
    VERSIONS["pandas"],  # to be removed from base
    "pydantic~=1.10",
    VERSIONS["pymysql"],
    "python-dateutil>=2.8.1",
    "python-jose~=3.3",
    "PyYAML",
    "requests>=2.23",
    "requests-aws4auth~=1.1",  # Only depends on requests as external package. Leaving as base.
    "setuptools~=65.6.3",
    "sqlalchemy>=1.4.0,<2",
    "openmetadata-sqllineage==1.0.1",
    "typing-compat~=0.1.0",  # compatibility requirements for 3.7
    "typing-inspect",
    "wheel~=0.38.4",
}


plugins: Dict[str, Set[str]] = {
    "airflow": {VERSIONS["airflow"]},  # Same as ingestion container. For development.
    "amundsen": {VERSIONS["neo4j"]},
    "athena": {"PyAthena[SQLAlchemy]"},
    "atlas": {},
    "azuresql": {VERSIONS["pyodbc"]},
    "azure-sso": {VERSIONS["msal"]},
    "backup": {VERSIONS["boto3"], "azure-identity", "azure-storage-blob"},
    "bigquery": {
        "cachetools",
        "google-cloud-datacatalog==3.6.2",
        "google-cloud-logging",
        VERSIONS["pyarrow"],
        "sqlalchemy-bigquery>=1.2.2",
    },
    "clickhouse": {"clickhouse-driver~=0.2", "clickhouse-sqlalchemy~=0.2"},
    "dagster": {
        VERSIONS["pymysql"],
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
        "dagster_graphql~=1.1",
    },
    "dbt": {
        "google-cloud",
        VERSIONS["boto3"],
        VERSIONS["google-cloud-storage"],
        "dbt-artifacts-parser",
    },
    "db2": {"ibm-db-sa~=0.3"},
    "databricks": {"sqlalchemy-databricks~=0.1"},
    "datalake-azure": {
        "azure-storage-blob~=12.14",
        "azure-identity~=1.12",
        "adlfs>=2022.2.0",  # Python 3.7 does only support up to 2022.2.0
        *COMMONS["datalake"],
    },
    "datalake-gcs": {
        VERSIONS["google-cloud-storage"],
        "gcsfs==2022.11.0",
        *COMMONS["datalake"],
    },
    "datalake-s3": {
        # requires aiobotocore
        # https://github.com/fsspec/s3fs/blob/9bf99f763edaf7026318e150c4bd3a8d18bb3a00/requirements.txt#L1
        # however, the latest version of `s3fs` conflicts its `aiobotocore` dep with `boto3`'s dep on `botocore`.
        # Leaving this marked to the automatic resolution to speed up installation.
        "s3fs==0.4.2",
        *COMMONS["datalake"],
    },
    "deltalake": {"delta-spark~=2.2"},
    "docker": {"python_on_whales==0.55.0"},
    "domo": {VERSIONS["pydomo"]},
    "druid": {"pydruid>=0.6.5"},
    "dynamodb": {VERSIONS["boto3"]},
    "elasticsearch": {
        "elasticsearch==7.13.1"
    },  # also requires requests-aws4auth which is in base
    "glue": {VERSIONS["boto3"]},
    "great-expectations": {VERSIONS["great-expectations"]},
    "hive": {
        *COMMONS["hive"],
        "thrift>=0.13,<1",
        "sasl~=0.3",
        "thrift-sasl~=0.4",
    },
    "kafka": {*COMMONS["kafka"]},
    "kinesis": {VERSIONS["boto3"]},
    "ldap-users": {"ldap3==2.9.1"},
    "looker": {"looker-sdk>=22.20.0"},
    "mlflow": {"mlflow-skinny~=1.30"},
    "mssql": {"sqlalchemy-pytds~=0.3"},
    "mssql-odbc": {VERSIONS["pyodbc"]},
    "mysql": {VERSIONS["pymysql"]},
    "nifi": {},  # uses requests
    "okta": {"okta~=2.3"},
    "oracle": {"cx_Oracle>=8.3.0,<9", "oracledb~=1.2"},
    "pinotdb": {"pinotdb~=0.3"},
    "postgres": {VERSIONS["pymysql"], "psycopg2-binary", VERSIONS["geoalchemy2"]},
    "powerbi": {VERSIONS["msal"]},
    "presto": {*COMMONS["hive"]},
    "pymssql": {"pymssql==2.2.5"},
    "quicksight": {VERSIONS["boto3"]},
    "redash": {"redash-toolbelt~=0.1"},
    "redpanda": {*COMMONS["kafka"]},
    "redshift": {
        "sqlalchemy-redshift~=0.8",
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
    },
    "sagemaker": {VERSIONS["boto3"]},
    "salesforce": {"simple_salesforce==1.11.4"},
    "singlestore": {VERSIONS["pymysql"]},
    "sklearn": {VERSIONS["scikit-learn"]},
    "snowflake": {"snowflake-sqlalchemy~=1.4"},
    "superset": {},  # uses requests
    "tableau": {"tableau-api-lib~=0.1"},
    "trino": {"trino[sqlalchemy]"},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5"},
}

dev = {
    "black==22.3.0",
    "datamodel-code-generator==0.15.0",
    "docker",
    "isort",
    "pre-commit",
    "pycln",
    "pylint",
    "twine",
}

test = {
    VERSIONS["airflow"],
    "coverage",
    VERSIONS["google-cloud-storage"],
    VERSIONS["great-expectations"],
    "moto==4.0.8",
    VERSIONS["neo4j"],
    VERSIONS["pandas"],
    VERSIONS["pydomo"],
    "pytest==7.0.0",
    "pytest-cov",
    "pytest-order",
    VERSIONS["scikit-learn"],
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-ingestion",
    version="0.13.2.3.dev3",
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
                        "db2",
                        "great-expectations",
                    }
                ]
            )
        ),
    },
)
