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


dev = {
    "boto3==1.20.14",
    "botocore==1.23.14",
    "datamodel-code-generator==0.12.0",
    "black==22.3.0",
    "pycln==1.3.2",
    "docker",
    "google-cloud-storage==1.43.0",
    "twine",
}


setup(
    name="openmetadata-ingestion-core",
    url="https://open-metadata.org/",
    author="OpenMetadata Committers",
    license="Apache License 2.0",
    description="These are the generated Python classes from JSON Schema",
    long_description=get_long_description(),
    long_description_content_type="text/markdown",
    python_requires=">=3.7",
    package_dir={"": "src"},
    zip_safe=False,
    use_incremental=True,
    setup_requires=["incremental"],
    install_requires=["incremental"],
    project_urls={
        "Documentation": "https://docs.open-metadata.org/",
        "Source": "https://github.com/open-metadata/OpenMetadata",
    },
    packages=find_namespace_packages(where="./src", exclude=["tests*"]),
    extras_require={
        "dev": list(dev),
    },
)
