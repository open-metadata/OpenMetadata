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
SFTP connection and helpers
"""
import io
import traceback
from dataclasses import dataclass
from typing import Optional

import paramiko
from paramiko import SFTPClient, Transport

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.drive.sftpConnection import (
    BasicAuth,
    KeyAuth,
    SftpConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


@dataclass
class SftpClient:
    """
    Wrapper around SFTP client and transport
    """

    sftp: SFTPClient
    transport: Transport

    def close(self):
        """Close SFTP connection"""
        try:
            self.sftp.close()
            self.transport.close()
        except Exception as exc:
            logger.warning(f"Error closing SFTP connection: {exc}")


def get_connection(connection: SftpConnection) -> SftpClient:
    """
    Create connection to SFTP server
    """
    transport = None
    try:
        transport = Transport((connection.host, connection.port or 22))

        auth_type = connection.authType

        if isinstance(auth_type, BasicAuth):
            password = (
                auth_type.password.get_secret_value() if auth_type.password else None
            )
            transport.connect(
                username=auth_type.username,
                password=password,
            )
        elif isinstance(auth_type, KeyAuth):
            private_key_str = auth_type.privateKey.get_secret_value()
            passphrase = (
                auth_type.privateKeyPassphrase.get_secret_value()
                if auth_type.privateKeyPassphrase
                else None
            )

            pkey = _parse_private_key(private_key_str, passphrase)
            if pkey is None:
                raise ValueError(
                    "Unable to parse private key. Ensure it is in PEM format "
                    "(RSA, Ed25519, ECDSA, or DSS)."
                )

            transport.connect(username=auth_type.username, pkey=pkey)
        else:
            raise ValueError(f"Unsupported authentication type: {type(auth_type)}")

        sftp_client = SFTPClient.from_transport(transport)

        return SftpClient(sftp=sftp_client, transport=transport)

    except Exception as exc:
        if transport:
            try:
                transport.close()
            except Exception:
                pass
        logger.debug(traceback.format_exc())
        raise SourceConnectionException(f"Failed to connect to SFTP server: {exc}")


def _parse_private_key(
    private_key_str: str, passphrase: Optional[str] = None
) -> Optional[paramiko.PKey]:
    """
    Parse a private key string in PEM format.
    Tries RSA, Ed25519, ECDSA, and DSS key types.
    """
    key_file = io.StringIO(private_key_str)
    key_classes = [
        paramiko.RSAKey,
        paramiko.Ed25519Key,
        paramiko.ECDSAKey,
        paramiko.DSSKey,
    ]

    for key_class in key_classes:
        try:
            key_file.seek(0)
            return key_class.from_private_key(key_file, password=passphrase)
        except Exception:
            continue

    return None


def test_connection(
    metadata: OpenMetadata,
    client: SftpClient,
    service_connection: SftpConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection to SFTP server
    """
    logger.info("Starting SFTP test connection")

    def check_access():
        """
        Check if we can access SFTP server
        """
        try:
            client.sftp.stat(".")
            logger.info("Successfully authenticated to SFTP server")
        except Exception as exc:
            logger.debug(f"Access check error traceback: {traceback.format_exc()}")
            raise SourceConnectionException(f"Failed to access SFTP server: {exc}")

    def list_directories():
        """
        Test listing root directories
        """
        try:
            logger.info("Testing SFTP directory listing")
            root_dirs = service_connection.rootDirectories or ["/"]

            for root_dir in root_dirs:
                try:
                    entries = client.sftp.listdir(root_dir)
                    logger.info(f"Found {len(entries)} entries in '{root_dir}'")
                except Exception as dir_exc:
                    logger.warning(f"Could not list directory '{root_dir}': {dir_exc}")
                    raise SourceConnectionException(
                        f"Failed to list directory '{root_dir}': {dir_exc}"
                    )

        except SourceConnectionException:
            raise
        except Exception as exc:
            logger.debug(
                f"Directory listing test error traceback: {traceback.format_exc()}"
            )
            raise SourceConnectionException(f"Failed to list directories: {exc}")

    test_fn = {
        "CheckAccess": check_access,
        "ListDirectories": list_directories,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
