#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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

        self.assertEqual(original.repositoryName.__root__, "name")
        self.assertEqual(updated.repositoryName.__root__, "new_name")
        self.assertEqual(
            updated.repositoryOwner.__root__, original.repositoryOwner.__root__
        )
        self.assertEqual(updated.token.__root__, original.token.__root__)

        bb_original = BitBucketCredentials(
            repositoryOwner="owner",
            repositoryName="name",
            token="token",
            branch="branch",
        )

        bb_updated = update_repository_name(original=bb_original, name="new_name")

        self.assertEqual(bb_original.repositoryName.__root__, "name")
        self.assertEqual(bb_updated.repositoryName.__root__, "new_name")
        self.assertEqual(
            bb_updated.repositoryOwner.__root__, bb_original.repositoryOwner.__root__
        )
        self.assertEqual(bb_updated.token.__root__, bb_original.token.__root__)
        self.assertEqual(bb_updated.branch, bb_original.branch)

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
        self.assertEqual(updated.repositoryName.__root__, "repo")

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
        self.assertEqual(bb_updated.repositoryName.__root__, "repo")

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
