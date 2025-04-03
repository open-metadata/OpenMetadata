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
"""S3 environment setup for integration tests"""
import os
import uuid
from pathlib import Path

import pytest
import yaml
from minio import Minio

from _openmetadata_testutils.ometa import OM_JWT, int_admin_ometa
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.workflow.metadata import MetadataWorkflow

from ..containers import MinioContainerConfigs, get_minio_container

RESOURCES_DIR = Path(__file__).parent / "resources"


@pytest.fixture(scope="module")
def metadata():
    return int_admin_ometa()


@pytest.fixture(scope="module")
def service_name():
    return str(uuid.uuid4())


@pytest.fixture(scope="session")
def bucket_name():
    return "test-bucket"


def upload_directory_to_minio(client: Minio, local_directory: Path, bucket_name: str):
    """
    Validate it with
    list(client.list_objects(bucket_name=bucket_name, recursive=True))
    """
    # Walk through the local directory
    for root, dirs, files in os.walk(local_directory):
        for filename in files:
            # Create the file path
            local_file_path = os.path.join(root, filename)
            # Generate the object name for MinIO by stripping the local directory path
            object_name = os.path.relpath(local_file_path, local_directory)

            # Upload the file
            client.fput_object(bucket_name, object_name, local_file_path)


@pytest.fixture(scope="session")
def minio(bucket_name):
    config = MinioContainerConfigs(container_name=str(uuid.uuid4()))
    minio_container = get_minio_container(config)
    minio_container.with_exposed_ports(9000, 9001)

    with minio_container:
        minio_client = minio_container.get_client()
        minio_client.make_bucket(bucket_name)

        yield minio_container, minio_client


@pytest.fixture(scope="module")
def create_data(minio, bucket_name):
    _, minio_client = minio
    upload_directory_to_minio(minio_client, RESOURCES_DIR, bucket_name)
    yield


@pytest.fixture(scope="module")
def ingest_s3_storage(minio, metadata, service_name, create_data):
    minio_container, _ = minio
    config = f"""
        source:
          type: s3
          serviceName: {service_name} 
          serviceConnection:
            config:
              type: S3
              awsConfig: 
                awsAccessKeyId: {minio_container.access_key}
                awsSecretAccessKey: {minio_container.secret_key} 
                awsRegion: not-important
                endPointURL: http://localhost:{minio_container.get_exposed_port(9000)}
          sourceConfig:
            config:
              type: StorageMetadata
        sink:
          type: metadata-rest
          config: {{}}
        workflowConfig:
          loggerLevel: DEBUG
          openMetadataServerConfig:
            hostPort: http://localhost:8585/api
            authProvider: openmetadata
            securityConfig:
              jwtToken: "{OM_JWT}"
        """

    workflow = MetadataWorkflow.create(yaml.safe_load(config))
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()

    yield

    service: StorageService = metadata.get_by_name(
        entity=StorageService, fqn=service_name
    )
    metadata.delete(
        entity=StorageService, entity_id=service.id, hard_delete=True, recursive=True
    )
