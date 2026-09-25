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
Environment fixtures to be able to test the DeltaLake Ingestion Pipeline.
"""
import pytest

from ....containers import S3ContainerConfigs, get_s3_container


class DeltaLakeStorageTestConfig:
    def __init__(self):
        self.s3_config = S3ContainerConfigs()
        self.bucket_name = "bucket"
        self.prefix = "prefix"
        self.storage_options = {
            "AWS_ACCESS_KEY_ID": self.s3_config.access_key,
            "AWS_SECRET_ACCESS_KEY": self.s3_config.secret_key,
            "AWS_REGION": "us-east-2",
            "AWS_ALLOW_HTTP": "true",
            "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
        }

    def with_exposed_port(self, container):
        self.s3_config.with_exposed_port(container)
        self.storage_options[
            "AWS_ENDPOINT_URL"
        ] = f"http://localhost:{self.s3_config.exposed_port}"


@pytest.fixture(scope="module")
def deltalake_storage_environment():
    config = DeltaLakeStorageTestConfig()
    s3_container = get_s3_container(config.s3_config)
    with s3_container:
        s3_container.get_client().make_bucket(config.bucket_name)

        config.with_exposed_port(s3_container)

        yield config
