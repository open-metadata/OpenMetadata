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
Test looker utils
"""
import os
import shutil
from unittest import TestCase
from unittest.mock import patch

from git import Repo

from metadata.generated.schema.entity.services.connections.dashboard.lookerConnection import (
    NoGitCredentials,
)
from metadata.generated.schema.security.credentials.bitbucketCredentials import (
    BitBucketCredentials,
)
from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.generated.schema.security.credentials.gitlabCredentials import (
    GitlabCredentials,
)
from metadata.ingestion.source.dashboard.looker.utils import (
    _clone_repo,
    _extract_hostname,
    _is_azure_devops_host,
)


class LookerUtilsTest(TestCase):
    """
    Test looker utils functions
    """

    def test_extract_hostname(self):
        """
        Test _extract_hostname function with various URL formats
        """
        # Test with https protocol
        self.assertEqual(_extract_hostname("https://github.com"), "github.com")
        self.assertEqual(
            _extract_hostname("https://git.company.com"), "git.company.com"
        )
        self.assertEqual(
            _extract_hostname("https://gitlab.example.org"), "gitlab.example.org"
        )

        # Test with http protocol
        self.assertEqual(
            _extract_hostname("http://internal-git.company.com"),
            "internal-git.company.com",
        )

        # Test with no protocol (should return as-is)
        self.assertEqual(_extract_hostname("git.company.com"), "git.company.com")

        # Test with port numbers
        self.assertEqual(
            _extract_hostname("https://git.company.com:8080"), "git.company.com:8080"
        )
        self.assertEqual(_extract_hostname("http://localhost:3000"), "localhost:3000")

    def test_is_azure_devops_host(self):
        """
        Test _is_azure_devops_host function
        """
        self.assertTrue(_is_azure_devops_host("dev.azure.com"))
        self.assertTrue(_is_azure_devops_host("myorg.visualstudio.com"))
        self.assertFalse(_is_azure_devops_host("github.com"))
        self.assertFalse(_is_azure_devops_host("gitlab.com"))
        self.assertFalse(_is_azure_devops_host("bitbucket.org"))

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_github_default_url(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with GitHub credentials using default URL
        """
        mock_isdir.return_value = False

        github_creds = GitHubCredentials(
            repositoryOwner="owner", repositoryName="repo", token="test_token"
        )

        _clone_repo("owner/repo", "/test/path", github_creds)

        expected_url = "https://x-oauth-basic:test_token@github.com/owner/repo.git"
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_github_custom_url(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with GitHub credentials using custom gitHostURL
        """
        mock_isdir.return_value = False

        github_creds = GitHubCredentials(
            repositoryOwner="owner",
            repositoryName="repo",
            token="test_token",
            gitHostURL="https://git.company.com",
        )

        _clone_repo("owner/repo", "/test/path", github_creds)

        expected_url = "https://x-oauth-basic:test_token@git.company.com/owner/repo.git"
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_azure_devops(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with GitHub credentials using Azure DevOps host.
        Users configure repositoryOwner as {org}/{project} and repositoryName as {repo}.
        The clone URL should follow Azure DevOps format: https://{PAT}@dev.azure.com/{org}/{project}/_git/{repo}
        """
        mock_isdir.return_value = False

        azure_creds = GitHubCredentials(
            repositoryOwner="payoneer/data-platform",
            repositoryName="Looker_Custom_Queries",
            token="my_pat_token",
            gitHostURL="https://dev.azure.com",
        )

        # repo_name passed from __init_repo: "{repositoryOwner}/{repositoryName}"
        _clone_repo(
            "payoneer/data-platform/Looker_Custom_Queries", "/test/path", azure_creds
        )

        expected_url = "https://my_pat_token@dev.azure.com/payoneer/data-platform/_git/Looker_Custom_Queries"
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_azure_devops_server(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with Azure DevOps Server (visualstudio.com)
        """
        mock_isdir.return_value = False

        azure_creds = GitHubCredentials(
            repositoryOwner="myorg/myproject",
            repositoryName="MyRepo",
            token="my_pat_token",
            gitHostURL="https://myorg.visualstudio.com",
        )

        _clone_repo("myorg/myproject/MyRepo", "/test/path", azure_creds)

        expected_url = (
            "https://my_pat_token@myorg.visualstudio.com/myorg/myproject/_git/MyRepo"
        )
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_gitlab_default_url(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with GitLab credentials using default URL
        """
        mock_isdir.return_value = False

        gitlab_creds = GitlabCredentials(
            repositoryOwner="owner", repositoryName="repo", token="test_token"
        )

        _clone_repo("owner/repo", "/test/path", gitlab_creds)

        expected_url = "https://x-token-auth:test_token@gitlab.com/owner/repo.git"
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_gitlab_custom_url(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with GitLab credentials using custom gitHostURL
        """
        mock_isdir.return_value = False

        gitlab_creds = GitlabCredentials(
            repositoryOwner="owner",
            repositoryName="repo",
            token="test_token",
            gitHostURL="https://gitlab.internal.company.com",
        )

        _clone_repo("owner/repo", "/test/path", gitlab_creds)

        expected_url = (
            "https://x-token-auth:test_token@gitlab.internal.company.com/owner/repo.git"
        )
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_bitbucket_default_url(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with BitBucket credentials using default URL
        """
        mock_isdir.return_value = False

        bitbucket_creds = BitBucketCredentials(
            repositoryOwner="owner",
            repositoryName="repo",
            token="test_token",
            branch="main",
        )

        _clone_repo("owner/repo", "/test/path", bitbucket_creds)

        expected_url = "https://x-token-auth:test_token@bitbucket.org/owner/repo.git"
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=True
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_bitbucket_custom_url(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with BitBucket credentials using custom gitHostURL
        """
        mock_isdir.return_value = False

        bitbucket_creds = BitBucketCredentials(
            repositoryOwner="owner",
            repositoryName="repo",
            token="test_token",
            branch="main",
            gitHostURL="https://bitbucket.company.com",
        )

        _clone_repo("owner/repo", "/test/path", bitbucket_creds)

        expected_url = (
            "https://x-token-auth:test_token@bitbucket.company.com/owner/repo.git"
        )
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=True
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_custom_url_with_port(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with custom URL including port number
        """
        mock_isdir.return_value = False

        github_creds = GitHubCredentials(
            repositoryOwner="owner",
            repositoryName="repo",
            token="test_token",
            gitHostURL="https://git.company.com:8080",
        )

        _clone_repo("owner/repo", "/test/path", github_creds)

        expected_url = (
            "https://x-oauth-basic:test_token@git.company.com:8080/owner/repo.git"
        )
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_http_protocol(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with custom URL using HTTP protocol
        """
        mock_isdir.return_value = False

        github_creds = GitHubCredentials(
            repositoryOwner="owner",
            repositoryName="repo",
            token="test_token",
            gitHostURL="http://internal-git.company.com",
        )

        _clone_repo("owner/repo", "/test/path", github_creds)

        expected_url = (
            "https://x-oauth-basic:test_token@internal-git.company.com/owner/repo.git"
        )
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(os.path, "isdir")
    def test_clone_repo_directory_exists(self, mock_isdir):
        """
        Test _clone_repo when directory already exists
        """
        mock_isdir.return_value = True

        github_creds = GitHubCredentials(
            repositoryOwner="owner", repositoryName="repo", token="test_token"
        )

        with patch.object(Repo, "clone_from") as mock_clone_from:
            _clone_repo("owner/repo", "/test/path", github_creds)
            mock_clone_from.assert_not_called()

    @patch.object(shutil, "rmtree")
    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_overwrite(self, mock_isdir, mock_clone_from, mock_rmtree):
        """
        Test _clone_repo with overwrite=True
        """
        # The rmtree call will remove the directory, so isdir should return False after rmtree is called
        mock_isdir.return_value = False

        github_creds = GitHubCredentials(
            repositoryOwner="owner", repositoryName="repo", token="test_token"
        )

        _clone_repo("owner/repo", "/test/path", github_creds, overwrite=True)

        mock_rmtree.assert_called_once_with("/test/path", ignore_errors=True)
        expected_url = "https://x-oauth-basic:test_token@github.com/owner/repo.git"
        mock_clone_from.assert_called_once_with(
            expected_url, "/test/path", allow_unsafe_protocols=False
        )

    @patch.object(Repo, "clone_from")
    @patch.object(os.path, "isdir")
    def test_clone_repo_no_git_credentials(self, mock_isdir, mock_clone_from):
        """
        Test _clone_repo with NoGitCredentials should handle gracefully without throwing assertion
        """
        mock_isdir.return_value = False

        no_git_creds = NoGitCredentials()

        # Should not raise an exception, but should log an error and not call clone_from
        _clone_repo("owner/repo", "/test/path", no_git_creds)
        mock_clone_from.assert_not_called()
