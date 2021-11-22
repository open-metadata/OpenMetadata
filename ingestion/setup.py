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

import os
from typing import Dict, Set

from setuptools import find_namespace_packages, setup


def get_version():
    root = os.path.dirname(__file__)
    changelog = os.path.join(root, "CHANGELOG")
    with open(changelog) as f:
        return f.readline().strip()


def get_long_description():
    root = os.path.dirname(__file__)
    with open(os.path.join(root, "README.md")) as f:
        description = f.read()
    description += "\n\nChangelog\n=========\n\n"
    with open(os.path.join(root, "CHANGELOG")) as f:
        description += f.read()
    return description


base_requirements = {
    "commonregex",
    "idna<3,>=2.5",
    "click<7.2.0,>=7.1.1",
    "expandvars>=0.6.5"
    "dataclasses>=0.8"
    "typing_extensions>=3.7.4"
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
    "PyYAML",
}
pii_requirements = {
    "en_core_web_sm@https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.0.0/en_core_web_sm-3.0.0.tar.gz#egg=en_core_web",
    "spacy==3.0.5",
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
    "bigquery": {"openmetadata-sqlalchemy-bigquery==0.2.0"},
    "bigquery-usage": {"google-cloud-logging", "cachetools"},
    "docker": {"docker==5.0.3"},
    "dbt": {},
    "elasticsearch": {"elasticsearch~=7.13.1"},
    "glue": {"boto3~=1.19.12"},
    "hive": {
        "openmetadata-sqlalchemy-hive==0.2.0",
        "thrift~=0.13.0",
        "sasl==0.3.1",
        "thrift-sasl==0.4.3",
    },
    "kafka": {"confluent_kafka>=1.5.0", "fastavro>=1.2.0"},
    "ldap-users": {"ldap3==2.9.1"},
    "looker": {"looker-sdk==21.12.2"},
    "mssql": {"sqlalchemy-pytds>=0.3"},
    "mssql-odbc": {"pyodbc"},
    "mysql": {"pymysql>=1.0.2"},
    "oracle": {"cx_Oracle"},
    "pii-processor": pii_requirements,
    "presto": {"pyhive~=0.6.3"},
    "trino": {"sqlalchemy-trino"},
    "postgres": {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2"},
    "redash": {"redash-toolbelt==0.1.4"},
    "redshift": {
        "openmetadata-sqlalchemy-redshift==0.2.1",
        "psycopg2-binary",
        "GeoAlchemy2",
    },
    "redshift-usage": {
        "openmetadata-sqlalchemy-redshift==0.2.1",
        "psycopg2-binary",
        "GeoAlchemy2",
    },
    "data-profiler": {"openmetadata-data-profiler"},
    "snowflake": {"snowflake-sqlalchemy<=1.2.4"},
    "snowflake-usage": {"snowflake-sqlalchemy<=1.2.4"},
    "sample-data": {"faker~=8.1.1"},
    "superset": {},
    "tableau": {"tableau-api-lib==0.1.22"},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5"},
    "report-server": report_requirements,
    "airflow": {"apache-airflow >= 1.10.2"},
    "salesforce": {"simple_salesforce~=1.11.4"},
    "okta": {"okta~=2.3.0"},
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-ingestion",
    version="0.4.4",
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
        **{plugin: list(dependencies) for (plugin, dependencies) in plugins.items()},
        "all": list(
            base_requirements.union(
                *[requirements for plugin, requirements in plugins.items()]
            )
        ),
    },
)
