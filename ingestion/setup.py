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


# Add here versions required for multiple plugins
VERSIONS = {
    "airflow": "apache-airflow==2.3.3",
    "boto3": "boto3~=1.26",  # No need to add botocore separately. It's a dep from boto3
    "pydomo": "pydomo~=0.3",
    "google-cloud-storage": "google-cloud-storage==1.43.0",
    "pyarrow": "pyarrow~=8.0",
    "geoalchemy2": "GeoAlchemy2~=0.12",
    "great-expectations": "great-expectations~=0.15.0",
    "pyodbc": "pyodbc>=4.0.35,<5",
    "msal": "msal~=1.2",
    "pymysql": "pymysql>=1.0.2",
    "scikit-learn": "scikit-learn~=1.2",
    "pandas": "pandas==1.3.5",
    "neo4j": "neo4j~=4.4.0",
}

COMMONS = {
    "datalake": {VERSIONS["pandas"], VERSIONS["pyarrow"], VERSIONS["boto3"]},
    "hive": {
        "pyhive~=0.6",
        "presto-types-parser>=0.0.2",
    },
    "kafka": {
        # Due to https://github.com/grpc/grpc/issues/30843#issuecomment-1303816925
        # we use v1.47.2 https://github.com/grpc/grpc/blob/v1.47.2/tools/distrib/python/grpcio_tools/grpc_version.py#L17
        "grpcio-tools==1.47.2",  # grpcio-tools already depends on grpcio. No need to add separately
        "confluent_kafka~=1.9",
        "fastavro>=1.2.0",
        "avro-python3~=1.10",
        "avro~=1.11",
        "protobuf",
    },
}


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
    "wheel~=0.38.4",
    "setuptools~=65.6.3",
    "python-jose~=3.3",
    "sqlalchemy>=1.4.0",
    "requests>=2.23",
    "cryptography",
    "Jinja2>=2.11.3",
    "PyYAML",
    "jsonschema",
    "sqllineage==1.3.7",
    "antlr4-python3-runtime==4.9.2",
    "typing-compat~=0.1.0",  # compatibility requirements for 3.7
    "importlib-metadata~=4.12.0",  # From airflow constraints
    "croniter~=1.3.0",
    "requests-aws4auth~=1.1",  # Does only depends on requests as external package. Leaving as base.
    VERSIONS["pymysql"],
    "cached-property==1.5.2",
    VERSIONS["pandas"],  # to be removed from base
    "chardet==4.0.0",
}


plugins: Dict[str, Set[str]] = {
    "airflow": {
        "apache-airflow==2.3.3"
    },  # Same as ingestion container. For development.
    "amundsen": {VERSIONS["neo4j"]},
    "athena": {"PyAthena[SQLAlchemy]"},
    "atlas": {},
    "azuresql": {VERSIONS["pyodbc"]},
    "bigquery": {
        "sqlalchemy-bigquery>=1.2.2",
        VERSIONS["pyarrow"],
        "google-cloud-datacatalog==3.6.2",
        "google-cloud-logging",
        "cachetools",
    },
    "docker": {"python_on_whales==0.55.0"},
    "backup": {VERSIONS["boto3"], "azure-identity", "azure-storage-blob"},
    "dagster": {
        VERSIONS["pymysql"],
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
        "dagster_graphql~=1.1",
    },
    "datalake-s3": {
        # requires aiobotocore
        # https://github.com/fsspec/s3fs/blob/9bf99f763edaf7026318e150c4bd3a8d18bb3a00/requirements.txt#L1
        # however, the latest version of `s3fs` conflicts its `aiobotocore` dep with `boto3`'s dep on `botocore`.
        # Leaving this marked to the automatic resolution to speed up installation.
        "s3fs==0.4.2",
        *COMMONS["datalake"],
    },
    "datalake-gcs": {
        VERSIONS["google-cloud-storage"],
        "gcsfs==2022.11.0",
        *COMMONS["datalake"],
    },
    "dbt": {"google-cloud", VERSIONS["boto3"], VERSIONS["google-cloud-storage"]},
    "druid": {"pydruid>=0.6.5"},
    "elasticsearch": {
        "elasticsearch>=7.17,<8"
    },  # also requires requests-aws4auth which is in base
    "glue": {VERSIONS["boto3"]},
    "dynamodb": {VERSIONS["boto3"]},
    "sagemaker": {VERSIONS["boto3"]},
    "hive": {
        *COMMONS["hive"],
        "thrift>=0.13,<1",
        "sasl~=0.3",
        "thrift-sasl~=0.4",
    },
    "kafka": {*COMMONS["kafka"]},
    "kinesis": {VERSIONS["boto3"]},
    "redpanda": {*COMMONS["kafka"]},
    "ldap-users": {"ldap3==2.9.1"},
    "looker": {"looker-sdk>=22.20.0"},
    "mssql": {"sqlalchemy-pytds~=0.3"},
    "pymssql": {"pymssql~=2.2"},
    "mssql-odbc": {VERSIONS["pyodbc"]},
    "mysql": {
        VERSIONS["pymysql"],
    },
    "oracle": {"cx_Oracle>=8.3.0,<9", "oracledb~=1.2"},
    "powerbi": {VERSIONS["msal"]},
    "presto": {*COMMONS["hive"]},
    "trino": {"trino[sqlalchemy]"},
    "postgres": {VERSIONS["pymysql"], "psycopg2-binary", VERSIONS["geoalchemy2"]},
    "redash": {"redash-toolbelt~=0.1"},
    "redshift": {
        "sqlalchemy-redshift~=0.8",
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
    },
    "snowflake": {"snowflake-sqlalchemy~=1.4"},
    "superset": {},  # uses requests
    "tableau": {"tableau-api-lib~=0.1"},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5"},
    "salesforce": {"simple_salesforce==1.11.4"},
    "okta": {"okta~=2.3"},
    "mlflow": {"mlflow-skinny~=1.30"},
    "sklearn": {VERSIONS["scikit-learn"]},
    "db2": {"ibm-db-sa~=0.3"},
    "clickhouse": {"clickhouse-driver~=0.2", "clickhouse-sqlalchemy~=0.2"},
    "databricks": {"sqlalchemy-databricks~=0.2"},
    "singlestore": {VERSIONS["pymysql"]},
    "azure-sso": {VERSIONS["msal"]},
    "deltalake": {"delta-spark~=2.2"},
    "great-expectations": {VERSIONS["great-expectations"]},
    "pinotdb": {"pinotdb~=0.3"},
    "nifi": {},
    "domo": {VERSIONS["pydomo"]},
    "datalake-azure": {
        "azure-storage-blob~=12.14",
        "azure-identity~=1.12",
        "adlfs~=2022.11",
        *COMMONS["datalake"],
    },
}
dev = {
    "datamodel-code-generator==0.15.0",
    "black==22.3.0",
    "pycln",
    "docker",
    "twine",
    "isort",
    "pre-commit",
    "pylint",
}
test = {
    "pytest==7.0.0",
    "pytest-cov",
    "pytest-order",
    "coverage",
    # sklearn integration
    VERSIONS["scikit-learn"],
    VERSIONS["pandas"],
    # great_expectations tests
    VERSIONS["great-expectations"],
    # Airflow tests
    VERSIONS["airflow"],
    # Domo test
    VERSIONS["pydomo"],
    # mock boto3 functions
    "moto==4.0.8",
    # amundsen
    VERSIONS["neo4j"],
    VERSIONS["google-cloud-storage"],
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-ingestion",
    version="0.13.2.0.dev0",
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
