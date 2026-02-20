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
SFTP integration tests
"""

from metadata.generated.schema.entity.data.directory import Directory
from metadata.generated.schema.entity.data.file import File, FileType
from metadata.generated.schema.entity.services.driveService import DriveService


class TestSftpIngestion:
    """Test SFTP ingestion workflow"""

    def test_service_created(self, metadata, ingest_sftp, service_name):
        """Test that the drive service is created"""
        service: DriveService = metadata.get_by_name(
            entity=DriveService, fqn=service_name
        )
        assert service is not None
        assert service.name.root == service_name
        assert service.serviceType.value == "Sftp"

    def test_directories_created(self, metadata, ingest_sftp, service_name):
        """Test that directories are created correctly"""
        documents_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.documents",
            fields=["*"],
        )
        assert documents_dir is not None
        assert documents_dir.name.root == "documents"

        data_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.data",
            fields=["*"],
        )
        assert data_dir is not None
        assert data_dir.name.root == "data"

    def test_nested_directories_created(self, metadata, ingest_sftp, service_name):
        """Test that nested directories are created"""
        nested_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.data.nested",
            fields=["*"],
        )
        assert nested_dir is not None
        assert nested_dir.name.root == "nested"
        assert nested_dir.parent is not None

    def test_directory_with_files_and_subdirectory(
        self, metadata, ingest_sftp, service_name
    ):
        """Test that a directory can have both files and subdirectories"""
        # data directory should exist
        data_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.data",
            fields=["*"],
        )
        assert data_dir is not None
        assert data_dir.name.root == "data"

        # Files directly in data/ should have data as their directory
        csv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."sample.csv"',
            fields=["*"],
        )
        assert csv_file is not None
        assert csv_file.directory is not None
        assert csv_file.directory.name == "data"

        # nested subdirectory should have data as parent
        nested_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.data.nested",
            fields=["*"],
        )
        assert nested_dir is not None
        assert nested_dir.parent is not None
        assert nested_dir.parent.name == "data"

        # File in nested/ should have nested as its directory
        deep_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data.nested."deep_file.txt"',
            fields=["*"],
        )
        assert deep_file is not None
        assert deep_file.directory is not None
        assert deep_file.directory.name == "nested"

    def test_files_created(self, metadata, ingest_sftp, service_name):
        """Test that files are created correctly"""
        report_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.documents."report.txt"',
            fields=["*"],
        )
        assert report_file is not None
        assert report_file.name.root == "report.txt"

        csv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."sample.csv"',
            fields=["*"],
        )
        assert csv_file is not None
        assert csv_file.name.root == "sample.csv"

    def test_file_in_nested_directory(self, metadata, ingest_sftp, service_name):
        """Test files in nested directories"""
        deep_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data.nested."deep_file.txt"',
            fields=["*"],
        )
        assert deep_file is not None
        assert deep_file.name.root == "deep_file.txt"

    def test_file_mime_types(self, metadata, ingest_sftp, service_name):
        """Test that file MIME types are detected"""
        json_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."config.json"',
            fields=["*"],
        )
        assert json_file is not None
        assert json_file.mimeType == "application/json"

        md_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.documents."notes.md"',
            fields=["*"],
        )
        assert md_file is not None
        assert md_file.mimeType == "text/markdown"

    def test_csv_file_type(self, metadata, ingest_sftp, service_name):
        """Test that CSV files have correct file type"""
        csv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."sample.csv"',
            fields=["*"],
        )
        assert csv_file is not None
        assert csv_file.fileType == FileType.CSV

    def test_csv_schema_extraction(self, metadata, ingest_sftp, service_name):
        """Test that CSV file schema is extracted correctly"""
        csv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."sample.csv"',
            fields=["columns"],
        )
        assert csv_file is not None
        assert csv_file.columns is not None
        assert len(csv_file.columns) == 5

        column_names = [col.name.root for col in csv_file.columns]
        assert "id" in column_names
        assert "name" in column_names
        assert "value" in column_names
        assert "price" in column_names
        assert "active" in column_names

    def test_tsv_file_schema(self, metadata, ingest_sftp, service_name):
        """Test that TSV files are parsed correctly"""
        tsv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."users.tsv"',
            fields=["columns"],
        )
        assert tsv_file is not None
        assert tsv_file.fileType == FileType.CSV
        assert tsv_file.columns is not None
        assert len(tsv_file.columns) == 4

        column_names = [col.name.root for col in tsv_file.columns]
        assert "user_id" in column_names
        assert "username" in column_names
        assert "email" in column_names
        assert "age" in column_names

    def test_media_directory_created(self, metadata, ingest_sftp, service_name):
        """Test that media directory is created"""
        media_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.media",
            fields=["*"],
        )
        assert media_dir is not None
        assert media_dir.name.root == "media"

    def test_unstructured_files_included(self, metadata, ingest_sftp, service_name):
        """Test that unstructured files (images, PDFs) are included when structuredDataFilesOnly is false"""
        # Check PNG file
        png_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.media."logo.png"',
            fields=["*"],
        )
        assert png_file is not None
        assert png_file.name.root == "logo.png"
        assert png_file.mimeType == "image/png"
        # Unstructured files should not have columns
        assert png_file.columns is None or len(png_file.columns) == 0

        # Check JPEG file
        jpg_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.media."photo.jpg"',
            fields=["*"],
        )
        assert jpg_file is not None
        assert jpg_file.name.root == "photo.jpg"
        assert jpg_file.mimeType == "image/jpeg"

        # Check PDF file
        pdf_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.documents."document.pdf"',
            fields=["*"],
        )
        assert pdf_file is not None
        assert pdf_file.name.root == "document.pdf"
        assert pdf_file.mimeType == "application/pdf"

        # Check ZIP file
        zip_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."archive.zip"',
            fields=["*"],
        )
        assert zip_file is not None
        assert zip_file.name.root == "archive.zip"
        assert zip_file.mimeType == "application/zip"

    def test_deeply_nested_directories(self, metadata, ingest_sftp, service_name):
        """Test deeply nested directories (3+ levels)"""
        # Level 2 directory
        level2_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.data.nested.level2",
            fields=["*"],
        )
        assert level2_dir is not None
        assert level2_dir.name.root == "level2"
        assert level2_dir.parent is not None
        assert level2_dir.parent.name == "nested"

        # Level 3 directory
        level3_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.data.nested.level2.level3",
            fields=["*"],
        )
        assert level3_dir is not None
        assert level3_dir.name.root == "level3"
        assert level3_dir.parent is not None
        assert level3_dir.parent.name == "level2"

    def test_files_in_deeply_nested_directories(
        self, metadata, ingest_sftp, service_name
    ):
        """Test files in deeply nested directories"""
        # File in level 2
        level2_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data.nested.level2."level2_file.txt"',
            fields=["*"],
        )
        assert level2_file is not None
        assert level2_file.name.root == "level2_file.txt"
        assert level2_file.directory is not None
        assert level2_file.directory.name == "level2"

        # CSV file in level 3
        level3_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data.nested.level2.level3."level3_file.csv"',
            fields=["columns"],
        )
        assert level3_file is not None
        assert level3_file.name.root == "level3_file.csv"
        assert level3_file.directory is not None
        assert level3_file.directory.name == "level3"
        # Verify schema was extracted
        assert level3_file.columns is not None
        assert len(level3_file.columns) == 3
        column_names = [col.name.root for col in level3_file.columns]
        assert "col_a" in column_names
        assert "col_b" in column_names
        assert "col_c" in column_names

    def test_empty_directory(self, metadata, ingest_sftp, service_name):
        """Test that empty directories are still created"""
        empty_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name}.empty_dir",
            fields=["*"],
        )
        assert empty_dir is not None
        assert empty_dir.name.root == "empty_dir"

    def test_root_level_file(self, metadata, ingest_sftp, service_name):
        """Test files at the root level (no parent directory)"""
        readme_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}."readme.txt"',
            fields=["*"],
        )
        assert readme_file is not None
        assert readme_file.name.root == "readme.txt"
        # Root-level files have no directory parent
        assert readme_file.directory is None

    def test_file_with_special_characters(self, metadata, ingest_sftp, service_name):
        """Test files with special characters in name (hyphens, underscores, dots)"""
        special_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."file-with_special.chars.csv"',
            fields=["columns"],
        )
        assert special_file is not None
        assert special_file.name.root == "file-with_special.chars.csv"
        assert special_file.fileType == FileType.CSV
        # Verify schema was extracted
        assert special_file.columns is not None
        assert len(special_file.columns) == 2

    def test_file_without_extension(self, metadata, ingest_sftp, service_name):
        """Test files without extension"""
        # Try without quotes first (no dots in name)
        readme_file: File = metadata.get_by_name(
            entity=File,
            fqn=f"{service_name}.documents.README",
            fields=["*"],
        )
        if readme_file is None:
            # Try with quotes
            readme_file = metadata.get_by_name(
                entity=File,
                fqn=f'{service_name}.documents."README"',
                fields=["*"],
            )
        assert readme_file is not None
        assert readme_file.name.root == "README"
        # MIME type should be None for files without extension
        assert readme_file.mimeType is None

    def test_empty_csv_file(self, metadata, ingest_sftp, service_name):
        """Test CSV file with header only (no data rows)"""
        empty_csv: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name}.data."empty_data.csv"',
            fields=["columns"],
        )
        assert empty_csv is not None
        assert empty_csv.name.root == "empty_data.csv"
        assert empty_csv.fileType == FileType.CSV
        # Schema should still be extracted from header
        assert empty_csv.columns is not None
        assert len(empty_csv.columns) == 3
        column_names = [col.name.root for col in empty_csv.columns]
        assert "header1" in column_names
        assert "header2" in column_names
        assert "header3" in column_names


class TestSftpStructuredOnly:
    """Test SFTP ingestion with structuredDataFilesOnly enabled"""

    def test_service_created(
        self, metadata, ingest_sftp_structured_only, service_name_structured
    ):
        """Test that the drive service is created"""
        service: DriveService = metadata.get_by_name(
            entity=DriveService, fqn=service_name_structured
        )
        assert service is not None
        assert service.name.root == service_name_structured

    def test_structured_files_included(
        self, metadata, ingest_sftp_structured_only, service_name_structured
    ):
        """Test that structured files (CSV, TSV, JSON) are included"""
        # CSV file should be included
        csv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.data."sample.csv"',
            fields=["columns"],
        )
        assert csv_file is not None
        assert csv_file.columns is not None
        assert len(csv_file.columns) == 5

        # TSV file should be included
        tsv_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.data."users.tsv"',
            fields=["columns"],
        )
        assert tsv_file is not None
        assert tsv_file.columns is not None

        # JSON file should be included
        json_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.data."config.json"',
            fields=["columns"],
        )
        assert json_file is not None

    def test_unstructured_files_excluded(
        self, metadata, ingest_sftp_structured_only, service_name_structured
    ):
        """Test that unstructured files (images, PDFs) are excluded"""
        # PNG file should NOT be included
        png_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.media."logo.png"',
            fields=["*"],
        )
        assert png_file is None

        # JPEG file should NOT be included
        jpg_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.media."photo.jpg"',
            fields=["*"],
        )
        assert jpg_file is None

        # PDF file should NOT be included
        pdf_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.documents."document.pdf"',
            fields=["*"],
        )
        assert pdf_file is None

        # ZIP file should NOT be included
        zip_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.data."archive.zip"',
            fields=["*"],
        )
        assert zip_file is None

        # TXT files should NOT be included (not in structured extensions)
        txt_file: File = metadata.get_by_name(
            entity=File,
            fqn=f'{service_name_structured}.documents."report.txt"',
            fields=["*"],
        )
        assert txt_file is None

    def test_directories_still_created(
        self, metadata, ingest_sftp_structured_only, service_name_structured
    ):
        """Test that directories are still created even with structuredDataFilesOnly"""
        # media directory should exist (even though its files are filtered)
        media_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name_structured}.media",
            fields=["*"],
        )
        assert media_dir is not None

        # documents directory should exist
        docs_dir: Directory = metadata.get_by_name(
            entity=Directory,
            fqn=f"{service_name_structured}.documents",
            fields=["*"],
        )
        assert docs_dir is not None


class TestSftpConnection:
    """Test SFTP connection functionality"""

    def test_connection_basic_auth(self, sftp_container):
        """Test SFTP connection with basic auth"""
        import paramiko

        host = sftp_container.get_container_host_ip()
        port = int(sftp_container.get_exposed_port(sftp_container.config.port))

        transport = paramiko.Transport((host, port))
        transport.connect(
            username=sftp_container.config.username,
            password=sftp_container.config.password,
        )
        sftp = paramiko.SFTPClient.from_transport(transport)

        try:
            entries = sftp.listdir("/")
            assert sftp_container.config.upload_dir in entries
        finally:
            sftp.close()
            transport.close()

    def test_list_directories(self, sftp_container, upload_test_data):
        """Test listing directories via SFTP"""
        import paramiko

        host = sftp_container.get_container_host_ip()
        port = int(sftp_container.get_exposed_port(sftp_container.config.port))

        transport = paramiko.Transport((host, port))
        transport.connect(
            username=sftp_container.config.username,
            password=sftp_container.config.password,
        )
        sftp = paramiko.SFTPClient.from_transport(transport)

        try:
            upload_dir = f"/{sftp_container.config.upload_dir}"
            entries = sftp.listdir(upload_dir)

            assert "documents" in entries
            assert "data" in entries
            assert "readme.txt" in entries
        finally:
            sftp.close()
            transport.close()

    def test_read_file_content(self, sftp_container, upload_test_data):
        """Test reading file content via SFTP"""
        import paramiko

        host = sftp_container.get_container_host_ip()
        port = int(sftp_container.get_exposed_port(sftp_container.config.port))

        transport = paramiko.Transport((host, port))
        transport.connect(
            username=sftp_container.config.username,
            password=sftp_container.config.password,
        )
        sftp = paramiko.SFTPClient.from_transport(transport)

        try:
            upload_dir = f"/{sftp_container.config.upload_dir}"
            with sftp.open(f"{upload_dir}/readme.txt", "r") as f:
                content = f.read()
                assert "test file" in content.decode()
        finally:
            sftp.close()
            transport.close()
