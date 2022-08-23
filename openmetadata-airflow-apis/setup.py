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

from setuptools import find_namespace_packages, setup


def get_long_description():
    root = os.path.dirname(__file__)
    with open(os.path.join(root, "README.md")) as f:
        description = f.read()
    return description


base_requirements = {
    "openmetadata-ingestion[airflow-container]~=0.11.4.4",
    "pendulum~=2.1.2",
    "packaging~=21.2",
    "setuptools~=58.3.0",
    "apache-airflow==2.1.4",
    "Flask~=1.1.4",
    "Flask-Admin==1.6.0",
}

dev_requirements = {
    "black==21.12b0",
    "pytest",
    "pylint",
    "pytest-cov",
    "isort",
    "pycln",
}

setup(
    name="openmetadata-airflow-managed-apis",
    version="0.11.4.4",
    url="https://open-metadata.org/",
    author="OpenMetadata Committers",
    license="Apache License 2.0",
    description="Airflow REST APIs to create and manage DAGS",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    python_requires=">=3.7",
    package_dir={"": "src"},
    zip_safe=False,
    dependency_links=[],
    project_urls={
        "Documentation": "https://docs.open-metadata.org/",
        "Source": "https://github.com/open-metadata/OpenMetadata",
    },
    packages=find_namespace_packages(where="./src", exclude=["tests*"]),
    install_requires=list(base_requirements),
    extras_require={
        "base": list(base_requirements),
        "dev": list(dev_requirements),
    },
)
