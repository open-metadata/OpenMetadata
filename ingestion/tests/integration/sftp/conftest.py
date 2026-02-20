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
SFTP integration test fixtures
"""
import os
import tempfile
import uuid
from dataclasses import dataclass
from typing import Optional

import pytest
import yaml
from testcontainers.core.container import DockerContainer
from testcontainers.core.waiting_utils import wait_for_logs

from _openmetadata_testutils.ometa import OM_JWT, int_admin_ometa
from metadata.generated.schema.entity.services.driveService import DriveService
from metadata.workflow.metadata import MetadataWorkflow


@dataclass
class SftpContainerConfig:
    """Configuration for SFTP test container"""

    username: str = "testuser"
    password: str = "testpass"
    port: int = 22
    container_name: Optional[str] = None
    upload_dir: str = "upload"


class SftpContainer(DockerContainer):
    """SFTP test container using atmoz/sftp image"""

    def __init__(self, config: SftpContainerConfig):
        super().__init__(image="atmoz/sftp:latest")
        self.config = config
        self.with_exposed_ports(config.port)
        self.with_command(
            f"{config.username}:{config.password}:1001:1001:{config.upload_dir}"
        )
        if config.container_name:
            self.with_name(config.container_name)

    def get_connection_url(self) -> str:
        """Get the connection URL for the SFTP server"""
        host = self.get_container_host_ip()
        port = self.get_exposed_port(self.config.port)
        return f"sftp://{self.config.username}@{host}:{port}"


def get_sftp_container(config: SftpContainerConfig) -> SftpContainer:
    """Create and return an SFTP container"""
    return SftpContainer(config)


def upload_test_data_to_sftp(container: SftpContainer, local_dir: str, remote_dir: str):
    """Upload test data to SFTP container"""
    import paramiko

    host = container.get_container_host_ip()
    port = int(container.get_exposed_port(container.config.port))

    transport = paramiko.Transport((host, port))
    transport.connect(
        username=container.config.username, password=container.config.password
    )
    sftp = paramiko.SFTPClient.from_transport(transport)

    try:
        try:
            sftp.mkdir(remote_dir)
        except IOError:
            pass

        for root, dirs, files in os.walk(local_dir):
            rel_root = os.path.relpath(root, local_dir)
            if rel_root == ".":
                remote_root = remote_dir
            else:
                remote_root = f"{remote_dir}/{rel_root}"

            for dir_name in dirs:
                remote_path = f"{remote_root}/{dir_name}"
                try:
                    sftp.mkdir(remote_path)
                except IOError:
                    pass

            for file_name in files:
                local_path = os.path.join(root, file_name)
                remote_path = f"{remote_root}/{file_name}"
                sftp.put(local_path, remote_path)
    finally:
        sftp.close()
        transport.close()


def create_test_data_directory() -> str:
    """Create a temporary directory with test data including structured and unstructured files"""
    temp_dir = tempfile.mkdtemp()

    os.makedirs(os.path.join(temp_dir, "documents"))
    os.makedirs(os.path.join(temp_dir, "data"))
    os.makedirs(os.path.join(temp_dir, "data", "nested"))
    os.makedirs(os.path.join(temp_dir, "data", "nested", "level2"))
    os.makedirs(os.path.join(temp_dir, "data", "nested", "level2", "level3"))
    os.makedirs(os.path.join(temp_dir, "media"))
    os.makedirs(os.path.join(temp_dir, "empty_dir"))

    with open(os.path.join(temp_dir, "readme.txt"), "w") as f:
        f.write("This is a test file in the root directory.")

    with open(os.path.join(temp_dir, "documents", "report.txt"), "w") as f:
        f.write("This is a test report.")

    with open(os.path.join(temp_dir, "documents", "notes.md"), "w") as f:
        f.write("# Notes\n\nSome test notes.")

    # CSV file with structured data
    with open(os.path.join(temp_dir, "data", "sample.csv"), "w") as f:
        f.write("id,name,value,price,active\n")
        f.write("1,Product A,100,19.99,true\n")
        f.write("2,Product B,200,29.99,false\n")
        f.write("3,Product C,150,24.99,true\n")

    # TSV file with structured data
    with open(os.path.join(temp_dir, "data", "users.tsv"), "w") as f:
        f.write("user_id\tusername\temail\tage\n")
        f.write("1\tjohn_doe\tjohn@example.com\t30\n")
        f.write("2\tjane_doe\tjane@example.com\t25\n")

    with open(os.path.join(temp_dir, "data", "config.json"), "w") as f:
        f.write('{"key": "value", "enabled": true}')

    with open(os.path.join(temp_dir, "data", "nested", "deep_file.txt"), "w") as f:
        f.write("Deep nested file content.")

    # Files in deeply nested directories (level2, level3)
    with open(
        os.path.join(temp_dir, "data", "nested", "level2", "level2_file.txt"), "w"
    ) as f:
        f.write("Level 2 nested file content.")

    with open(
        os.path.join(temp_dir, "data", "nested", "level2", "level3", "level3_file.csv"),
        "w",
    ) as f:
        f.write("col_a,col_b,col_c\n")
        f.write("val1,val2,val3\n")

    # Empty CSV file (header only)
    with open(os.path.join(temp_dir, "data", "empty_data.csv"), "w") as f:
        f.write("header1,header2,header3\n")

    # File with special characters in name
    with open(os.path.join(temp_dir, "data", "file-with_special.chars.csv"), "w") as f:
        f.write("name,score\n")
        f.write("test,100\n")

    # File without extension
    with open(os.path.join(temp_dir, "documents", "README"), "w") as f:
        f.write("This is a README without extension.")

    # Create unstructured files (images, PDFs)
    # Create a minimal PNG file (1x1 pixel transparent PNG)
    png_data = bytes(
        [
            0x89,
            0x50,
            0x4E,
            0x47,
            0x0D,
            0x0A,
            0x1A,
            0x0A,  # PNG signature
            0x00,
            0x00,
            0x00,
            0x0D,
            0x49,
            0x48,
            0x44,
            0x52,  # IHDR chunk
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            0x01,  # 1x1 pixel
            0x08,
            0x06,
            0x00,
            0x00,
            0x00,
            0x1F,
            0x15,
            0xC4,
            0x89,
            0x00,
            0x00,
            0x00,
            0x0A,
            0x49,
            0x44,
            0x41,  # IDAT chunk
            0x54,
            0x78,
            0x9C,
            0x63,
            0x00,
            0x01,
            0x00,
            0x00,
            0x05,
            0x00,
            0x01,
            0x0D,
            0x0A,
            0x2D,
            0xB4,
            0x00,
            0x00,
            0x00,
            0x00,
            0x49,
            0x45,
            0x4E,
            0x44,
            0xAE,  # IEND chunk
            0x42,
            0x60,
            0x82,
        ]
    )
    with open(os.path.join(temp_dir, "media", "logo.png"), "wb") as f:
        f.write(png_data)

    # Create a minimal JPEG file
    jpeg_data = bytes(
        [
            0xFF,
            0xD8,
            0xFF,
            0xE0,
            0x00,
            0x10,
            0x4A,
            0x46,  # JPEG header
            0x49,
            0x46,
            0x00,
            0x01,
            0x01,
            0x00,
            0x00,
            0x01,
            0x00,
            0x01,
            0x00,
            0x00,
            0xFF,
            0xDB,
            0x00,
            0x43,  # Quantization table
            0x00,
            0x08,
            0x06,
            0x06,
            0x07,
            0x06,
            0x05,
            0x08,
            0x07,
            0x07,
            0x07,
            0x09,
            0x09,
            0x08,
            0x0A,
            0x0C,
            0x14,
            0x0D,
            0x0C,
            0x0B,
            0x0B,
            0x0C,
            0x19,
            0x12,
            0x13,
            0x0F,
            0x14,
            0x1D,
            0x1A,
            0x1F,
            0x1E,
            0x1D,
            0x1A,
            0x1C,
            0x1C,
            0x20,
            0x24,
            0x2E,
            0x27,
            0x20,
            0x22,
            0x2C,
            0x23,
            0x1C,
            0x1C,
            0x28,
            0x37,
            0x29,
            0x2C,
            0x30,
            0x31,
            0x34,
            0x34,
            0x34,
            0x1F,
            0x27,
            0x39,
            0x3D,
            0x38,
            0x32,
            0x3C,
            0x2E,
            0x33,
            0x34,
            0x32,
            0xFF,
            0xC0,
            0x00,
            0x0B,
            0x08,
            0x00,
            0x01,
            0x00,
            0x01,
            0x01,
            0x01,
            0x11,
            0x00,
            0xFF,
            0xC4,
            0x00,
            0x1F,
            0x00,
            0x00,
            0x01,
            0x05,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x01,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x09,
            0x0A,
            0x0B,
            0xFF,
            0xC4,
            0x00,
            0xB5,
            0x10,
            0x00,
            0x02,
            0x01,
            0x03,
            0x03,
            0x02,
            0x04,
            0x03,
            0x05,
            0x05,
            0x04,
            0x04,
            0x00,
            0x00,
            0x01,
            0x7D,
            0x01,
            0x02,
            0x03,
            0x00,
            0x04,
            0x11,
            0x05,
            0x12,
            0x21,
            0x31,
            0x41,
            0x06,
            0x13,
            0x51,
            0x61,
            0x07,
            0x22,
            0x71,
            0x14,
            0x32,
            0x81,
            0x91,
            0xA1,
            0x08,
            0x23,
            0x42,
            0xB1,
            0xC1,
            0x15,
            0x52,
            0xD1,
            0xF0,
            0x24,
            0x33,
            0x62,
            0x72,
            0x82,
            0x09,
            0x0A,
            0x16,
            0x17,
            0x18,
            0x19,
            0x1A,
            0x25,
            0x26,
            0x27,
            0x28,
            0x29,
            0x2A,
            0x34,
            0x35,
            0x36,
            0x37,
            0x38,
            0x39,
            0x3A,
            0x43,
            0x44,
            0x45,
            0x46,
            0x47,
            0x48,
            0x49,
            0x4A,
            0x53,
            0x54,
            0x55,
            0x56,
            0x57,
            0x58,
            0x59,
            0x5A,
            0x63,
            0x64,
            0x65,
            0x66,
            0x67,
            0x68,
            0x69,
            0x6A,
            0x73,
            0x74,
            0x75,
            0x76,
            0x77,
            0x78,
            0x79,
            0x7A,
            0x83,
            0x84,
            0x85,
            0x86,
            0x87,
            0x88,
            0x89,
            0x8A,
            0x92,
            0x93,
            0x94,
            0x95,
            0x96,
            0x97,
            0x98,
            0x99,
            0x9A,
            0xA2,
            0xA3,
            0xA4,
            0xA5,
            0xA6,
            0xA7,
            0xA8,
            0xA9,
            0xAA,
            0xB2,
            0xB3,
            0xB4,
            0xB5,
            0xB6,
            0xB7,
            0xB8,
            0xB9,
            0xBA,
            0xC2,
            0xC3,
            0xC4,
            0xC5,
            0xC6,
            0xC7,
            0xC8,
            0xC9,
            0xCA,
            0xD2,
            0xD3,
            0xD4,
            0xD5,
            0xD6,
            0xD7,
            0xD8,
            0xD9,
            0xDA,
            0xE1,
            0xE2,
            0xE3,
            0xE4,
            0xE5,
            0xE6,
            0xE7,
            0xE8,
            0xE9,
            0xEA,
            0xF1,
            0xF2,
            0xF3,
            0xF4,
            0xF5,
            0xF6,
            0xF7,
            0xF8,
            0xF9,
            0xFA,
            0xFF,
            0xDA,
            0x00,
            0x08,
            0x01,
            0x01,
            0x00,
            0x00,
            0x3F,
            0x00,
            0xFB,
            0xD5,
            0xDB,
            0x20,
            0xA8,
            0xA8,
            0x02,
            0x8A,
            0x28,
            0x03,
            0xFF,
            0xD9,
        ]
    )
    with open(os.path.join(temp_dir, "media", "photo.jpg"), "wb") as f:
        f.write(jpeg_data)

    # Create a minimal PDF file
    pdf_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
196
%%EOF
"""
    with open(os.path.join(temp_dir, "documents", "document.pdf"), "wb") as f:
        f.write(pdf_content)

    # Create another unstructured file in data directory
    with open(os.path.join(temp_dir, "data", "archive.zip"), "wb") as f:
        # Minimal ZIP file (empty archive)
        f.write(
            bytes(
                [
                    0x50,
                    0x4B,
                    0x05,
                    0x06,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                    0x00,
                ]
            )
        )

    return temp_dir


@pytest.fixture(scope="module")
def metadata():
    """Return admin metadata client"""
    return int_admin_ometa()


@pytest.fixture(scope="module")
def service_name():
    """Generate unique service name"""
    return f"sftp_test_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="package")
def sftp_container():
    """Create and start SFTP container"""
    config = SftpContainerConfig(
        container_name=f"sftp-test-{uuid.uuid4().hex[:8]}",
        upload_dir="upload",
    )
    container = get_sftp_container(config)

    with container:
        wait_for_logs(container, "Server listening on", timeout=60)
        yield container


@pytest.fixture(scope="module")
def test_data_dir():
    """Create test data directory"""
    temp_dir = create_test_data_directory()
    yield temp_dir
    import shutil

    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture(scope="module")
def upload_test_data(sftp_container, test_data_dir):
    """Upload test data to SFTP container"""
    upload_test_data_to_sftp(
        sftp_container,
        test_data_dir,
        f"/{sftp_container.config.upload_dir}",
    )
    yield


@pytest.fixture(scope="module")
def ingest_sftp(sftp_container, metadata, service_name, upload_test_data):
    """Run SFTP ingestion workflow"""
    host = sftp_container.get_container_host_ip()
    port = sftp_container.get_exposed_port(sftp_container.config.port)

    config = f"""
source:
  type: Sftp
  serviceName: {service_name}
  serviceConnection:
    config:
      type: Sftp
      host: {host}
      port: {port}
      authType:
        username: {sftp_container.config.username}
        password: {sftp_container.config.password}
      rootDirectories:
        - /{sftp_container.config.upload_dir}
  sourceConfig:
    config:
      type: DriveMetadata
      includeDirectories: true
      includeFiles: true
      markDeletedDirectories: true
      markDeletedFiles: true
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

    workflow_config = yaml.safe_load(config)

    # Run workflow multiple times to handle nested directories and files
    # Run 1: Creates top-level directories (data, documents, media, empty_dir)
    # Run 2: Creates level 2 directories (nested)
    # Run 3: Creates level 3 directories (level2)
    # Run 4: Creates level 4 directories (level3)
    # Run 5: Creates files (in all directories including deeply nested)
    # (bulk API may process entities out of order within a batch)
    for run in range(5):
        workflow = MetadataWorkflow.create(workflow_config)
        workflow.execute()
        workflow.print_status()
        workflow.stop()

    yield workflow

    service: DriveService = metadata.get_by_name(entity=DriveService, fqn=service_name)
    if service:
        metadata.delete(
            entity=DriveService, entity_id=service.id, hard_delete=True, recursive=True
        )


@pytest.fixture(scope="module")
def service_name_structured():
    """Generate unique service name for structured-only test"""
    return f"sftp_structured_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def ingest_sftp_structured_only(
    sftp_container, metadata, service_name_structured, upload_test_data
):
    """Run SFTP ingestion workflow with structuredDataFilesOnly enabled"""
    host = sftp_container.get_container_host_ip()
    port = sftp_container.get_exposed_port(sftp_container.config.port)

    config = f"""
source:
  type: Sftp
  serviceName: {service_name_structured}
  serviceConnection:
    config:
      type: Sftp
      host: {host}
      port: {port}
      authType:
        username: {sftp_container.config.username}
        password: {sftp_container.config.password}
      rootDirectories:
        - /{sftp_container.config.upload_dir}
      structuredDataFilesOnly: true
  sourceConfig:
    config:
      type: DriveMetadata
      includeDirectories: true
      includeFiles: true
      markDeletedDirectories: true
      markDeletedFiles: true
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

    workflow_config = yaml.safe_load(config)

    # Run workflow multiple times to handle nested directories and files
    for run in range(5):
        workflow = MetadataWorkflow.create(workflow_config)
        workflow.execute()
        workflow.print_status()
        workflow.stop()

    yield workflow

    service: DriveService = metadata.get_by_name(
        entity=DriveService, fqn=service_name_structured
    )
    if service:
        metadata.delete(
            entity=DriveService, entity_id=service.id, hard_delete=True, recursive=True
        )
