#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
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
    "sqlalchemy>=1.3.24",
    "Jinja2>=2.11.3, <3.0",
    "click>=7.1.2, <8.0",
    "cryptography==3.3.2",
    "pyyaml>=5.4.1, <6.0",
    "requests>=2.23.0, <3.0" "idna<3,>=2.5",
    "click<7.2.0,>=7.1.1",
    "expandvars>=0.6.5"
    "dataclasses>=0.8"
    "typing_extensions>=3.7.4"
    "mypy_extensions>=0.4.3",
    "typing-inspect",
    "pydantic==1.7.4",
    "pymysql>=1.0.2",
    "GeoAlchemy2",
    "psycopg2-binary>=2.8.5, <3.0",
    "openmetadata-sqlalchemy-redshift==0.2.1",
}

plugins: Dict[str, Set[str]] = {
    "redshift": {
        "openmetadata-sqlalchemy-redshift==0.2.1",
        "psycopg2-binary",
        "GeoAlchemy2",
    },
    "postgres": {"pymysql>=1.0.2", "psycopg2-binary", "GeoAlchemy2"},
}

build_options = {"includes": ["_cffi_backend"]}
setup(
    name="openmetadata-data-profiler",
    version="0.1",
    url="https://open-metadata.org/",
    author="OpenMetadata Committers",
    license="Apache License 2.0",
    description="Data Profiler and Testing Framework for OpenMetadata",
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
        "console_scripts": ["openmetadata = openmetadata.cmd:openmetadata"],
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
