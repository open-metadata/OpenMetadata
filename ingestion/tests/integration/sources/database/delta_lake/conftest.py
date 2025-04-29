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

from ....containers import MinioContainerConfigs, get_minio_container


class DeltaLakeStorageTestConfig:
    def __init__(self):
        self.minio_config = MinioContainerConfigs()
        self.bucket_name = "bucket"
        self.prefix = "prefix"
        self.storage_options = {
            "AWS_ACCESS_KEY_ID": self.minio_config.access_key,
            "AWS_SECRET_ACCESS_KEY": self.minio_config.secret_key,
            "AWS_REGION": "us-east-2",
            "AWS_ALLOW_HTTP": "true",
            "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
        }

    def with_exposed_port(self, minio):
        self.minio_config.with_exposed_port(minio)
        self.storage_options[
            "AWS_ENDPOINT_URL"
        ] = f"http://localhost:{self.minio_config.exposed_port}"


@pytest.fixture(scope="module")
def deltalake_storage_environment():
    config = DeltaLakeStorageTestConfig()
    minio = get_minio_container(config.minio_config)
    with minio:
        minio_client = minio.get_client()
        minio_client.make_bucket(config.bucket_name)

        config.with_exposed_port(minio)

        yield config
