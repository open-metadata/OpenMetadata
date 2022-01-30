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
    "openmetadata-ingestion-core==0.8.0",
    "commonregex",
    "idna<3,>=2.5",
    "click>=7.1.1",
    "typing_extensions>=3.7.4",
    "mypy_extensions>=0.4.3",
    "typing-inspect",
    "pydantic>=1.7.4",
    "pydantic[email]>=1.7.2",
    "google>=3.0.0",
    "google-auth>=1.33.0",
    "python-dateutil>=2.8.1",
    "email-validator>=1.0.3",
    "wheel~=0.36.2",
    "python-jose==3.3.0",
    "sqlalchemy>=1.3.24",
    "sql-metadata~=2.0.0",
    "requests~=2.26",
    "cryptography",
    "Jinja2>=2.11.3, <3.0",
    "PyYAML",
    "jsonschema",
}

report_requirements = {
    "asgiref==3.4.1",
    "Django==3.2.7",
    "pytz==2021.1",
    "sqlparse==0.4.2",
}

base_plugins = {
    "query-parser",
    "metadata-usage",
    "file-stage",
    "sql-metadata~=2.0.0",
}
plugins: Dict[str, Set[str]] = {
    "amundsen": {"neo4j~=4.4.0"},
    "athena": {"PyAthena[SQLAlchemy]"},
    "bigquery": {"sqlalchemy-bigquery==1.2.2", "pyarrow~=6.0.1"},
    "bigquery-usage": {"google-cloud-logging", "cachetools"},
    # "docker": {"docker==5.0.3"},
    "docker": {"python_on_whales==0.34.0"},
    "backup": {"boto3~=1.19.12"},
    "dbt": {},
    "druid": {"pydruid>=0.6.2"},
    "elasticsearch": {"elasticsearch~=7.13.1"},
    "glue": {"boto3~=1.19.12"},
    "hive": {
        "pyhive~=0.6.3",
        "thrift~=0.13.0",
        "sasl==0.3.1",
        "thrift-sasl==0.4.3",
        "presto-types-parser==0.0.2",
    },
    "kafka": {"confluent_kafka>=1.5.0", "fastavro>=1.2.0"},
    "ldap-users": {"ldap3==2.9.1"},
    "looker": {"looker-sdk==21.12.2"},
    "mssql": {"sqlalchemy-pytds>=0.3"},
    "mssql-odbc": {"pyodbc"},
    "mysql": {"pymysql>=1.0.2"},
    "oracle": {"cx_Oracle"},
    "presto": {"pyhive~=0.6.3"},
    "trino": {"sqlalchemy-trino"},
    "postgres": {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2"},
    "redash": {"redash-toolbelt==0.1.4"},
    "redshift": {"sqlalchemy-redshift==0.8.9", "psycopg2-binary", "GeoAlchemy2"},
    "redshift-usage": {
        "sqlalchemy-redshift==0.8.9",
        "psycopg2-binary",
        "GeoAlchemy2",
    },
    "snowflake": {"snowflake-sqlalchemy<=1.3.2"},
    "snowflake-usage": {"snowflake-sqlalchemy<=1.3.2"},
    "sample-entity": {"faker~=8.1.1"},
    "superset": {},
    "tableau": {"tableau-api-lib==0.1.22"},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5"},
    "report-server": report_requirements,
    "airflow": {"apache-airflow >= 1.10.2"},
    "salesforce": {"simple_salesforce~=1.11.4"},
    "okta": {"okta~=2.3.0"},
    "mlflow": {"mlflow-skinny~=1.22.0"},
    "sklearn": {"scikit-learn==1.0.2"},
}
dev = {
    "boto3==1.20.14",
    "botocore==1.23.14",
    "datamodel-code-generator==0.11.14",
    "docker",
    "google-cloud-storage==1.43.0",
    "twine",
}
test = {
    "black==21.12b0",
    "isort",
    "pre-commit",
    "pylint",
    "pytest",
    "pytest-cov",
    "faker",
    "coverage",
    # sklearn integration
    "scikit-learn==1.0.2",
    "pandas==1.3.5",
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-ingestion",
    version="0.9.0.dev0",
    url="https://open-metadata.org/",
    author="OpenMetadata Committers",
    license="Apache License 2.0",
    description="Ingestion Framework for OpenMetadata",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    python_requires=">=3.8",
    options={"build_exe": build_options},
    package_dir={"": "src"},
    zip_safe=False,
    dependency_links=[],
    project_urls={
        "Documentation": "https://docs.open-metadata.org/",
        "Source": "https://github.com/open-metadata/OpenMetadata",
    },
    packages=find_namespace_packages(where="./src", exclude=["tests*"]),
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
        **{plugin: list(dependencies) for (plugin, dependencies) in plugins.items()},
        "all": list(
            base_requirements.union(
                *[requirements for plugin, requirements in plugins.items()]
            )
        ),
    },
)
