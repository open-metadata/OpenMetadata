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
Test Credentials helpers
"""
from unittest import TestCase

from metadata.generated.schema.security.credentials.bitbucketCredentials import (
    BitBucketCredentials,
)
from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.generated.schema.security.credentials.gitlabCredentials import (
    GitlabCredentials,
)
from metadata.readers.file.credentials import (
    get_credentials_from_url,
    update_repository_name,
)


class TestCreds(TestCase):
    """
    Validate credentials scenarios
    """

    def test_update_repository_name(self):
        """
        Check we get new creds without updating the original
        """

        original = GitHubCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
        )

        updated = update_repository_name(original=original, name="new_name")

        self.assertEqual(original.repositoryName.root, "name")
        self.assertEqual(updated.repositoryName.root, "new_name")
        self.assertEqual(updated.repositoryOwner.root, original.repositoryOwner.root)
        self.assertEqual(updated.token.root, original.token.root)

        bb_original = BitBucketCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
            branch="branch",
        )

        bb_updated = update_repository_name(original=bb_original, name="new_name")

        self.assertEqual(bb_original.repositoryName.root, "name")
        self.assertEqual(bb_updated.repositoryName.root, "new_name")
        self.assertEqual(
            bb_updated.repositoryOwner.root, bb_original.repositoryOwner.root
        )
        self.assertEqual(bb_updated.token.root, bb_original.token.root)
        self.assertEqual(bb_updated.branch, bb_original.branch)

        gl_original = GitlabCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
        )

        gl_updated = update_repository_name(original=gl_original, name="new_name")

        self.assertEqual(gl_original.repositoryName.root, "name")
        self.assertEqual(gl_updated.repositoryName.root, "new_name")
        self.assertEqual(
            gl_updated.repositoryOwner.root, gl_original.repositoryOwner.root
        )
        self.assertEqual(gl_updated.token.root, gl_original.token.root)

    def test_get_credentials_from_url(self):
        """
        With and without the right owner
        """
        url = "git@github.com:owner/repo.git"

        original = GitHubCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
        )

        updated = get_credentials_from_url(original=original, url=url)
        self.assertEqual(updated.repositoryName.root, "repo")

        original_not_owner = GitHubCredentials(
            repositoryOwner="not_owner",
            repositoryName="name",
            token="token",
        )

        updated_not_owner = get_credentials_from_url(
            original=original_not_owner, url=url
        )
        self.assertEqual(updated_not_owner, original_not_owner)

        bb_url = "git@gitbucket.org:owner/repo.git"

        bb_original = BitBucketCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
            branch="branch",
        )

        bb_updated = get_credentials_from_url(original=bb_original, url=bb_url)
        self.assertEqual(bb_updated.repositoryName.root, "repo")

        bb_original_not_owner = BitBucketCredentials(
            repositoryOwner="not_owner",
            repositoryName="name",
            token="token",
            branch="branch",
        )

        bb_updated_not_owner = get_credentials_from_url(
            original=bb_original_not_owner, url=bb_url
        )
        self.assertEqual(bb_updated_not_owner, bb_original_not_owner)

        gl_url = "git@gitlab.com:owner/repo.git"

        gl_original = GitlabCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
        )

        gl_updated = get_credentials_from_url(original=gl_original, url=gl_url)
        self.assertEqual(gl_updated.repositoryName.root, "repo")

        gl_original_not_owner = GitlabCredentials(
            repositoryOwner="not_owner",
            repositoryName="name",
            token="token",
        )

        gl_updated_not_owner = get_credentials_from_url(
            original=gl_original_not_owner, url=gl_url
        )
        self.assertEqual(gl_updated_not_owner, gl_original_not_owner)
