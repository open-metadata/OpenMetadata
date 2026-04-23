import unittest
from unittest.mock import patch, MagicMock
import time
from evaluator import is_zombie
from client import apply_zombie_tag

class TestFinOpsAgent(unittest.TestCase):
    def setUp(self):
        self.now_ms = int(time.time() * 1000)
        self.day_ms = 86400000

    def test_missing_usageSummary(self):
        table = {
            "updatedAt": self.now_ms - (10 * self.day_ms),
        }
        # missing usageSummary
        is_zomb, reason = is_zombie(table, has_upstream=True)
        self.assertFalse(is_zomb)
        self.assertEqual(reason, "Missing usageSummary")
        
    def test_already_tagged_table(self):
        table = {
            "updatedAt": self.now_ms - (10 * self.day_ms),
            "usageSummary": {
                "monthlyStats": {"count": 0}
            },
            "tags": [{"tagFQN": "FinOps.Zombie"}]
        }
        is_zomb, reason = is_zombie(table, has_upstream=True)
        self.assertFalse(is_zomb)
        self.assertEqual(reason, "Already tagged with FinOps.Zombie")

    def test_valid_zombie_detection(self):
        table = {
            "updatedAt": self.now_ms - (10 * self.day_ms),
            "usageSummary": {
                "monthlyStats": {"count": 0}
            }
        }
        is_zomb, reason = is_zombie(table, has_upstream=True)
        self.assertTrue(is_zomb)
        self.assertEqual(reason, "All zombie criteria met")

    def test_skips_table_with_usage(self):
        table = {
            "updatedAt": self.now_ms - (10 * self.day_ms),
            "usageSummary": {
                "monthlyStats": {"count": 100}
            }
        }
        is_zomb, reason = is_zombie(table, has_upstream=True)
        self.assertFalse(is_zomb)
        self.assertEqual(reason, "Has usage (count = 100)")

    def test_skips_no_upstream(self):
        table = {
            "updatedAt": self.now_ms - (10 * self.day_ms),
            "usageSummary": {
                "monthlyStats": {"count": 0}
            }
        }
        is_zomb, reason = is_zombie(table, has_upstream=False)
        self.assertFalse(is_zomb)
        self.assertEqual(reason, "No upstream lineage")

    @patch('client.DRY_RUN', False)
    @patch('client.request_with_retry')
    def test_patch_success(self, mock_request):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_request.return_value = mock_response
        
        success = apply_zombie_tag("test_id", [], False, "Test Description", "1.0")
        self.assertTrue(success)

    @patch('client.DRY_RUN', False)
    @patch('client.request_with_retry')
    def test_patch_failure_412(self, mock_request):
        mock_412 = MagicMock()
        mock_412.status_code = 412
        
        mock_200 = MagicMock()
        mock_200.status_code = 200
        mock_200.json.return_value = {"version": "2.0", "tags": []}
        
        # The logic calls request_with_retry for PATCH, then GET, then PATCH
        mock_request.side_effect = [mock_412, mock_200, mock_200]
        
        success = apply_zombie_tag("test_id", [], False, "Test Description", "1.0")
        self.assertTrue(success)
        self.assertEqual(mock_request.call_count, 3)

if __name__ == "__main__":
    unittest.main()