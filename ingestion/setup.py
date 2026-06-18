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
Python Dependencies
"""

from typing import Dict, List, Set  # noqa: UP035

from setuptools import setup

# Add here versions required for multiple plugins
VERSIONS = {
    "airflow": "apache-airflow==3.2.1",
    "adlfs": "adlfs>=2023.1.0",
    "aiobotocore": "aiobotocore~=2.26.0",
    "avro": "avro>=1.11.4,<1.12",
    "boto3": "boto3~=1.41.5",
    "cloud-sql-python-connector-pymysql": "cloud-sql-python-connector[pymysql]>=1.0.0,<2.0.0",
    "geoalchemy2": "GeoAlchemy2~=0.12",
    "google-cloud-monitoring": "google-cloud-monitoring>=2.0.0",
    "google-cloud-storage": "google-cloud-storage>=1.43.0",
    "gcsfs": "gcsfs~=2026.3",
    "great-expectations": "great-expectations~=0.18.0",
    "great-expectations-1xx": "great-expectations~=1.0",
    "grpc-tools": "grpcio-tools>=1.47.2",
    "ijson": "ijson~=3.4",
    "msal": "msal~=1.2",
    "neo4j": "neo4j~=5.3",
    "pandas": "pandas~=2.1.4",
    "pyarrow": "pyarrow~=16.0",
    "pydantic": "pydantic~=2.0,>=2.7.0,<2.12",  # Pin down to <2.12 due to breaking changes in 2.12.0
    "pydantic-settings": "pydantic-settings~=2.0,>=2.7.0",
    "pydomo": "pydomo~=0.3",
    "pymysql": "pymysql~=1.0",
    "pyodbc": "pyodbc~=5.3.0",
    "numpy": "numpy<2",
    "scikit-learn": "scikit-learn>=1.3,<2",
    "packaging": "packaging",
    "azure-storage-blob": "azure-storage-blob~=12.14",
    "azure-identity": "azure-identity~=1.12",
    "databricks-sdk": "databricks-sdk~=0.20.0",
    "databricks-sql-connector": "databricks-sql-connector>=4.0.0",
    "databricks-sqlalchemy": "databricks-sqlalchemy~=2.0.9",
    "trino": "trino[sqlalchemy]",
    "spacy": "spacy<3.8",
    "looker-sdk": "looker-sdk>=22.20.0,!=24.18.0",
    "lkml": "lkml~=1.3",
    "tableau": "tableauserverclient==0.40",  # pre-0.37 pins urllib3<2, which conflicts with collate-data-diff's urllib3>=2.7
    "pyhive": "pyhive[hive_pure_sasl]~=0.7",
    "mongo": "pymongo~=4.3",
    "snowflake": "snowflake-sqlalchemy>=1.8.0",  # <1.8 caps snowflake-connector-python at <4, but we need 4.x for pyOpenSSL 26 (CVE-2026-27459)
    "elasticsearch8": "elasticsearch8~=8.9.0",
    "giturlparse": "giturlparse",
    "validators": "validators~=0.22.0",
    "teradata": "teradatasqlalchemy==20.0.0.2",
    "cockroach": "sqlalchemy-cockroachdb~=2.0",
    "cassandra": "cassandra-driver>=3.28.0",
    "opensearch": "opensearch-py~=2.4.0",
    "starrocks": "pymysql~=1.0",
    "google-cloud-bigtable": "google-cloud-bigtable>=2.0.0",
    "google-cloud-pubsub": "google-cloud-pubsub>=2.0.0",
    "pyathena": "pyathena~=3.25.0",
    "s3fs": "s3fs~=2026.3",
    "sqlalchemy-bigquery": "sqlalchemy-bigquery>=1.15.0",
    "presidio-analyzer": "presidio-analyzer==2.2.358",
    "asammdf": "asammdf~=7.4.5",
    "kafka-connect": "kafka-connect-py==0.10.11",
    "griffe2md": "griffe2md~=1.2",
    "factory-boy": "factory-boy~=3.3.3",
    "rarfile": "rarfile~=4.2",
    "py7zr": "py7zr~=1.1.0",
}

COMMONS = {
    "storage-archive": {
        VERSIONS["pandas"],
        VERSIONS["pyarrow"],
        VERSIONS["rarfile"],
        VERSIONS["py7zr"],
    },
    "datalake": {
        VERSIONS["asammdf"],
        VERSIONS["avro"],
        VERSIONS["boto3"],
        VERSIONS["ijson"],
        VERSIONS["pandas"],
        VERSIONS["pyarrow"],
        VERSIONS["numpy"],
        # python-snappy does not work well on 3.11 https://github.com/aio-libs/aiokafka/discussions/931
        # Using this as an alternative
        "cramjam~=2.7",
        "fastavro>=1.2.0",
    },
    "hive": {
        "pure-transport==0.2.0",
        "presto-types-parser>=0.0.2",
        VERSIONS["pyhive"],
    },
    "kafka": {
        VERSIONS["avro"],
        "confluent_kafka>=2.1.1,<=2.6.1",
        "fastavro>=1.2.0",
        # Due to https://github.com/grpc/grpc/issues/30843#issuecomment-1303816925
        # use >= v1.47.2 https://github.com/grpc/grpc/blob/v1.47.2/tools/distrib/python/grpcio_tools/grpc_version.py#L17
        VERSIONS["grpc-tools"],  # grpcio-tools already depends on grpcio. No need to add separately
        "protobuf>=5.29.6",  # CVE-2026-0994 JSON recursion depth bypass
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
    "cachetools",  # Used to cache masked queries in ingestion/src/metadata/ingestion/lineage/masker.py
    "chardet==4.0.0",  # Used in the profiler
    "cryptography>=46.0.5",  # CVE-2026-26007
    "google-cloud-secret-manager==2.24.0",
    "google-crc32c",
    "email-validator>=2.0",  # For the pydantic generated models for Email
    "importlib-metadata>=4.13.0",  # From airflow constraints
    "Jinja2>=2.11.3",
    "idna>=3.15",  # CVE-2026-45409 idna.encode() bypass of CVE-2024-3651 fix
    "jsonpatch<2.0, >=1.24",
    "kubernetes>=21.0.0,<36",  # 36.0.0 regressed in-cluster auth (https://github.com/kubernetes-client/python/issues/2582)
    "lxml>=6.1.0",  # CVE-2026-41066 iterparse/ETCompatXMLParser XXE
    "Mako>=1.3.12",  # CVE-2026-44307 TemplateLookup path traversal
    "memory-profiler",
    "mistune>=3.2.1",  # CVE-2026-33079 ReDoS + CVE-2026-44898/44899 XSS/CSS injection
    "mypy_extensions>=0.4.3",
    "PyJWT>=2.12.0",  # CVE-2026-32597 unknown crit header acceptance
    VERSIONS["pydantic"],
    VERSIONS["pydantic-settings"],
    VERSIONS["pymysql"],
    "python-dateutil>=2.8.1",
    "python-dotenv>=0.19.0",  # For environment variable support in dbt ingestion
    "PyYAML~=6.0",
    "requests>=2.32.4",
    "requests-aws4auth~=1.1",  # Only depends on requests as external package. Leaving as base.
    "sqlalchemy>=2.0.0,<3",
    "collate-sqllineage>=2.1.3",
    "tabulate==0.9.0",
    "tenacity>=8.0,<10",
    "typing-inspect",
    "packaging",  # For version parsing
    "setuptools>=78.1.1",
    "shapely",
    "collate-data-diff>=0.11.11",
    # Floor on dbt-extractor (transitive via collate-data-diff -> dbt-core).
    # Pre-0.5 versions ship no cp310-manylinux_2_17_aarch64 wheel, forcing a
    # Rust/Cargo source build on ARM runners. 0.5+ uses cp38-abi3 wheels.
    "dbt-extractor>=0.5.0",
    "jaraco.functools<4.2.0",  # above 4.2 breaks the build
    "jaraco.context>=6.1.0",
    "httpx~=0.28.0",
}

plugins: Dict[str, Set[str]] = {  # noqa: UP006
    "airflow": {
        "opentelemetry-exporter-otlp==1.37.0",
        "attrs",
        VERSIONS["airflow"],
        # Transitive floor pins for Airflow 3.x stack — Dependabot CVEs.
        "apache-airflow-providers-http>=6.0.0",  # CVE-2025-69219 unsafe pickle RCE
        "apache-airflow-providers-opensearch>=1.9.1",  # CVE-2026-43826 credential leak
        "apache-airflow-providers-elasticsearch>=6.5.3",  # CVE-2026-41018 credential leak
        "tornado>=6.5.5",  # CVE-2026-31958 DoS + CVE-2026-35536 cookie injection
        "Werkzeug>=3.0.6",  # CVE-2024-34069 debugger RCE
        "starlette>=0.49.1",  # CVE-2025-62727 O(n^2) DoS; Airflow 3.2.1 lifts the fastapi<0.118 cap
        "python-multipart>=0.0.27",  # CVE-2026-42561 unbounded headers DoS
    },  # Same as ingestion container. For development.
    "amundsen": {VERSIONS["neo4j"]},
    "athena": {VERSIONS["pyathena"]},
    "atlas": {},
    "azuresql": {VERSIONS["pyodbc"]},
    "azure-sso": {VERSIONS["msal"]},
    "backup": {VERSIONS["boto3"], VERSIONS["azure-identity"], "azure-storage-blob"},
    "googledrive": {
        "google-api-python-client>=2.0.0",
    },
    "bigquery": {
        "google-cloud-datacatalog>=3.6.2",
        "google-cloud-logging",
        VERSIONS["pyarrow"],
        VERSIONS["numpy"],
        VERSIONS["sqlalchemy-bigquery"],
    },
    "bigtable": {
        VERSIONS["google-cloud-bigtable"],
        VERSIONS["pandas"],
        VERSIONS["numpy"],
    },
    "clickhouse": {
        "clickhouse-driver~=0.2",
        "clickhouse-sqlalchemy>=0.3",
        DATA_DIFF["clickhouse"],
    },
    "dagster": {
        "croniter<3",
        VERSIONS["pymysql"],
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
        "dagster_graphql>=1.8.0",
    },
    "kestra": set(),  # Uses base requests; no extra deps
    "dbt": {
        "google-cloud",
        VERSIONS["boto3"],
        VERSIONS["google-cloud-storage"],
        "collate-dbt-artifacts-parser",
        VERSIONS["azure-storage-blob"],
        VERSIONS["azure-identity"],
    },
    "db2": {"ibm-db-sa~=0.4.1", "ibm-db>=3.2.6"},
    "db2-ibmi": {
        # sqlalchemy-ibmi is pre-installed with --no-deps (SA<2 metadata conflict)
    },
    "databricks": {
        VERSIONS["databricks-sqlalchemy"],
        VERSIONS["databricks-sdk"],
        VERSIONS["databricks-sql-connector"],
        "ndg-httpsclient~=0.5.1",
        "pyOpenSSL>=26.0.0",  # CVE-2026-27459 DTLS cookie callback BoF
        "pyasn1>=0.6.3",  # CVE-2026-30922 DoS via unbounded recursion
    },
    "datalake-azure": {
        VERSIONS["azure-storage-blob"],
        VERSIONS["azure-identity"],
        VERSIONS["adlfs"],
        VERSIONS["aiobotocore"],
        *COMMONS["datalake"],
    },
    "datalake-gcs": {
        VERSIONS["google-cloud-monitoring"],
        VERSIONS["google-cloud-storage"],
        VERSIONS["gcsfs"],
        VERSIONS["aiobotocore"],
        *COMMONS["datalake"],
    },
    "datalake-s3": {
        VERSIONS["s3fs"],
        VERSIONS["aiobotocore"],
        *COMMONS["datalake"],
    },
    "deltalake": {
        "delta-spark>=3.0.0,<4.0.0",
        "deltalake>=0.19.0,<0.20",
        "pyspark==3.5.6",
    },  # TODO: remove pinning to under 0.20 after https://github.com/open-metadata/OpenMetadata/issues/17909
    "s3": {*COMMONS["storage-archive"]},
    "gcs": {VERSIONS["google-cloud-storage"], *COMMONS["storage-archive"]},
    "deltalake-storage": {"deltalake>=0.19.0,<0.20"},
    "deltalake-spark": {"delta-spark>=3.0.0,<4.0.0", "pyspark==3.5.6"},
    "domo": {VERSIONS["pydomo"]},
    # pydoris-custom declares sqlalchemy<2 but works at runtime with SA 2.0.
    # Pre-installed with --no-deps in Dockerfiles.
    "doris": set(),
    "starrocks": {VERSIONS["pymysql"]},
    "druid": {"pydruid>=0.6.5"},
    "dynamodb": {VERSIONS["boto3"]},
    "elasticsearch": {
        VERSIONS["elasticsearch8"],
    },  # also requires requests-aws4auth which is in base
    "opensearch": {VERSIONS["opensearch"]},
    "exasol": {
        "sqlalchemy_exasol>=7.1.1,<8",
    },
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
    "iomete": {
        "iomete-sqlalchemy>=1.0.22",
        "adbc-driver-flightsql",
        "adbc-driver-manager",
    },
    "impala": {
        "presto-types-parser>=0.0.2",
        "impyla[kerberos]~=0.18.0",
        "thrift>=0.13,<1",
        "pure-sasl",
        "thrift-sasl~=0.4",
    },
    "kafka": {*COMMONS["kafka"]},
    "kafkaconnect": {VERSIONS["kafka-connect"]},
    "kinesis": {VERSIONS["boto3"]},
    "pubsub": {VERSIONS["google-cloud-pubsub"]},
    "looker": {
        VERSIONS["looker-sdk"],
        VERSIONS["lkml"],
        "gitpython>=3.1.50",
        VERSIONS["giturlparse"],
        "python-liquid",
    },
    # >=3.11.1 closes CVE-2026-4137 (insecure tmp dir permissions).
    "mlflow": {"mlflow-skinny>=3.11.1,<3.13"},
    "mongo": {VERSIONS["mongo"], VERSIONS["pandas"], VERSIONS["numpy"]},
    "cassandra": {VERSIONS["cassandra"]},
    "couchbase": {"couchbase~=4.1"},
    "mssql": {
        # 1.0+ moved internal `tds.skipall` calls to `tds_base.skipall`, matching
        # the python-tds 1.x layout. 0.3.x raises AttributeError on every
        # server-side cursor fetch (TABNAME / COLINFO tokens) when paired with
        # python-tds 1.x.
        "sqlalchemy-pytds~=1.0",
        DATA_DIFF["mssql"],
    },
    "mssql-odbc": {
        VERSIONS["pyodbc"],
        DATA_DIFF["mssql"],
    },
    "mysql": {
        VERSIONS["pymysql"],
        VERSIONS["cloud-sql-python-connector-pymysql"],
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
    "pymssql": {"pymssql~=2.3.9"},
    "questdb": {"psycopg2-binary"},
    "quicksight": {VERSIONS["boto3"]},
    "redash": {VERSIONS["packaging"]},
    "redpanda": {*COMMONS["kafka"]},
    "redshift": {
        "sqlalchemy-redshift~=1.0.0",
        "psycopg2-binary",
        VERSIONS["geoalchemy2"],
    },
    "sagemaker": {VERSIONS["boto3"]},
    # authlib >=1.6.9 required for: CVE-2026-27962 (critical, JWS JWK header injection),
    # CVE-2026-28490 (RSA1_5 Bleichenbacher), CVE-2026-28498 (OIDC hash fail-open),
    # CVE-2026-28802 (alg:none bypass).
    "salesforce": {"simple_salesforce~=1.11", "authlib>=1.6.9"},
    "sample-data": {
        VERSIONS["avro"],
        VERSIONS["grpc-tools"],
        VERSIONS["sqlalchemy-bigquery"],
        VERSIONS["spacy"],
        VERSIONS["presidio-analyzer"],
    },
    "sap-hana": {"hdbcli", "sqlalchemy-hana"},
    "sas": {},
    "singlestore": {VERSIONS["pymysql"]},
    "sklearn": {VERSIONS["scikit-learn"]},
    "snowflake": {VERSIONS["snowflake"], DATA_DIFF["snowflake"]},
    "ssrs": {"requests-ntlm"},
    "superset": {},  # uses requests
    "tableau": {VERSIONS["tableau"], VERSIONS["validators"], VERSIONS["packaging"]},
    "teradata": {VERSIONS["teradata"]},
    "trino": {VERSIONS["trino"], DATA_DIFF["trino"]},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5", DATA_DIFF["vertica"]},
    # SDK Data Quality: Required for DataFrame validation (DataFrameValidator)
    # Install with: pip install 'openmetadata-ingestion[pandas]'
    "pandas": {VERSIONS["pandas"], VERSIONS["numpy"]},
    "pyarrow": {VERSIONS["pyarrow"]},
    "pii-processor": {
        VERSIONS["spacy"],
        VERSIONS["pandas"],
        VERSIONS["numpy"],
        VERSIONS["presidio-analyzer"],
    },
    "presidio-analyzer": {VERSIONS["presidio-analyzer"]},
}

dev = {
    "ruff~=0.15.12",
    "uvloop==0.21.0",
    "datamodel-code-generator==0.25.6",
    "boto3-stubs",
    "mypy-boto3-glue",
    "google-api-python-client-stubs",
    "google-auth-stubs",
    "types-requests",
    "pandas-stubs~=2.1.4",
    "scipy-stubs",
    "nox",
    "pre-commit",
    "basedpyright==1.39.3",
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
    "pytest-rerunfailures",
    "dirty-equals",
    "faker==37.1.0",  # The version needs to be fixed to prevent flaky tests!
    # TODO: Remove once no unit test requires testcontainers
    "testcontainers",
    VERSIONS["factory-boy"],
    *plugins["exasol"],
    *plugins["teradata"],
}

exasol_test = {
    "exasol-integration-test-docker-environment>=6.0.0,<7",
    "luigi>=2.8.4,<=3.6.0",
}

test = {
    # Install Airflow as it's not part of `all` plugin
    "opentelemetry-exporter-otlp==1.37.0",
    VERSIONS["airflow"],
    "boto3-stubs",
    "mypy-boto3-glue",
    "coverage",
    # Install GE because it's not in the `all` plugin
    VERSIONS["great-expectations"],
    "pytest==7.0.1",
    "pytest-cov",
    "pytest-xdist~=3.5",
    "pytest-order",
    "dirty-equals",
    # install dbt dependency
    "collate-dbt-artifacts-parser",
    "freezegun",
    VERSIONS["databricks-sdk"],
    VERSIONS["databricks-sql-connector"],
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
    VERSIONS["snowflake"],
    VERSIONS["elasticsearch8"],
    VERSIONS["giturlparse"],
    VERSIONS["avro"],  # Sample Data
    VERSIONS["grpc-tools"],
    VERSIONS["neo4j"],
    VERSIONS["cockroach"],
    # pydoris-custom pre-installed with --no-deps in Dockerfiles (SA<2 metadata constraint).
    VERSIONS["starrocks"],
    *plugins["vertica"],
    "testcontainers~=4.8.0",
    "minio==7.2.5",
    *plugins["mlflow"],
    *plugins["datalake-s3"],
    *plugins["kafka"],
    "kafka-python==2.0.2",
    *plugins["pii-processor"],
    "requests>=2.32.4,<3",
    f"{DATA_DIFF['mysql']}",
    *plugins["deltalake"],
    *plugins["datalake-gcs"],
    *plugins["pgspider"],
    *plugins["clickhouse"],
    *plugins["dagster"],
    *plugins["oracle"],
    *plugins["mssql"],
    VERSIONS["validators"],
    VERSIONS["pyathena"],
    "python-liquid",
    VERSIONS["google-cloud-bigtable"],
    *plugins["bigquery"],
    "faker==37.1.0",  # The version needs to be fixed to prevent flaky tests!
    VERSIONS["opensearch"],
    VERSIONS["kafka-connect"],
    VERSIONS["factory-boy"],
    "locust~=2.32.0",
    *plugins["exasol"],
    *exasol_test,
    *plugins["teradata"],
}

docs = {
    VERSIONS["griffe2md"],
}

e2e_test = {
    # playwright dependencies
    "pytest-playwright",
    "pytest-base-url",
    *plugins["exasol"],
    *exasol_test,
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


def filter_requirements(filtered: Set[str]) -> List[str]:  # noqa: UP006
    """Filter out requirements from base_requirements"""
    return list(
        base_requirements.union(*[requirements for plugin, requirements in plugins.items() if plugin not in filtered])
    )


setup(
    install_requires=list(base_requirements),
    extras_require={
        "dev": list(dev),
        "test": list(test),
        "test-unit": list(test_unit),
        "e2e_test": list(e2e_test),
        "exasol-test": list(exasol_test),
        "data-insight": list(plugins["elasticsearch"]),
        **{plugin: list(dependencies) for (plugin, dependencies) in plugins.items()},
        # FIXME: all-dev-env is a temporary solution to install all dependencies except
        #   those that might conflict with each other or cause issues in the dev environment
        #   This covers all development cases where none of the plugins are used
        "all-dev-env": filter_requirements({"airflow", "db2", "great-expectations", "pymssql"}),
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
        "docs": docs,
    },
)
