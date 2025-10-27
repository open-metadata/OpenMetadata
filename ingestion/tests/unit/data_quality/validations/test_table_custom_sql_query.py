"""
Unit tests for TableCustomSQLQueryValidator._replace_where_clause method
"""

import unittest
from datetime import datetime
from unittest.mock import Mock

from metadata.data_quality.validations.table.sqlalchemy.tableCustomSQLQuery import (
    TableCustomSQLQueryValidator,
)


class TestTableCustomSQLQueryValidator(unittest.TestCase):
    """Test cases for TableCustomSQLQueryValidator._replace_where_clause method"""

    def setUp(self):
        """Set up test fixtures"""
        mock_runner = Mock()
        mock_test_case = Mock()
        mock_execution_date = datetime.now()

        self.validator = TableCustomSQLQueryValidator(
            runner=mock_runner,
            test_case=mock_test_case,
            execution_date=mock_execution_date,
        )

    def test_simple_query_no_where_clause(self):
        """Test adding WHERE clause to simple query without existing WHERE"""
        sql = "SELECT * FROM users"
        partition_expr = "created_at > '2023-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT * FROM users WHERE created_at > '2023-01-01'"

        self.assertEqual(result, expected)

    def test_simple_query_with_existing_where(self):
        """Test replacing existing WHERE clause in simple query"""
        sql = "SELECT * FROM users WHERE id > 100"
        partition_expr = "created_at > '2023-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT * FROM users WHERE created_at > '2023-01-01'"

        self.assertEqual(result, expected)

    def test_query_with_order_by_no_where(self):
        """Test adding WHERE clause before ORDER BY"""
        sql = "SELECT * FROM users ORDER BY name"
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT * FROM users WHERE status = 'active' ORDER BY name"

        self.assertEqual(result, expected)

    def test_query_with_group_by_no_where(self):
        """Test adding WHERE clause before GROUP BY"""
        sql = "SELECT department, COUNT(*) FROM employees GROUP BY department"
        partition_expr = "hire_date > '2020-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT department, COUNT(*) FROM employees WHERE hire_date > '2020-01-01' GROUP BY department"

        self.assertEqual(result, expected)

    def test_query_with_subquery_inner_where_preserved(self):
        """Test that WHERE clause in subquery is preserved"""
        sql = "SELECT foo FROM a INNER JOIN (SELECT bar FROM b WHERE abc = 3) WHERE a.id BETWEEN 2 AND 4"
        partition_expr = "a.status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT foo FROM a INNER JOIN (SELECT bar FROM b WHERE abc = 3) WHERE a.status = 'active'"

        self.assertEqual(result, expected)

    def test_complex_subquery_multiple_levels(self):
        """Test complex nested subqueries with multiple WHERE clauses"""
        sql = """SELECT * FROM users u
                 WHERE u.id IN (
                     SELECT user_id FROM orders o
                     WHERE o.total > (
                         SELECT AVG(total) FROM orders WHERE status = 'completed'
                     )
                 )"""
        partition_expr = "u.created_at > '2023-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)

        self.assertIn("WHERE u.created_at > '2023-01-01'", result)
        self.assertNotIn("WHERE u.id IN", result)

    def test_query_with_cte_where_preserved(self):
        """Test that WHERE clauses in CTEs are preserved"""
        sql = """WITH active_users AS (
                     SELECT * FROM users WHERE status = 'active'
                 )
                 SELECT * FROM active_users WHERE id > 100"""
        partition_expr = "created_at > '2023-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)

        self.assertIn("WHERE status = 'active'", result)
        self.assertIn("WHERE created_at > '2023-01-01'", result)
        self.assertNotIn("WHERE id > 100", result)

    def test_query_with_union_no_where(self):
        """Test adding WHERE clause before UNION"""
        sql = "SELECT id FROM table1 UNION SELECT id FROM table2"
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = (
            "SELECT id FROM table1 WHERE status = 'active' UNION SELECT id FROM table2"
        )

        self.assertEqual(result, expected)

    def test_query_with_having_no_where(self):
        """Test adding WHERE clause before HAVING"""
        sql = "SELECT department, COUNT(*) FROM employees GROUP BY department HAVING COUNT(*) > 5"
        partition_expr = "hire_date > '2020-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT department, COUNT(*) FROM employees WHERE hire_date > '2020-01-01' GROUP BY department HAVING COUNT(*) > 5"

        self.assertEqual(result, expected)

    def test_query_with_limit_no_where(self):
        """Test adding WHERE clause before LIMIT"""
        sql = "SELECT * FROM users LIMIT 10"
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT * FROM users WHERE status = 'active' LIMIT 10"

        self.assertEqual(result, expected)

    def test_query_with_offset_no_where(self):
        """Test adding WHERE clause before OFFSET"""
        sql = "SELECT * FROM users OFFSET 20"
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "SELECT * FROM users WHERE status = 'active' OFFSET 20"

        self.assertEqual(result, expected)

    def test_complex_query_with_joins_and_subqueries(self):
        """Test complex query with joins, subqueries, and existing WHERE"""
        sql = """SELECT u.name, o.total
                 FROM users u
                 INNER JOIN orders o ON u.id = o.user_id
                 LEFT JOIN (
                     SELECT user_id, COUNT(*) as order_count
                     FROM orders
                     WHERE created_at > '2022-01-01'
                     GROUP BY user_id
                 ) oc ON u.id = oc.user_id
                 WHERE u.status = 'active' AND o.total > 100
                 ORDER BY o.total DESC"""
        partition_expr = "u.created_at BETWEEN '2023-01-01' AND '2023-12-31'"

        result = self.validator._replace_where_clause(sql, partition_expr)

        self.assertIn(
            "WHERE u.created_at BETWEEN '2023-01-01' AND '2023-12-31'", result
        )
        self.assertIn("WHERE created_at > '2022-01-01'", result)
        self.assertIn("ORDER BY o.total DESC", result)
        self.assertNotIn("WHERE u.status = 'active' AND o.total > 100", result)

    def test_query_with_multiple_clauses_existing_where(self):
        """Test query with WHERE, GROUP BY, HAVING, ORDER BY, LIMIT"""
        sql = """SELECT department, AVG(salary)
                 FROM employees
                 WHERE salary > 50000
                 GROUP BY department
                 HAVING AVG(salary) > 60000
                 ORDER BY AVG(salary) DESC
                 LIMIT 5"""
        partition_expr = "hire_date > '2020-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = """SELECT department, AVG(salary)
                 FROM employees
                 WHERE hire_date > '2020-01-01'
                 GROUP BY department
                 HAVING AVG(salary) > 60000
                 ORDER BY AVG(salary) DESC
                 LIMIT 5"""

        self.assertEqual(result, expected)

    def test_empty_sql_query(self):
        """Test handling of empty SQL query"""
        sql = ""
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)

        self.assertIsNone(result)

    def test_malformed_sql_query(self):
        """Test handling of malformed SQL query"""
        sql = "SELECT FROM"
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)

        self.assertIsNotNone(result)

    def test_case_insensitive_keywords(self):
        """Test that keyword matching is case insensitive"""
        sql = "select * from users where id > 100 order by name"
        partition_expr = "status = 'active'"

        result = self.validator._replace_where_clause(sql, partition_expr)
        expected = "select * from users WHERE status = 'active' order by name"

        self.assertEqual(result, expected)

    def test_deeply_nested_subqueries(self):
        """Test handling of deeply nested subqueries"""
        sql = """SELECT * FROM table1
                 WHERE id IN (
                     SELECT t2.id FROM table2 t2
                     WHERE t2.value > (
                         SELECT AVG(t3.value) FROM table3 t3
                         WHERE t3.category IN (
                             SELECT category FROM categories
                             WHERE active = 1
                         )
                     )
                 )"""
        partition_expr = "created_at > '2023-01-01'"

        result = self.validator._replace_where_clause(sql, partition_expr)

        self.assertIn("WHERE created_at > '2023-01-01'", result)
        self.assertNotIn("WHERE id IN", result)


if __name__ == "__main__":
    unittest.main()
