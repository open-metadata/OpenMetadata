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
Test looker local repository path support
"""
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    LocalRepositoryPath,
)
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource


class LookerLocalRepoTest(TestCase):
    """
    Test looker local repository path functionality
    """

    def test_init_repo_with_local_path(self):
        """
        Test _LookerSource__init_repo with LocalRepositoryPath
        """
        local_path = Path("/tmp/test-repo")
        local_repo_creds = LocalRepositoryPath(root=str(local_path))

        repos = LookerSource._LookerSource__init_repo(local_repo_creds)

        self.assertIsInstance(repos, list)
        self.assertEqual(len(repos), 1)
        self.assertEqual(repos[0].name, "test-repo")
        self.assertEqual(repos[0].path, str(local_path))

    @patch("pathlib.Path.is_file")
    @patch("lkml.load")
    @patch("builtins.open")
    @patch("pathlib.Path.exists")
    def test_read_manifest_with_local_path_no_remote_deps(
        self, mock_exists, mock_open, mock_lkml_load, mock_isfile
    ):
        """
        Test __read_manifest with LocalRepositoryPath and no remote dependencies
        """
        # Mock file operations
        mock_isfile.return_value = True
        mock_lkml_load.return_value = {"name": "test"}  # Mock parsed LookML content

        # Create LookerSource instance with mocked repo
        with patch.object(LookerSource, "_LookerSource__init_repo") as mock_init_repo:
            from metadata.ingestion.source.dashboard.looker.models import LookMLRepo

            mock_repo = LookMLRepo(name="test", path="/tmp/test-repo")
            mock_init_repo.return_value = [mock_repo]

            source = LookerSource.__new__(LookerSource)
            source._main_lookml_repo = mock_repo

            local_repo_creds = LocalRepositoryPath(root="/tmp/test-repo")

            # This should not raise any exceptions
            manifest = source._LookerSource__read_manifest(local_repo_creds, mock_repo)

            # Verify that the manifest is processed correctly
            self.assertIsNotNone(manifest)

    @patch("pathlib.Path.is_file")
    @patch("builtins.open")
    @patch("metadata.ingestion.source.dashboard.looker.metadata.logger")
    def test_read_manifest_with_local_path_missing_file(
        self, mock_logger, mock_open, mock_isfile
    ):
        """
        Test __read_manifest with LocalRepositoryPath when manifest file is missing
        """
        # Mock file operations - manifest file doesn't exist
        mock_isfile.return_value = False

        # Create LookerSource instance with mocked repo
        with patch.object(LookerSource, "_LookerSource__init_repo") as mock_init_repo:
            from metadata.ingestion.source.dashboard.looker.models import LookMLRepo

            mock_repo = LookMLRepo(name="test", path="/tmp/test-repo")
            mock_init_repo.return_value = [mock_repo]

            source = LookerSource.__new__(LookerSource)
            source._main_lookml_repo = mock_repo

            local_repo_creds = LocalRepositoryPath(root="/tmp/test-repo")

            # This should log a warning about missing manifest file
            manifest = source._LookerSource__read_manifest(local_repo_creds, mock_repo)

            # Should return None when file doesn't exist
            self.assertIsNone(manifest)

            # Verify warning was logged about missing manifest
            mock_logger.warning.assert_called_once()
            warning_call = mock_logger.warning.call_args[0][0]
            self.assertIn("Manifest file", warning_call)
            self.assertIn("not found in local repository", warning_call)

    @patch("pathlib.Path.is_file")
    @patch("builtins.open")
    @patch("metadata.ingestion.source.dashboard.looker.metadata.logger")
    def test_read_manifest_with_local_path_remote_deps_warning(
        self, mock_logger, mock_open, mock_isfile
    ):
        """
        Test __read_manifest with LocalRepositoryPath warns about remote dependencies
        """
        # Mock file operations
        mock_isfile.return_value = True

        with patch("lkml.load") as mock_lkml_load:
            mock_lkml_load.return_value = {
                "remote_dependency": {
                    "name": "remote_project",
                    "url": "https://github.com/test/remote.git",
                }
            }

            # Create LookerSource instance with mocked repo
            with patch.object(
                LookerSource, "_LookerSource__init_repo"
            ) as mock_init_repo:
                from metadata.ingestion.source.dashboard.looker.models import LookMLRepo

                mock_repo = LookMLRepo(name="test", path="/tmp/test-repo")
                mock_init_repo.return_value = [mock_repo]

                source = LookerSource.__new__(LookerSource)
                source._main_lookml_repo = mock_repo

                local_repo_creds = LocalRepositoryPath(root="/tmp/test-repo")

                # This should log a warning about remote dependencies
                manifest = source._LookerSource__read_manifest(
                    local_repo_creds, mock_repo
                )

                # Should return the manifest despite the warning
                self.assertIsNotNone(manifest)

                # Verify warning was logged about remote dependencies
                mock_logger.warning.assert_called_once()
                warning_call = mock_logger.warning.call_args[0][0]
                self.assertIn("Remote dependency 'remote_project' found", warning_call)
                self.assertIn(
                    "remote dependencies are not automatically fetched", warning_call
                )
