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
    "pydantic~=1.10",
    "email-validator>=1.0.3",
    "wheel~=0.38.4",
    "setuptools~=65.6.3",
    "typing_extensions<=4.5.0",  # We need to have this fixed due to a yanked release 4.6.0
}


dev = {
    "black==22.3.0",
    "datamodel-code-generator==0.15.0",
    "isort",
    "pre-commit",
    "pycln",
    "pylint",
    "pytest==7.0.0",
    "pytest-cov",
    "pytest-order",
    "twine",
}

setup(
    name="openmetadata-ingestion-core",
    version="1.2.0.0.dev0",
    url="https://open-metadata.org/",
    author="OpenMetadata Committers",
    license="Apache License 2.0",
    description="These are the generated Python classes from JSON Schema and base client.",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    python_requires=">=3.7",
    zip_safe=False,
    install_requires=list(base_requirements),
    project_urls={
        "Documentation": "https://docs.open-metadata.org/",
        "Source": "https://github.com/open-metadata/OpenMetadata",
    },
    packages=find_namespace_packages(include=["metadata.*"], exclude=["tests*"]),
    extras_require={
        "dev": list(dev),
    },
)
