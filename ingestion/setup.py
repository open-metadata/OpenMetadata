# https://github.com/open-metadata/OpenMetadata/actions/runs/15640676139/job/44066998708?pr=21719  Copyright 2025 Collate
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
Python Dependencies
"""

import sys
from typing import Dict, List, Set

from setuptools import setup

# Add here versions required for multiple plugins
VERSIONS = {
    "airflow": "apache-airflow==2.10.5",
    "adlfs": "adlfs>=2023.1.0",
    "avro": "avro>=1.11.3,<1.12",
    "boto3": "boto3>=1.20,<2.0",  # No need to add botocore separately. It's a dep from boto3
    "geoalchemy2": "GeoAlchemy2~=0.12",
    "google-cloud-monitoring": "google-cloud-monitoring>=2.0.0",
    "google-cloud-storage": "google-cloud-storage>=1.43.0",
    "gcsfs": "gcsfs>=2023.1.0",
    "great-expectations": "great-expectations~=0.18.0",
    "great-expectations-1xx": "great-expectations~=1.0",
    "grpc-tools": "grpcio-tools>=1.47.2",
    "msal": "msal~=1.2",
    "neo4j": "neo4j~=5.3",
    "pandas": "pandas~=2.0.0",
    "pyarrow": "pyarrow~=16.0",
    "pydantic": "pydantic~=2.0,>=2.7.0",
    "pydantic-settings": "pydantic-settings~=2.0,>=2.7.0",
    "pydomo": "pydomo~=0.3",
    "pymysql": "pymysql~=1.0",
    "pyodbc": "pyodbc>=4.0.35,<5",
    "numpy": "numpy<2",
    "scikit-learn": "scikit-learn~=1.0",  # Python 3.7 only goes up to 1.0.2
    "packaging": "packaging",
    "azure-storage-blob": "azure-storage-blob~=12.14",
    "azure-identity": "azure-identity~=1.12",
    "sqlalchemy-databricks": "sqlalchemy-databricks~=0.1",
    "databricks-sdk": "databricks-sdk~=0.20.0",
    "trino": "trino[sqlalchemy]",
    "spacy": "spacy<3.8",
    "looker-sdk": "looker-sdk>=22.20.0,!=24.18.0",
    "lkml": "lkml~=1.3",
    "tableau": "tableauserverclient==0.25",  # higher versions require urllib3>2.0 which conflicts other libs
    "pyhive": "pyhive[hive_pure_sasl]~=0.7",
    "mongo": "pymongo~=4.3",
    "redshift": "sqlalchemy-redshift==0.8.12",
    "snowflake": "snowflake-sqlalchemy~=1.4",
    "elasticsearch8": "elasticsearch8~=8.9.0",
    "giturlparse": "giturlparse",
    "validators": "validators~=0.22.0",
    "teradata": "teradatasqlalchemy==20.0.0.2",
    "cockroach": "sqlalchemy-cockroachdb~=2.0",
    "cassandra": "cassandra-driver>=3.28.0",
    "opensearch": "opensearch-py~=2.4.0",
    "pydoris": "pydoris==1.0.2",
    "pyiceberg": "pyiceberg==0.5.1",
    "google-cloud-bigtable": "google-cloud-bigtable>=2.0.0",
    "pyathena": "pyathena~=3.0",
    "sqlalchemy-bigquery": "sqlalchemy-bigquery>=1.2.2",
    "presidio-analyzer": "presidio-analyzer==2.2.358",
}

COMMONS = {
    "datalake": {
        VERSIONS["avro"],
        VERSIONS["boto3"],
        VERSIONS["pandas"],
        VERSIONS["pyarrow"],
        VERSIONS["numpy"],
        # python-snappy does not work well on 3.11 https://github.com/aio-libs/aiokafka/discussions/931
        # Using this as an alternative
        "cramjam~=2.7",
    },
    "hive": {
        "presto-types-parser>=0.0.2",
        VERSIONS["pyhive"],
    },
    "kafka": {
        VERSIONS["avro"],
        "confluent_kafka>=2.1.1,<=2.6.1",
        "fastavro>=1.2.0",
        # Due to https://github.com/grpc/grpc/issues/30843#issuecomment-1303816925
        # use >= v1.47.2 https://github.com/grpc/grpc/blob/v1.47.2/tools/distrib/python/grpcio_tools/grpc_version.py#L17
        VERSIONS[
            "grpc-tools"
        ],  # grpcio-tools already depends on grpcio. No need to add separately
        "protobuf",
    },
    "postgres": {
        VERSIONS["pymysql"],
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
        VERSIONS["packaging"],
    },  # Adding as Postgres SQL & GreenPlum are using common packages.
}

DATA_DIFF = {
    driver: f"collate-data-diff[{driver}]"
    # data-diff uses different drivers out-of-the-box than OpenMetadata
    # the extras are described here:
    # https://github.com/open-metadata/collate-data-diff/blob/main/pyproject.toml#L68
    # install all data diffs with "pip install collate-data-diff[all-dbs]"
    for driver in [
        "clickhouse",
        # "duckdb", # Not supported by OpenMetadata
        "mssql",
        "mysql",
        "oracle",
        # "postgresql", we dont use this as it installs psycopg2 which interferes with psycopg2-binary
        "presto",
        "redshift",
        "snowflake",
        "trino",
        "vertica",
    ]
}

base_requirements = {
    "antlr4-python3-runtime==4.9.2",
    VERSIONS["azure-identity"],
    "azure-keyvault-secrets",  # Azure Key Vault SM
    VERSIONS["boto3"],  # Required in base for the secrets manager
    "cached-property==1.5.2",  # LineageParser
    "chardet==4.0.0",  # Used in the profiler
    "cryptography>=42.0.0",
    "google-cloud-secret-manager==2.22.1",
    "google-crc32c",
    "email-validator>=2.0",  # For the pydantic generated models for Email
    "importlib-metadata>=4.13.0",  # From airflow constraints
    "Jinja2>=2.11.3",
    "jsonpatch<2.0, >=1.24",
    "memory-profiler",
    "mypy_extensions>=0.4.3",
    VERSIONS["pydantic"],
    VERSIONS["pydantic-settings"],
    VERSIONS["pymysql"],
    "python-dateutil>=2.8.1",
    "python-dotenv>=0.19.0",  # For environment variable support in dbt ingestion
    "PyYAML~=6.0",
    "requests>=2.23",
    "requests-aws4auth~=1.1",  # Only depends on requests as external package. Leaving as base.
    "sqlalchemy>=1.4.0,<2",
    "collate-sqllineage~=1.6.0",
    "tabulate==0.9.0",
    "typing-inspect",
    "packaging",  # For version parsing
    "setuptools~=70.0",
    "shapely",
    "collate-data-diff",
    "jaraco.functools<4.2.0",  # above 4.2 breaks the build
    # TODO: Remove one once we have updated datadiff version
    "snowflake-connector-python>=3.13.1,<4.0.0",
    "mysql-connector-python>=8.0.29;python_version<'3.9'",
    "mysql-connector-python>=9.1;python_version>='3.9'",
}

plugins: Dict[str, Set[str]] = {
    "airflow": {
        "opentelemetry-exporter-otlp==1.27.0",
        "protobuf<5",
        "attrs",
        VERSIONS["airflow"],
    },  # Same as ingestion container. For development.
    "amundsen": {VERSIONS["neo4j"]},
    "athena": {VERSIONS["pyathena"]},
    "atlas": {},
    "azuresql": {VERSIONS["pyodbc"]},
    "azure-sso": {VERSIONS["msal"]},
    "backup": {VERSIONS["boto3"], VERSIONS["azure-identity"], "azure-storage-blob"},
    "bigquery": {
        "cachetools",
        "google-cloud-datacatalog>=3.6.2",
        "google-cloud-logging",
        VERSIONS["pyarrow"],
        VERSIONS["numpy"],
        "sqlalchemy-bigquery>=1.2.2",
    },
    "bigtable": {
        VERSIONS["google-cloud-bigtable"],
        VERSIONS["pandas"],
        VERSIONS["numpy"],
    },
    "clickhouse": {
        "clickhouse-driver~=0.2",
        "clickhouse-sqlalchemy~=0.2.0",
        DATA_DIFF["clickhouse"],
    },
    "dagster": {
        "croniter<3",
        VERSIONS["pymysql"],
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
        "dagster_graphql>=1.8.0",
    },
    "dbt": {
        "google-cloud",
        VERSIONS["boto3"],
        VERSIONS["google-cloud-storage"],
        "collate-dbt-artifacts-parser",
        VERSIONS["azure-storage-blob"],
        VERSIONS["azure-identity"],
    },
    "db2": {"ibm-db-sa~=0.4.1", "ibm-db>=3.2.6"},
    "db2-ibmi": {"sqlalchemy-ibmi~=0.9.3"},
    "databricks": {
        VERSIONS["sqlalchemy-databricks"],
        VERSIONS["databricks-sdk"],
        "ndg-httpsclient~=0.5.1",
        "pyOpenSSL~=24.1.0",
        "pyasn1~=0.6.0",
        # databricks has a dependency on pyhive for metadata as well as profiler
        VERSIONS["pyhive"],
    },
    "datalake-azure": {
        VERSIONS["azure-storage-blob"],
        VERSIONS["azure-identity"],
        VERSIONS["adlfs"],
        *COMMONS["datalake"],
    },
    "datalake-gcs": {
        VERSIONS["google-cloud-monitoring"],
        VERSIONS["google-cloud-storage"],
        VERSIONS["gcsfs"],
        *COMMONS["datalake"],
    },
    "datalake-s3": {
        *COMMONS["datalake"],
    },
    "deltalake": {
        "delta-spark<=2.3.0",
        "deltalake~=0.17,<0.20",
    },  # TODO: remove pinning to under 0.20 after https://github.com/open-metadata/OpenMetadata/issues/17909
    "deltalake-storage": {"deltalake~=0.17"},
    "deltalake-spark": {"delta-spark<=2.3.0"},
    "domo": {VERSIONS["pydomo"]},
    "doris": {"pydoris==1.0.2"},
    "druid": {"pydruid>=0.6.5"},
    "dynamodb": {VERSIONS["boto3"]},
    "elasticsearch": {
        VERSIONS["elasticsearch8"],
        "httpx>=0.23.0",
    },  # also requires requests-aws4auth which is in base
    "opensearch": {VERSIONS["opensearch"]},
    "exasol": {"sqlalchemy_exasol>=5,<6"},
    "glue": {VERSIONS["boto3"]},
    "great-expectations": {VERSIONS["great-expectations"]},
    "great-expectations-1xx": {VERSIONS["great-expectations-1xx"]},
    "greenplum": {*COMMONS["postgres"]},
    "cockroach": {
        VERSIONS["cockroach"],
        "psycopg2-binary",
    },
    "hive": {
        *COMMONS["hive"],
        "thrift>=0.13,<1",
        # Replacing sasl with pure-sasl based on https://github.com/cloudera/python-sasl/issues/30 for py 3.11
        "pure-sasl",
        "thrift-sasl~=0.4",
        "impyla~=0.18.0",
    },
    "iceberg": {
        VERSIONS["pyiceberg"],
        # Forcing the version of a few packages so it plays nicely with other requirements.
        VERSIONS["pydantic"],
        VERSIONS["adlfs"],
        VERSIONS["gcsfs"],
        VERSIONS["pyarrow"],
    },
    "impala": {
        "presto-types-parser>=0.0.2",
        "impyla[kerberos]~=0.18.0",
        "thrift>=0.13,<1",
        "pure-sasl",
        "thrift-sasl~=0.4",
    },
    "kafka": {*COMMONS["kafka"]},
    "kafkaconnect": {"kafka-connect-py==0.10.11"},
    "kinesis": {VERSIONS["boto3"]},
    "looker": {
        VERSIONS["looker-sdk"],
        VERSIONS["lkml"],
        "gitpython~=3.1.34",
        VERSIONS["giturlparse"],
        "python-liquid",
    },
    "mlflow": {"mlflow-skinny~=2.22.0"},
    "mongo": {VERSIONS["mongo"], VERSIONS["pandas"], VERSIONS["numpy"]},
    "cassandra": {VERSIONS["cassandra"]},
    "couchbase": {"couchbase~=4.1"},
    "mssql": {
        "sqlalchemy-pytds~=0.3",
        DATA_DIFF["mssql"],
    },
    "mssql-odbc": {
        VERSIONS["pyodbc"],
        DATA_DIFF["mssql"],
    },
    "mysql": {
        VERSIONS["pymysql"],
        DATA_DIFF["mysql"],
    },
    "nifi": {},  # uses requests
    "openlineage": {*COMMONS["kafka"]},
    "oracle": {"cx_Oracle>=8.3.0,<9", "oracledb~=1.2", DATA_DIFF["oracle"]},
    "pgspider": {"psycopg2-binary", "sqlalchemy-pgspider"},
    "pinotdb": {"pinotdb~=5.0"},
    "postgres": {*COMMONS["postgres"]},
    "powerbi": {
        VERSIONS["msal"],
        VERSIONS["boto3"],
        VERSIONS["google-cloud-storage"],
        VERSIONS["azure-storage-blob"],
        VERSIONS["azure-identity"],
    },
    "qliksense": {"websocket-client~=1.6.1"},
    "presto": {*COMMONS["hive"], DATA_DIFF["presto"]},
    "pymssql": {"pymssql~=2.2.0"},
    "quicksight": {VERSIONS["boto3"]},
    "redash": {VERSIONS["packaging"]},
    "redpanda": {*COMMONS["kafka"]},
    "redshift": {
        # Going higher has memory and performance issues
        VERSIONS["redshift"],
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
    },
    "sagemaker": {VERSIONS["boto3"]},
    "salesforce": {"simple_salesforce~=1.11", "authlib>=1.3.1"},
    "sample-data": {
        VERSIONS["avro"],
        VERSIONS["grpc-tools"],
        VERSIONS["sqlalchemy-bigquery"],
        VERSIONS["presidio-analyzer"],
    },
    "sap-hana": {"hdbcli", "sqlalchemy-hana"},
    "sas": {},
    "singlestore": {VERSIONS["pymysql"]},
    "sklearn": {VERSIONS["scikit-learn"]},
    "snowflake": {VERSIONS["snowflake"], DATA_DIFF["snowflake"]},
    "superset": {},  # uses requests
    "tableau": {VERSIONS["tableau"], VERSIONS["validators"], VERSIONS["packaging"]},
    "teradata": {VERSIONS["teradata"]},
    "trino": {VERSIONS["trino"], DATA_DIFF["trino"]},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5", DATA_DIFF["vertica"]},
    "pii-processor": {
        VERSIONS["spacy"],
        VERSIONS["pandas"],
        VERSIONS["numpy"],
        VERSIONS["presidio-analyzer"],
    },
    "presidio-analyzer": {VERSIONS["presidio-analyzer"]},
}

dev = {
    "black==22.3.0",
    "datamodel-code-generator==0.25.6",
    "boto3-stubs",
    "mypy-boto3-glue",
    "isort",
    "pre-commit",
    "pycln",
    "pylint~=3.2.0",  # 3.3.0+ breaks our current linting
    # For publishing
    "twine",
    "build",
    *plugins["sample-data"],
}

# Dependencies for unit testing in addition to dev dependencies and plugins
test_unit = {
    "pytest==7.0.1",
    "pytest-cov",
    "pytest-order",
    "dirty-equals",
    "faker==37.1.0",  # The version needs to be fixed to prevent flaky tests!
    # TODO: Remove once no unit test requires testcontainers
    "testcontainers",
}

test = {
    # Install Airflow as it's not part of `all` plugin
    "opentelemetry-exporter-otlp==1.27.0",
    VERSIONS["airflow"],
    "boto3-stubs",
    "mypy-boto3-glue",
    "coverage",
    # Install GE because it's not in the `all` plugin
    VERSIONS["great-expectations"],
    "basedpyright~=1.14",
    "pytest==7.0.1",
    "pytest-cov",
    "pytest-order",
    "dirty-equals",
    # install dbt dependency
    "collate-dbt-artifacts-parser",
    "freezegun",
    VERSIONS["sqlalchemy-databricks"],
    VERSIONS["databricks-sdk"],
    VERSIONS["scikit-learn"],
    VERSIONS["pyarrow"],
    VERSIONS["trino"],
    VERSIONS["spacy"],
    VERSIONS["pydomo"],
    VERSIONS["looker-sdk"],
    VERSIONS["lkml"],
    VERSIONS["tableau"],
    VERSIONS["pyhive"],
    VERSIONS["mongo"],
    VERSIONS["cassandra"],
    VERSIONS["redshift"],
    VERSIONS["snowflake"],
    VERSIONS["elasticsearch8"],
    VERSIONS["giturlparse"],
    VERSIONS["avro"],  # Sample Data
    VERSIONS["grpc-tools"],
    VERSIONS["neo4j"],
    VERSIONS["cockroach"],
    VERSIONS["pydoris"],
    VERSIONS["pyiceberg"],
    "testcontainers==3.7.1;python_version<'3.9'",
    "testcontainers~=4.8.0;python_version>='3.9'",
    "minio==7.2.5",
    *plugins["mlflow"],
    *plugins["datalake-s3"],
    *plugins["kafka"],
    "kafka-python==2.0.2",
    *plugins["pii-processor"],
    "requests==2.31.0",
    f"{DATA_DIFF['mysql']}",
    *plugins["deltalake"],
    *plugins["datalake-gcs"],
    *plugins["pgspider"],
    *plugins["clickhouse"],
    *plugins["mssql"],
    *plugins["dagster"],
    *plugins["oracle"],
    *plugins["mssql"],
    VERSIONS["validators"],
    VERSIONS["pyathena"],
    VERSIONS["pyiceberg"],
    VERSIONS["pydoris"],
    "python-liquid",
    VERSIONS["google-cloud-bigtable"],
    *plugins["bigquery"],
    "faker==37.1.0",  # The version needs to be fixed to prevent flaky tests!
}

if sys.version_info >= (3, 9):
    test.add("locust~=2.32.0")

e2e_test = {
    # playwright dependencies
    "pytest-playwright",
    "pytest-base-url",
}

# Define playwright_dependencies as a set of packages required for Playwright tests
# These packages correspond to the ingestion connectors used in Playwright tests
playwright_dependencies = {
    *plugins["mysql"],
    *plugins["bigquery"],
    *plugins["kafka"],
    *plugins["mlflow"],
    *plugins["snowflake"],
    *plugins["superset"],
    *plugins["postgres"],
    *plugins["redshift"],
    *plugins["airflow"],
    *plugins["datalake-s3"],
    *plugins["dbt"],
    *plugins["presidio-analyzer"],
    *e2e_test,
    # Add other plugins as needed for Playwright tests
}


def filter_requirements(filtered: Set[str]) -> List[str]:
    """Filter out requirements from base_requirements"""
    return list(
        base_requirements.union(
            *[
                requirements
                for plugin, requirements in plugins.items()
                if plugin not in filtered
            ]
        )
    )


setup(
    install_requires=list(base_requirements),
    extras_require={
        "dev": list(dev),
        "test": list(test),
        "test-unit": list(test_unit),
        "e2e_test": list(e2e_test),
        "data-insight": list(plugins["elasticsearch"]),
        **{plugin: list(dependencies) for (plugin, dependencies) in plugins.items()},
        # FIXME: all-dev-env is a temporary solution to install all dependencies except
        #   those that might conflict with each other or cause issues in the dev environment
        #   This covers all development cases where none of the plugins are used
        "all-dev-env": filter_requirements(
            {"airflow", "db2", "great-expectations", "pymssql"}
        ),
        # enf-of-fixme
        "all": filter_requirements({"airflow", "db2", "great-expectations"}),
        "playwright": list(playwright_dependencies),
        "slim": filter_requirements(
            {
                "airflow",
                "db2",
                "great-expectations",
                "deltalake",
                "deltalake-spark",
                "sklearn",
            }
        ),
    },
)
