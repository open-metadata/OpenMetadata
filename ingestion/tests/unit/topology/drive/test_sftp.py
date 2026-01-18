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
SFTP Source Unit Tests
"""
import stat
from collections import namedtuple
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.entity.services.connections.drive.sftpConnection import (
    BasicAuth,
    KeyAuth,
    SftpConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.ingestion.source.drive.sftp.metadata import SftpSource
from metadata.ingestion.source.drive.sftp.models import SftpDirectoryInfo, SftpFileInfo

# Mock SFTP file attributes
MockSFTPAttributes = namedtuple(
    "MockSFTPAttributes", ["filename", "st_mode", "st_size", "st_mtime"]
)

# Mock configurations
MOCK_SFTP_CONFIG = {
    "source": {
        "type": "Sftp",
        "serviceName": "sftp_test",
        "serviceConnection": {
            "config": {
                "type": "Sftp",
                "host": "localhost",
                "port": 22,
                "authType": {
                    "username": "testuser",
                    "password": "testpass",
                },
                "rootDirectories": ["/data"],
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DriveMetadata",
                "includeDirectories": True,
                "includeFiles": True,
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

MOCK_SFTP_CONFIG_KEY_AUTH = {
    "source": {
        "type": "Sftp",
        "serviceName": "sftp_test_key",
        "serviceConnection": {
            "config": {
                "type": "Sftp",
                "host": "localhost",
                "port": 2222,
                "authType": {
                    "username": "testuser",
                    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\nMIItest\n-----END RSA PRIVATE KEY-----",
                },
                "rootDirectories": ["/home/testuser"],
            }
        },
        "sourceConfig": {
            "config": {
                "type": "DriveMetadata",
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "token"},
        }
    },
}

# Mock directory listing responses
MOCK_ROOT_DIRECTORY_LISTING = [
    MockSFTPAttributes(
        filename="subdir1",
        st_mode=stat.S_IFDIR | 0o755,
        st_size=4096,
        st_mtime=1704067200,
    ),
    MockSFTPAttributes(
        filename="subdir2",
        st_mode=stat.S_IFDIR | 0o755,
        st_size=4096,
        st_mtime=1704153600,
    ),
    MockSFTPAttributes(
        filename="file1.txt",
        st_mode=stat.S_IFREG | 0o644,
        st_size=1024,
        st_mtime=1704067200,
    ),
    MockSFTPAttributes(
        filename="file2.csv",
        st_mode=stat.S_IFREG | 0o644,
        st_size=2048,
        st_mtime=1704153600,
    ),
]

MOCK_SUBDIR1_LISTING = [
    MockSFTPAttributes(
        filename="nested_dir",
        st_mode=stat.S_IFDIR | 0o755,
        st_size=4096,
        st_mtime=1704067200,
    ),
    MockSFTPAttributes(
        filename="data.json",
        st_mode=stat.S_IFREG | 0o644,
        st_size=512,
        st_mtime=1704067200,
    ),
]

MOCK_SUBDIR2_LISTING = [
    MockSFTPAttributes(
        filename="report.pdf",
        st_mode=stat.S_IFREG | 0o644,
        st_size=10240,
        st_mtime=1704153600,
    ),
]

MOCK_NESTED_DIR_LISTING = [
    MockSFTPAttributes(
        filename="deep_file.txt",
        st_mode=stat.S_IFREG | 0o644,
        st_size=256,
        st_mtime=1704067200,
    ),
]


def get_mock_listdir_attr(path):
    """Return mock listing based on path"""
    listings = {
        "/data": MOCK_ROOT_DIRECTORY_LISTING,
        "/data/subdir1": MOCK_SUBDIR1_LISTING,
        "/data/subdir2": MOCK_SUBDIR2_LISTING,
        "/data/subdir1/nested_dir": MOCK_NESTED_DIR_LISTING,
    }
    return listings.get(path, [])


class TestSftpModels(TestCase):
    """Test SFTP model classes"""

    def test_sftp_directory_info(self):
        """Test SftpDirectoryInfo model"""
        dir_info = SftpDirectoryInfo(
            name="test_dir",
            full_path="/data/test_dir",
            parents=["data"],
            modified_time=1704067200.0,
            path=["data", "test_dir"],
        )
        self.assertEqual(dir_info.name, "test_dir")
        self.assertEqual(dir_info.full_path, "/data/test_dir")
        self.assertEqual(dir_info.parents, ["data"])
        self.assertEqual(dir_info.path, ["data", "test_dir"])

    def test_sftp_file_info(self):
        """Test SftpFileInfo model"""
        file_info = SftpFileInfo(
            name="test.txt",
            full_path="/data/test.txt",
            size=1024,
            modified_time=1704067200.0,
            mime_type="text/plain",
        )
        self.assertEqual(file_info.name, "test.txt")
        self.assertEqual(file_info.full_path, "/data/test.txt")
        self.assertEqual(file_info.size, 1024)
        self.assertEqual(file_info.mime_type, "text/plain")


class TestSftpConnection(TestCase):
    """Test SFTP connection configuration"""

    def test_basic_auth_config(self):
        """Test BasicAuth configuration"""
        auth = BasicAuth(username="testuser", password="testpass")
        self.assertEqual(auth.username, "testuser")
        self.assertEqual(auth.password.get_secret_value(), "testpass")

    def test_key_auth_config(self):
        """Test KeyAuth configuration"""
        auth = KeyAuth(
            username="testuser",
            privateKey="-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
            privateKeyPassphrase="passphrase",
        )
        self.assertEqual(auth.username, "testuser")
        self.assertIn("RSA PRIVATE KEY", auth.privateKey.get_secret_value())
        self.assertEqual(auth.privateKeyPassphrase.get_secret_value(), "passphrase")

    def test_sftp_connection_config(self):
        """Test SftpConnection configuration"""
        config = SftpConnection(
            host="localhost",
            port=22,
            authType=BasicAuth(username="user", password="pass"),
            rootDirectories=["/data", "/home"],
        )
        self.assertEqual(config.host, "localhost")
        self.assertEqual(config.port, 22)
        self.assertEqual(config.rootDirectories, ["/data", "/home"])


class TestSftpSource(TestCase):
    """Test SFTP Source class"""

    @patch(
        "metadata.ingestion.source.drive.drive_service.DriveServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.drive.sftp.metadata.get_connection")
    def setUp(self, mock_get_connection, mock_test_connection):
        """Set up test fixtures"""
        mock_test_connection.return_value = False

        # Create mock SFTP client
        self.mock_sftp = MagicMock()
        self.mock_transport = MagicMock()
        self.mock_client = MagicMock()
        self.mock_client.sftp = self.mock_sftp
        self.mock_client.transport = self.mock_transport
        mock_get_connection.return_value = self.mock_client

        # Set up mock listdir_attr
        self.mock_sftp.listdir_attr = get_mock_listdir_attr

        # Create source
        config = OpenMetadataWorkflowConfig.model_validate(MOCK_SFTP_CONFIG)
        self.sftp_source = SftpSource.create(
            MOCK_SFTP_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

        # Mock context
        mock_context = MagicMock()
        mock_context.get.return_value = MagicMock(
            drive_service="sftp_test",
            directory=None,
        )
        self.sftp_source.context = mock_context
        self.sftp_source.metadata = MagicMock()

    def test_create_from_valid_config(self):
        """Test source creation with valid config"""
        self.assertIsNotNone(self.sftp_source)
        self.assertEqual(self.sftp_source.service_connection.host, "localhost")
        self.assertEqual(self.sftp_source.service_connection.port, 22)

    def test_build_directory_path(self):
        """Test directory path building"""
        path = self.sftp_source._build_directory_path("/data/subdir1/nested")
        self.assertEqual(path, ["data", "subdir1", "nested"])

        path_empty = self.sftp_source._build_directory_path("/")
        self.assertEqual(path_empty, [])

    def test_fetch_directories(self):
        """Test directory fetching"""
        self.sftp_source._fetch_directories()

        self.assertIn("/data/subdir1", self.sftp_source._directories_cache)
        self.assertIn("/data/subdir2", self.sftp_source._directories_cache)
        self.assertIn("/data/subdir1/nested_dir", self.sftp_source._directories_cache)

        subdir1 = self.sftp_source._directories_cache["/data/subdir1"]
        self.assertEqual(subdir1.name, "subdir1")
        self.assertEqual(subdir1.path, ["data", "subdir1"])

    def test_fetch_all_files(self):
        """Test file fetching"""
        self.sftp_source._fetch_directories()

        self.assertIn("/data/subdir1", self.sftp_source._files_by_parent_cache)
        self.assertIn("/data/subdir2", self.sftp_source._files_by_parent_cache)

        subdir1_files = self.sftp_source._files_by_parent_cache["/data/subdir1"]
        self.assertEqual(len(subdir1_files), 1)
        self.assertEqual(subdir1_files[0].name, "data.json")

        subdir2_files = self.sftp_source._files_by_parent_cache["/data/subdir2"]
        self.assertEqual(len(subdir2_files), 1)
        self.assertEqual(subdir2_files[0].name, "report.pdf")

    def test_sort_directories_by_hierarchy(self):
        """Test hierarchical directory sorting"""
        self.sftp_source._fetch_directories()
        sorted_dirs = self.sftp_source._sort_directories_by_hierarchy()

        subdir1_idx = sorted_dirs.index("/data/subdir1")
        nested_idx = sorted_dirs.index("/data/subdir1/nested_dir")
        self.assertLess(subdir1_idx, nested_idx)

    def test_get_spreadsheets_list_returns_empty(self):
        """Test that SFTP does not support spreadsheets"""
        result = list(self.sftp_source.get_spreadsheets_list())
        self.assertEqual(result, [])

    def test_get_spreadsheet_name_returns_empty(self):
        """Test spreadsheet name returns empty string"""
        result = self.sftp_source.get_spreadsheet_name(None)
        self.assertEqual(result, "")

    def test_get_spreadsheet_details_returns_none(self):
        """Test spreadsheet details returns None"""
        result = self.sftp_source.get_spreadsheet_details(None)
        self.assertIsNone(result)

    def test_yield_spreadsheet_returns_empty(self):
        """Test yield_spreadsheet returns empty iterator"""
        result = list(self.sftp_source.yield_spreadsheet(None))
        self.assertEqual(result, [])

    def test_yield_worksheet_returns_empty(self):
        """Test yield_worksheet returns empty iterator"""
        result = list(self.sftp_source.yield_worksheet(None))
        self.assertEqual(result, [])

    def test_close(self):
        """Test source close cleans up resources"""
        self.sftp_source._directories_cache = {"/test": MagicMock()}
        self.sftp_source._files_by_parent_cache = {"/test": []}
        self.sftp_source._directory_fqn_cache = {"/test": "fqn"}

        self.sftp_source.close()

        self.assertEqual(self.sftp_source._directories_cache, {})
        self.assertEqual(self.sftp_source._files_by_parent_cache, {})
        self.assertEqual(self.sftp_source._directory_fqn_cache, {})
        self.mock_client.close.assert_called_once()


class TestSftpConnectionModule(TestCase):
    """Test SFTP connection module functions"""

    @patch("metadata.ingestion.source.drive.sftp.connection.Transport")
    @patch("metadata.ingestion.source.drive.sftp.connection.SFTPClient")
    def test_get_connection_basic_auth(self, mock_sftp_client, mock_transport):
        """Test get_connection with basic auth"""
        from metadata.ingestion.source.drive.sftp.connection import get_connection

        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance
        mock_sftp_instance = MagicMock()
        mock_sftp_client.from_transport.return_value = mock_sftp_instance

        connection = SftpConnection(
            host="localhost",
            port=22,
            authType=BasicAuth(username="user", password="pass"),
        )

        client = get_connection(connection)

        mock_transport.assert_called_once_with(("localhost", 22))
        mock_transport_instance.connect.assert_called_once_with(
            username="user", password="pass"
        )
        self.assertEqual(client.sftp, mock_sftp_instance)
        self.assertEqual(client.transport, mock_transport_instance)

    @patch("metadata.ingestion.source.drive.sftp.connection._parse_private_key")
    @patch("metadata.ingestion.source.drive.sftp.connection.Transport")
    @patch("metadata.ingestion.source.drive.sftp.connection.SFTPClient")
    def test_get_connection_key_auth(
        self, mock_sftp_client, mock_transport, mock_parse_key
    ):
        """Test get_connection with key auth"""
        from metadata.ingestion.source.drive.sftp.connection import get_connection

        mock_transport_instance = MagicMock()
        mock_transport.return_value = mock_transport_instance
        mock_sftp_instance = MagicMock()
        mock_sftp_client.from_transport.return_value = mock_sftp_instance
        mock_pkey = MagicMock()
        mock_parse_key.return_value = mock_pkey

        connection = SftpConnection(
            host="localhost",
            port=2222,
            authType=KeyAuth(
                username="user",
                privateKey="-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
            ),
        )

        client = get_connection(connection)

        mock_transport.assert_called_once_with(("localhost", 2222))
        mock_transport_instance.connect.assert_called_once_with(
            username="user", pkey=mock_pkey
        )

    @patch("metadata.ingestion.source.drive.sftp.connection.paramiko")
    def test_parse_private_key_rsa(self, mock_paramiko):
        """Test parsing RSA private key"""
        from metadata.ingestion.source.drive.sftp.connection import _parse_private_key

        mock_rsa_key = MagicMock()
        mock_paramiko.RSAKey.from_private_key.return_value = mock_rsa_key

        key_content = (
            "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----"
        )
        result = _parse_private_key(key_content)

        self.assertEqual(result, mock_rsa_key)

    @patch("metadata.ingestion.source.drive.sftp.connection.paramiko")
    def test_parse_private_key_invalid(self, mock_paramiko):
        """Test parsing invalid private key returns None"""
        from metadata.ingestion.source.drive.sftp.connection import _parse_private_key

        mock_paramiko.RSAKey.from_private_key.side_effect = Exception("Invalid key")
        mock_paramiko.Ed25519Key.from_private_key.side_effect = Exception("Invalid key")
        mock_paramiko.ECDSAKey.from_private_key.side_effect = Exception("Invalid key")
        mock_paramiko.DSSKey.from_private_key.side_effect = Exception("Invalid key")

        result = _parse_private_key("invalid key content")

        self.assertIsNone(result)


class TestCsvExtraction(TestCase):
    """Test CSV schema extraction functionality"""

    @patch(
        "metadata.ingestion.source.drive.drive_service.DriveServiceSource.test_connection"
    )
    @patch("metadata.ingestion.source.drive.sftp.metadata.get_connection")
    def setUp(self, mock_get_connection, mock_test_connection):
        """Set up test fixtures"""
        mock_test_connection.return_value = False

        self.mock_sftp = MagicMock()
        self.mock_transport = MagicMock()
        self.mock_client = MagicMock()
        self.mock_client.sftp = self.mock_sftp
        self.mock_client.transport = self.mock_transport
        mock_get_connection.return_value = self.mock_client

        self.mock_sftp.listdir_attr = get_mock_listdir_attr

        config = OpenMetadataWorkflowConfig.model_validate(MOCK_SFTP_CONFIG)
        self.sftp_source = SftpSource.create(
            MOCK_SFTP_CONFIG["source"],
            config.workflowConfig.openMetadataServerConfig,
        )

    def test_is_csv_file(self):
        """Test CSV file detection"""
        self.assertTrue(self.sftp_source._is_csv_file("data.csv"))
        self.assertTrue(self.sftp_source._is_csv_file("DATA.CSV"))
        self.assertTrue(self.sftp_source._is_csv_file("users.tsv"))
        self.assertTrue(self.sftp_source._is_csv_file("USERS.TSV"))
        self.assertFalse(self.sftp_source._is_csv_file("image.png"))
        self.assertFalse(self.sftp_source._is_csv_file("document.pdf"))

    def test_get_csv_separator(self):
        """Test separator detection based on file extension"""
        self.assertEqual(self.sftp_source._get_csv_separator("data.csv"), ",")
        self.assertEqual(self.sftp_source._get_csv_separator("data.CSV"), ",")
        self.assertEqual(self.sftp_source._get_csv_separator("users.tsv"), "\t")
        self.assertEqual(self.sftp_source._get_csv_separator("users.TSV"), "\t")

    def test_extract_csv_schema_success(self):
        """Test successful CSV schema extraction"""
        csv_content = b"id,name,value\n1,test,100\n2,demo,200\n"

        mock_file = MagicMock()
        mock_file.read.return_value = csv_content
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)

        self.mock_sftp.open.return_value = mock_file

        columns, sample_data = self.sftp_source._extract_csv_schema(
            "/data/test.csv", "test.csv"
        )

        self.assertIsNotNone(columns)
        self.assertEqual(len(columns), 3)

        column_names = [col.name.root for col in columns]
        self.assertIn("id", column_names)
        self.assertIn("name", column_names)
        self.assertIn("value", column_names)

        self.assertIsNotNone(sample_data)
        self.assertEqual(len(sample_data.columns), 3)
        self.assertEqual(len(sample_data.rows), 2)

    def test_extract_csv_schema_empty_file(self):
        """Test CSV extraction with empty file"""
        csv_content = b""

        mock_file = MagicMock()
        mock_file.read.return_value = csv_content
        mock_file.__enter__ = MagicMock(return_value=mock_file)
        mock_file.__exit__ = MagicMock(return_value=False)

        self.mock_sftp.open.return_value = mock_file

        columns, sample_data = self.sftp_source._extract_csv_schema(
            "/data/empty.csv", "empty.csv"
        )

        self.assertIsNone(columns)
        self.assertIsNone(sample_data)

    def test_extract_csv_schema_error(self):
        """Test CSV extraction handles errors gracefully"""
        self.mock_sftp.open.side_effect = IOError("File not found")

        columns, sample_data = self.sftp_source._extract_csv_schema(
            "/data/missing.csv", "missing.csv"
        )

        self.assertIsNone(columns)
        self.assertIsNone(sample_data)

    def test_is_structured_data_file(self):
        """Test structured data file detection"""
        self.assertTrue(self.sftp_source._is_structured_data_file("data.csv"))
        self.assertTrue(self.sftp_source._is_structured_data_file("data.tsv"))
        self.assertTrue(self.sftp_source._is_structured_data_file("data.json"))
        self.assertTrue(self.sftp_source._is_structured_data_file("data.jsonl"))
        self.assertTrue(self.sftp_source._is_structured_data_file("data.parquet"))
        self.assertTrue(self.sftp_source._is_structured_data_file("data.avro"))
        self.assertFalse(self.sftp_source._is_structured_data_file("image.png"))
        self.assertFalse(self.sftp_source._is_structured_data_file("document.pdf"))
        self.assertFalse(self.sftp_source._is_structured_data_file("video.mp4"))
        self.assertFalse(self.sftp_source._is_structured_data_file("archive.zip"))


class TestConfigOptions(TestCase):
    """Test configuration options for SFTP connector"""

    def test_structured_data_files_only_default(self):
        """Test structuredDataFilesOnly defaults to False"""
        connection = SftpConnection(
            host="localhost",
            authType=BasicAuth(username="user", password="pass"),
        )
        self.assertFalse(connection.structuredDataFilesOnly)

    def test_structured_data_files_only_enabled(self):
        """Test structuredDataFilesOnly can be enabled"""
        connection = SftpConnection(
            host="localhost",
            authType=BasicAuth(username="user", password="pass"),
            structuredDataFilesOnly=True,
        )
        self.assertTrue(connection.structuredDataFilesOnly)

    def test_extract_sample_data_default(self):
        """Test extractSampleData defaults to False"""
        connection = SftpConnection(
            host="localhost",
            authType=BasicAuth(username="user", password="pass"),
        )
        self.assertFalse(connection.extractSampleData)

    def test_extract_sample_data_enabled(self):
        """Test extractSampleData can be enabled"""
        connection = SftpConnection(
            host="localhost",
            authType=BasicAuth(username="user", password="pass"),
            extractSampleData=True,
        )
        self.assertTrue(connection.extractSampleData)

    def test_both_options_enabled(self):
        """Test both options can be enabled together"""
        connection = SftpConnection(
            host="localhost",
            authType=BasicAuth(username="user", password="pass"),
            structuredDataFilesOnly=True,
            extractSampleData=True,
        )
        self.assertTrue(connection.structuredDataFilesOnly)
        self.assertTrue(connection.extractSampleData)
