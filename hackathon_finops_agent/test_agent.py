import unittest
from evaluator import evaluate_table

class TestFinOpsEvaluator(unittest.TestCase):

    def test_strict_type_guard_usage_count(self):
        # Strings, lists, booleans should be rejected safely
        for invalid_usage in ["0", [0], True, None]:
            state, reason = evaluate_table(usage_count=invalid_usage, age_days=35, has_downstream=False, current_tags=[])
            self.assertEqual(state, "UNDER_REVIEW")
            self.assertEqual(reason, "Insufficient or malformed metadata")

    def test_strict_type_guard_age_days(self):
        for invalid_age in ["30", [30], True, None]:
            state, reason = evaluate_table(usage_count=0, age_days=invalid_age, has_downstream=False, current_tags=[])
            self.assertEqual(state, "UNDER_REVIEW")
            self.assertEqual(reason, "Insufficient or malformed metadata")
            
    def test_strict_type_guard_has_downstream(self):
        for invalid_downstream in ["True", 1, None]:
            state, reason = evaluate_table(usage_count=0, age_days=35, has_downstream=invalid_downstream, current_tags=[])
            self.assertEqual(state, "UNDER_REVIEW")
            self.assertEqual(reason, "Malformed lineage metadata")

    def test_no_action_for_active_usage(self):
        state, reason = evaluate_table(usage_count=100, age_days=40, has_downstream=False, current_tags=[])
        self.assertIsNone(state)
        self.assertEqual(reason, "No action required (Active usage)")

    def test_no_action_for_has_downstream(self):
        state, reason = evaluate_table(usage_count=0, age_days=40, has_downstream=True, current_tags=[])
        self.assertIsNone(state)
        self.assertEqual(reason, "No action required (Has downstream dependencies)")

    def test_zombie_state_routing(self):
        state, reason = evaluate_table(usage_count=0, age_days=30, has_downstream=False, current_tags=[])
        self.assertEqual(state, "ZOMBIE")
        
    def test_warning_state_routing(self):
        state, reason = evaluate_table(usage_count=0, age_days=14, has_downstream=False, current_tags=[])
        self.assertEqual(state, "WARNING")
        
    def test_under_review_state_routing(self):
        state, reason = evaluate_table(usage_count=0, age_days=7, has_downstream=False, current_tags=[])
        self.assertEqual(state, "UNDER_REVIEW")

    def test_table_too_new(self):
        state, reason = evaluate_table(usage_count=0, age_days=6, has_downstream=False, current_tags=[])
        self.assertIsNone(state)
        self.assertEqual(reason, "No action required (Table too new)")

    def test_idempotency(self):
        # Should not tag ZOMBIE if already ZOMBIE
        state, reason = evaluate_table(usage_count=0, age_days=35, has_downstream=False, current_tags=["FinOps.Zombie"])
        self.assertIsNone(state)
        self.assertEqual(reason, "No-op (already in desired state)")
        
        # Should not tag WARNING if already WARNING or ZOMBIE
        state, reason = evaluate_table(usage_count=0, age_days=15, has_downstream=False, current_tags=["FinOps.Warning"])
        self.assertIsNone(state)
        
        state, reason = evaluate_table(usage_count=0, age_days=15, has_downstream=False, current_tags=["FinOps.Zombie"])
        self.assertIsNone(state)

if __name__ == "__main__":
    unittest.main()
