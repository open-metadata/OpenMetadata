"""
Test Tableau BACKFILL_RUNNING error detection
"""
import unittest
from unittest.mock import MagicMock, patch

from metadata.ingestion.source.dashboard.tableau.client import (
    TableauBackfillRunningException,
    TableauClient,
)


class TestTableauBackfillRunning(unittest.TestCase):
    """
    Test cases for BACKFILL_RUNNING error detection in Tableau client
    """

    def setUp(self):
        """Set up test fixtures"""
        self.mock_config = MagicMock()
        self.mock_config.hostPort = "http://tableau.example.com"
        self.mock_config.apiVersion = None
        
        self.mock_auth = MagicMock()
        
        # Mock the tableau server
        with patch('metadata.ingestion.source.dashboard.tableau.client.Server'):
            self.client = TableauClient(
                tableau_server_auth=self.mock_auth,
                config=self.mock_config,
                verify_ssl=False,
                pagination_limit=50,
                ssl_manager=None,
                mark_deleted_dashboards=False,
            )

    def test_check_backfill_running_error_with_backfill_code(self):
        """Test that BACKFILL_RUNNING error is detected"""
        graphql_result = {
            "errors": [
                {
                    "message": "Still creating the Metadata API Store. Results from the query might be incomplete at this time.",
                    "extensions": {
                        "severity": "WARNING",
                        "code": "BACKFILL_RUNNING"
                    }
                }
            ],
            "data": {
                "workbooks": []
            }
        }
        
        # Should not raise when mark_deleted_dashboards is False
        self.client.mark_deleted_dashboards = False
        self.client._check_backfill_running_error(graphql_result)
        
        # Should raise when mark_deleted_dashboards is True
        self.client.mark_deleted_dashboards = True
        with self.assertRaises(TableauBackfillRunningException) as context:
            self.client._check_backfill_running_error(graphql_result)
        
        self.assertIn("BACKFILL_RUNNING", str(context.exception))
        self.assertIn("markDeletedDashboards", str(context.exception))

    def test_check_backfill_running_error_without_backfill_code(self):
        """Test that non-BACKFILL_RUNNING errors are ignored"""
        graphql_result = {
            "errors": [
                {
                    "message": "Some other error",
                    "extensions": {
                        "severity": "ERROR",
                        "code": "SOME_OTHER_ERROR"
                    }
                }
            ],
            "data": {
                "workbooks": []
            }
        }
        
        # Should not raise for other error codes
        self.client.mark_deleted_dashboards = True
        self.client._check_backfill_running_error(graphql_result)

    def test_check_backfill_running_error_with_no_errors(self):
        """Test that responses without errors are handled correctly"""
        graphql_result = {
            "data": {
                "workbooks": []
            }
        }
        
        # Should not raise when no errors
        self.client.mark_deleted_dashboards = True
        self.client._check_backfill_running_error(graphql_result)

    def test_check_backfill_running_error_with_none(self):
        """Test that None input is handled correctly"""
        # Should not raise when input is None
        self.client.mark_deleted_dashboards = True
        self.client._check_backfill_running_error(None)

    def test_check_backfill_running_error_with_empty_errors(self):
        """Test that empty errors list is handled correctly"""
        graphql_result = {
            "errors": [],
            "data": {
                "workbooks": []
            }
        }
        
        # Should not raise when errors list is empty
        self.client.mark_deleted_dashboards = True
        self.client._check_backfill_running_error(graphql_result)

    def test_check_backfill_running_warning_when_mark_deleted_false(self):
        """Test that a warning is logged when markDeletedDashboards is False"""
        graphql_result = {
            "errors": [
                {
                    "message": "Still creating the Metadata API Store.",
                    "extensions": {
                        "severity": "WARNING",
                        "code": "BACKFILL_RUNNING"
                    }
                }
            ],
            "data": {
                "workbooks": []
            }
        }
        
        self.client.mark_deleted_dashboards = False
        
        # Should not raise but should log warning
        with patch('metadata.ingestion.source.dashboard.tableau.client.logger') as mock_logger:
            self.client._check_backfill_running_error(graphql_result)
            mock_logger.warning.assert_called_once()
            warning_message = mock_logger.warning.call_args[0][0]
            self.assertIn("BACKFILL_RUNNING", warning_message)
            self.assertIn("markDeletedDashboards", warning_message)

    def test_check_backfill_running_error_log_when_mark_deleted_true(self):
        """Test that an error is logged when markDeletedDashboards is True"""
        graphql_result = {
            "errors": [
                {
                    "message": "Still creating the Metadata API Store.",
                    "extensions": {
                        "severity": "WARNING",
                        "code": "BACKFILL_RUNNING"
                    }
                }
            ],
            "data": {
                "workbooks": []
            }
        }
        
        self.client.mark_deleted_dashboards = True
        
        # Should log error before raising
        with patch('metadata.ingestion.source.dashboard.tableau.client.logger') as mock_logger:
            with self.assertRaises(TableauBackfillRunningException):
                self.client._check_backfill_running_error(graphql_result)
            mock_logger.error.assert_called_once()
            error_message = mock_logger.error.call_args[0][0]
            self.assertIn("BACKFILL_RUNNING", error_message)


if __name__ == '__main__':
    unittest.main()
