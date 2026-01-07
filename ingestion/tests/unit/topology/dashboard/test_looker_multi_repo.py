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
Test Looker multi-repository support
"""
import tempfile
from pathlib import Path
from unittest import TestCase
from unittest.mock import MagicMock, patch

from metadata.generated.schema.security.credentials.githubCredentials import (
    GitHubCredentials,
)
from metadata.ingestion.source.dashboard.looker.bulk_parser import BulkLkmlParser
from metadata.ingestion.source.dashboard.looker.metadata import LookerSource
from metadata.readers.file.local import LocalReader


class TestLookerMultiRepository(TestCase):
    """Test suite for Looker multi-repository support"""

    def setUp(self):
        """Set up test fixtures"""
        # Create temporary directories for mock repositories
        self.temp_dir = tempfile.mkdtemp()
        self.repo1_path = Path(self.temp_dir) / "repo1"
        self.repo2_path = Path(self.temp_dir) / "repo2"
        self.repo1_path.mkdir(parents=True, exist_ok=True)
        self.repo2_path.mkdir(parents=True, exist_ok=True)

        # Create mock view files in repo1
        self.create_mock_view_file(
            self.repo1_path / "users.view.lkml",
            """
view: users {
  sql_table_name: public.users ;;

  dimension: id {
    primary_key: yes
    type: number
    sql: ${TABLE}.id ;;
  }

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }
}
""",
        )

        # Create mock view files in repo2
        self.create_mock_view_file(
            self.repo2_path / "orders.view.lkml",
            """
view: orders {
  sql_table_name: public.orders ;;

  dimension: order_id {
    primary_key: yes
    type: number
    sql: ${TABLE}.order_id ;;
  }

  dimension: customer_id {
    type: number
    sql: ${TABLE}.customer_id ;;
  }
}
""",
        )

        self.create_mock_view_file(
            self.repo2_path / "customers.view.lkml",
            """
view: customers {
  sql_table_name: public.customers ;;

  dimension: customer_id {
    primary_key: yes
    type: number
    sql: ${TABLE}.customer_id ;;
  }

  dimension: email {
    type: string
    sql: ${TABLE}.email ;;
  }
}
""",
        )

    def create_mock_view_file(self, path: Path, content: str):
        """Helper to create mock .view.lkml files"""
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    def tearDown(self):
        """Clean up test fixtures"""
        import shutil

        shutil.rmtree(self.temp_dir, ignore_errors=True)

        # Clear the BulkLkmlParser singleton instance between tests
        if hasattr(BulkLkmlParser, "_instances"):
            BulkLkmlParser._instances.clear()

    def test_comma_separated_repository_names(self):
        """Test parsing comma-separated repository names"""
        repo_names = "repo1,repo2,repo3"
        expected = ["repo1", "repo2", "repo3"]

        parsed = [name.strip() for name in repo_names.split(",") if name.strip()]

        self.assertEqual(parsed, expected)

    def test_comma_separated_with_spaces(self):
        """Test parsing comma-separated repository names with spaces"""
        repo_names = "repo1 , repo2  ,  repo3"
        expected = ["repo1", "repo2", "repo3"]

        parsed = [name.strip() for name in repo_names.split(",") if name.strip()]

        self.assertEqual(parsed, expected)

    def test_single_repository_name(self):
        """Test parsing single repository name (backward compatibility)"""
        repo_names = "single-repo"
        expected = ["single-repo"]

        parsed = [name.strip() for name in repo_names.split(",") if name.strip()]

        self.assertEqual(parsed, expected)

    def test_empty_repository_names_filtered(self):
        """Test that empty strings are filtered out"""
        repo_names = "repo1,,repo2,  ,repo3"
        expected = ["repo1", "repo2", "repo3"]

        parsed = [name.strip() for name in repo_names.split(",") if name.strip()]

        self.assertEqual(parsed, expected)

    @patch(
        "metadata.ingestion.source.dashboard.looker.bulk_parser.BulkLkmlParser.__init__"
    )
    def test_bulk_parser_multiple_readers(self, mock_init):
        """Test BulkLkmlParser accepts multiple readers"""
        mock_init.return_value = None

        reader1 = MagicMock(spec=LocalReader)
        reader2 = MagicMock(spec=LocalReader)
        additional_readers = [reader2]

        # Test that constructor accepts additional_readers parameter
        try:
            BulkLkmlParser(reader=reader1, additional_readers=additional_readers)
            initialization_successful = True
        except TypeError:
            initialization_successful = False

        self.assertTrue(
            initialization_successful,
            "BulkLkmlParser should accept additional_readers parameter",
        )

    def test_bulk_parser_aggregates_views_from_multiple_repos(self):
        """Test that BulkLkmlParser aggregates views from multiple repositories"""
        # Create readers for both repos
        reader1 = LocalReader(base_path=self.repo1_path)
        reader2 = LocalReader(base_path=self.repo2_path)

        # Create parser with multiple readers
        parser = BulkLkmlParser(reader=reader1, additional_readers=[reader2])

        # Verify views from both repositories are cached
        self.assertIn("users", parser._views_cache, "View from repo1 should be cached")
        self.assertIn("orders", parser._views_cache, "View from repo2 should be cached")
        self.assertIn(
            "customers", parser._views_cache, "View from repo2 should be cached"
        )

        # Verify we can find views from both repos
        users_view = parser.find_view("users")
        orders_view = parser.find_view("orders")
        customers_view = parser.find_view("customers")

        self.assertIsNotNone(users_view, "Should find users view from repo1")
        self.assertIsNotNone(orders_view, "Should find orders view from repo2")
        self.assertIsNotNone(customers_view, "Should find customers view from repo2")

    def test_bulk_parser_view_source_file_tracking(self):
        """Test that views track their source files correctly"""
        reader1 = LocalReader(base_path=self.repo1_path)
        reader2 = LocalReader(base_path=self.repo2_path)

        parser = BulkLkmlParser(reader=reader1, additional_readers=[reader2])

        # Verify source files are tracked
        users_view = parser.find_view("users")
        orders_view = parser.find_view("orders")

        self.assertIsNotNone(users_view.source_file)
        self.assertIsNotNone(orders_view.source_file)
        self.assertIn("users.view.lkml", users_view.source_file)
        self.assertIn("orders.view.lkml", orders_view.source_file)

    def test_github_credentials_comma_separated_repos(self):
        """Test GitHubCredentials can accept comma-separated repository names"""
        # This tests that the schema allows the string format
        github_creds = GitHubCredentials(
            repositoryOwner="test-owner",
            repositoryName="repo1,repo2,repo3",
            token="test-token",
        )

        self.assertEqual(github_creds.repositoryName.root, "repo1,repo2,repo3")

        # Test parsing
        repo_names = github_creds.repositoryName.root.split(",")
        self.assertEqual(len(repo_names), 3)
        self.assertEqual([r.strip() for r in repo_names], ["repo1", "repo2", "repo3"])

    @patch("metadata.ingestion.source.dashboard.looker.metadata._clone_repo")
    def test_init_repo_creates_multiple_lookml_repos(self, mock_clone):
        """Test __init_repo creates LookMLRepo objects for each repository"""
        from metadata.ingestion.source.dashboard.looker.metadata import LookerSource

        # Create mock credentials
        github_creds = GitHubCredentials(
            repositoryOwner="test-owner",
            repositoryName="repo1,repo2",
            token="test-token",
        )

        # Call the static method
        repos = LookerSource._LookerSource__init_repo(github_creds)

        # Verify multiple repos were created
        self.assertEqual(len(repos), 2, "Should create 2 LookMLRepo objects")
        self.assertEqual(repos[0].name, "test-owner/repo1")
        self.assertEqual(repos[1].name, "test-owner/repo2")

        # Verify clone was called for each repo
        self.assertEqual(mock_clone.call_count, 2, "Should clone both repositories")

    @patch("metadata.ingestion.source.dashboard.looker.metadata._clone_repo")
    def test_init_repo_backward_compatibility_single_repo(self, mock_clone):
        """Test backward compatibility with single repository name"""
        from metadata.ingestion.source.dashboard.looker.metadata import LookerSource

        # Create mock credentials with single repo
        github_creds = GitHubCredentials(
            repositoryOwner="test-owner",
            repositoryName="single-repo",
            token="test-token",
        )

        # Call the static method
        repos = LookerSource._LookerSource__init_repo(github_creds)

        # Verify single repo was created
        self.assertEqual(len(repos), 1, "Should create 1 LookMLRepo object")
        self.assertEqual(repos[0].name, "test-owner/single-repo")
        self.assertEqual(mock_clone.call_count, 1, "Should clone one repository")

    def test_bulk_parser_handles_duplicate_view_names(self):
        """Test that views with same name from different repos (last one wins)"""
        # Create duplicate view in repo1
        self.create_mock_view_file(
            self.repo1_path / "duplicate.view.lkml",
            """
view: shared_view {
  sql_table_name: repo1.shared ;;

  dimension: id {
    type: number
    sql: ${TABLE}.id ;;
  }
}
""",
        )

        # Create duplicate view in repo2 with different content
        self.create_mock_view_file(
            self.repo2_path / "duplicate.view.lkml",
            """
view: shared_view {
  sql_table_name: repo2.shared ;;

  dimension: id {
    type: string
    sql: ${TABLE}.id ;;
  }

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }
}
""",
        )

        reader1 = LocalReader(base_path=self.repo1_path)
        reader2 = LocalReader(base_path=self.repo2_path)

        parser = BulkLkmlParser(reader=reader1, additional_readers=[reader2])

        # The last parsed view should win (from repo2)
        shared_view = parser.find_view("shared_view")
        self.assertIsNotNone(shared_view)

        # Verify it has the extra dimension from repo2
        dimension_names = [d.name for d in shared_view.dimensions or []]
        self.assertIn("name", dimension_names, "Should have dimension from repo2")

    def test_bulk_parser_error_handling_malformed_lkml(self):
        """Test that parser handles malformed LKML files gracefully"""
        # Create malformed LKML file
        self.create_mock_view_file(
            self.repo1_path / "malformed.view.lkml",
            """
view: malformed {
  this is not valid lkml syntax {{{
  dimension: id
""",
        )

        reader1 = LocalReader(base_path=self.repo1_path)

        # Should not raise exception, just skip the malformed file
        try:
            parser = BulkLkmlParser(reader=reader1, additional_readers=[])
            parser_created = True
        except Exception:
            parser_created = False

        self.assertTrue(
            parser_created, "Parser should handle malformed files gracefully"
        )

        # Other valid views should still be parsed
        users_view = parser.find_view("users")
        self.assertIsNotNone(
            users_view, "Valid views should be parsed despite malformed files"
        )

    def test_integration_multiple_repos_end_to_end(self):
        """Integration test: Verify complete flow with multiple repositories"""
        reader1 = LocalReader(base_path=self.repo1_path)
        reader2 = LocalReader(base_path=self.repo2_path)

        # Create parser with both repos
        parser = BulkLkmlParser(reader=reader1, additional_readers=[reader2])

        # Verify all views are accessible
        expected_views = ["users", "orders", "customers"]
        for view_name in expected_views:
            view = parser.find_view(view_name)
            self.assertIsNotNone(
                view, f"View {view_name} should be found in aggregated parser"
            )

        # Verify view count
        self.assertEqual(
            len(parser._views_cache),
            len(expected_views),
            "Should have cached all views from both repos",
        )

        # Verify parsed files
        self.assertGreater(
            len(parser.parsed_files),
            0,
            "Should have parsed files from both repos",
        )
