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
    with open(os.path.join(root, "README.md")) as f:
        description = f.read()
    description += "\n\nChangelog\n=========\n\n"
    with open(os.path.join(root, "CHANGELOG")) as f:
        description += f.read()
    return description


scheduler_requirements = {
    "apns@git+git://github.com/djacobs/PyAPNs.git#egg=apns",
    "simplescheduler@git+git://github.com/open-metadata/simplescheduler.git#egg=simplescheduler"
}

profiler_requirements = {
    "openmetadata-data-profiler@git+git://github.com/open-metadata/data-profiler.git#egg=openmetadata-data-rofiler"
}

base_requirements = {
    "commonregex",
    "idna<3,>=2.5",
    "click<7.2.0,>=7.1.1",
    "expandvars>=0.6.5"
    "dataclasses>=0.8"
    "typing_extensions>=3.7.4"
    "mypy_extensions>=0.4.3",
    "typing-inspect",
    "pydantic==1.7.4",
    "pydantic[email]>=1.7.2",
    "google>=3.0.0",
    "google-auth>=1.33.0",
    "python-dateutil>=2.8.1",
    "email-validator>=1.0.3",
    "wheel~=0.36.2",
    "python-jose==3.3.0",
    "okta>=1.7.0",
    "sqlalchemy>=1.3.24",
    "sql-metadata~=2.0.0",
    "spacy==3.0.5",
    "requests~=2.25.1",
    "en_core_web_sm@https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.0.0/en_core_web_sm-3.0.0.tar.gz#egg=en_core_web"
}
base_plugins = {
    "query-parser",
    "metadata-usage",
    "file-stage",
    "sql-metadata~=2.0.0",
}
plugins: Dict[str, Set[str]] = {
    "athena": {"PyAthena[SQLAlchemy]"},
    "bigquery": {"pybigquery >= 0.6.0"},
    "bigquery-usage": {"google-cloud-logging", "cachetools"},
    "elasticsearch": {"elasticsearch~=7.13.1"},
    "hive": {"pyhive~=0.6.3", "thrift~=0.13.0", "sasl==0.3.1", "thrift-sasl==0.4.3"},
    "kafka": {"confluent_kafka>=1.5.0", "fastavro>=1.2.0"},
    "ldap-users": {"ldap3==2.9.1"},
    "looker": {"looker-sdk==21.12.2"},
    "mssql": {"sqlalchemy-pytds>=0.3"},
    "mssql-odbc": {"pyodbc"},
    "mysql": {"pymysql>=1.0.2"},
    "oracle": {"cx_Oracle"},
    "pii-processor": {"pandas~=1.3.1"},
    "presto": {"pyhive~=0.6.3"},
    "postgres": {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2"},
    "profiler": {"ruamel.yaml", "jsonpatch", "pandas", "IPython", "jsonschema", "scipy", "mistune", "altair", "tzlocal"},
    "redshift": {"sqlalchemy-redshift", "GeoAlchemy2", "psycopg2-binary"},
    "redshift-usage": {"sqlalchemy-redshift", "psycopg2-binary", "GeoAlchemy2"},
    "scheduler": scheduler_requirements,
    "data-profiler": profiler_requirements,
    "snowflake": {"snowflake-sqlalchemy<=1.2.4"},
    "snowflake-usage": {"snowflake-sqlalchemy<=1.2.4"},
    "sample-data": {"faker~=8.1.1"},
    "superset": {},
    "tableau": {"tableau-api-lib==0.1.22"},
    "vertica": {"sqlalchemy-vertica[vertica-python]>=0.0.5"}
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-ingestion",
    version="0.2.2",
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
    dependency_links=[

    ],
    project_urls={
        "Documentation": "https://docs.open-metadata.org/",
        "Source": "https://github.com/open-metadata/OpenMetadata",
    },
    packages=find_namespace_packages(where='./src', exclude=['tests*']),
    entry_points={
        "console_scripts": ["metadata = metadata.cmd:metadata"],
    },
    install_requires=list(base_requirements),
    extras_require={
        "base": list(base_requirements),
        **{
            plugin: list(dependencies)
            for (plugin, dependencies) in plugins.items()
        },
        "all": list(
            base_requirements.union(
                *[
                    requirements
                    for plugin, requirements in plugins.items()
                ]
            )
        )
    }

)
