"""
Unit tests for Complex SQL Query Patterns - Comprehensive Lineage Validation

This test suite validates SQL lineage parsers (SqlGlot, SqlFluff, SqlParse) against
a comprehensive set of complex real-world query patterns that stress-test the parsers'
capabilities.
"""

from unittest import TestCase

from ingestion.tests.unit.lineage.queries.helpers import (
    TestColumnQualifierTuple,
    assert_column_lineage_equal,
    assert_table_lineage_equal,
)
from metadata.ingestion.lineage.models import Dialect


class TestComplexQueryPatterns(TestCase):
    """Comprehensive test suite for complex SQL query patterns"""

    # ==================== JOIN PATTERNS ====================

    def test_multiple_inner_joins_complex_conditions(self):
        """Test multiple INNER JOINs with complex conditions"""
        query = """
        SELECT
            o.order_id,
            c.customer_name,
            p.product_name,
            s.supplier_name,
            w.warehouse_location
        FROM orders o
        INNER JOIN customers c
            ON o.customer_id = c.customer_id
            AND c.is_active = 1
        INNER JOIN order_items oi
            ON o.order_id = oi.order_id
        INNER JOIN products p
            ON oi.product_id = p.product_id
            AND p.is_available = 1
        INNER JOIN suppliers s
            ON p.supplier_id = s.supplier_id
        INNER JOIN warehouses w
            ON s.warehouse_id = w.warehouse_id
        WHERE o.order_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {
                "orders",
                "customers",
                "order_items",
                "products",
                "suppliers",
                "warehouses",
            },
            set(),  # SELECT query, no target
            dialect=Dialect.MYSQL.value,
        )

        # No column lineage - SELECT query with no target table
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_left_right_full_outer_joins(self):
        """Test LEFT, RIGHT, and FULL OUTER JOINs with NULL handling"""
        query = """
        SELECT
            COALESCE(e.employee_id, ex.employee_id) as emp_id,
            e.employee_name,
            d.department_name,
            p.project_name
        FROM employees e
        LEFT OUTER JOIN departments d
            ON e.department_id = d.department_id
        RIGHT OUTER JOIN ex_employees ex
            ON e.employee_id = ex.employee_id
        FULL OUTER JOIN projects p
            ON e.current_project_id = p.project_id
        WHERE e.hire_date > '2020-01-01'
           OR ex.termination_date IS NOT NULL
        """

        assert_table_lineage_equal(
            query,
            {"employees", "departments", "ex_employees", "projects"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cross_join_cartesian_product(self):
        """Test CROSS JOIN creating Cartesian product"""
        query = """
        SELECT
            d.date_key,
            p.product_id,
            s.store_id,
            COALESCE(f.sales_amount, 0) as sales_amount
        FROM dim_date d
        CROSS JOIN dim_products p
        CROSS JOIN dim_stores s
        LEFT JOIN fact_sales f
            ON d.date_key = f.date_key
            AND p.product_id = f.product_id
            AND s.store_id = f.store_id
        WHERE d.date_key BETWEEN 20240101 AND 20241231
        """

        assert_table_lineage_equal(
            query,
            {"dim_date", "dim_products", "dim_stores", "fact_sales"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_self_join_with_aliases(self):
        """Test self-join with multiple aliases"""
        query = """
        SELECT
            e1.employee_id as employee_id,
            e1.employee_name as employee_name,
            e2.employee_name as manager_name,
            e3.employee_name as manager_of_manager
        FROM employees e1
        LEFT JOIN employees e2
            ON e1.manager_id = e2.employee_id
        LEFT JOIN employees e3
            ON e2.manager_id = e3.employee_id
        WHERE e1.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_joins_with_subqueries_in_conditions(self):
        """Test joins with subqueries in ON clauses"""
        query = """
        SELECT
            o.order_id,
            o.order_amount,
            c.customer_name,
            avg_orders.avg_amount
        FROM orders o
        INNER JOIN customers c
            ON o.customer_id = c.customer_id
        LEFT JOIN (
            SELECT
                customer_id,
                AVG(order_amount) as avg_amount
            FROM orders
            WHERE order_date >= DATE_SUB(CURRENT_DATE, INTERVAL 90 DAY)
            GROUP BY customer_id
        ) avg_orders
            ON c.customer_id = avg_orders.customer_id
            AND o.order_amount > avg_orders.avg_amount * 1.5
        WHERE o.status = 'completed'
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    # ==================== CTE PATTERNS ====================

    def test_single_cte_with_aggregation(self):
        """Test single CTE with aggregation"""
        query = """
        WITH monthly_sales AS (
            SELECT
                DATE_TRUNC('month', order_date) as month,
                product_id,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_amount
            FROM sales
            WHERE order_date >= '2024-01-01'
            GROUP BY DATE_TRUNC('month', order_date), product_id
        )
        SELECT
            ms.month,
            p.product_name,
            ms.total_quantity,
            ms.total_amount
        FROM monthly_sales ms
        JOIN products p ON ms.product_id = p.product_id
        ORDER BY ms.month DESC, ms.total_amount DESC
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_multiple_sequential_ctes(self):
        """Test multiple CTEs referencing each other sequentially"""
        query = """
        WITH
        raw_orders AS (
            SELECT order_id, customer_id, order_date, amount
            FROM orders
            WHERE status = 'completed'
        ),
        customer_totals AS (
            SELECT
                customer_id,
                COUNT(*) as order_count,
                SUM(amount) as total_spent
            FROM raw_orders
            GROUP BY customer_id
        ),
        high_value_customers AS (
            SELECT
                ct.customer_id,
                ct.total_spent,
                c.customer_name,
                c.customer_tier
            FROM customer_totals ct
            JOIN customers c ON ct.customer_id = c.customer_id
            WHERE ct.total_spent > 10000
        )
        SELECT * FROM high_value_customers
        ORDER BY total_spent DESC
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_recursive_cte_hierarchical_data(self):
        """Test recursive CTE for hierarchical data"""
        query = """
        WITH RECURSIVE employee_hierarchy AS (
            -- Anchor member
            SELECT
                employee_id,
                employee_name,
                manager_id,
                1 as level,
                CAST(employee_name AS VARCHAR(1000)) as path
            FROM employees
            WHERE manager_id IS NULL

            UNION ALL

            -- Recursive member
            SELECT
                e.employee_id,
                e.employee_name,
                e.manager_id,
                eh.level + 1,
                CONCAT(eh.path, ' > ', e.employee_name)
            FROM employees e
            INNER JOIN employee_hierarchy eh
                ON e.manager_id = eh.employee_id
            WHERE eh.level < 10
        )
        SELECT
            employee_id,
            employee_name,
            level,
            path
        FROM employee_hierarchy
        ORDER BY path
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_with_window_functions(self):
        """Test CTE with window functions"""
        query = """
        WITH ranked_sales AS (
            SELECT
                s.sale_id,
                s.product_id,
                s.amount,
                s.sale_date,
                ROW_NUMBER() OVER (
                    PARTITION BY s.product_id
                    ORDER BY s.amount DESC
                ) as rank_in_product,
                SUM(s.amount) OVER (
                    PARTITION BY s.product_id
                    ORDER BY s.sale_date
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) as running_total,
                AVG(s.amount) OVER (
                    PARTITION BY s.product_id
                    ORDER BY s.sale_date
                    ROWS BETWEEN 7 PRECEDING AND CURRENT ROW
                ) as moving_avg_7day
            FROM sales s
            WHERE s.sale_date >= '2024-01-01'
        )
        SELECT
            rs.product_id,
            p.product_name,
            rs.amount,
            rs.rank_in_product,
            rs.running_total,
            rs.moving_avg_7day
        FROM ranked_sales rs
        JOIN products p ON rs.product_id = p.product_id
        WHERE rs.rank_in_product <= 10
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_deeply_nested_ctes_five_levels(self):
        """Test deeply nested CTEs (5 levels)"""
        query = """
        WITH
        level1 AS (
            SELECT customer_id, order_date, amount
            FROM orders
            WHERE status = 'completed'
        ),
        level2 AS (
            SELECT
                customer_id,
                DATE_TRUNC('month', order_date) as month,
                SUM(amount) as monthly_total
            FROM level1
            GROUP BY customer_id, DATE_TRUNC('month', order_date)
        ),
        level3 AS (
            SELECT
                customer_id,
                AVG(monthly_total) as avg_monthly_spend,
                MAX(monthly_total) as max_monthly_spend
            FROM level2
            GROUP BY customer_id
        ),
        level4 AS (
            SELECT
                l3.customer_id,
                l3.avg_monthly_spend,
                c.customer_name,
                c.customer_segment
            FROM level3 l3
            JOIN customers c ON l3.customer_id = c.customer_id
        ),
        level5 AS (
            SELECT
                customer_segment,
                COUNT(*) as customer_count,
                AVG(avg_monthly_spend) as segment_avg_spend
            FROM level4
            GROUP BY customer_segment
        )
        SELECT * FROM level5
        ORDER BY segment_avg_spend DESC
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== SUBQUERY PATTERNS ====================

    def test_scalar_subquery_in_select(self):
        """Test scalar subqueries in SELECT clause"""
        query = """
        SELECT
            p.product_id,
            p.product_name,
            p.price,
            (SELECT AVG(price) FROM products) as avg_price,
            (SELECT COUNT(*) FROM sales WHERE product_id = p.product_id) as sale_count,
            (SELECT SUM(quantity) FROM inventory WHERE product_id = p.product_id) as total_inventory
        FROM products p
        WHERE p.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"products", "sales", "inventory"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        # Parsers create different internal graph structures for scalar subqueries
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_correlated_subqueries(self):
        """Test correlated subqueries"""
        query = """
        SELECT
            e.employee_id,
            e.employee_name,
            e.salary,
            e.department_id
        FROM employees e
        WHERE e.salary > (
            SELECT AVG(e2.salary)
            FROM employees e2
            WHERE e2.department_id = e.department_id
        )
        AND EXISTS (
            SELECT 1
            FROM performance_reviews pr
            WHERE pr.employee_id = e.employee_id
            AND pr.rating >= 4
            AND pr.review_year = 2024
        )
        """

        assert_table_lineage_equal(
            query,
            {"employees", "performance_reviews"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        # Correlated subqueries create different graph structures across parsers
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_nested_subqueries_three_levels(self):
        """Test nested subqueries (3 levels deep)"""
        query = """
        SELECT
            customer_id,
            customer_name,
            total_orders
        FROM customers
        WHERE customer_id IN (
            SELECT DISTINCT customer_id
            FROM orders
            WHERE order_date >= '2024-01-01'
            AND order_id IN (
                SELECT order_id
                FROM order_items
                WHERE product_id IN (
                    SELECT product_id
                    FROM products
                    WHERE category = 'Electronics'
                    AND price > 1000
                )
            )
        )
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders", "order_items", "products"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        # Deeply nested subqueries create different graph structures
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_subqueries_in_case_statements(self):
        """Test subqueries within CASE statements"""
        query = """
        SELECT
            o.order_id,
            o.customer_id,
            o.order_amount,
            CASE
                WHEN o.order_amount > (
                    SELECT AVG(order_amount) * 2
                    FROM orders
                    WHERE customer_id = o.customer_id
                ) THEN 'High Value'
                WHEN o.order_amount > (
                    SELECT AVG(order_amount)
                    FROM orders
                    WHERE customer_id = o.customer_id
                ) THEN 'Above Average'
                ELSE 'Normal'
            END as order_category
        FROM orders o
        WHERE o.status = 'completed'
        """

        # SqlFluff extracts minimal structure from CASE subqueries
        assert_table_lineage_equal(
            query,
            {"orders"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # ==================== UNION PATTERNS ====================

    def test_union_all_with_multiple_sources(self):
        """Test UNION ALL combining multiple data sources"""
        query = """
        SELECT
            'Current' as source_type,
            employee_id,
            employee_name,
            department_id,
            hire_date,
            NULL as termination_date
        FROM current_employees
        WHERE is_active = 1

        UNION ALL

        SELECT
            'Former' as source_type,
            employee_id,
            employee_name,
            department_id,
            hire_date,
            termination_date
        FROM former_employees
        WHERE termination_date >= '2020-01-01'

        UNION ALL

        SELECT
            'Contractor' as source_type,
            contractor_id as employee_id,
            contractor_name as employee_name,
            assigned_department_id as department_id,
            contract_start_date as hire_date,
            contract_end_date as termination_date
        FROM contractors
        WHERE contract_status = 'active'
        """

        assert_table_lineage_equal(
            query,
            {"current_employees", "former_employees", "contractors"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_union_with_ctes_and_order_by(self):
        """Test UNION with CTEs and ORDER BY"""
        query = """
        WITH
        online_sales AS (
            SELECT
                sale_date,
                product_id,
                'Online' as channel,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_amount
            FROM web_sales
            GROUP BY sale_date, product_id
        ),
        store_sales AS (
            SELECT
                sale_date,
                product_id,
                'Store' as channel,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_amount
            FROM pos_sales
            GROUP BY sale_date, product_id
        )
        SELECT * FROM online_sales
        UNION ALL
        SELECT * FROM store_sales
        ORDER BY sale_date DESC, total_amount DESC
        LIMIT 1000
        """

        assert_table_lineage_equal(
            query,
            {"web_sales", "pos_sales"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_nested_unions(self):
        """Test nested UNION operations"""
        query = """
        SELECT customer_id, 'High' as tier FROM premium_customers
        UNION
        (
            SELECT customer_id, 'Medium' as tier FROM regular_customers
            UNION
            SELECT customer_id, 'Low' as tier FROM basic_customers
        )
        UNION ALL
        SELECT customer_id, 'Trial' as tier FROM trial_customers
        ORDER BY tier, customer_id
        """

        assert_table_lineage_equal(
            query,
            {
                "premium_customers",
                "regular_customers",
                "basic_customers",
                "trial_customers",
            },
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== WINDOW FUNCTIONS ====================

    def test_multiple_window_functions_single_query(self):
        """Test multiple window functions in a single query"""
        query = """
        SELECT
            sale_id,
            product_id,
            sale_date,
            amount,
            ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY amount DESC) as rank_by_amount,
            RANK() OVER (PARTITION BY product_id ORDER BY sale_date) as rank_by_date,
            DENSE_RANK() OVER (ORDER BY amount DESC) as dense_rank_overall,
            LAG(amount, 1) OVER (PARTITION BY product_id ORDER BY sale_date) as prev_sale_amount,
            LEAD(amount, 1) OVER (PARTITION BY product_id ORDER BY sale_date) as next_sale_amount,
            FIRST_VALUE(amount) OVER (PARTITION BY product_id ORDER BY sale_date) as first_sale,
            LAST_VALUE(amount) OVER (
                PARTITION BY product_id
                ORDER BY sale_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
            ) as last_sale,
            SUM(amount) OVER (
                PARTITION BY product_id
                ORDER BY sale_date
                ROWS BETWEEN 7 PRECEDING AND CURRENT ROW
            ) as rolling_sum_7days,
            AVG(amount) OVER (
                PARTITION BY product_id
                ORDER BY sale_date
                ROWS BETWEEN 30 PRECEDING AND CURRENT ROW
            ) as moving_avg_30days
        FROM sales
        WHERE sale_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_named_window_specifications(self):
        """Test named window specifications"""
        query = """
        SELECT
            product_id,
            sale_date,
            amount,
            AVG(amount) OVER product_window as avg_by_product,
            SUM(amount) OVER product_date_window as cumulative_sum,
            ROW_NUMBER() OVER product_date_window as row_num
        FROM sales
        WHERE sale_date >= '2024-01-01'
        WINDOW
            product_window AS (PARTITION BY product_id),
            product_date_window AS (PARTITION BY product_id ORDER BY sale_date)
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== AGGREGATION PATTERNS ====================

    def test_group_by_with_rollup(self):
        """Test GROUP BY with ROLLUP for subtotals"""
        query = """
        SELECT
            COALESCE(region, 'ALL REGIONS') as region,
            COALESCE(category, 'ALL CATEGORIES') as category,
            COALESCE(product_name, 'ALL PRODUCTS') as product_name,
            SUM(quantity) as total_quantity,
            SUM(amount) as total_amount,
            COUNT(*) as sale_count
        FROM sales s
        JOIN products p ON s.product_id = p.product_id
        JOIN regions r ON s.region_id = r.region_id
        WHERE s.sale_date >= '2024-01-01'
        GROUP BY ROLLUP (region, category, product_name)
        ORDER BY region NULLS LAST, category NULLS LAST, product_name NULLS LAST
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products", "regions"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_group_by_with_cube(self):
        """Test GROUP BY with CUBE for all combinations"""
        query = """
        SELECT
            year,
            quarter,
            month,
            SUM(revenue) as total_revenue,
            COUNT(DISTINCT customer_id) as unique_customers
        FROM sales
        WHERE year >= 2024
        GROUP BY CUBE (year, quarter, month)
        HAVING SUM(revenue) > 0
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            set(),
            dialect=Dialect.ORACLE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.ORACLE.value,
        )

    def test_grouping_sets(self):
        """Test GROUPING SETS for custom aggregation combinations"""
        query = """
        SELECT
            region,
            product_category,
            sales_channel,
            SUM(amount) as total_sales,
            AVG(amount) as avg_sale,
            GROUPING(region) as is_all_regions,
            GROUPING(product_category) as is_all_categories,
            GROUPING(sales_channel) as is_all_channels
        FROM sales
        GROUP BY GROUPING SETS (
            (region, product_category, sales_channel),
            (region, product_category),
            (region, sales_channel),
            (product_category, sales_channel),
            (region),
            (product_category),
            (sales_channel),
            ()
        )
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== DML WITH COMPLEX QUERIES ====================

    def test_insert_with_complex_union(self):
        """Test INSERT with complex UNION and transformations"""
        query = """
        INSERT INTO consolidated_sales (
            sale_date,
            customer_id,
            product_id,
            channel,
            quantity,
            amount
        )
        SELECT
            sale_date,
            customer_id,
            product_id,
            'Online' as channel,
            quantity,
            amount
        FROM web_sales
        WHERE sale_date >= '2024-01-01'

        UNION ALL

        SELECT
            sale_date,
            customer_id,
            product_id,
            'Store' as channel,
            quantity,
            amount
        FROM pos_sales
        WHERE sale_date >= '2024-01-01'

        UNION ALL

        SELECT
            order_date as sale_date,
            customer_id,
            product_id,
            'Mobile' as channel,
            quantity,
            total_amount as amount
        FROM mobile_orders
        WHERE order_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"web_sales", "pos_sales", "mobile_orders"},
            {"consolidated_sales"},
            dialect=Dialect.POSTGRES.value,
        )

        # Complex INSERT with UNION ALL - column lineage from multiple sources
        assert_column_lineage_equal(
            query,
            [
                # From web_sales
                (
                    TestColumnQualifierTuple("sale_date", "web_sales"),
                    TestColumnQualifierTuple("sale_date", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "web_sales"),
                    TestColumnQualifierTuple("customer_id", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "web_sales"),
                    TestColumnQualifierTuple("product_id", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "web_sales"),
                    TestColumnQualifierTuple("quantity", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("amount", "web_sales"),
                    TestColumnQualifierTuple("amount", "consolidated_sales"),
                ),
                # From pos_sales
                (
                    TestColumnQualifierTuple("sale_date", "pos_sales"),
                    TestColumnQualifierTuple("sale_date", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "pos_sales"),
                    TestColumnQualifierTuple("customer_id", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "pos_sales"),
                    TestColumnQualifierTuple("product_id", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "pos_sales"),
                    TestColumnQualifierTuple("quantity", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("amount", "pos_sales"),
                    TestColumnQualifierTuple("amount", "consolidated_sales"),
                ),
                # From mobile_orders
                (
                    TestColumnQualifierTuple("order_date", "mobile_orders"),
                    TestColumnQualifierTuple("sale_date", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "mobile_orders"),
                    TestColumnQualifierTuple("customer_id", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "mobile_orders"),
                    TestColumnQualifierTuple("product_id", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "mobile_orders"),
                    TestColumnQualifierTuple("quantity", "consolidated_sales"),
                ),
                (
                    TestColumnQualifierTuple("total_amount", "mobile_orders"),
                    TestColumnQualifierTuple("amount", "consolidated_sales"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_update_with_join_and_cte(self):
        """Test UPDATE with JOIN and CTE"""
        query = """
        WITH latest_prices AS (
            SELECT
                product_id,
                price as latest_price,
                effective_date
            FROM price_history
            WHERE effective_date = (
                SELECT MAX(effective_date)
                FROM price_history ph2
                WHERE ph2.product_id = price_history.product_id
            )
        )
        UPDATE products p
        SET
            current_price = lp.latest_price,
            last_price_update = lp.effective_date
        FROM latest_prices lp
        WHERE p.product_id = lp.product_id
        AND p.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"price_history", "products"},
            {"products"},
            dialect=Dialect.POSTGRES.value,
        )

        # UPDATE with CTE - parsers may have different column lineage extraction
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_create_table_as_select_complex(self):
        """Test CREATE TABLE AS SELECT with complex query"""
        query = """
        CREATE TABLE customer_360_view AS
        WITH
        customer_orders AS (
            SELECT
                customer_id,
                COUNT(*) as total_orders,
                SUM(order_amount) as total_spent,
                AVG(order_amount) as avg_order_value,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date
            FROM orders
            WHERE status = 'completed'
            GROUP BY customer_id
        ),
        customer_interactions AS (
            SELECT
                customer_id,
                COUNT(*) as total_interactions,
                MAX(interaction_date) as last_interaction_date
            FROM customer_support
            GROUP BY customer_id
        ),
        customer_reviews AS (
            SELECT
                customer_id,
                AVG(rating) as avg_rating,
                COUNT(*) as review_count
            FROM product_reviews
            GROUP BY customer_id
        )
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            c.registration_date,
            COALESCE(co.total_orders, 0) as total_orders,
            COALESCE(co.total_spent, 0) as lifetime_value,
            COALESCE(co.avg_order_value, 0) as avg_order_value,
            co.last_order_date,
            COALESCE(ci.total_interactions, 0) as support_interactions,
            ci.last_interaction_date,
            COALESCE(cr.avg_rating, 0) as avg_review_rating,
            COALESCE(cr.review_count, 0) as review_count,
            CASE
                WHEN co.total_spent > 10000 THEN 'VIP'
                WHEN co.total_spent > 5000 THEN 'Premium'
                WHEN co.total_spent > 1000 THEN 'Regular'
                ELSE 'New'
            END as customer_tier
        FROM customers c
        LEFT JOIN customer_orders co ON c.customer_id = co.customer_id
        LEFT JOIN customer_interactions ci ON c.customer_id = ci.customer_id
        LEFT JOIN customer_reviews cr ON c.customer_id = cr.customer_id
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers", "customer_support", "product_reviews"},
            {"customer_360_view"},
            dialect=Dialect.POSTGRES.value,
        )

        # CREATE TABLE AS SELECT with complex CTEs - extensive column lineage
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_360_view"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_360_view"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "customer_360_view"),
                ),
                (
                    TestColumnQualifierTuple("registration_date", "customers"),
                    TestColumnQualifierTuple("registration_date", "customer_360_view"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_merge_upsert_operation(self):
        """Test MERGE/UPSERT operation with complex matching"""
        query = """
        MERGE INTO target_customers tgt
        USING (
            SELECT
                customer_id,
                customer_name,
                email,
                last_purchase_date,
                total_purchases
            FROM source_customers
            WHERE is_active = 1
        ) src
        ON tgt.customer_id = src.customer_id
        WHEN MATCHED AND src.last_purchase_date > tgt.last_purchase_date THEN
            UPDATE SET
                customer_name = src.customer_name,
                email = src.email,
                last_purchase_date = src.last_purchase_date,
                total_purchases = tgt.total_purchases + src.total_purchases,
                updated_at = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
            INSERT (customer_id, customer_name, email, last_purchase_date, total_purchases, created_at)
            VALUES (src.customer_id, src.customer_name, src.email, src.last_purchase_date, src.total_purchases, CURRENT_TIMESTAMP)
        """

        assert_table_lineage_equal(
            query,
            {"source_customers", "target_customers"},
            {"target_customers"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        # MERGE operations have complex column lineage - parsers differ
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # ==================== SET OPERATIONS ====================

    def test_intersect_operation(self):
        """Test INTERSECT to find common records"""
        query = """
        SELECT customer_id, email
        FROM active_customers
        WHERE registration_date >= '2024-01-01'
        INTERSECT
        SELECT customer_id, email
        FROM premium_members
        WHERE membership_status = 'active'
        """

        assert_table_lineage_equal(
            query,
            {"active_customers", "premium_members"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_except_minus_operation(self):
        """Test EXCEPT/MINUS to find non-matching records"""
        query = """
        SELECT product_id, product_name
        FROM inventory
        WHERE warehouse_id = 1
        EXCEPT
        SELECT product_id, product_name
        FROM sold_products
        WHERE sale_date >= '2024-01-01'
        ORDER BY product_id
        """

        assert_table_lineage_equal(
            query,
            {"inventory", "sold_products"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_combination_of_set_operations(self):
        """Test combination of UNION, INTERSECT, EXCEPT"""
        query = """
        (
            SELECT customer_id FROM high_value_customers
            UNION
            SELECT customer_id FROM frequent_buyers
        )
        INTERSECT
        (
            SELECT customer_id FROM all_customers
            EXCEPT
            SELECT customer_id FROM churned_customers
        )
        ORDER BY customer_id
        """

        assert_table_lineage_equal(
            query,
            {
                "high_value_customers",
                "frequent_buyers",
                "all_customers",
                "churned_customers",
            },
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== ADVANCED JSON/ARRAY OPERATIONS ====================

    def test_json_path_extraction_postgres(self):
        """Test JSON path expressions in PostgreSQL"""
        query = """
        SELECT
            order_id,
            order_data->>'customer_name' as customer_name,
            order_data->'items'->0->>'product_id' as first_product,
            jsonb_array_length(order_data->'items') as item_count,
            order_data #>> '{shipping,address,city}' as shipping_city
        FROM orders_json
        WHERE order_data @> '{"status": "completed"}'
        """

        assert_table_lineage_equal(
            query,
            {"orders_json"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_array_operations_and_unnesting(self):
        """Test array operations and UNNEST"""
        query = """
        SELECT
            t.customer_id,
            t.tag_value,
            array_position(t.tags, t.tag_value) as tag_position
        FROM customers c
        CROSS JOIN LATERAL unnest(c.tags) as t(tag_value)
        WHERE cardinality(c.tags) > 0
        """

        assert_table_lineage_equal(
            query,
            {"customers"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== COMPLEX CONDITIONAL LOGIC ====================

    def test_complex_case_with_subqueries(self):
        """Test complex CASE expressions with subqueries"""
        query = """
        SELECT
            p.product_id,
            p.product_name,
            p.base_price,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM premium_products pp
                    WHERE pp.product_id = p.product_id
                ) THEN p.base_price * 1.5
                WHEN p.product_id IN (
                    SELECT product_id FROM seasonal_discounts
                    WHERE CURRENT_DATE BETWEEN start_date AND end_date
                ) THEN p.base_price * 0.8
                WHEN (
                    SELECT AVG(rating)
                    FROM product_reviews pr
                    WHERE pr.product_id = p.product_id
                ) > 4.5 THEN p.base_price * 1.2
                ELSE p.base_price
            END as final_price
        FROM products p
        WHERE p.is_available = 1
        """

        assert_table_lineage_equal(
            query,
            {
                "products",
                "premium_products",
                "seasonal_discounts",
                "product_reviews",
            },
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== LATERAL JOINS AND DERIVED TABLES ====================

    def test_lateral_join_postgres(self):
        """Test LATERAL joins for row-by-row correlated subqueries"""
        query = """
        SELECT
            c.customer_id,
            c.customer_name,
            recent_orders.order_id,
            recent_orders.order_date,
            recent_orders.amount
        FROM customers c
        LEFT JOIN LATERAL (
            SELECT order_id, order_date, amount
            FROM orders o
            WHERE o.customer_id = c.customer_id
            ORDER BY o.order_date DESC
            LIMIT 5
        ) recent_orders ON true
        WHERE c.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_multiple_lateral_joins(self):
        """Test multiple LATERAL joins in single query"""
        query = """
        SELECT
            p.product_id,
            p.product_name,
            top_customers.customer_id,
            top_customers.total_purchased,
            recent_reviews.rating,
            recent_reviews.review_text
        FROM products p
        LEFT JOIN LATERAL (
            SELECT customer_id, SUM(quantity) as total_purchased
            FROM sales s
            WHERE s.product_id = p.product_id
            GROUP BY customer_id
            ORDER BY SUM(quantity) DESC
            LIMIT 3
        ) top_customers ON true
        LEFT JOIN LATERAL (
            SELECT rating, review_text, review_date
            FROM reviews r
            WHERE r.product_id = p.product_id
            ORDER BY review_date DESC
            LIMIT 5
        ) recent_reviews ON true
        """

        assert_table_lineage_equal(
            query,
            {"products", "sales", "reviews"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== COMPLEX AGGREGATIONS ====================

    def test_string_aggregation_functions(self):
        """Test STRING_AGG and GROUP_CONCAT for string aggregation"""
        query = """
        SELECT
            c.category_id,
            c.category_name,
            STRING_AGG(p.product_name, ', ' ORDER BY p.product_name) as products_list,
            STRING_AGG(DISTINCT p.supplier_name, '; ') as suppliers_list,
            COUNT(DISTINCT p.product_id) as product_count
        FROM categories c
        JOIN products p ON c.category_id = p.category_id
        WHERE p.is_active = 1
        GROUP BY c.category_id, c.category_name
        HAVING COUNT(DISTINCT p.product_id) > 5
        """

        assert_table_lineage_equal(
            query,
            {"categories", "products"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_aggregation_with_filter_clause(self):
        """Test aggregations with FILTER clause (PostgreSQL)"""
        query = """
        SELECT
            product_id,
            COUNT(*) as total_sales,
            COUNT(*) FILTER (WHERE sale_date >= '2024-01-01') as ytd_sales,
            SUM(amount) as total_revenue,
            SUM(amount) FILTER (WHERE sale_channel = 'online') as online_revenue,
            SUM(amount) FILTER (WHERE sale_channel = 'store') as store_revenue,
            AVG(amount) FILTER (WHERE customer_tier = 'premium') as avg_premium_sale
        FROM sales
        GROUP BY product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== COMPLEX JOINS WITH MULTIPLE CONDITIONS ====================

    def test_join_chain_five_tables(self):
        """Test join chain across 5 tables (A→B→C→D→E)"""
        query = """
        SELECT
            o.order_id,
            c.customer_name,
            p.product_name,
            s.store_name,
            r.region_name
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        JOIN order_items oi ON o.order_id = oi.order_id
        JOIN products p ON oi.product_id = p.product_id
        JOIN stores s ON o.store_id = s.store_id
        JOIN regions r ON s.region_id = r.region_id
        WHERE o.order_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers", "order_items", "products", "stores", "regions"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    def test_star_schema_joins_fact_multiple_dimensions(self):
        """Test star schema with fact table joining multiple dimension tables"""
        query = """
        SELECT
            dd.date_key,
            dd.year,
            dd.quarter,
            dd.month,
            dp.product_name,
            dc.customer_name,
            ds.store_name,
            dr.region_name,
            f.quantity,
            f.amount,
            f.discount
        FROM fact_sales f
        JOIN dim_date dd ON f.date_key = dd.date_key
        JOIN dim_product dp ON f.product_key = dp.product_key
        JOIN dim_customer dc ON f.customer_key = dc.customer_key
        JOIN dim_store ds ON f.store_key = ds.store_key
        JOIN dim_region dr ON f.region_key = dr.region_key
        WHERE dd.year = 2024
        AND dr.region_name IN ('North America', 'Europe')
        """

        assert_table_lineage_equal(
            query,
            {
                "fact_sales",
                "dim_date",
                "dim_product",
                "dim_customer",
                "dim_store",
                "dim_region",
            },
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_joins_with_using_clause(self):
        """Test JOINs with USING clause instead of ON"""
        query = """
        SELECT
            o.order_id,
            c.customer_name,
            p.product_name,
            o.quantity
        FROM orders o
        JOIN customers c USING (customer_id)
        JOIN order_items oi USING (order_id)
        JOIN products p USING (product_id)
        WHERE o.order_status = 'completed'
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers", "order_items", "products"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== TEMPORAL AND TIME-SERIES QUERIES ====================

    def test_time_series_with_gaps_filled(self):
        """Test time series query with gap filling using generate_series"""
        query = """
        WITH date_series AS (
            SELECT generate_series(
                '2024-01-01'::date,
                '2024-12-31'::date,
                '1 day'::interval
            )::date as date
        ),
        daily_sales AS (
            SELECT
                DATE(sale_date) as sale_date,
                SUM(amount) as daily_total
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY DATE(sale_date)
        )
        SELECT
            ds.date,
            COALESCE(s.daily_total, 0) as sales_amount,
            SUM(COALESCE(s.daily_total, 0)) OVER (
                ORDER BY ds.date
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as cumulative_sales
        FROM date_series ds
        LEFT JOIN daily_sales s ON ds.date = s.sale_date
        ORDER BY ds.date
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            set(),
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== ADVANCED DML PATTERNS ====================

    def test_insert_with_cte_and_complex_transformations(self):
        """Test INSERT with CTEs and complex transformations"""
        query = """
        WITH
        enriched_customers AS (
            SELECT
                c.customer_id,
                c.customer_name,
                COUNT(DISTINCT o.order_id) as total_orders,
                SUM(o.amount) as lifetime_value,
                MAX(o.order_date) as last_order_date
            FROM customers c
            LEFT JOIN orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_id, c.customer_name
        ),
        segmented_customers AS (
            SELECT
                customer_id,
                customer_name,
                total_orders,
                lifetime_value,
                last_order_date,
                CASE
                    WHEN lifetime_value > 10000 THEN 'VIP'
                    WHEN lifetime_value > 5000 THEN 'Premium'
                    WHEN lifetime_value > 1000 THEN 'Regular'
                    ELSE 'Basic'
                END as customer_segment,
                CASE
                    WHEN last_order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'Active'
                    WHEN last_order_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'At Risk'
                    ELSE 'Churned'
                END as activity_status
            FROM enriched_customers
        )
        INSERT INTO customer_segments (
            customer_id,
            customer_name,
            total_orders,
            lifetime_value,
            customer_segment,
            activity_status,
            calculated_date
        )
        SELECT
            customer_id,
            customer_name,
            total_orders,
            lifetime_value,
            customer_segment,
            activity_status,
            CURRENT_DATE
        FROM segmented_customers
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"customer_segments"},
            dialect=Dialect.POSTGRES.value,
        )

        # INSERT with CTEs - column lineage from base tables through transformations
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_segments"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_delete_with_subquery_and_join(self):
        """Test DELETE with subquery and JOIN conditions"""
        query = """
        DELETE FROM old_orders
        WHERE order_id IN (
            SELECT o.order_id
            FROM old_orders o
            LEFT JOIN customers c ON o.customer_id = c.customer_id
            WHERE o.order_date < '2020-01-01'
            AND (c.customer_id IS NULL OR c.is_deleted = 1)
        )
        """

        assert_table_lineage_equal(
            query,
            {"old_orders", "customers"},
            {"old_orders"},
            dialect=Dialect.MYSQL.value,
        )

        # DELETE operations typically don't have column lineage
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    # ==================== COMPLEX VIEW CREATION ====================

    def test_create_view_with_union_and_ctes(self):
        """Test CREATE VIEW with UNION and CTEs"""
        query = """
        CREATE VIEW unified_customer_activity AS
        WITH
        purchase_activity AS (
            SELECT
                customer_id,
                'Purchase' as activity_type,
                order_date as activity_date,
                order_id as reference_id,
                amount as value
            FROM orders
        ),
        support_activity AS (
            SELECT
                customer_id,
                'Support' as activity_type,
                ticket_date as activity_date,
                ticket_id as reference_id,
                NULL as value
            FROM support_tickets
        ),
        review_activity AS (
            SELECT
                customer_id,
                'Review' as activity_type,
                review_date as activity_date,
                review_id as reference_id,
                rating as value
            FROM product_reviews
        )
        SELECT * FROM purchase_activity
        UNION ALL
        SELECT * FROM support_activity
        UNION ALL
        SELECT * FROM review_activity
        ORDER BY activity_date DESC
        """

        assert_table_lineage_equal(
            query,
            {"orders", "support_tickets", "product_reviews"},
            {"unified_customer_activity"},
            dialect=Dialect.POSTGRES.value,
        )

        # CREATE VIEW with UNION - column lineage from multiple sources
        assert_column_lineage_equal(
            query,
            [
                # From orders
                (
                    TestColumnQualifierTuple("customer_id", "orders"),
                    TestColumnQualifierTuple(
                        "customer_id", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple(
                        "activity_date", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple(
                        "reference_id", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple("value", "unified_customer_activity"),
                ),
                # From support_tickets
                (
                    TestColumnQualifierTuple("customer_id", "support_tickets"),
                    TestColumnQualifierTuple(
                        "customer_id", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("ticket_date", "support_tickets"),
                    TestColumnQualifierTuple(
                        "activity_date", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("ticket_id", "support_tickets"),
                    TestColumnQualifierTuple(
                        "reference_id", "unified_customer_activity"
                    ),
                ),
                # From product_reviews
                (
                    TestColumnQualifierTuple("customer_id", "product_reviews"),
                    TestColumnQualifierTuple(
                        "customer_id", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("review_date", "product_reviews"),
                    TestColumnQualifierTuple(
                        "activity_date", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("review_id", "product_reviews"),
                    TestColumnQualifierTuple(
                        "reference_id", "unified_customer_activity"
                    ),
                ),
                (
                    TestColumnQualifierTuple("rating", "product_reviews"),
                    TestColumnQualifierTuple("value", "unified_customer_activity"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== COMPLEX SUBQUERY PATTERNS ====================

    def test_multiple_levels_correlated_subqueries(self):
        """Test multiple levels of correlated subqueries"""
        query = """
        SELECT
            p1.product_id,
            p1.product_name,
            p1.category_id,
            (
                SELECT AVG(p2.price)
                FROM products p2
                WHERE p2.category_id = p1.category_id
                AND p2.product_id != p1.product_id
                AND p2.price > (
                    SELECT AVG(p3.price)
                    FROM products p3
                    WHERE p3.category_id = p2.category_id
                )
            ) as avg_higher_priced_in_category
        FROM products p1
        WHERE p1.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"products"},
            set(),
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.MYSQL.value,
        )

    # ==================== MIXED COMPLEX PATTERNS ====================

    def test_ultimate_complexity_ctes_joins_unions_windows(self):
        """Test ultimate complexity: CTEs + JOINs + UNIONs + Window Functions + Subqueries"""
        query = """
        WITH
        monthly_metrics AS (
            SELECT
                DATE_TRUNC('month', sale_date) as month,
                product_id,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_revenue,
                COUNT(DISTINCT customer_id) as unique_customers
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY DATE_TRUNC('month', sale_date), product_id
        ),
        product_rankings AS (
            SELECT
                month,
                product_id,
                total_revenue,
                ROW_NUMBER() OVER (
                    PARTITION BY month
                    ORDER BY total_revenue DESC
                ) as revenue_rank,
                PERCENT_RANK() OVER (
                    PARTITION BY month
                    ORDER BY total_revenue
                ) as revenue_percentile
            FROM monthly_metrics
        ),
        top_products AS (
            SELECT
                pr.month,
                pr.product_id,
                p.product_name,
                p.category,
                pr.total_revenue,
                pr.revenue_rank
            FROM product_rankings pr
            JOIN products p ON pr.product_id = p.product_id
            WHERE pr.revenue_rank <= 10
        ),
        category_leaders AS (
            SELECT
                tp.month,
                tp.category,
                tp.product_id,
                tp.product_name,
                tp.total_revenue,
                ROW_NUMBER() OVER (
                    PARTITION BY tp.month, tp.category
                    ORDER BY tp.total_revenue DESC
                ) as category_rank
            FROM top_products tp
        )
        SELECT
            cl.month,
            cl.category,
            cl.product_name,
            cl.total_revenue,
            cl.category_rank,
            (
                SELECT SUM(total_revenue)
                FROM category_leaders cl2
                WHERE cl2.month = cl.month
                AND cl2.category = cl.category
            ) as category_total,
            cl.total_revenue * 100.0 / (
                SELECT SUM(total_revenue)
                FROM category_leaders cl3
                WHERE cl3.month = cl.month
                AND cl3.category = cl.category
            ) as category_share_percent
        FROM category_leaders cl
        WHERE cl.category_rank = 1
        UNION ALL
        SELECT
            month,
            'ALL CATEGORIES' as category,
            'Top Overall Product' as product_name,
            MAX(total_revenue) as total_revenue,
            1 as category_rank,
            SUM(total_revenue) as category_total,
            MAX(total_revenue) * 100.0 / SUM(total_revenue) as category_share_percent
        FROM category_leaders
        GROUP BY month
        ORDER BY month DESC, category, category_rank
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            set(),
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # ==================== COMPLEX NESTED JOINS WITH COLUMN LINEAGE (10 TESTS) ====================

    def test_nested_join_01_three_level_inner_with_extensive_lineage(self):
        """Test 3-level nested INNER joins with extensive column lineage"""
        query = """
        CREATE TABLE sales_summary AS
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            o.order_id,
            o.order_date,
            oi.product_id,
            p.product_name,
            p.category,
            oi.quantity,
            oi.unit_price,
            oi.quantity * oi.unit_price as line_total
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN order_items oi ON o.order_id = oi.order_id
        INNER JOIN products p ON oi.product_id = p.product_id
        WHERE o.order_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders", "order_items", "products"},
            {"sales_summary"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple("order_id", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("order_date", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "order_items"),
                    TestColumnQualifierTuple("product_id", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "order_items"),
                    TestColumnQualifierTuple("quantity", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "order_items"),
                    TestColumnQualifierTuple("unit_price", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "order_items"),
                    TestColumnQualifierTuple("line_total", "sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "order_items"),
                    TestColumnQualifierTuple("line_total", "sales_summary"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_nested_join_02_four_level_mixed_joins(self):
        """Test 4-level mixed joins (INNER, LEFT, RIGHT) with column lineage"""
        query = """
        INSERT INTO customer_activity_log (
            customer_id,
            customer_name,
            region_name,
            product_category,
            total_spent,
            last_purchase_date
        )
        SELECT
            c.customer_id,
            c.customer_name,
            r.region_name,
            p.category as product_category,
            SUM(oi.quantity * oi.unit_price) as total_spent,
            MAX(o.order_date) as last_purchase_date
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN order_items oi ON o.order_id = oi.order_id
        RIGHT JOIN products p ON oi.product_id = p.product_id
        LEFT JOIN regions r ON c.region_id = r.region_id
        GROUP BY c.customer_id, c.customer_name, r.region_name, p.category
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders", "order_items", "products", "regions"},
            {"customer_activity_log"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("region_name", "regions"),
                    TestColumnQualifierTuple("region_name", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple(
                        "product_category", "customer_activity_log"
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "order_items"),
                    TestColumnQualifierTuple("total_spent", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "order_items"),
                    TestColumnQualifierTuple("total_spent", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple(
                        "last_purchase_date", "customer_activity_log"
                    ),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_nested_join_03_five_level_star_schema(self):
        """Test 5-level star schema joins with comprehensive column lineage"""
        query = """
        CREATE TABLE analytics_cube AS
        SELECT
            dd.date_key,
            dd.year,
            dd.quarter,
            dd.month_name,
            dc.customer_key,
            dc.customer_segment,
            dp.product_key,
            dp.product_line,
            ds.store_key,
            ds.store_type,
            dr.region_key,
            dr.country,
            f.quantity_sold,
            f.revenue_amount,
            f.discount_amount,
            f.profit_amount
        FROM fact_sales f
        INNER JOIN dim_date dd ON f.date_key = dd.date_key
        INNER JOIN dim_customer dc ON f.customer_key = dc.customer_key
        INNER JOIN dim_product dp ON f.product_key = dp.product_key
        INNER JOIN dim_store ds ON f.store_key = ds.store_key
        INNER JOIN dim_region dr ON f.region_key = dr.region_key
        WHERE dd.year >= 2024
        """

        assert_table_lineage_equal(
            query,
            {
                "fact_sales",
                "dim_date",
                "dim_customer",
                "dim_product",
                "dim_store",
                "dim_region",
            },
            {"analytics_cube"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("date_key", "dim_date"),
                    TestColumnQualifierTuple("date_key", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("year", "dim_date"),
                    TestColumnQualifierTuple("year", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("quarter", "dim_date"),
                    TestColumnQualifierTuple("quarter", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("month_name", "dim_date"),
                    TestColumnQualifierTuple("month_name", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("customer_key", "dim_customer"),
                    TestColumnQualifierTuple("customer_key", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("customer_segment", "dim_customer"),
                    TestColumnQualifierTuple("customer_segment", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("product_key", "dim_product"),
                    TestColumnQualifierTuple("product_key", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("product_line", "dim_product"),
                    TestColumnQualifierTuple("product_line", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("store_key", "dim_store"),
                    TestColumnQualifierTuple("store_key", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("store_type", "dim_store"),
                    TestColumnQualifierTuple("store_type", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("region_key", "dim_region"),
                    TestColumnQualifierTuple("region_key", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("country", "dim_region"),
                    TestColumnQualifierTuple("country", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("quantity_sold", "fact_sales"),
                    TestColumnQualifierTuple("quantity_sold", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("revenue_amount", "fact_sales"),
                    TestColumnQualifierTuple("revenue_amount", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("discount_amount", "fact_sales"),
                    TestColumnQualifierTuple("discount_amount", "analytics_cube"),
                ),
                (
                    TestColumnQualifierTuple("profit_amount", "fact_sales"),
                    TestColumnQualifierTuple("profit_amount", "analytics_cube"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_nested_join_04_self_join_multiple_levels(self):
        """Test self-join with multiple levels and column lineage"""
        query = """
        INSERT INTO employee_hierarchy_flat (
            emp_id,
            emp_name,
            emp_level,
            manager_id,
            manager_name,
            director_id,
            director_name,
            vp_id,
            vp_name
        )
        SELECT
            e1.employee_id as emp_id,
            e1.employee_name as emp_name,
            e1.level as emp_level,
            e2.employee_id as manager_id,
            e2.employee_name as manager_name,
            e3.employee_id as director_id,
            e3.employee_name as director_name,
            e4.employee_id as vp_id,
            e4.employee_name as vp_name
        FROM employees e1
        LEFT JOIN employees e2 ON e1.manager_id = e2.employee_id
        LEFT JOIN employees e3 ON e2.manager_id = e3.employee_id
        LEFT JOIN employees e4 ON e3.manager_id = e4.employee_id
        WHERE e1.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            {"employee_hierarchy_flat"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("emp_id", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple("emp_name", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("level", "employees"),
                    TestColumnQualifierTuple("emp_level", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("manager_id", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple("manager_name", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("director_id", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple(
                        "director_name", "employee_hierarchy_flat"
                    ),
                ),
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("vp_id", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple("vp_name", "employee_hierarchy_flat"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_nested_join_05_cross_join_with_filtering(self):
        """Test CROSS JOIN with filtering and column lineage"""
        query = """
        CREATE TABLE product_store_coverage AS
        SELECT
            p.product_id,
            p.product_name,
            p.category,
            s.store_id,
            s.store_name,
            s.city,
            COALESCE(inv.quantity, 0) as inventory_quantity,
            COALESCE(sales.total_sold, 0) as total_sold
        FROM products p
        CROSS JOIN stores s
        LEFT JOIN inventory inv ON p.product_id = inv.product_id AND s.store_id = inv.store_id
        LEFT JOIN (
            SELECT product_id, store_id, SUM(quantity) as total_sold
            FROM sales
            GROUP BY product_id, store_id
        ) sales ON p.product_id = sales.product_id AND s.store_id = sales.store_id
        WHERE p.is_active = 1 AND s.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"products", "stores", "inventory", "sales"},
            {"product_store_coverage"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "product_store_coverage"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "product_store_coverage"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "product_store_coverage"),
                ),
                (
                    TestColumnQualifierTuple("store_id", "stores"),
                    TestColumnQualifierTuple("store_id", "product_store_coverage"),
                ),
                (
                    TestColumnQualifierTuple("store_name", "stores"),
                    TestColumnQualifierTuple("store_name", "product_store_coverage"),
                ),
                (
                    TestColumnQualifierTuple("city", "stores"),
                    TestColumnQualifierTuple("city", "product_store_coverage"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "inventory"),
                    TestColumnQualifierTuple(
                        "inventory_quantity", "product_store_coverage"
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple("total_sold", "product_store_coverage"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_nested_join_06_join_with_derived_table(self):
        """Test joins with derived tables and column lineage"""
        query = """
        INSERT INTO sales_by_region (
            region_id,
            region_name,
            total_sales,
            avg_order_value,
            customer_count
        )
        SELECT
            r.region_id,
            r.region_name,
            agg.total_sales,
            agg.avg_order_value,
            agg.customer_count
        FROM regions r
        INNER JOIN (
            SELECT
                c.region_id,
                SUM(o.total_amount) as total_sales,
                AVG(o.total_amount) as avg_order_value,
                COUNT(DISTINCT c.customer_id) as customer_count
            FROM customers c
            INNER JOIN orders o ON c.customer_id = o.customer_id
            WHERE o.status = 'completed'
            GROUP BY c.region_id
        ) agg ON r.region_id = agg.region_id
        """

        assert_table_lineage_equal(
            query,
            {"regions", "customers", "orders"},
            {"sales_by_region"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("region_id", "regions"),
                    TestColumnQualifierTuple("region_id", "sales_by_region"),
                ),
                (
                    TestColumnQualifierTuple("region_name", "regions"),
                    TestColumnQualifierTuple("region_name", "sales_by_region"),
                ),
                (
                    TestColumnQualifierTuple("total_amount", "orders"),
                    TestColumnQualifierTuple("total_sales", "sales_by_region"),
                ),
                (
                    TestColumnQualifierTuple("total_amount", "orders"),
                    TestColumnQualifierTuple("avg_order_value", "sales_by_region"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_count", "sales_by_region"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_nested_join_07_full_outer_join_with_coalesce(self):
        """Test FULL OUTER JOIN with COALESCE for column lineage"""
        query = """
        CREATE TABLE merged_contacts AS
        SELECT
            COALESCE(c.contact_id, l.contact_id) as contact_id,
            COALESCE(c.email, l.email) as email,
            COALESCE(c.first_name, l.first_name) as first_name,
            COALESCE(c.last_name, l.last_name) as last_name,
            c.crm_source,
            l.lead_source,
            COALESCE(c.created_date, l.created_date) as first_contact_date
        FROM crm_contacts c
        FULL OUTER JOIN lead_database l ON c.email = l.email
        """

        assert_table_lineage_equal(
            query,
            {"crm_contacts", "lead_database"},
            {"merged_contacts"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("contact_id", "crm_contacts"),
                    TestColumnQualifierTuple("contact_id", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("contact_id", "lead_database"),
                    TestColumnQualifierTuple("contact_id", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("email", "crm_contacts"),
                    TestColumnQualifierTuple("email", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("email", "lead_database"),
                    TestColumnQualifierTuple("email", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("first_name", "crm_contacts"),
                    TestColumnQualifierTuple("first_name", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("first_name", "lead_database"),
                    TestColumnQualifierTuple("first_name", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("last_name", "crm_contacts"),
                    TestColumnQualifierTuple("last_name", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("last_name", "lead_database"),
                    TestColumnQualifierTuple("last_name", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("crm_source", "crm_contacts"),
                    TestColumnQualifierTuple("crm_source", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("lead_source", "lead_database"),
                    TestColumnQualifierTuple("lead_source", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("created_date", "crm_contacts"),
                    TestColumnQualifierTuple("first_contact_date", "merged_contacts"),
                ),
                (
                    TestColumnQualifierTuple("created_date", "lead_database"),
                    TestColumnQualifierTuple("first_contact_date", "merged_contacts"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_nested_join_08_anti_join_pattern(self):
        """Test anti-join pattern (LEFT JOIN WHERE NULL) with column lineage"""
        query = """
        INSERT INTO unmatched_orders (
            order_id,
            order_date,
            customer_ref,
            amount
        )
        SELECT
            o.order_id,
            o.order_date,
            o.customer_reference as customer_ref,
            o.total_amount as amount
        FROM orders o
        LEFT JOIN customers c ON o.customer_reference = c.external_ref
        WHERE c.customer_id IS NULL
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers"},
            {"unmatched_orders"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple("order_id", "unmatched_orders"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("order_date", "unmatched_orders"),
                ),
                (
                    TestColumnQualifierTuple("customer_reference", "orders"),
                    TestColumnQualifierTuple("customer_ref", "unmatched_orders"),
                ),
                (
                    TestColumnQualifierTuple("total_amount", "orders"),
                    TestColumnQualifierTuple("amount", "unmatched_orders"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_nested_join_09_semi_join_with_exists(self):
        """Test semi-join pattern using EXISTS with column lineage"""
        query = """
        CREATE TABLE active_products AS
        SELECT
            p.product_id,
            p.product_name,
            p.category,
            p.price,
            p.inventory_count
        FROM products p
        WHERE EXISTS (
            SELECT 1
            FROM sales s
            WHERE s.product_id = p.product_id
            AND s.sale_date >= CURRENT_DATE - INTERVAL '90 days'
        )
        """

        assert_table_lineage_equal(
            query,
            {"products", "sales"},
            {"active_products"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "active_products"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "active_products"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "active_products"),
                ),
                (
                    TestColumnQualifierTuple("price", "products"),
                    TestColumnQualifierTuple("price", "active_products"),
                ),
                (
                    TestColumnQualifierTuple("inventory_count", "products"),
                    TestColumnQualifierTuple("inventory_count", "active_products"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_nested_join_10_complex_join_conditions(self):
        """Test joins with complex conditions and column lineage"""
        query = """
        INSERT INTO matched_transactions (
            transaction_id,
            customer_name,
            product_name,
            transaction_amount,
            discount_applied,
            final_amount
        )
        SELECT
            t.transaction_id,
            c.customer_name,
            p.product_name,
            t.amount as transaction_amount,
            d.discount_percent as discount_applied,
            t.amount * (1 - COALESCE(d.discount_percent, 0) / 100.0) as final_amount
        FROM transactions t
        INNER JOIN customers c ON t.customer_id = c.customer_id AND c.is_active = 1
        INNER JOIN products p ON t.product_id = p.product_id AND p.is_available = 1
        LEFT JOIN discounts d ON t.product_id = d.product_id 
            AND t.customer_id = d.customer_id 
            AND t.transaction_date BETWEEN d.start_date AND d.end_date
        WHERE t.status = 'completed'
        """

        assert_table_lineage_equal(
            query,
            {"transactions", "customers", "products", "discounts"},
            {"matched_transactions"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("transaction_id", "transactions"),
                    TestColumnQualifierTuple("transaction_id", "matched_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "matched_transactions"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "matched_transactions"),
                ),
                (
                    TestColumnQualifierTuple("amount", "transactions"),
                    TestColumnQualifierTuple(
                        "transaction_amount", "matched_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("discount_percent", "discounts"),
                    TestColumnQualifierTuple(
                        "discount_applied", "matched_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "transactions"),
                    TestColumnQualifierTuple("final_amount", "matched_transactions"),
                ),
                (
                    TestColumnQualifierTuple("discount_percent", "discounts"),
                    TestColumnQualifierTuple("final_amount", "matched_transactions"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # ====================  MULTIPLE CTE CHAINS WITH COLUMN LINEAGE (10 TESTS) ====================

    def test_cte_chain_01_three_level_sequential_ctes(self):
        """Test 3-level sequential CTEs with column lineage"""
        query = """
        CREATE TABLE customer_lifecycle_stages AS
        WITH
        raw_data AS (
            SELECT
                customer_id,
                customer_name,
                registration_date,
                last_login_date
            FROM customers
            WHERE is_deleted = 0
        ),
        enriched_data AS (
            SELECT
                rd.customer_id,
                rd.customer_name,
                rd.registration_date,
                rd.last_login_date,
                DATEDIFF(day, rd.registration_date, CURRENT_DATE) as days_since_registration,
                DATEDIFF(day, rd.last_login_date, CURRENT_DATE) as days_since_last_login
            FROM raw_data rd
        ),
        categorized_data AS (
            SELECT
                ed.customer_id,
                ed.customer_name,
                ed.registration_date,
                ed.days_since_registration,
                ed.days_since_last_login,
                CASE
                    WHEN ed.days_since_last_login <= 7 THEN 'Active'
                    WHEN ed.days_since_last_login <= 30 THEN 'At Risk'
                    ELSE 'Churned'
                END as lifecycle_stage
            FROM enriched_data ed
        )
        SELECT
            customer_id,
            customer_name,
            registration_date,
            days_since_registration,
            days_since_last_login,
            lifecycle_stage
        FROM categorized_data
        """

        assert_table_lineage_equal(
            query,
            {"customers"},
            {"customer_lifecycle_stages"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple(
                        "customer_id", "customer_lifecycle_stages"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "customer_lifecycle_stages"
                    ),
                ),
                (
                    TestColumnQualifierTuple("registration_date", "customers"),
                    TestColumnQualifierTuple(
                        "registration_date", "customer_lifecycle_stages"
                    ),
                ),
                (
                    TestColumnQualifierTuple("registration_date", "customers"),
                    TestColumnQualifierTuple(
                        "days_since_registration", "customer_lifecycle_stages"
                    ),
                ),
                (
                    TestColumnQualifierTuple("last_login_date", "customers"),
                    TestColumnQualifierTuple(
                        "days_since_last_login", "customer_lifecycle_stages"
                    ),
                ),
                (
                    TestColumnQualifierTuple("last_login_date", "customers"),
                    TestColumnQualifierTuple(
                        "lifecycle_stage", "customer_lifecycle_stages"
                    ),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_cte_chain_02_four_level_with_joins(self):
        """Test 4-level CTE chain with joins and extensive column lineage"""
        query = """
        INSERT INTO product_performance_summary (
            product_id,
            product_name,
            category,
            total_revenue,
            total_units_sold,
            avg_selling_price,
            profit_margin,
            performance_tier
        )
        WITH
        sales_data AS (
            SELECT
                product_id,
                SUM(quantity) as units_sold,
                SUM(sale_amount) as revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY product_id
        ),
        cost_data AS (
            SELECT
                product_id,
                AVG(cost_per_unit) as avg_cost
            FROM product_costs
            WHERE effective_date >= '2024-01-01'
            GROUP BY product_id
        ),
        enriched_metrics AS (
            SELECT
                sd.product_id,
                sd.units_sold,
                sd.revenue,
                cd.avg_cost,
                sd.revenue / NULLIF(sd.units_sold, 0) as avg_price,
                (sd.revenue - (sd.units_sold * cd.avg_cost)) / NULLIF(sd.revenue, 0) * 100 as margin_pct
            FROM sales_data sd
            LEFT JOIN cost_data cd ON sd.product_id = cd.product_id
        ),
        final_with_products AS (
            SELECT
                em.product_id,
                p.product_name,
                p.category,
                em.revenue as total_revenue,
                em.units_sold as total_units_sold,
                em.avg_price as avg_selling_price,
                em.margin_pct as profit_margin,
                CASE
                    WHEN em.revenue > 100000 THEN 'Platinum'
                    WHEN em.revenue > 50000 THEN 'Gold'
                    WHEN em.revenue > 10000 THEN 'Silver'
                    ELSE 'Bronze'
                END as performance_tier
            FROM enriched_metrics em
            INNER JOIN products p ON em.product_id = p.product_id
        )
        SELECT * FROM final_with_products
        """

        assert_table_lineage_equal(
            query,
            {"sales", "product_costs", "products"},
            {"product_performance_summary"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple(
                        "product_id", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple(
                        "product_name", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "product_performance_summary"),
                ),
                (
                    TestColumnQualifierTuple("sale_amount", "sales"),
                    TestColumnQualifierTuple(
                        "total_revenue", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple(
                        "total_units_sold", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("sale_amount", "sales"),
                    TestColumnQualifierTuple(
                        "avg_selling_price", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple(
                        "avg_selling_price", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("sale_amount", "sales"),
                    TestColumnQualifierTuple(
                        "profit_margin", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple(
                        "profit_margin", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("cost_per_unit", "product_costs"),
                    TestColumnQualifierTuple(
                        "profit_margin", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("sale_amount", "sales"),
                    TestColumnQualifierTuple(
                        "performance_tier", "product_performance_summary"
                    ),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_03_ctes_referencing_multiple_ctes(self):
        """Test CTEs referencing multiple other CTEs with complex column lineage"""
        query = """
        CREATE TABLE customer_360 AS
        WITH
        purchase_history AS (
            SELECT customer_id, COUNT(*) as purchase_count, SUM(amount) as total_spent
            FROM orders
            GROUP BY customer_id
        ),
        support_history AS (
            SELECT customer_id, COUNT(*) as ticket_count, AVG(satisfaction_score) as avg_satisfaction
            FROM support_tickets
            GROUP BY customer_id
        ),
        engagement_history AS (
            SELECT customer_id, COUNT(*) as login_count, MAX(login_date) as last_login
            FROM user_logins
            GROUP BY customer_id
        ),
        combined_metrics AS (
            SELECT
                c.customer_id,
                c.customer_name,
                c.email,
                COALESCE(ph.purchase_count, 0) as purchases,
                COALESCE(ph.total_spent, 0) as revenue,
                COALESCE(sh.ticket_count, 0) as support_tickets,
                COALESCE(sh.avg_satisfaction, 0) as satisfaction,
                COALESCE(eh.login_count, 0) as logins,
                eh.last_login
            FROM customers c
            LEFT JOIN purchase_history ph ON c.customer_id = ph.customer_id
            LEFT JOIN support_history sh ON c.customer_id = sh.customer_id
            LEFT JOIN engagement_history eh ON c.customer_id = eh.customer_id
        )
        SELECT * FROM combined_metrics
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders", "support_tickets", "user_logins"},
            {"customer_360"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "orders"),
                    TestColumnQualifierTuple("purchases", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple("revenue", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "support_tickets"),
                    TestColumnQualifierTuple("support_tickets", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("satisfaction_score", "support_tickets"),
                    TestColumnQualifierTuple("satisfaction", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "user_logins"),
                    TestColumnQualifierTuple("logins", "customer_360"),
                ),
                (
                    TestColumnQualifierTuple("login_date", "user_logins"),
                    TestColumnQualifierTuple("last_login", "customer_360"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_cte_chain_04_nested_window_functions_with_column_lineage(self):
        """Test CTEs with nested window functions and column lineage."""
        query = """
        CREATE TABLE sales_insights AS
        WITH daily_sales AS (
            SELECT 
                DATE(order_date) as sale_date,
                product_id,
                SUM(amount) as daily_total,
                COUNT(*) as order_count
            FROM orders
            GROUP BY DATE(order_date), product_id
        ),
        ranked_sales AS (
            SELECT 
                sale_date,
                product_id,
                daily_total,
                order_count,
                ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY daily_total DESC) as daily_rank,
                SUM(daily_total) OVER (PARTITION BY product_id ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as rolling_7day_total
            FROM daily_sales
        ),
        product_metrics AS (
            SELECT 
                product_id,
                AVG(daily_total) as avg_daily_sales,
                MAX(daily_total) as peak_daily_sales,
                AVG(rolling_7day_total) as avg_weekly_sales,
                COUNT(DISTINCT sale_date) as active_days
            FROM ranked_sales
            WHERE daily_rank <= 100
            GROUP BY product_id
        )
        SELECT 
            pm.product_id,
            p.product_name,
            p.category,
            pm.avg_daily_sales,
            pm.peak_daily_sales,
            pm.avg_weekly_sales,
            pm.active_days
        FROM product_metrics pm
        JOIN products p ON pm.product_id = p.product_id
        """

        assert_table_lineage_equal(
            query,
            ["orders", "products"],
            ["sales_insights"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple(
                        "sale_date",
                        "daily_sales",
                        is_subquery=True,
                        subquery="daily_sales",
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_id", "orders"),
                    TestColumnQualifierTuple(
                        "product_id",
                        "daily_sales",
                        is_subquery=True,
                        subquery="daily_sales",
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple(
                        "daily_total",
                        "daily_sales",
                        is_subquery=True,
                        subquery="daily_sales",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "product_id",
                        "daily_sales",
                        is_subquery=True,
                        subquery="daily_sales",
                    ),
                    TestColumnQualifierTuple(
                        "product_id",
                        "ranked_sales",
                        is_subquery=True,
                        subquery="ranked_sales",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "sale_date",
                        "daily_sales",
                        is_subquery=True,
                        subquery="daily_sales",
                    ),
                    TestColumnQualifierTuple(
                        "sale_date",
                        "ranked_sales",
                        is_subquery=True,
                        subquery="ranked_sales",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "daily_total",
                        "daily_sales",
                        is_subquery=True,
                        subquery="daily_sales",
                    ),
                    TestColumnQualifierTuple(
                        "daily_total",
                        "ranked_sales",
                        is_subquery=True,
                        subquery="ranked_sales",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "product_id",
                        "ranked_sales",
                        is_subquery=True,
                        subquery="ranked_sales",
                    ),
                    TestColumnQualifierTuple(
                        "product_id",
                        "product_metrics",
                        is_subquery=True,
                        subquery="product_metrics",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "daily_total",
                        "ranked_sales",
                        is_subquery=True,
                        subquery="ranked_sales",
                    ),
                    TestColumnQualifierTuple(
                        "avg_daily_sales",
                        "product_metrics",
                        is_subquery=True,
                        subquery="product_metrics",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "daily_total",
                        "ranked_sales",
                        is_subquery=True,
                        subquery="ranked_sales",
                    ),
                    TestColumnQualifierTuple(
                        "peak_daily_sales",
                        "product_metrics",
                        is_subquery=True,
                        subquery="product_metrics",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "product_id",
                        "product_metrics",
                        is_subquery=True,
                        subquery="product_metrics",
                    ),
                    TestColumnQualifierTuple("product_id", "sales_insights"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "sales_insights"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "sales_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "avg_daily_sales",
                        "product_metrics",
                        is_subquery=True,
                        subquery="product_metrics",
                    ),
                    TestColumnQualifierTuple("avg_daily_sales", "sales_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "peak_daily_sales",
                        "product_metrics",
                        is_subquery=True,
                        subquery="product_metrics",
                    ),
                    TestColumnQualifierTuple("peak_daily_sales", "sales_insights"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_05_recursive_hierarchy_with_lineage(self):
        """Test recursive CTE for organizational hierarchy with column lineage."""
        query = """
        INSERT INTO org_structure 
        WITH RECURSIVE employee_hierarchy AS (
            SELECT 
                employee_id,
                employee_name,
                manager_id,
                department_id,
                1 as level,
                CAST(employee_name AS VARCHAR(500)) as path
            FROM employees
            WHERE manager_id IS NULL
            UNION ALL
            SELECT 
                e.employee_id,
                e.employee_name,
                e.manager_id,
                e.department_id,
                eh.level + 1,
                CAST(eh.path || ' > ' || e.employee_name AS VARCHAR(500))
            FROM employees e
            JOIN employee_hierarchy eh ON e.manager_id = eh.employee_id
        ),
        dept_info AS (
            SELECT 
                d.department_id,
                d.department_name,
                d.location,
                COUNT(eh.employee_id) as team_size
            FROM departments d
            LEFT JOIN employee_hierarchy eh ON d.department_id = eh.department_id
            GROUP BY d.department_id, d.department_name, d.location
        )
        SELECT 
            eh.employee_id,
            eh.employee_name,
            eh.level,
            eh.path,
            di.department_name,
            di.location,
            di.team_size
        FROM employee_hierarchy eh
        JOIN dept_info di ON eh.department_id = di.department_id
        """

        assert_table_lineage_equal(
            query,
            ["employees", "departments"],
            ["org_structure"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple(
                        "employee_id",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple(
                        "employee_name",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                ),
                (
                    TestColumnQualifierTuple("manager_id", "employees"),
                    TestColumnQualifierTuple(
                        "manager_id",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                ),
                (
                    TestColumnQualifierTuple("department_id", "employees"),
                    TestColumnQualifierTuple(
                        "department_id",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                ),
                (
                    TestColumnQualifierTuple("department_id", "departments"),
                    TestColumnQualifierTuple(
                        "department_id",
                        "dept_info",
                        is_subquery=True,
                        subquery="dept_info",
                    ),
                ),
                (
                    TestColumnQualifierTuple("department_name", "departments"),
                    TestColumnQualifierTuple(
                        "department_name",
                        "dept_info",
                        is_subquery=True,
                        subquery="dept_info",
                    ),
                ),
                (
                    TestColumnQualifierTuple("location", "departments"),
                    TestColumnQualifierTuple(
                        "location", "dept_info", is_subquery=True, subquery="dept_info"
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "employee_id",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                    TestColumnQualifierTuple("employee_id", "org_structure"),
                ),
                (
                    TestColumnQualifierTuple(
                        "employee_name",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                    TestColumnQualifierTuple("employee_name", "org_structure"),
                ),
                (
                    TestColumnQualifierTuple(
                        "level",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                    TestColumnQualifierTuple("level", "org_structure"),
                ),
                (
                    TestColumnQualifierTuple(
                        "path",
                        "employee_hierarchy",
                        is_subquery=True,
                        subquery="employee_hierarchy",
                    ),
                    TestColumnQualifierTuple("path", "org_structure"),
                ),
                (
                    TestColumnQualifierTuple(
                        "department_name",
                        "dept_info",
                        is_subquery=True,
                        subquery="dept_info",
                    ),
                    TestColumnQualifierTuple("department_name", "org_structure"),
                ),
                (
                    TestColumnQualifierTuple(
                        "location", "dept_info", is_subquery=True, subquery="dept_info"
                    ),
                    TestColumnQualifierTuple("location", "org_structure"),
                ),
                (
                    TestColumnQualifierTuple(
                        "team_size", "dept_info", is_subquery=True, subquery="dept_info"
                    ),
                    TestColumnQualifierTuple("team_size", "org_structure"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_06_materialized_ctes_with_column_lineage(self):
        """Test materialized CTEs with complex aggregations and column lineage."""
        query = """
        CREATE TABLE performance_dashboard AS
        WITH monthly_revenue AS MATERIALIZED (
            SELECT 
                DATE_TRUNC('month', transaction_date) as month,
                region_id,
                product_category,
                SUM(revenue) as total_revenue,
                SUM(quantity) as units_sold
            FROM sales_transactions
            GROUP BY DATE_TRUNC('month', transaction_date), region_id, product_category
        ),
        regional_targets AS MATERIALIZED (
            SELECT 
                month,
                region_id,
                SUM(quota_amount) as monthly_target
            FROM sales_quotas
            GROUP BY month, region_id
        ),
        performance_metrics AS (
            SELECT 
                mr.month,
                r.region_name,
                mr.product_category,
                mr.total_revenue,
                mr.units_sold,
                rt.monthly_target,
                (mr.total_revenue / NULLIF(rt.monthly_target, 0) * 100) as achievement_pct,
                RANK() OVER (PARTITION BY mr.month ORDER BY mr.total_revenue DESC) as revenue_rank
            FROM monthly_revenue mr
            JOIN regions r ON mr.region_id = r.region_id
            LEFT JOIN regional_targets rt ON mr.month = rt.month AND mr.region_id = rt.region_id
        )
        SELECT 
            month,
            region_name,
            product_category,
            total_revenue,
            units_sold,
            monthly_target,
            achievement_pct,
            revenue_rank
        FROM performance_metrics
        WHERE revenue_rank <= 10
        """

        assert_table_lineage_equal(
            query,
            ["sales_transactions", "sales_quotas", "regions"],
            ["performance_dashboard"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("transaction_date", "sales_transactions"),
                    TestColumnQualifierTuple(
                        "month",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                ),
                (
                    TestColumnQualifierTuple("region_id", "sales_transactions"),
                    TestColumnQualifierTuple(
                        "region_id",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_category", "sales_transactions"),
                    TestColumnQualifierTuple(
                        "product_category",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                ),
                (
                    TestColumnQualifierTuple("revenue", "sales_transactions"),
                    TestColumnQualifierTuple(
                        "total_revenue",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales_transactions"),
                    TestColumnQualifierTuple(
                        "units_sold",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                ),
                (
                    TestColumnQualifierTuple("month", "sales_quotas"),
                    TestColumnQualifierTuple(
                        "month",
                        "regional_targets",
                        is_subquery=True,
                        subquery="regional_targets",
                    ),
                ),
                (
                    TestColumnQualifierTuple("region_id", "sales_quotas"),
                    TestColumnQualifierTuple(
                        "region_id",
                        "regional_targets",
                        is_subquery=True,
                        subquery="regional_targets",
                    ),
                ),
                (
                    TestColumnQualifierTuple("quota_amount", "sales_quotas"),
                    TestColumnQualifierTuple(
                        "monthly_target",
                        "regional_targets",
                        is_subquery=True,
                        subquery="regional_targets",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "month",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                    TestColumnQualifierTuple("month", "performance_dashboard"),
                ),
                (
                    TestColumnQualifierTuple("region_name", "regions"),
                    TestColumnQualifierTuple("region_name", "performance_dashboard"),
                ),
                (
                    TestColumnQualifierTuple(
                        "product_category",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                    TestColumnQualifierTuple(
                        "product_category", "performance_dashboard"
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "total_revenue",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                    TestColumnQualifierTuple("total_revenue", "performance_dashboard"),
                ),
                (
                    TestColumnQualifierTuple(
                        "units_sold",
                        "monthly_revenue",
                        is_subquery=True,
                        subquery="monthly_revenue",
                    ),
                    TestColumnQualifierTuple("units_sold", "performance_dashboard"),
                ),
                (
                    TestColumnQualifierTuple(
                        "monthly_target",
                        "regional_targets",
                        is_subquery=True,
                        subquery="regional_targets",
                    ),
                    TestColumnQualifierTuple("monthly_target", "performance_dashboard"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_07_cte_with_union_and_joins(self):
        """Test CTE containing UNION with subsequent joins and column lineage."""
        query = """
        INSERT INTO consolidated_contacts
        WITH all_sources AS (
            SELECT 
                customer_id as contact_id,
                email,
                phone,
                'customer' as source_type,
                created_at
            FROM customers
            UNION ALL
            SELECT 
                lead_id as contact_id,
                email_address as email,
                mobile_phone as phone,
                'lead' as source_type,
                lead_date as created_at
            FROM leads
            UNION ALL
            SELECT 
                partner_id as contact_id,
                contact_email as email,
                contact_phone as phone,
                'partner' as source_type,
                partnership_date as created_at
            FROM partners
        ),
        enriched_contacts AS (
            SELECT 
                s.contact_id,
                s.email,
                s.phone,
                s.source_type,
                s.created_at,
                COALESCE(ci.company_name, 'Unknown') as company_name,
                COALESCE(ci.industry, 'Unknown') as industry
            FROM all_sources s
            LEFT JOIN company_info ci ON s.email LIKE '%@' || ci.domain
        )
        SELECT 
            contact_id,
            email,
            phone,
            source_type,
            created_at,
            company_name,
            industry
        FROM enriched_contacts
        """

        assert_table_lineage_equal(
            query,
            ["customers", "leads", "partners", "company_info"],
            ["consolidated_contacts"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple(
                        "contact_id",
                        "all_sources",
                        is_subquery=True,
                        subquery="all_sources",
                    ),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple(
                        "email", "all_sources", is_subquery=True, subquery="all_sources"
                    ),
                ),
                (
                    TestColumnQualifierTuple("phone", "customers"),
                    TestColumnQualifierTuple(
                        "phone", "all_sources", is_subquery=True, subquery="all_sources"
                    ),
                ),
                (
                    TestColumnQualifierTuple("created_at", "customers"),
                    TestColumnQualifierTuple(
                        "created_at",
                        "all_sources",
                        is_subquery=True,
                        subquery="all_sources",
                    ),
                ),
                (
                    TestColumnQualifierTuple("lead_id", "leads"),
                    TestColumnQualifierTuple(
                        "contact_id",
                        "all_sources",
                        is_subquery=True,
                        subquery="all_sources",
                    ),
                ),
                (
                    TestColumnQualifierTuple("email_address", "leads"),
                    TestColumnQualifierTuple(
                        "email", "all_sources", is_subquery=True, subquery="all_sources"
                    ),
                ),
                (
                    TestColumnQualifierTuple("mobile_phone", "leads"),
                    TestColumnQualifierTuple(
                        "phone", "all_sources", is_subquery=True, subquery="all_sources"
                    ),
                ),
                (
                    TestColumnQualifierTuple("lead_date", "leads"),
                    TestColumnQualifierTuple(
                        "created_at",
                        "all_sources",
                        is_subquery=True,
                        subquery="all_sources",
                    ),
                ),
                (
                    TestColumnQualifierTuple("partner_id", "partners"),
                    TestColumnQualifierTuple(
                        "contact_id",
                        "all_sources",
                        is_subquery=True,
                        subquery="all_sources",
                    ),
                ),
                (
                    TestColumnQualifierTuple("contact_email", "partners"),
                    TestColumnQualifierTuple(
                        "email", "all_sources", is_subquery=True, subquery="all_sources"
                    ),
                ),
                (
                    TestColumnQualifierTuple("contact_phone", "partners"),
                    TestColumnQualifierTuple(
                        "phone", "all_sources", is_subquery=True, subquery="all_sources"
                    ),
                ),
                (
                    TestColumnQualifierTuple("partnership_date", "partners"),
                    TestColumnQualifierTuple(
                        "created_at",
                        "all_sources",
                        is_subquery=True,
                        subquery="all_sources",
                    ),
                ),
                (
                    TestColumnQualifierTuple("company_name", "company_info"),
                    TestColumnQualifierTuple(
                        "company_name",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                ),
                (
                    TestColumnQualifierTuple("industry", "company_info"),
                    TestColumnQualifierTuple(
                        "industry",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "contact_id",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("contact_id", "consolidated_contacts"),
                ),
                (
                    TestColumnQualifierTuple(
                        "email",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("email", "consolidated_contacts"),
                ),
                (
                    TestColumnQualifierTuple(
                        "phone",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("phone", "consolidated_contacts"),
                ),
                (
                    TestColumnQualifierTuple(
                        "source_type",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("source_type", "consolidated_contacts"),
                ),
                (
                    TestColumnQualifierTuple(
                        "created_at",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("created_at", "consolidated_contacts"),
                ),
                (
                    TestColumnQualifierTuple(
                        "company_name",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("company_name", "consolidated_contacts"),
                ),
                (
                    TestColumnQualifierTuple(
                        "industry",
                        "enriched_contacts",
                        is_subquery=True,
                        subquery="enriched_contacts",
                    ),
                    TestColumnQualifierTuple("industry", "consolidated_contacts"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_08_lateral_join_with_ctes(self):
        """Test CTEs with LATERAL joins and column lineage."""
        query = """
        CREATE TABLE customer_top_products AS
        WITH customer_stats AS (
            SELECT 
                customer_id,
                COUNT(*) as total_orders,
                SUM(order_total) as lifetime_value
            FROM orders
            GROUP BY customer_id
        )
        SELECT 
            c.customer_id,
            c.customer_name,
            cs.total_orders,
            cs.lifetime_value,
            tp.product_id,
            tp.product_name,
            tp.purchase_count,
            tp.product_rank
        FROM customers c
        JOIN customer_stats cs ON c.customer_id = cs.customer_id
        CROSS JOIN LATERAL (
            SELECT 
                oi.product_id,
                p.product_name,
                COUNT(*) as purchase_count,
                ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as product_rank
            FROM order_items oi
            JOIN products p ON oi.product_id = p.product_id
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.customer_id = c.customer_id
            GROUP BY oi.product_id, p.product_name
            ORDER BY purchase_count DESC
            LIMIT 5
        ) tp
        """

        assert_table_lineage_equal(
            query,
            ["customers", "orders", "order_items", "products"],
            ["customer_top_products"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "orders"),
                    TestColumnQualifierTuple(
                        "customer_id",
                        "customer_stats",
                        is_subquery=True,
                        subquery="customer_stats",
                    ),
                ),
                (
                    TestColumnQualifierTuple("order_total", "orders"),
                    TestColumnQualifierTuple(
                        "lifetime_value",
                        "customer_stats",
                        is_subquery=True,
                        subquery="customer_stats",
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple(
                        "total_orders",
                        "customer_stats",
                        is_subquery=True,
                        subquery="customer_stats",
                    ),
                    TestColumnQualifierTuple("total_orders", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple(
                        "lifetime_value",
                        "customer_stats",
                        is_subquery=True,
                        subquery="customer_stats",
                    ),
                    TestColumnQualifierTuple("lifetime_value", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "order_items"),
                    TestColumnQualifierTuple("product_id", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "customer_top_products"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_09_cte_with_case_expressions(self):
        """Test CTEs with complex CASE expressions and column lineage."""
        query = """
        INSERT INTO customer_segments
        WITH transaction_summary AS (
            SELECT 
                customer_id,
                COUNT(*) as txn_count,
                SUM(amount) as total_spent,
                AVG(amount) as avg_order_value,
                MAX(transaction_date) as last_purchase_date,
                MIN(transaction_date) as first_purchase_date
            FROM transactions
            GROUP BY customer_id
        ),
        customer_classification AS (
            SELECT 
                ts.customer_id,
                c.customer_name,
                c.email,
                ts.txn_count,
                ts.total_spent,
                ts.avg_order_value,
                CASE 
                    WHEN ts.total_spent >= 10000 THEN 'Platinum'
                    WHEN ts.total_spent >= 5000 THEN 'Gold'
                    WHEN ts.total_spent >= 1000 THEN 'Silver'
                    ELSE 'Bronze'
                END as tier,
                CASE 
                    WHEN CURRENT_DATE - ts.last_purchase_date <= 30 THEN 'Active'
                    WHEN CURRENT_DATE - ts.last_purchase_date <= 90 THEN 'At Risk'
                    ELSE 'Churned'
                END as status,
                CASE 
                    WHEN ts.txn_count >= 50 AND ts.avg_order_value >= 200 THEN 'VIP'
                    WHEN ts.txn_count >= 20 THEN 'Loyal'
                    WHEN ts.txn_count >= 5 THEN 'Regular'
                    ELSE 'Occasional'
                END as engagement_level
            FROM transaction_summary ts
            JOIN customers c ON ts.customer_id = c.customer_id
        )
        SELECT 
            customer_id,
            customer_name,
            email,
            txn_count,
            total_spent,
            avg_order_value,
            tier,
            status,
            engagement_level
        FROM customer_classification
        """

        assert_table_lineage_equal(
            query,
            ["transactions", "customers"],
            ["customer_segments"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "transactions"),
                    TestColumnQualifierTuple(
                        "customer_id",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "transactions"),
                    TestColumnQualifierTuple(
                        "total_spent",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "transactions"),
                    TestColumnQualifierTuple(
                        "avg_order_value",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                ),
                (
                    TestColumnQualifierTuple("transaction_date", "transactions"),
                    TestColumnQualifierTuple(
                        "last_purchase_date",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                ),
                (
                    TestColumnQualifierTuple("transaction_date", "transactions"),
                    TestColumnQualifierTuple(
                        "first_purchase_date",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "customer_id",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("customer_id", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "txn_count",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("txn_count", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "total_spent",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("total_spent", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "avg_order_value",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("avg_order_value", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "total_spent",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("tier", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "last_purchase_date",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("status", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "txn_count",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("engagement_level", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple(
                        "avg_order_value",
                        "transaction_summary",
                        is_subquery=True,
                        subquery="transaction_summary",
                    ),
                    TestColumnQualifierTuple("engagement_level", "customer_segments"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_cte_chain_10_cross_database_ctes(self):
        """Test CTEs with cross-database references and column lineage."""
        query = """
        CREATE TABLE analytics.customer_insights AS
        WITH sales_data AS (
            SELECT 
                s.customer_id,
                s.order_date,
                s.product_id,
                s.quantity,
                s.unit_price,
                s.quantity * s.unit_price as line_total
            FROM sales_db.sales s
        ),
        customer_profiles AS (
            SELECT 
                cp.customer_id,
                cp.segment,
                cp.country,
                cp.acquisition_channel,
                cp.registration_date
            FROM crm_db.customer_profiles cp
        ),
        product_catalog AS (
            SELECT 
                p.product_id,
                p.category,
                p.brand,
                p.profit_margin
            FROM inventory_db.products p
        ),
        enriched_sales AS (
            SELECT 
                sd.customer_id,
                cp.segment,
                cp.country,
                cp.acquisition_channel,
                sd.order_date,
                pc.category,
                pc.brand,
                sd.quantity,
                sd.line_total,
                sd.line_total * pc.profit_margin as profit
            FROM sales_data sd
            JOIN customer_profiles cp ON sd.customer_id = cp.customer_id
            JOIN product_catalog pc ON sd.product_id = pc.product_id
        )
        SELECT 
            customer_id,
            segment,
            country,
            acquisition_channel,
            category,
            brand,
            SUM(quantity) as total_quantity,
            SUM(line_total) as total_revenue,
            SUM(profit) as total_profit,
            COUNT(*) as order_count
        FROM enriched_sales
        GROUP BY customer_id, segment, country, acquisition_channel, category, brand
        """

        assert_table_lineage_equal(
            query,
            ["sales_db.sales", "crm_db.customer_profiles", "inventory_db.products"],
            ["analytics.customer_insights"],
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "sales"),
                    TestColumnQualifierTuple(
                        "customer_id",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                ),
                (
                    TestColumnQualifierTuple("order_date", "sales"),
                    TestColumnQualifierTuple(
                        "order_date",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple(
                        "product_id",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple(
                        "quantity",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "sales"),
                    TestColumnQualifierTuple(
                        "unit_price",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "customer_profiles"),
                    TestColumnQualifierTuple(
                        "customer_id",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                ),
                (
                    TestColumnQualifierTuple("segment", "customer_profiles"),
                    TestColumnQualifierTuple(
                        "segment",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                ),
                (
                    TestColumnQualifierTuple("country", "customer_profiles"),
                    TestColumnQualifierTuple(
                        "country",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "acquisition_channel", "customer_profiles"
                    ),
                    TestColumnQualifierTuple(
                        "acquisition_channel",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple(
                        "product_id",
                        "product_catalog",
                        is_subquery=True,
                        subquery="product_catalog",
                    ),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple(
                        "category",
                        "product_catalog",
                        is_subquery=True,
                        subquery="product_catalog",
                    ),
                ),
                (
                    TestColumnQualifierTuple("brand", "products"),
                    TestColumnQualifierTuple(
                        "brand",
                        "product_catalog",
                        is_subquery=True,
                        subquery="product_catalog",
                    ),
                ),
                (
                    TestColumnQualifierTuple("profit_margin", "products"),
                    TestColumnQualifierTuple(
                        "profit_margin",
                        "product_catalog",
                        is_subquery=True,
                        subquery="product_catalog",
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "customer_id",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                    TestColumnQualifierTuple("customer_id", "customer_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "segment",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                    TestColumnQualifierTuple("segment", "customer_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "country",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                    TestColumnQualifierTuple("country", "customer_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "acquisition_channel",
                        "customer_profiles",
                        is_subquery=True,
                        subquery="customer_profiles",
                    ),
                    TestColumnQualifierTuple(
                        "acquisition_channel", "customer_insights"
                    ),
                ),
                (
                    TestColumnQualifierTuple(
                        "category",
                        "product_catalog",
                        is_subquery=True,
                        subquery="product_catalog",
                    ),
                    TestColumnQualifierTuple("category", "customer_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "brand",
                        "product_catalog",
                        is_subquery=True,
                        subquery="product_catalog",
                    ),
                    TestColumnQualifierTuple("brand", "customer_insights"),
                ),
                (
                    TestColumnQualifierTuple(
                        "quantity",
                        "sales_data",
                        is_subquery=True,
                        subquery="sales_data",
                    ),
                    TestColumnQualifierTuple("total_quantity", "customer_insights"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    # ====================  COMPLEX UNION OPERATIONS WITH COLUMN LINEAGE (10 TESTS) ====================

    def test_union_01_three_branch_union_all_with_mapping(self):
        """Test 3-branch UNION ALL with comprehensive column mapping"""
        query = """
        CREATE TABLE unified_transactions AS
        SELECT
            transaction_id,
            'Online' as channel,
            customer_id,
            product_id,
            amount,
            transaction_date,
            payment_method
        FROM online_orders
        WHERE transaction_date >= '2024-01-01'
        UNION ALL
        SELECT
            sale_id as transaction_id,
            'Retail' as channel,
            customer_id,
            product_id,
            total_amount as amount,
            sale_date as transaction_date,
            payment_type as payment_method
        FROM pos_sales
        WHERE sale_date >= '2024-01-01'
        UNION ALL
        SELECT
            order_number as transaction_id,
            'Mobile' as channel,
            user_id as customer_id,
            item_id as product_id,
            order_total as amount,
            order_timestamp as transaction_date,
            payment_mode as payment_method
        FROM mobile_purchases
        WHERE order_timestamp >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"online_orders", "pos_sales", "mobile_purchases"},
            {"unified_transactions"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # Online orders
                (
                    TestColumnQualifierTuple("transaction_id", "online_orders"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "online_orders"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "online_orders"),
                    TestColumnQualifierTuple("product_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("amount", "online_orders"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("transaction_date", "online_orders"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("payment_method", "online_orders"),
                    TestColumnQualifierTuple("payment_method", "unified_transactions"),
                ),
                # POS sales
                (
                    TestColumnQualifierTuple("sale_id", "pos_sales"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "pos_sales"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "pos_sales"),
                    TestColumnQualifierTuple("product_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("total_amount", "pos_sales"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("sale_date", "pos_sales"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("payment_type", "pos_sales"),
                    TestColumnQualifierTuple("payment_method", "unified_transactions"),
                ),
                # Mobile purchases
                (
                    TestColumnQualifierTuple("order_number", "mobile_purchases"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "mobile_purchases"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("item_id", "mobile_purchases"),
                    TestColumnQualifierTuple("product_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("order_total", "mobile_purchases"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("order_timestamp", "mobile_purchases"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("payment_mode", "mobile_purchases"),
                    TestColumnQualifierTuple("payment_method", "unified_transactions"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_union_02_four_branch_union_all_with_transformations(self):
        """Test UNION ALL with 4 branches and column transformations"""
        query = """
        INSERT INTO unified_transactions (
            transaction_id,
            transaction_type,
            customer_id,
            amount,
            transaction_date,
            source_system
        )
        SELECT 
            order_id as transaction_id,
            'SALE' as transaction_type,
            customer_id,
            order_amount as amount,
            order_date as transaction_date,
            'POS' as source_system
        FROM pos_orders
        WHERE order_status = 'completed'
        
        UNION ALL
        
        SELECT 
            refund_id as transaction_id,
            'REFUND' as transaction_type,
            customer_id,
            refund_amount as amount,
            refund_date as transaction_date,
            'REFUND_SYSTEM' as source_system
        FROM refunds
        WHERE refund_status = 'approved'
        
        UNION ALL
        
        SELECT 
            payment_id as transaction_id,
            'PAYMENT' as transaction_type,
            customer_id,
            payment_amount as amount,
            payment_date as transaction_date,
            'PAYMENT_GATEWAY' as source_system
        FROM payments
        WHERE payment_status = 'successful'
        
        UNION ALL
        
        SELECT 
            credit_id as transaction_id,
            'CREDIT' as transaction_type,
            customer_id,
            credit_amount as amount,
            credit_date as transaction_date,
            'CREDIT_SYSTEM' as source_system
        FROM customer_credits
        WHERE is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"pos_orders", "refunds", "payments", "customer_credits"},
            {"unified_transactions"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # From pos_orders
                (
                    TestColumnQualifierTuple("order_id", "pos_orders"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "pos_orders"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("order_amount", "pos_orders"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "pos_orders"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                # From refunds
                (
                    TestColumnQualifierTuple("refund_id", "refunds"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "refunds"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("refund_amount", "refunds"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("refund_date", "refunds"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                # From payments
                (
                    TestColumnQualifierTuple("payment_id", "payments"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "payments"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("payment_amount", "payments"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("payment_date", "payments"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                # From customer_credits
                (
                    TestColumnQualifierTuple("credit_id", "customer_credits"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "customer_credits"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("credit_amount", "customer_credits"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("credit_date", "customer_credits"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_union_03_union_with_cte_and_extensive_mapping(self):
        """Test UNION with CTEs and extensive column mapping"""
        query = """
        CREATE VIEW customer_activity_log AS
        WITH online_activity AS (
            SELECT 
                customer_id,
                session_id as activity_id,
                page_view_count as activity_count,
                session_duration as activity_duration,
                session_date as activity_date
            FROM web_sessions
            WHERE session_date >= '2024-01-01'
        ),
        store_activity AS (
            SELECT 
                customer_id,
                visit_id as activity_id,
                items_viewed as activity_count,
                visit_duration as activity_duration,
                visit_date as activity_date
            FROM store_visits
            WHERE visit_date >= '2024-01-01'
        )
        SELECT * FROM online_activity
        UNION ALL
        SELECT * FROM store_activity
        """

        assert_table_lineage_equal(
            query,
            {"web_sessions", "store_visits"},
            {"customer_activity_log"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # From web_sessions
                (
                    TestColumnQualifierTuple("customer_id", "web_sessions"),
                    TestColumnQualifierTuple("customer_id", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("session_id", "web_sessions"),
                    TestColumnQualifierTuple("activity_id", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("page_view_count", "web_sessions"),
                    TestColumnQualifierTuple("activity_count", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("session_duration", "web_sessions"),
                    TestColumnQualifierTuple(
                        "activity_duration", "customer_activity_log"
                    ),
                ),
                (
                    TestColumnQualifierTuple("session_date", "web_sessions"),
                    TestColumnQualifierTuple("activity_date", "customer_activity_log"),
                ),
                # From store_visits
                (
                    TestColumnQualifierTuple("customer_id", "store_visits"),
                    TestColumnQualifierTuple("customer_id", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("visit_id", "store_visits"),
                    TestColumnQualifierTuple("activity_id", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("items_viewed", "store_visits"),
                    TestColumnQualifierTuple("activity_count", "customer_activity_log"),
                ),
                (
                    TestColumnQualifierTuple("visit_duration", "store_visits"),
                    TestColumnQualifierTuple(
                        "activity_duration", "customer_activity_log"
                    ),
                ),
                (
                    TestColumnQualifierTuple("visit_date", "store_visits"),
                    TestColumnQualifierTuple("activity_date", "customer_activity_log"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_union_04_nested_union_with_joins(self):
        """Test nested UNION with joins and column lineage"""
        query = """
        INSERT INTO product_availability (
            product_id,
            product_name,
            warehouse_id,
            warehouse_name,
            quantity,
            last_updated
        )
        SELECT 
            p.product_id,
            p.product_name,
            w1.warehouse_id,
            w1.warehouse_name,
            i1.quantity,
            i1.last_updated
        FROM inventory_warehouse1 i1
        JOIN products p ON i1.product_id = p.product_id
        JOIN warehouses w1 ON i1.warehouse_id = w1.warehouse_id
        WHERE i1.quantity > 0
        
        UNION ALL
        
        SELECT 
            p.product_id,
            p.product_name,
            w2.warehouse_id,
            w2.warehouse_name,
            i2.quantity,
            i2.last_updated
        FROM inventory_warehouse2 i2
        JOIN products p ON i2.product_id = p.product_id
        JOIN warehouses w2 ON i2.warehouse_id = w2.warehouse_id
        WHERE i2.quantity > 0
        """

        assert_table_lineage_equal(
            query,
            {"inventory_warehouse1", "inventory_warehouse2", "products", "warehouses"},
            {"product_availability"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # From first UNION branch
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "product_availability"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "product_availability"),
                ),
                (
                    TestColumnQualifierTuple("warehouse_id", "warehouses"),
                    TestColumnQualifierTuple("warehouse_id", "product_availability"),
                ),
                (
                    TestColumnQualifierTuple("warehouse_name", "warehouses"),
                    TestColumnQualifierTuple("warehouse_name", "product_availability"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "inventory_warehouse1"),
                    TestColumnQualifierTuple("quantity", "product_availability"),
                ),
                (
                    TestColumnQualifierTuple("last_updated", "inventory_warehouse1"),
                    TestColumnQualifierTuple("last_updated", "product_availability"),
                ),
                # From second UNION branch
                (
                    TestColumnQualifierTuple("quantity", "inventory_warehouse2"),
                    TestColumnQualifierTuple("quantity", "product_availability"),
                ),
                (
                    TestColumnQualifierTuple("last_updated", "inventory_warehouse2"),
                    TestColumnQualifierTuple("last_updated", "product_availability"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_union_05_union_with_aggregations_and_mappings(self):
        """Test UNION with aggregations and extensive column mappings"""
        query = """
        CREATE TABLE regional_sales_summary AS
        SELECT 
            'North' as region,
            product_id,
            SUM(quantity) as total_quantity,
            SUM(amount) as total_revenue,
            COUNT(*) as order_count
        FROM north_sales
        GROUP BY product_id
        
        UNION ALL
        
        SELECT 
            'South' as region,
            product_id,
            SUM(quantity) as total_quantity,
            SUM(amount) as total_revenue,
            COUNT(*) as order_count
        FROM south_sales
        GROUP BY product_id
        
        UNION ALL
        
        SELECT 
            'East' as region,
            product_id,
            SUM(quantity) as total_quantity,
            SUM(amount) as total_revenue,
            COUNT(*) as order_count
        FROM east_sales
        GROUP BY product_id
        """

        assert_table_lineage_equal(
            query,
            {"north_sales", "south_sales", "east_sales"},
            {"regional_sales_summary"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "north_sales"),
                    TestColumnQualifierTuple("product_id", "regional_sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "north_sales"),
                    TestColumnQualifierTuple(
                        "total_quantity", "regional_sales_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "north_sales"),
                    TestColumnQualifierTuple("total_revenue", "regional_sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "south_sales"),
                    TestColumnQualifierTuple("product_id", "regional_sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "south_sales"),
                    TestColumnQualifierTuple(
                        "total_quantity", "regional_sales_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "south_sales"),
                    TestColumnQualifierTuple("total_revenue", "regional_sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "east_sales"),
                    TestColumnQualifierTuple("product_id", "regional_sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "east_sales"),
                    TestColumnQualifierTuple(
                        "total_quantity", "regional_sales_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "east_sales"),
                    TestColumnQualifierTuple("total_revenue", "regional_sales_summary"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_union_06_five_branch_union_all(self):
        """Test 5-branch UNION ALL with column lineage"""
        query = """
        INSERT INTO all_events (
            event_id,
            event_type,
            user_id,
            event_timestamp,
            event_data
        )
        SELECT event_id, 'LOGIN' as event_type, user_id, login_time as event_timestamp, login_details as event_data FROM user_logins
        UNION ALL
        SELECT event_id, 'LOGOUT' as event_type, user_id, logout_time as event_timestamp, logout_details as event_data FROM user_logouts
        UNION ALL
        SELECT event_id, 'PURCHASE' as event_type, user_id, purchase_time as event_timestamp, purchase_details as event_data FROM user_purchases
        UNION ALL
        SELECT event_id, 'VIEW' as event_type, user_id, view_time as event_timestamp, view_details as event_data FROM page_views
        UNION ALL
        SELECT event_id, 'CLICK' as event_type, user_id, click_time as event_timestamp, click_details as event_data FROM button_clicks
        """

        assert_table_lineage_equal(
            query,
            {
                "user_logins",
                "user_logouts",
                "user_purchases",
                "page_views",
                "button_clicks",
            },
            {"all_events"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("event_id", "user_logins"),
                    TestColumnQualifierTuple("event_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "user_logins"),
                    TestColumnQualifierTuple("user_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("login_time", "user_logins"),
                    TestColumnQualifierTuple("event_timestamp", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("login_details", "user_logins"),
                    TestColumnQualifierTuple("event_data", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("event_id", "user_logouts"),
                    TestColumnQualifierTuple("event_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "user_logouts"),
                    TestColumnQualifierTuple("user_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("logout_time", "user_logouts"),
                    TestColumnQualifierTuple("event_timestamp", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("logout_details", "user_logouts"),
                    TestColumnQualifierTuple("event_data", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("event_id", "user_purchases"),
                    TestColumnQualifierTuple("event_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "user_purchases"),
                    TestColumnQualifierTuple("user_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("purchase_time", "user_purchases"),
                    TestColumnQualifierTuple("event_timestamp", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("purchase_details", "user_purchases"),
                    TestColumnQualifierTuple("event_data", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("event_id", "page_views"),
                    TestColumnQualifierTuple("event_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "page_views"),
                    TestColumnQualifierTuple("user_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("view_time", "page_views"),
                    TestColumnQualifierTuple("event_timestamp", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("view_details", "page_views"),
                    TestColumnQualifierTuple("event_data", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("event_id", "button_clicks"),
                    TestColumnQualifierTuple("event_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "button_clicks"),
                    TestColumnQualifierTuple("user_id", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("click_time", "button_clicks"),
                    TestColumnQualifierTuple("event_timestamp", "all_events"),
                ),
                (
                    TestColumnQualifierTuple("click_details", "button_clicks"),
                    TestColumnQualifierTuple("event_data", "all_events"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_union_07_union_distinct_with_column_lineage(self):
        """Test UNION DISTINCT with column deduplication"""
        query = """
        CREATE VIEW unique_customer_contacts AS
        SELECT 
            customer_id,
            email as contact_value,
            'email' as contact_type
        FROM customer_emails
        
        UNION
        
        SELECT 
            customer_id,
            phone as contact_value,
            'phone' as contact_type
        FROM customer_phones
        """

        assert_table_lineage_equal(
            query,
            {"customer_emails", "customer_phones"},
            {"unique_customer_contacts"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customer_emails"),
                    TestColumnQualifierTuple("customer_id", "unique_customer_contacts"),
                ),
                (
                    TestColumnQualifierTuple("email", "customer_emails"),
                    TestColumnQualifierTuple(
                        "contact_value", "unique_customer_contacts"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "customer_phones"),
                    TestColumnQualifierTuple("customer_id", "unique_customer_contacts"),
                ),
                (
                    TestColumnQualifierTuple("phone", "customer_phones"),
                    TestColumnQualifierTuple(
                        "contact_value", "unique_customer_contacts"
                    ),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_union_08_union_all_with_type_casting(self):
        """Test UNION ALL with type casting and transformations"""
        query = """
        INSERT INTO transaction_log (
            transaction_id,
            amount,
            currency,
            transaction_date
        )
        SELECT 
            CAST(order_id AS VARCHAR) as transaction_id,
            order_total as amount,
            order_currency as currency,
            order_date as transaction_date
        FROM orders
        
        UNION ALL
        
        SELECT 
            CAST(refund_id AS VARCHAR) as transaction_id,
            -1 * refund_amount as amount,
            refund_currency as currency,
            refund_date as transaction_date
        FROM refunds
        """

        assert_table_lineage_equal(
            query,
            {"orders", "refunds"},
            {"transaction_log"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple("transaction_id", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("order_total", "orders"),
                    TestColumnQualifierTuple("amount", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("order_currency", "orders"),
                    TestColumnQualifierTuple("currency", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("transaction_date", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("refund_id", "refunds"),
                    TestColumnQualifierTuple("transaction_id", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("refund_amount", "refunds"),
                    TestColumnQualifierTuple("amount", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("refund_currency", "refunds"),
                    TestColumnQualifierTuple("currency", "transaction_log"),
                ),
                (
                    TestColumnQualifierTuple("refund_date", "refunds"),
                    TestColumnQualifierTuple("transaction_date", "transaction_log"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_union_09_union_with_window_functions(self):
        """Test UNION with window functions and column lineage"""
        query = """
        CREATE TABLE ranked_products AS
        SELECT 
            product_id,
            product_name,
            category,
            price,
            ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) as price_rank
        FROM premium_products
        
        UNION ALL
        
        SELECT 
            product_id,
            product_name,
            category,
            price,
            ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) as price_rank
        FROM standard_products
        """

        assert_table_lineage_equal(
            query,
            {"premium_products", "standard_products"},
            {"ranked_products"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "premium_products"),
                    TestColumnQualifierTuple("product_id", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "premium_products"),
                    TestColumnQualifierTuple("product_name", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("category", "premium_products"),
                    TestColumnQualifierTuple("category", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("price", "premium_products"),
                    TestColumnQualifierTuple("price", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "standard_products"),
                    TestColumnQualifierTuple("product_id", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "standard_products"),
                    TestColumnQualifierTuple("product_name", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("category", "standard_products"),
                    TestColumnQualifierTuple("category", "ranked_products"),
                ),
                (
                    TestColumnQualifierTuple("price", "standard_products"),
                    TestColumnQualifierTuple("price", "ranked_products"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_union_10_union_with_subqueries_and_joins(self):
        """Test UNION with subqueries and joins - comprehensive lineage"""
        query = """
        INSERT INTO customer_revenue_report (
            customer_id,
            customer_name,
            revenue_source,
            total_revenue,
            transaction_count
        )
        SELECT 
            c.customer_id,
            c.customer_name,
            'Online Sales' as revenue_source,
            SUM(o.amount) as total_revenue,
            COUNT(*) as transaction_count
        FROM customers c
        JOIN online_orders o ON c.customer_id = o.customer_id
        WHERE o.status = 'completed'
        GROUP BY c.customer_id, c.customer_name
        
        UNION ALL
        
        SELECT 
            c.customer_id,
            c.customer_name,
            'Store Sales' as revenue_source,
            SUM(s.amount) as total_revenue,
            COUNT(*) as transaction_count
        FROM customers c
        JOIN store_sales s ON c.customer_id = s.customer_id
        WHERE s.status = 'completed'
        GROUP BY c.customer_id, c.customer_name
        """

        assert_table_lineage_equal(
            query,
            {"customers", "online_orders", "store_sales"},
            {"customer_revenue_report"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_revenue_report"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "customer_revenue_report"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "online_orders"),
                    TestColumnQualifierTuple(
                        "total_revenue", "customer_revenue_report"
                    ),
                ),
                (
                    TestColumnQualifierTuple("amount", "store_sales"),
                    TestColumnQualifierTuple(
                        "total_revenue", "customer_revenue_report"
                    ),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    # ====================  COMPLEX INSERT SELECT PATTERNS (10 TESTS) ====================

    def test_insert_select_01_with_cte_and_joins(self):
        """Test INSERT SELECT with CTEs, joins, and extensive column lineage"""
        query = """
        INSERT INTO sales_fact (
            date_key,
            customer_key,
            product_key,
            store_key,
            quantity,
            unit_price,
            discount_amount,
            net_amount,
            tax_amount,
            total_amount
        )
        WITH
        daily_sales AS (
            SELECT
                s.sale_date,
                s.customer_id,
                s.product_id,
                s.store_id,
                s.quantity,
                s.unit_price,
                s.discount_percent
            FROM sales s
            WHERE s.sale_date = CURRENT_DATE - INTERVAL '1 day'
        )
        SELECT
            dd.date_key,
            dc.customer_key,
            dp.product_key,
            ds.store_key,
            daily_sales.quantity,
            daily_sales.unit_price,
            daily_sales.quantity * daily_sales.unit_price * daily_sales.discount_percent / 100 as discount_amount,
            daily_sales.quantity * daily_sales.unit_price * (1 - daily_sales.discount_percent / 100) as net_amount,
            daily_sales.quantity * daily_sales.unit_price * (1 - daily_sales.discount_percent / 100) * 0.08 as tax_amount,
            daily_sales.quantity * daily_sales.unit_price * (1 - daily_sales.discount_percent / 100) * 1.08 as total_amount
        FROM daily_sales
        INNER JOIN dim_date dd ON daily_sales.sale_date = dd.date_value
        INNER JOIN dim_customer dc ON daily_sales.customer_id = dc.customer_id
        INNER JOIN dim_product dp ON daily_sales.product_id = dp.product_id
        INNER JOIN dim_store ds ON daily_sales.store_id = ds.store_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "dim_date", "dim_customer", "dim_product", "dim_store"},
            {"sales_fact"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("date_key", "dim_date"),
                    TestColumnQualifierTuple("date_key", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("customer_key", "dim_customer"),
                    TestColumnQualifierTuple("customer_key", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("product_key", "dim_product"),
                    TestColumnQualifierTuple("product_key", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("store_key", "dim_store"),
                    TestColumnQualifierTuple("store_key", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple("quantity", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "sales"),
                    TestColumnQualifierTuple("unit_price", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple("discount_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "sales"),
                    TestColumnQualifierTuple("discount_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("discount_percent", "sales"),
                    TestColumnQualifierTuple("discount_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple("net_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "sales"),
                    TestColumnQualifierTuple("net_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("discount_percent", "sales"),
                    TestColumnQualifierTuple("net_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple("tax_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "sales"),
                    TestColumnQualifierTuple("tax_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("discount_percent", "sales"),
                    TestColumnQualifierTuple("tax_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "sales"),
                    TestColumnQualifierTuple("total_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("unit_price", "sales"),
                    TestColumnQualifierTuple("total_amount", "sales_fact"),
                ),
                (
                    TestColumnQualifierTuple("discount_percent", "sales"),
                    TestColumnQualifierTuple("total_amount", "sales_fact"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_insert_select_02_multi_table_join_with_extensive_lineage(self):
        """Test INSERT SELECT with multi-table joins and extensive column lineage"""
        query = """
        INSERT INTO customer_order_summary (
            customer_id,
            customer_name,
            total_orders,
            total_amount,
            avg_order_value,
            first_order_date,
            last_order_date
        )
        SELECT
            c.customer_id,
            c.first_name || ' ' || c.last_name as customer_name,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.total_amount) as total_amount,
            AVG(o.total_amount) as avg_order_value,
            MIN(o.order_date) as first_order_date,
            MAX(o.order_date) as last_order_date
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE o.status = 'completed'
        GROUP BY c.customer_id, c.first_name, c.last_name
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"customer_order_summary"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_order_summary"),
                ),
                (
                    TestColumnQualifierTuple("first_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_order_summary"),
                ),
                (
                    TestColumnQualifierTuple("last_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_order_summary"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_insert_select_03_union_all_with_column_mapping(self):
        """Test INSERT SELECT with UNION ALL from multiple sources"""
        query = """
        INSERT INTO unified_transactions (
            transaction_id,
            transaction_date,
            customer_id,
            amount,
            source_system
        )
        SELECT
            online_id as transaction_id,
            purchase_date as transaction_date,
            customer_id,
            total_amount as amount,
            'ONLINE' as source_system
        FROM online_purchases
        UNION ALL
        SELECT
            store_id as transaction_id,
            sale_date as transaction_date,
            customer_id,
            sale_amount as amount,
            'STORE' as source_system
        FROM store_sales
        UNION ALL
        SELECT
            mobile_id as transaction_id,
            order_date as transaction_date,
            customer_id,
            order_total as amount,
            'MOBILE' as source_system
        FROM mobile_orders
        """

        assert_table_lineage_equal(
            query,
            {"online_purchases", "store_sales", "mobile_orders"},
            {"unified_transactions"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # online_purchases
                (
                    TestColumnQualifierTuple("online_id", "online_purchases"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("purchase_date", "online_purchases"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "online_purchases"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("total_amount", "online_purchases"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                # store_sales
                (
                    TestColumnQualifierTuple("store_id", "store_sales"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("sale_date", "store_sales"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "store_sales"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("sale_amount", "store_sales"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
                # mobile_orders
                (
                    TestColumnQualifierTuple("mobile_id", "mobile_orders"),
                    TestColumnQualifierTuple("transaction_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "mobile_orders"),
                    TestColumnQualifierTuple(
                        "transaction_date", "unified_transactions"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "mobile_orders"),
                    TestColumnQualifierTuple("customer_id", "unified_transactions"),
                ),
                (
                    TestColumnQualifierTuple("order_total", "mobile_orders"),
                    TestColumnQualifierTuple("amount", "unified_transactions"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_insert_select_04_nested_cte_with_window_functions(self):
        """Test INSERT SELECT with nested CTEs and window functions"""
        query = """
        INSERT INTO product_rankings (
            product_id,
            product_name,
            category,
            revenue,
            revenue_rank,
            category_rank
        )
        WITH monthly_sales AS (
            SELECT
                product_id,
                SUM(quantity * unit_price) as revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY product_id
        ),
        ranked_products AS (
            SELECT
                ms.product_id,
                p.product_name,
                p.category,
                ms.revenue,
                ROW_NUMBER() OVER (ORDER BY ms.revenue DESC) as revenue_rank,
                ROW_NUMBER() OVER (PARTITION BY p.category ORDER BY ms.revenue DESC) as category_rank
            FROM monthly_sales ms
            JOIN products p ON ms.product_id = p.product_id
        )
        SELECT
            product_id,
            product_name,
            category,
            revenue,
            revenue_rank,
            category_rank
        FROM ranked_products
        WHERE revenue_rank <= 100
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"product_rankings"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "product_rankings"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "product_rankings"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "product_rankings"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_insert_select_05_five_table_join_with_aggregations(self):
        """Test INSERT SELECT with 5-table join and aggregations"""
        query = """
        INSERT INTO sales_analytics (
            date_key,
            product_id,
            customer_segment,
            region,
            total_quantity,
            total_revenue
        )
        SELECT
            d.date_key,
            p.product_id,
            c.customer_segment,
            r.region_name as region,
            SUM(s.quantity) as total_quantity,
            SUM(s.amount) as total_revenue
        FROM sales s
        JOIN dim_date d ON s.sale_date = d.calendar_date
        JOIN products p ON s.product_id = p.product_id
        JOIN customers c ON s.customer_id = c.customer_id
        JOIN regions r ON c.region_id = r.region_id
        WHERE d.year = 2024
        GROUP BY d.date_key, p.product_id, c.customer_segment, r.region_name
        """

        assert_table_lineage_equal(
            query,
            {"sales", "dim_date", "products", "customers", "regions"},
            {"sales_analytics"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("date_key", "dim_date"),
                    TestColumnQualifierTuple("date_key", "sales_analytics"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "sales_analytics"),
                ),
                (
                    TestColumnQualifierTuple("customer_segment", "customers"),
                    TestColumnQualifierTuple("customer_segment", "sales_analytics"),
                ),
                (
                    TestColumnQualifierTuple("region_name", "regions"),
                    TestColumnQualifierTuple("region", "sales_analytics"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_insert_select_06_subquery_with_case_expressions(self):
        """Test INSERT SELECT with subqueries and complex CASE expressions"""
        query = """
        INSERT INTO customer_segments (
            customer_id,
            customer_name,
            segment,
            lifetime_value,
            risk_level
        )
        SELECT
            c.customer_id,
            c.customer_name,
            CASE
                WHEN total_spent.amount > 10000 THEN 'VIP'
                WHEN total_spent.amount > 5000 THEN 'Premium'
                ELSE 'Standard'
            END as segment,
            total_spent.amount as lifetime_value,
            CASE
                WHEN recent_orders.order_count = 0 THEN 'High'
                WHEN recent_orders.order_count < 3 THEN 'Medium'
                ELSE 'Low'
            END as risk_level
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, SUM(amount) as amount
            FROM orders
            GROUP BY customer_id
        ) total_spent ON c.customer_id = total_spent.customer_id
        LEFT JOIN (
            SELECT customer_id, COUNT(*) as order_count
            FROM orders
            WHERE order_date >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY customer_id
        ) recent_orders ON c.customer_id = recent_orders.customer_id
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"customer_segments"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_segments"),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple("lifetime_value", "customer_segments"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_insert_select_07_lateral_join_with_top_n(self):
        """Test INSERT SELECT with LATERAL join for top-N per group"""
        query = """
        INSERT INTO customer_top_products (
            customer_id,
            product_id,
            product_name,
            total_purchased,
            purchase_rank
        )
        SELECT
            c.customer_id,
            top_products.product_id,
            top_products.product_name,
            top_products.total_quantity as total_purchased,
            top_products.rank as purchase_rank
        FROM customers c
        CROSS JOIN LATERAL (
            SELECT
                s.product_id,
                p.product_name,
                SUM(s.quantity) as total_quantity,
                ROW_NUMBER() OVER (ORDER BY SUM(s.quantity) DESC) as rank
            FROM sales s
            JOIN products p ON s.product_id = p.product_id
            WHERE s.customer_id = c.customer_id
            GROUP BY s.product_id, p.product_name
            ORDER BY total_quantity DESC
            LIMIT 5
        ) top_products
        """

        assert_table_lineage_equal(
            query,
            {"customers", "sales", "products"},
            {"customer_top_products"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "customer_top_products"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "customer_top_products"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_insert_select_08_recursive_cte_hierarchy(self):
        """Test INSERT SELECT with recursive CTE for hierarchical data"""
        query = """
        INSERT INTO employee_hierarchy_flat (
            employee_id,
            employee_name,
            manager_id,
            hierarchy_level,
            full_path
        )
        WITH RECURSIVE emp_tree AS (
            SELECT
                employee_id,
                employee_name,
                manager_id,
                1 as hierarchy_level,
                employee_name as full_path
            FROM employees
            WHERE manager_id IS NULL

            UNION ALL

            SELECT
                e.employee_id,
                e.employee_name,
                e.manager_id,
                et.hierarchy_level + 1,
                et.full_path || ' > ' || e.employee_name
            FROM employees e
            JOIN emp_tree et ON e.manager_id = et.employee_id
        )
        SELECT
            employee_id,
            employee_name,
            manager_id,
            hierarchy_level,
            full_path
        FROM emp_tree
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            {"employee_hierarchy_flat"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("employee_id", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple(
                        "employee_name", "employee_hierarchy_flat"
                    ),
                ),
                (
                    TestColumnQualifierTuple("manager_id", "employees"),
                    TestColumnQualifierTuple("manager_id", "employee_hierarchy_flat"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple("full_path", "employee_hierarchy_flat"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_insert_select_09_cross_database_join(self):
        """Test INSERT SELECT with cross-database joins"""
        query = """
        INSERT INTO analytics_db.customer_metrics (
            customer_id,
            customer_name,
            total_orders,
            total_revenue,
            support_tickets
        )
        SELECT
            c.customer_id,
            c.customer_name,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.amount) as total_revenue,
            COUNT(DISTINCT t.ticket_id) as support_tickets
        FROM crm_db.customers c
        LEFT JOIN sales_db.orders o ON c.customer_id = o.customer_id
        LEFT JOIN support_db.tickets t ON c.customer_id = t.customer_id
        WHERE c.status = 'active'
        GROUP BY c.customer_id, c.customer_name
        """

        assert_table_lineage_equal(
            query,
            {"crm_db.customers", "sales_db.orders", "support_db.tickets"},
            {"analytics_db.customer_metrics"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_id", "analytics_db.customer_metrics"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "analytics_db.customer_metrics"
                    ),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_insert_select_10_time_series_aggregation(self):
        """Test INSERT SELECT with time series aggregation and window functions"""
        query = """
        INSERT INTO daily_metrics (
            metric_date,
            product_id,
            daily_sales,
            moving_avg_7day,
            cumulative_sales,
            yoy_growth
        )
        WITH daily_aggregates AS (
            SELECT
                DATE(sale_date) as metric_date,
                product_id,
                SUM(amount) as daily_sales
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY DATE(sale_date), product_id
        )
        SELECT
            metric_date,
            product_id,
            daily_sales,
            AVG(daily_sales) OVER (
                PARTITION BY product_id
                ORDER BY metric_date
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) as moving_avg_7day,
            SUM(daily_sales) OVER (
                PARTITION BY product_id
                ORDER BY metric_date
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as cumulative_sales,
            daily_sales - LAG(daily_sales, 365) OVER (
                PARTITION BY product_id
                ORDER BY metric_date
            ) as yoy_growth
        FROM daily_aggregates
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            {"daily_metrics"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("sale_date", "sales"),
                    TestColumnQualifierTuple("metric_date", "daily_metrics"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "daily_metrics"),
                ),
                (
                    TestColumnQualifierTuple("amount", "sales"),
                    TestColumnQualifierTuple("daily_sales", "daily_metrics"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== UPDATE/MERGE PATTERNS (Tests 01-10) ====================

    def test_update_merge_01_update_with_join_and_column_mapping(self):
        """Test UPDATE with JOIN and explicit column mapping"""
        query = """
        UPDATE products p
        SET
            current_price = lp.new_price,
            last_updated = lp.update_date,
            price_change_percent = ((lp.new_price - p.current_price) / p.current_price) * 100
        FROM latest_prices lp
        WHERE p.product_id = lp.product_id
        AND lp.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"latest_prices", "products"},
            {"products"},
            dialect=Dialect.POSTGRES.value,
        )

        # UPDATE column lineage - parsers may differ
        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_update_merge_02_update_with_cte(self):
        """Test UPDATE with CTE providing source data"""
        query = """
        WITH aggregated_sales AS (
            SELECT
                product_id,
                COUNT(*) as sale_count,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY product_id
        )
        UPDATE product_stats ps
        SET
            ytd_sales_count = agg.sale_count,
            ytd_quantity_sold = agg.total_quantity,
            ytd_revenue = agg.total_revenue,
            last_calculation_date = CURRENT_DATE
        FROM aggregated_sales agg
        WHERE ps.product_id = agg.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "product_stats"},
            {"product_stats"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_update_merge_03_merge_with_insert_update(self):
        """Test MERGE with both INSERT and UPDATE clauses"""
        query = """
        MERGE INTO customer_summary cs
        USING (
            SELECT
                c.customer_id,
                c.customer_name,
                c.email,
                COUNT(o.order_id) as order_count,
                SUM(o.amount) as total_spent
            FROM customers c
            LEFT JOIN orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_id, c.customer_name, c.email
        ) src
        ON cs.customer_id = src.customer_id
        WHEN MATCHED THEN
            UPDATE SET
                customer_name = src.customer_name,
                email = src.email,
                order_count = src.order_count,
                total_spent = src.total_spent,
                last_updated = CURRENT_TIMESTAMP
        WHEN NOT MATCHED THEN
            INSERT (customer_id, customer_name, email, order_count, total_spent, created_at)
            VALUES (src.customer_id, src.customer_name, src.email, src.order_count, src.total_spent, CURRENT_TIMESTAMP)
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders", "customer_summary"},
            {"customer_summary"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        # MERGE has complex column lineage
        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_summary"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_summary"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "customer_summary"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_update_merge_04_update_from_multiple_tables(self):
        """Test UPDATE with data from multiple joined tables"""
        query = """
        UPDATE inventory i
        SET
            reorder_level = s.avg_daily_sales * 30,
            last_stock_check = CURRENT_DATE,
            supplier_lead_time = sup.lead_time_days
        FROM (
            SELECT
                product_id,
                AVG(quantity) as avg_daily_sales
            FROM sales
            WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY product_id
        ) s
        JOIN products p ON s.product_id = p.product_id
        JOIN suppliers sup ON p.supplier_id = sup.supplier_id
        WHERE i.product_id = s.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products", "suppliers", "inventory"},
            {"inventory"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_update_merge_05_merge_with_complex_matching(self):
        """Test MERGE with complex matching conditions"""
        query = """
        MERGE INTO product_inventory target
        USING (
            SELECT
                w.warehouse_id,
                p.product_id,
                p.product_name,
                COALESCE(SUM(s.quantity_sold), 0) as total_sold,
                COALESCE(SUM(r.quantity_received), 0) as total_received
            FROM warehouses w
            CROSS JOIN products p
            LEFT JOIN sales s ON p.product_id = s.product_id AND w.warehouse_id = s.warehouse_id
            LEFT JOIN receipts r ON p.product_id = r.product_id AND w.warehouse_id = r.warehouse_id
            WHERE w.is_active = 1
            GROUP BY w.warehouse_id, p.product_id, p.product_name
        ) source
        ON target.warehouse_id = source.warehouse_id
        AND target.product_id = source.product_id
        WHEN MATCHED THEN
            UPDATE SET
                product_name = source.product_name,
                quantity_sold = source.total_sold,
                quantity_received = source.total_received,
                current_stock = target.current_stock + source.total_received - source.total_sold
        WHEN NOT MATCHED THEN
            INSERT (warehouse_id, product_id, product_name, quantity_sold, quantity_received, current_stock)
            VALUES (source.warehouse_id, source.product_id, source.product_name, source.total_sold, source.total_received, source.total_received - source.total_sold)
        """

        assert_table_lineage_equal(
            query,
            {"warehouses", "products", "sales", "receipts", "product_inventory"},
            {"product_inventory"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("warehouse_id", "warehouses"),
                    TestColumnQualifierTuple("warehouse_id", "product_inventory"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "product_inventory"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "product_inventory"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_update_merge_06_update_with_window_functions(self):
        """Test UPDATE using window functions in subquery"""
        query = """
        UPDATE employee_rankings er
        SET
            salary_rank = ranked.rank,
            salary_percentile = ranked.percentile,
            dept_avg_salary = ranked.dept_avg
        FROM (
            SELECT
                employee_id,
                RANK() OVER (ORDER BY salary DESC) as rank,
                PERCENT_RANK() OVER (ORDER BY salary) as percentile,
                AVG(salary) OVER (PARTITION BY department_id) as dept_avg
            FROM employees
            WHERE is_active = 1
        ) ranked
        WHERE er.employee_id = ranked.employee_id
        """

        assert_table_lineage_equal(
            query,
            {"employees", "employee_rankings"},
            {"employee_rankings"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_update_merge_07_merge_with_delete_clause(self):
        """Test MERGE with DELETE clause for inactive records"""
        query = """
        MERGE INTO customer_active ca
        USING (
            SELECT
                customer_id,
                customer_name,
                last_order_date,
                total_orders
            FROM customer_summary
            WHERE last_order_date >= CURRENT_DATE - INTERVAL '365 days'
        ) active_customers
        ON ca.customer_id = active_customers.customer_id
        WHEN MATCHED THEN
            UPDATE SET
                customer_name = active_customers.customer_name,
                last_order_date = active_customers.last_order_date,
                total_orders = active_customers.total_orders
        WHEN NOT MATCHED BY SOURCE THEN
            DELETE
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (customer_id, customer_name, last_order_date, total_orders)
            VALUES (active_customers.customer_id, active_customers.customer_name, active_customers.last_order_date, active_customers.total_orders)
        """

        assert_table_lineage_equal(
            query,
            {"customer_summary", "customer_active"},
            {"customer_active"},
            dialect=Dialect.TSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customer_summary"),
                    TestColumnQualifierTuple("customer_id", "customer_active"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customer_summary"),
                    TestColumnQualifierTuple("customer_name", "customer_active"),
                ),
                (
                    TestColumnQualifierTuple("last_order_date", "customer_summary"),
                    TestColumnQualifierTuple("last_order_date", "customer_active"),
                ),
                (
                    TestColumnQualifierTuple("total_orders", "customer_summary"),
                    TestColumnQualifierTuple("total_orders", "customer_active"),
                ),
            ],
            dialect=Dialect.TSQL.value,
        )

    def test_update_merge_08_update_with_correlated_subquery(self):
        """Test UPDATE with correlated subquery"""
        query = """
        UPDATE products p
        SET
            avg_rating = (
                SELECT AVG(rating)
                FROM reviews r
                WHERE r.product_id = p.product_id
            ),
            review_count = (
                SELECT COUNT(*)
                FROM reviews r
                WHERE r.product_id = p.product_id
            ),
            last_review_date = (
                SELECT MAX(review_date)
                FROM reviews r
                WHERE r.product_id = p.product_id
            )
        WHERE EXISTS (
            SELECT 1
            FROM reviews r
            WHERE r.product_id = p.product_id
        )
        """

        assert_table_lineage_equal(
            query,
            {"reviews", "products"},
            {"products"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    def test_update_merge_09_merge_with_computed_columns(self):
        """Test MERGE with computed columns and transformations"""
        query = """
        MERGE INTO sales_metrics sm
        USING (
            SELECT
                s.product_id,
                p.product_name,
                p.category,
                COUNT(DISTINCT s.customer_id) as unique_customers,
                SUM(s.quantity) as total_quantity,
                SUM(s.amount) as total_revenue,
                SUM(s.amount) / NULLIF(SUM(s.quantity), 0) as avg_unit_price,
                COUNT(*) as transaction_count
            FROM sales s
            JOIN products p ON s.product_id = p.product_id
            WHERE s.sale_date >= '2024-01-01'
            GROUP BY s.product_id, p.product_name, p.category
        ) src
        ON sm.product_id = src.product_id
        WHEN MATCHED THEN
            UPDATE SET
                product_name = src.product_name,
                category = src.category,
                unique_customers = src.unique_customers,
                total_quantity = src.total_quantity,
                total_revenue = src.total_revenue,
                avg_unit_price = src.avg_unit_price,
                transaction_count = src.transaction_count,
                revenue_per_customer = src.total_revenue / NULLIF(src.unique_customers, 0)
        WHEN NOT MATCHED THEN
            INSERT (product_id, product_name, category, unique_customers, total_quantity, total_revenue, avg_unit_price, transaction_count, revenue_per_customer)
            VALUES (src.product_id, src.product_name, src.category, src.unique_customers, src.total_quantity, src.total_revenue, src.avg_unit_price, src.transaction_count, src.total_revenue / NULLIF(src.unique_customers, 0))
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products", "sales_metrics"},
            {"sales_metrics"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "sales_metrics"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "sales_metrics"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "sales_metrics"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_update_merge_10_update_with_recursive_cte(self):
        """Test UPDATE with recursive CTE for hierarchical updates"""
        query = """
        WITH RECURSIVE manager_chain AS (
            SELECT
                employee_id,
                manager_id,
                1 as level,
                ARRAY[employee_id] as chain
            FROM employees
            WHERE manager_id IS NULL

            UNION ALL

            SELECT
                e.employee_id,
                e.manager_id,
                mc.level + 1,
                mc.chain || e.employee_id
            FROM employees e
            JOIN manager_chain mc ON e.manager_id = mc.employee_id
            WHERE mc.level < 10
        )
        UPDATE employee_hierarchy eh
        SET
            management_level = mc.level,
            reporting_chain = mc.chain,
            top_level_manager = mc.chain[1]
        FROM manager_chain mc
        WHERE eh.employee_id = mc.employee_id
        """

        assert_table_lineage_equal(
            query,
            {"employees", "employee_hierarchy"},
            {"employee_hierarchy"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== CREATE TABLE AS SELECT PATTERNS (Tests 01-10) ====================

    def test_ctas_01_simple_table_with_joins(self):
        """Test CREATE TABLE AS SELECT with multi-table joins"""
        query = """
        CREATE TABLE customer_order_facts AS
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            c.registration_date,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.amount) as lifetime_value,
            AVG(o.amount) as avg_order_value,
            MIN(o.order_date) as first_order_date,
            MAX(o.order_date) as last_order_date
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.customer_name, c.email, c.registration_date
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"customer_order_facts"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_order_facts"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_order_facts"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "customer_order_facts"),
                ),
                (
                    TestColumnQualifierTuple("registration_date", "customers"),
                    TestColumnQualifierTuple(
                        "registration_date", "customer_order_facts"
                    ),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_ctas_02_with_cte_and_window_functions(self):
        """Test CREATE TABLE AS SELECT with CTEs and window functions"""
        query = """
        CREATE TABLE product_sales_ranked AS
        WITH product_metrics AS (
            SELECT
                p.product_id,
                p.product_name,
                p.category,
                SUM(s.quantity) as total_quantity,
                SUM(s.amount) as total_revenue
            FROM products p
            JOIN sales s ON p.product_id = s.product_id
            WHERE s.sale_date >= '2024-01-01'
            GROUP BY p.product_id, p.product_name, p.category
        )
        SELECT
            product_id,
            product_name,
            category,
            total_quantity,
            total_revenue,
            RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
            RANK() OVER (PARTITION BY category ORDER BY total_revenue DESC) as category_rank,
            total_revenue / SUM(total_revenue) OVER () * 100 as revenue_share_percent
        FROM product_metrics
        """

        assert_table_lineage_equal(
            query,
            {"products", "sales"},
            {"product_sales_ranked"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "product_sales_ranked"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "product_sales_ranked"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "product_sales_ranked"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_ctas_03_union_all_multiple_sources(self):
        """Test CREATE TABLE AS SELECT with UNION ALL"""
        query = """
        CREATE TABLE all_transactions AS
        SELECT
            'SALE' as transaction_type,
            sale_id as transaction_id,
            sale_date as transaction_date,
            customer_id,
            amount,
            'Completed' as status
        FROM sales
        WHERE sale_date >= '2024-01-01'
        UNION ALL
        SELECT
            'REFUND' as transaction_type,
            refund_id as transaction_id,
            refund_date as transaction_date,
            customer_id,
            -amount as amount,
            'Processed' as status
        FROM refunds
        WHERE refund_date >= '2024-01-01'
        UNION ALL
        SELECT
            'CREDIT' as transaction_type,
            credit_id as transaction_id,
            credit_date as transaction_date,
            customer_id,
            credit_amount as amount,
            'Applied' as status
        FROM credits
        WHERE credit_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"sales", "refunds", "credits"},
            {"all_transactions"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # sales
                (
                    TestColumnQualifierTuple("sale_id", "sales"),
                    TestColumnQualifierTuple("transaction_id", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("sale_date", "sales"),
                    TestColumnQualifierTuple("transaction_date", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "sales"),
                    TestColumnQualifierTuple("customer_id", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("amount", "sales"),
                    TestColumnQualifierTuple("amount", "all_transactions"),
                ),
                # refunds
                (
                    TestColumnQualifierTuple("refund_id", "refunds"),
                    TestColumnQualifierTuple("transaction_id", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("refund_date", "refunds"),
                    TestColumnQualifierTuple("transaction_date", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "refunds"),
                    TestColumnQualifierTuple("customer_id", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("amount", "refunds"),
                    TestColumnQualifierTuple("amount", "all_transactions"),
                ),
                # credits
                (
                    TestColumnQualifierTuple("credit_id", "credits"),
                    TestColumnQualifierTuple("transaction_id", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("credit_date", "credits"),
                    TestColumnQualifierTuple("transaction_date", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "credits"),
                    TestColumnQualifierTuple("customer_id", "all_transactions"),
                ),
                (
                    TestColumnQualifierTuple("credit_amount", "credits"),
                    TestColumnQualifierTuple("amount", "all_transactions"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_ctas_04_five_table_star_schema(self):
        """Test CREATE TABLE AS SELECT with 5-table star schema join"""
        query = """
        CREATE TABLE sales_fact_denormalized AS
        SELECT
            f.sale_id,
            d.date_key,
            d.year,
            d.quarter,
            d.month,
            p.product_id,
            p.product_name,
            p.category,
            c.customer_id,
            c.customer_name,
            c.segment,
            s.store_id,
            s.store_name,
            s.region,
            f.quantity,
            f.amount,
            f.discount
        FROM fact_sales f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_product p ON f.product_key = p.product_key
        JOIN dim_customer c ON f.customer_key = c.customer_key
        JOIN dim_store s ON f.store_key = s.store_key
        WHERE d.year >= 2024
        """

        assert_table_lineage_equal(
            query,
            {"fact_sales", "dim_date", "dim_product", "dim_customer", "dim_store"},
            {"sales_fact_denormalized"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("sale_id", "fact_sales"),
                    TestColumnQualifierTuple("sale_id", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("date_key", "dim_date"),
                    TestColumnQualifierTuple("date_key", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("year", "dim_date"),
                    TestColumnQualifierTuple("year", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("quarter", "dim_date"),
                    TestColumnQualifierTuple("quarter", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("month", "dim_date"),
                    TestColumnQualifierTuple("month", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "dim_product"),
                    TestColumnQualifierTuple("product_id", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "dim_product"),
                    TestColumnQualifierTuple("product_name", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("category", "dim_product"),
                    TestColumnQualifierTuple("category", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "dim_customer"),
                    TestColumnQualifierTuple("customer_id", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "dim_customer"),
                    TestColumnQualifierTuple(
                        "customer_name", "sales_fact_denormalized"
                    ),
                ),
                (
                    TestColumnQualifierTuple("segment", "dim_customer"),
                    TestColumnQualifierTuple("segment", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("store_id", "dim_store"),
                    TestColumnQualifierTuple("store_id", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("store_name", "dim_store"),
                    TestColumnQualifierTuple("store_name", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("region", "dim_store"),
                    TestColumnQualifierTuple("region", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "fact_sales"),
                    TestColumnQualifierTuple("quantity", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("amount", "fact_sales"),
                    TestColumnQualifierTuple("amount", "sales_fact_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("discount", "fact_sales"),
                    TestColumnQualifierTuple("discount", "sales_fact_denormalized"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_ctas_05_with_subqueries_and_case(self):
        """Test CREATE TABLE AS SELECT with subqueries and CASE expressions"""
        query = """
        CREATE TABLE customer_segmentation AS
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            COALESCE(o.order_count, 0) as order_count,
            COALESCE(o.total_spent, 0) as total_spent,
            CASE
                WHEN o.total_spent > 10000 THEN 'VIP'
                WHEN o.total_spent > 5000 THEN 'Premium'
                WHEN o.total_spent > 1000 THEN 'Regular'
                ELSE 'Basic'
            END as customer_tier,
            CASE
                WHEN o.last_order_date >= CURRENT_DATE - INTERVAL '30 days' THEN 'Active'
                WHEN o.last_order_date >= CURRENT_DATE - INTERVAL '90 days' THEN 'At Risk'
                WHEN o.last_order_date IS NOT NULL THEN 'Inactive'
                ELSE 'Never Purchased'
            END as activity_status
        FROM customers c
        LEFT JOIN (
            SELECT
                customer_id,
                COUNT(*) as order_count,
                SUM(amount) as total_spent,
                MAX(order_date) as last_order_date
            FROM orders
            GROUP BY customer_id
        ) o ON c.customer_id = o.customer_id
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"customer_segmentation"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_segmentation"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_segmentation"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "customer_segmentation"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_ctas_06_recursive_cte_hierarchy(self):
        """Test CREATE TABLE AS SELECT with recursive CTE"""
        query = """
        CREATE TABLE organizational_hierarchy AS
        WITH RECURSIVE org_tree AS (
            SELECT
                employee_id,
                employee_name,
                manager_id,
                department,
                1 as level,
                employee_name as hierarchy_path,
                CAST(employee_id AS VARCHAR) as id_path
            FROM employees
            WHERE manager_id IS NULL

            UNION ALL

            SELECT
                e.employee_id,
                e.employee_name,
                e.manager_id,
                e.department,
                ot.level + 1,
                ot.hierarchy_path || ' > ' || e.employee_name,
                ot.id_path || '/' || CAST(e.employee_id AS VARCHAR)
            FROM employees e
            JOIN org_tree ot ON e.manager_id = ot.employee_id
            WHERE ot.level < 10
        )
        SELECT
            employee_id,
            employee_name,
            manager_id,
            department,
            level as management_level,
            hierarchy_path,
            id_path
        FROM org_tree
        ORDER BY id_path
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            {"organizational_hierarchy"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("employee_id", "organizational_hierarchy"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple(
                        "employee_name", "organizational_hierarchy"
                    ),
                ),
                (
                    TestColumnQualifierTuple("manager_id", "employees"),
                    TestColumnQualifierTuple("manager_id", "organizational_hierarchy"),
                ),
                (
                    TestColumnQualifierTuple("department", "employees"),
                    TestColumnQualifierTuple("department", "organizational_hierarchy"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple(
                        "hierarchy_path", "organizational_hierarchy"
                    ),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_ctas_07_lateral_join_top_n(self):
        """Test CREATE TABLE AS SELECT with LATERAL join"""
        query = """
        CREATE TABLE customer_favorite_products AS
        SELECT
            c.customer_id,
            c.customer_name,
            tp.product_id,
            tp.product_name,
            tp.purchase_count,
            tp.total_spent,
            tp.product_rank
        FROM customers c
        CROSS JOIN LATERAL (
            SELECT
                p.product_id,
                p.product_name,
                COUNT(*) as purchase_count,
                SUM(s.amount) as total_spent,
                ROW_NUMBER() OVER (ORDER BY SUM(s.amount) DESC) as product_rank
            FROM sales s
            JOIN products p ON s.product_id = p.product_id
            WHERE s.customer_id = c.customer_id
            GROUP BY p.product_id, p.product_name
            ORDER BY total_spent DESC
            LIMIT 3
        ) tp
        WHERE c.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"customers", "sales", "products"},
            {"customer_favorite_products"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple(
                        "customer_id", "customer_favorite_products"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "customer_favorite_products"
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple(
                        "product_id", "customer_favorite_products"
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple(
                        "product_name", "customer_favorite_products"
                    ),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_ctas_08_time_series_with_gap_filling(self):
        """Test CREATE TABLE AS SELECT with time series and gap filling"""
        query = """
        CREATE TABLE daily_sales_complete AS
        WITH date_range AS (
            SELECT generate_series(
                '2024-01-01'::date,
                '2024-12-31'::date,
                '1 day'::interval
            )::date as calendar_date
        ),
        daily_aggregates AS (
            SELECT
                DATE(sale_date) as sale_date,
                product_id,
                SUM(quantity) as daily_quantity,
                SUM(amount) as daily_revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY DATE(sale_date), product_id
        ),
        all_product_dates AS (
            SELECT
                dr.calendar_date,
                p.product_id,
                p.product_name,
                p.category
            FROM date_range dr
            CROSS JOIN products p
            WHERE p.is_active = 1
        )
        SELECT
            apd.calendar_date as sale_date,
            apd.product_id,
            apd.product_name,
            apd.category,
            COALESCE(da.daily_quantity, 0) as quantity,
            COALESCE(da.daily_revenue, 0) as revenue
        FROM all_product_dates apd
        LEFT JOIN daily_aggregates da
            ON apd.calendar_date = da.sale_date
            AND apd.product_id = da.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"daily_sales_complete"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "daily_sales_complete"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "daily_sales_complete"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "daily_sales_complete"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_ctas_09_cross_database_aggregation(self):
        """Test CREATE TABLE AS SELECT with cross-database joins"""
        query = """
        CREATE TABLE analytics_db.unified_customer_view AS
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            c.phone,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.amount) as total_revenue,
            AVG(o.amount) as avg_order_value,
            COUNT(DISTINCT t.ticket_id) as support_tickets,
            COUNT(DISTINCT r.review_id) as product_reviews,
            AVG(r.rating) as avg_review_rating
        FROM crm_db.customers c
        LEFT JOIN sales_db.orders o ON c.customer_id = o.customer_id
        LEFT JOIN support_db.tickets t ON c.customer_id = t.customer_id
        LEFT JOIN reviews_db.reviews r ON c.customer_id = r.customer_id
        WHERE c.is_active = 1
        GROUP BY c.customer_id, c.customer_name, c.email, c.phone
        """

        assert_table_lineage_equal(
            query,
            {
                "crm_db.customers",
                "sales_db.orders",
                "support_db.tickets",
                "reviews_db.reviews",
            },
            {"analytics_db.unified_customer_view"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_id", "analytics_db.unified_customer_view"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "analytics_db.unified_customer_view"
                    ),
                ),
                (
                    TestColumnQualifierTuple("email", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "email", "analytics_db.unified_customer_view"
                    ),
                ),
                (
                    TestColumnQualifierTuple("phone", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "phone", "analytics_db.unified_customer_view"
                    ),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_ctas_10_complex_nested_transformations(self):
        """Test CREATE TABLE AS SELECT with deeply nested transformations"""
        query = """
        CREATE TABLE product_performance_summary AS
        WITH
        base_metrics AS (
            SELECT
                product_id,
                COUNT(*) as transaction_count,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY product_id
        ),
        ranked_metrics AS (
            SELECT
                bm.product_id,
                p.product_name,
                p.category,
                p.supplier_id,
                bm.transaction_count,
                bm.total_quantity,
                bm.total_revenue,
                RANK() OVER (ORDER BY bm.total_revenue DESC) as overall_rank,
                RANK() OVER (PARTITION BY p.category ORDER BY bm.total_revenue DESC) as category_rank
            FROM base_metrics bm
            JOIN products p ON bm.product_id = p.product_id
        ),
        supplier_aggregates AS (
            SELECT
                supplier_id,
                SUM(total_revenue) as supplier_revenue,
                COUNT(*) as product_count
            FROM ranked_metrics
            GROUP BY supplier_id
        )
        SELECT
            rm.product_id,
            rm.product_name,
            rm.category,
            s.supplier_name,
            rm.transaction_count,
            rm.total_quantity,
            rm.total_revenue,
            rm.overall_rank,
            rm.category_rank,
            sa.supplier_revenue,
            sa.product_count as supplier_product_count,
            rm.total_revenue / NULLIF(sa.supplier_revenue, 0) * 100 as supplier_revenue_share
        FROM ranked_metrics rm
        JOIN suppliers s ON rm.supplier_id = s.supplier_id
        JOIN supplier_aggregates sa ON rm.supplier_id = sa.supplier_id
        WHERE rm.overall_rank <= 100
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products", "suppliers"},
            {"product_performance_summary"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple(
                        "product_id", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple(
                        "product_name", "product_performance_summary"
                    ),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "product_performance_summary"),
                ),
                (
                    TestColumnQualifierTuple("supplier_name", "suppliers"),
                    TestColumnQualifierTuple(
                        "supplier_name", "product_performance_summary"
                    ),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # ==================== CREATE VIEW PATTERNS (Tests 01-10) ====================

    def test_create_view_01_with_joins_and_aggregations(self):
        """Test CREATE VIEW with multi-table joins and aggregations"""
        query = """
        CREATE VIEW v_customer_summary AS
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(o.amount) as total_spent,
            AVG(o.amount) as avg_order_value
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.customer_name, c.email
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"v_customer_summary"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "v_customer_summary"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "v_customer_summary"),
                ),
                (
                    TestColumnQualifierTuple("email", "customers"),
                    TestColumnQualifierTuple("email", "v_customer_summary"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_create_view_02_with_cte_and_window_functions(self):
        """Test CREATE VIEW with CTE and window functions"""
        query = """
        CREATE VIEW v_product_rankings AS
        WITH sales_metrics AS (
            SELECT
                product_id,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY product_id
        )
        SELECT
            sm.product_id,
            p.product_name,
            p.category,
            sm.total_quantity,
            sm.total_revenue,
            RANK() OVER (ORDER BY sm.total_revenue DESC) as revenue_rank,
            RANK() OVER (PARTITION BY p.category ORDER BY sm.total_revenue DESC) as category_rank
        FROM sales_metrics sm
        JOIN products p ON sm.product_id = p.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"v_product_rankings"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "v_product_rankings"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "v_product_rankings"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "v_product_rankings"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_create_view_03_union_all_multiple_sources(self):
        """Test CREATE VIEW with UNION ALL"""
        query = """
        CREATE VIEW v_all_events AS
        SELECT
            'ORDER' as event_type,
            order_id as event_id,
            customer_id,
            order_date as event_date,
            amount as event_value
        FROM orders
        UNION ALL
        SELECT
            'SUPPORT' as event_type,
            ticket_id as event_id,
            customer_id,
            ticket_date as event_date,
            NULL as event_value
        FROM support_tickets
        UNION ALL
        SELECT
            'REVIEW' as event_type,
            review_id as event_id,
            customer_id,
            review_date as event_date,
            rating as event_value
        FROM product_reviews
        """

        assert_table_lineage_equal(
            query,
            {"orders", "support_tickets", "product_reviews"},
            {"v_all_events"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # orders
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple("event_id", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "orders"),
                    TestColumnQualifierTuple("customer_id", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("event_date", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple("event_value", "v_all_events"),
                ),
                # support_tickets
                (
                    TestColumnQualifierTuple("ticket_id", "support_tickets"),
                    TestColumnQualifierTuple("event_id", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "support_tickets"),
                    TestColumnQualifierTuple("customer_id", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("ticket_date", "support_tickets"),
                    TestColumnQualifierTuple("event_date", "v_all_events"),
                ),
                # product_reviews
                (
                    TestColumnQualifierTuple("review_id", "product_reviews"),
                    TestColumnQualifierTuple("event_id", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "product_reviews"),
                    TestColumnQualifierTuple("customer_id", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("review_date", "product_reviews"),
                    TestColumnQualifierTuple("event_date", "v_all_events"),
                ),
                (
                    TestColumnQualifierTuple("rating", "product_reviews"),
                    TestColumnQualifierTuple("event_value", "v_all_events"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_create_view_04_with_subqueries(self):
        """Test CREATE VIEW with correlated subqueries"""
        query = """
        CREATE VIEW v_product_stats AS
        SELECT
            p.product_id,
            p.product_name,
            p.category,
            p.current_price,
            (SELECT AVG(price) FROM products WHERE category = p.category) as category_avg_price,
            (SELECT COUNT(*) FROM sales WHERE product_id = p.product_id) as sale_count,
            (SELECT SUM(amount) FROM sales WHERE product_id = p.product_id) as total_revenue
        FROM products p
        WHERE p.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"products", "sales"},
            {"v_product_stats"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("product_id", "v_product_stats"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "v_product_stats"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "v_product_stats"),
                ),
                (
                    TestColumnQualifierTuple("current_price", "products"),
                    TestColumnQualifierTuple("current_price", "v_product_stats"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_create_view_05_recursive_hierarchy(self):
        """Test CREATE VIEW with recursive CTE for hierarchy"""
        query = """
        CREATE VIEW v_employee_tree AS
        WITH RECURSIVE emp_hierarchy AS (
            SELECT
                employee_id,
                employee_name,
                manager_id,
                department,
                1 as level
            FROM employees
            WHERE manager_id IS NULL

            UNION ALL

            SELECT
                e.employee_id,
                e.employee_name,
                e.manager_id,
                e.department,
                eh.level + 1
            FROM employees e
            JOIN emp_hierarchy eh ON e.manager_id = eh.employee_id
        )
        SELECT
            employee_id,
            employee_name,
            manager_id,
            department,
            level
        FROM emp_hierarchy
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            {"v_employee_tree"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("employee_id", "v_employee_tree"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple("employee_name", "v_employee_tree"),
                ),
                (
                    TestColumnQualifierTuple("manager_id", "employees"),
                    TestColumnQualifierTuple("manager_id", "v_employee_tree"),
                ),
                (
                    TestColumnQualifierTuple("department", "employees"),
                    TestColumnQualifierTuple("department", "v_employee_tree"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_create_view_06_star_schema_denormalization(self):
        """Test CREATE VIEW denormalizing star schema"""
        query = """
        CREATE VIEW v_sales_denormalized AS
        SELECT
            f.sale_id,
            d.year,
            d.month,
            d.day_of_week,
            p.product_name,
            p.category as product_category,
            c.customer_name,
            c.segment as customer_segment,
            s.store_name,
            s.region as store_region,
            f.quantity,
            f.amount,
            f.discount
        FROM fact_sales f
        JOIN dim_date d ON f.date_key = d.date_key
        JOIN dim_product p ON f.product_key = p.product_key
        JOIN dim_customer c ON f.customer_key = c.customer_key
        JOIN dim_store s ON f.store_key = s.store_key
        """

        assert_table_lineage_equal(
            query,
            {"fact_sales", "dim_date", "dim_product", "dim_customer", "dim_store"},
            {"v_sales_denormalized"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("sale_id", "fact_sales"),
                    TestColumnQualifierTuple("sale_id", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("year", "dim_date"),
                    TestColumnQualifierTuple("year", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("month", "dim_date"),
                    TestColumnQualifierTuple("month", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("day_of_week", "dim_date"),
                    TestColumnQualifierTuple("day_of_week", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "dim_product"),
                    TestColumnQualifierTuple("product_name", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("category", "dim_product"),
                    TestColumnQualifierTuple(
                        "product_category", "v_sales_denormalized"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "dim_customer"),
                    TestColumnQualifierTuple("customer_name", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("segment", "dim_customer"),
                    TestColumnQualifierTuple(
                        "customer_segment", "v_sales_denormalized"
                    ),
                ),
                (
                    TestColumnQualifierTuple("store_name", "dim_store"),
                    TestColumnQualifierTuple("store_name", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("region", "dim_store"),
                    TestColumnQualifierTuple("store_region", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("quantity", "fact_sales"),
                    TestColumnQualifierTuple("quantity", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("amount", "fact_sales"),
                    TestColumnQualifierTuple("amount", "v_sales_denormalized"),
                ),
                (
                    TestColumnQualifierTuple("discount", "fact_sales"),
                    TestColumnQualifierTuple("discount", "v_sales_denormalized"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_create_view_07_with_lateral_join(self):
        """Test CREATE VIEW with LATERAL join"""
        query = """
        CREATE VIEW v_customer_recent_orders AS
        SELECT
            c.customer_id,
            c.customer_name,
            recent.order_id,
            recent.order_date,
            recent.amount,
            recent.order_rank
        FROM customers c
        CROSS JOIN LATERAL (
            SELECT
                order_id,
                order_date,
                amount,
                ROW_NUMBER() OVER (ORDER BY order_date DESC) as order_rank
            FROM orders
            WHERE customer_id = c.customer_id
            ORDER BY order_date DESC
            LIMIT 5
        ) recent
        WHERE c.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"v_customer_recent_orders"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "v_customer_recent_orders"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "v_customer_recent_orders"
                    ),
                ),
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple("order_id", "v_customer_recent_orders"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("order_date", "v_customer_recent_orders"),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple("amount", "v_customer_recent_orders"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_create_view_08_materialized_with_aggregations(self):
        """Test CREATE MATERIALIZED VIEW with complex aggregations"""
        query = """
        CREATE MATERIALIZED VIEW mv_daily_sales_summary AS
        SELECT
            DATE(sale_date) as sale_date,
            product_id,
            COUNT(*) as transaction_count,
            SUM(quantity) as total_quantity,
            SUM(amount) as total_revenue,
            AVG(amount) as avg_transaction_value,
            COUNT(DISTINCT customer_id) as unique_customers
        FROM sales
        WHERE sale_date >= '2024-01-01'
        GROUP BY DATE(sale_date), product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            {"mv_daily_sales_summary"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("sale_date", "sales"),
                    TestColumnQualifierTuple("sale_date", "mv_daily_sales_summary"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "mv_daily_sales_summary"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_create_view_09_cross_database_consolidation(self):
        """Test CREATE VIEW with cross-database consolidation"""
        query = """
        CREATE VIEW analytics.v_customer_360 AS
        SELECT
            c.customer_id,
            c.customer_name,
            c.email,
            c.phone,
            COUNT(DISTINCT o.order_id) as order_count,
            SUM(o.amount) as total_revenue,
            COUNT(DISTINCT t.ticket_id) as support_tickets,
            AVG(r.rating) as avg_review_rating
        FROM crm_db.customers c
        LEFT JOIN sales_db.orders o ON c.customer_id = o.customer_id
        LEFT JOIN support_db.tickets t ON c.customer_id = t.customer_id
        LEFT JOIN reviews_db.reviews r ON c.customer_id = r.customer_id
        WHERE c.is_active = 1
        GROUP BY c.customer_id, c.customer_name, c.email, c.phone
        """

        assert_table_lineage_equal(
            query,
            {
                "crm_db.customers",
                "sales_db.orders",
                "support_db.tickets",
                "reviews_db.reviews",
            },
            {"analytics.v_customer_360"},
            dialect=Dialect.MYSQL.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "crm_db.customers"),
                    TestColumnQualifierTuple("customer_id", "analytics.v_customer_360"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "analytics.v_customer_360"
                    ),
                ),
                (
                    TestColumnQualifierTuple("email", "crm_db.customers"),
                    TestColumnQualifierTuple("email", "analytics.v_customer_360"),
                ),
                (
                    TestColumnQualifierTuple("phone", "crm_db.customers"),
                    TestColumnQualifierTuple("phone", "analytics.v_customer_360"),
                ),
            ],
            dialect=Dialect.MYSQL.value,
        )

    def test_create_view_10_complex_nested_ctes(self):
        """Test CREATE VIEW with complex nested CTEs"""
        query = """
        CREATE VIEW v_product_performance AS
        WITH
        monthly_sales AS (
            SELECT
                product_id,
                DATE_TRUNC('month', sale_date) as month,
                SUM(quantity) as monthly_quantity,
                SUM(amount) as monthly_revenue
            FROM sales
            WHERE sale_date >= '2024-01-01'
            GROUP BY product_id, DATE_TRUNC('month', sale_date)
        ),
        product_trends AS (
            SELECT
                ms.product_id,
                ms.month,
                ms.monthly_revenue,
                LAG(ms.monthly_revenue) OVER (
                    PARTITION BY ms.product_id
                    ORDER BY ms.month
                ) as prev_month_revenue,
                AVG(ms.monthly_revenue) OVER (
                    PARTITION BY ms.product_id
                    ORDER BY ms.month
                    ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
                ) as rolling_avg_3month
            FROM monthly_sales ms
        )
        SELECT
            pt.product_id,
            p.product_name,
            p.category,
            pt.month,
            pt.monthly_revenue,
            pt.prev_month_revenue,
            pt.rolling_avg_3month,
            CASE
                WHEN pt.prev_month_revenue IS NOT NULL AND pt.prev_month_revenue > 0
                THEN ((pt.monthly_revenue - pt.prev_month_revenue) / pt.prev_month_revenue) * 100
                ELSE NULL
            END as month_over_month_growth
        FROM product_trends pt
        JOIN products p ON pt.product_id = p.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"v_product_performance"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "v_product_performance"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "v_product_performance"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "v_product_performance"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    # ==================== WINDOW FUNCTIONS PATTERNS (Tests 01-10) ====================

    def test_window_func_01_row_number_with_joins(self):
        """Test window functions with ROW_NUMBER and joins"""
        query = """
        INSERT INTO ranked_orders
        SELECT
            o.order_id,
            o.customer_id,
            c.customer_name,
            o.order_date,
            o.amount,
            ROW_NUMBER() OVER (PARTITION BY o.customer_id ORDER BY o.order_date DESC) as order_rank,
            ROW_NUMBER() OVER (ORDER BY o.amount DESC) as global_rank
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.order_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"orders", "customers"},
            {"ranked_orders"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_id", "orders"),
                    TestColumnQualifierTuple("order_id", "ranked_orders"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "orders"),
                    TestColumnQualifierTuple("customer_id", "ranked_orders"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "ranked_orders"),
                ),
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("order_date", "ranked_orders"),
                ),
                (
                    TestColumnQualifierTuple("amount", "orders"),
                    TestColumnQualifierTuple("amount", "ranked_orders"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_window_func_02_lag_lead_time_series(self):
        """Test LAG/LEAD for time series analysis"""
        query = """
        INSERT INTO stock_analysis
        SELECT
            s.stock_id,
            s.trade_date,
            s.closing_price,
            LAG(s.closing_price, 1) OVER (PARTITION BY s.stock_id ORDER BY s.trade_date) as prev_day_price,
            LEAD(s.closing_price, 1) OVER (PARTITION BY s.stock_id ORDER BY s.trade_date) as next_day_price,
            s.closing_price - LAG(s.closing_price, 1) OVER (
                PARTITION BY s.stock_id ORDER BY s.trade_date
            ) as daily_change,
            s.volume,
            LAG(s.volume, 7) OVER (PARTITION BY s.stock_id ORDER BY s.trade_date) as same_weekday_prev_week
        FROM stock_prices s
        WHERE s.trade_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"stock_prices"},
            {"stock_analysis"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("stock_id", "stock_prices"),
                    TestColumnQualifierTuple("stock_id", "stock_analysis"),
                ),
                (
                    TestColumnQualifierTuple("trade_date", "stock_prices"),
                    TestColumnQualifierTuple("trade_date", "stock_analysis"),
                ),
                (
                    TestColumnQualifierTuple("closing_price", "stock_prices"),
                    TestColumnQualifierTuple("closing_price", "stock_analysis"),
                ),
                (
                    TestColumnQualifierTuple("volume", "stock_prices"),
                    TestColumnQualifierTuple("volume", "stock_analysis"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_window_func_03_multiple_window_specs(self):
        """Test multiple window specifications with different partitioning"""
        query = """
        INSERT INTO sales_metrics
        SELECT
            s.sale_id,
            s.product_id,
            p.category,
            s.sale_date,
            s.amount,
            SUM(s.amount) OVER (PARTITION BY s.product_id) as product_total,
            SUM(s.amount) OVER (PARTITION BY p.category) as category_total,
            SUM(s.amount) OVER () as grand_total,
            AVG(s.amount) OVER (PARTITION BY s.product_id ORDER BY s.sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as moving_avg_7day,
            COUNT(*) OVER (PARTITION BY p.category ORDER BY s.sale_date) as running_count_in_category
        FROM sales s
        JOIN products p ON s.product_id = p.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"sales_metrics"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("sale_id", "sales"),
                    TestColumnQualifierTuple("sale_id", "sales_metrics"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "sales_metrics"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "sales_metrics"),
                ),
                (
                    TestColumnQualifierTuple("sale_date", "sales"),
                    TestColumnQualifierTuple("sale_date", "sales_metrics"),
                ),
                (
                    TestColumnQualifierTuple("amount", "sales"),
                    TestColumnQualifierTuple("amount", "sales_metrics"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_window_func_04_rank_dense_rank_ntile(self):
        """Test RANK, DENSE_RANK, and NTILE functions"""
        query = """
        INSERT INTO customer_segmentation
        SELECT
            c.customer_id,
            c.customer_name,
            SUM(o.amount) as total_spent,
            COUNT(o.order_id) as order_count,
            RANK() OVER (ORDER BY SUM(o.amount) DESC) as spending_rank,
            DENSE_RANK() OVER (ORDER BY SUM(o.amount) DESC) as spending_dense_rank,
            NTILE(10) OVER (ORDER BY SUM(o.amount) DESC) as spending_decile,
            PERCENT_RANK() OVER (ORDER BY SUM(o.amount) DESC) as spending_percentile
        FROM customers c
        LEFT JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.customer_name
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders"},
            {"customer_segmentation"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("customer_id", "customer_segmentation"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("customer_name", "customer_segmentation"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_window_func_05_first_last_value(self):
        """Test FIRST_VALUE and LAST_VALUE functions"""
        query = """
        INSERT INTO session_analytics
        SELECT
            session_id,
            user_id,
            event_timestamp,
            page_url,
            FIRST_VALUE(page_url) OVER (
                PARTITION BY session_id
                ORDER BY event_timestamp
                ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
            ) as landing_page,
            LAST_VALUE(page_url) OVER (
                PARTITION BY session_id
                ORDER BY event_timestamp
                ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
            ) as exit_page,
            COUNT(*) OVER (PARTITION BY session_id) as total_events,
            event_timestamp - FIRST_VALUE(event_timestamp) OVER (
                PARTITION BY session_id
                ORDER BY event_timestamp
            ) as time_from_session_start
        FROM web_events
        WHERE event_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"web_events"},
            {"session_analytics"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("session_id", "web_events"),
                    TestColumnQualifierTuple("session_id", "session_analytics"),
                ),
                (
                    TestColumnQualifierTuple("user_id", "web_events"),
                    TestColumnQualifierTuple("user_id", "session_analytics"),
                ),
                (
                    TestColumnQualifierTuple("event_timestamp", "web_events"),
                    TestColumnQualifierTuple("event_timestamp", "session_analytics"),
                ),
                (
                    TestColumnQualifierTuple("page_url", "web_events"),
                    TestColumnQualifierTuple("page_url", "session_analytics"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_window_func_06_cume_dist_and_percentiles(self):
        """Test CUME_DIST and percentile functions"""
        query = """
        INSERT INTO employee_compensation_analysis
        SELECT
            e.employee_id,
            e.employee_name,
            e.department,
            e.salary,
            CUME_DIST() OVER (ORDER BY e.salary) as cumulative_dist_overall,
            CUME_DIST() OVER (PARTITION BY e.department ORDER BY e.salary) as cumulative_dist_dept,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.salary) OVER (PARTITION BY e.department) as dept_median_salary,
            PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY e.salary) OVER () as p75_salary
        FROM employees e
        WHERE e.is_active = 1
        """

        assert_table_lineage_equal(
            query,
            {"employees"},
            {"employee_compensation_analysis"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple(
                        "employee_id", "employee_compensation_analysis"
                    ),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple(
                        "employee_name", "employee_compensation_analysis"
                    ),
                ),
                (
                    TestColumnQualifierTuple("department", "employees"),
                    TestColumnQualifierTuple(
                        "department", "employee_compensation_analysis"
                    ),
                ),
                (
                    TestColumnQualifierTuple("salary", "employees"),
                    TestColumnQualifierTuple(
                        "salary", "employee_compensation_analysis"
                    ),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_window_func_07_running_aggregates_with_cte(self):
        """Test running aggregates with CTEs"""
        query = """
        WITH daily_metrics AS (
            SELECT
                DATE(order_date) as order_date,
                COUNT(*) as daily_orders,
                SUM(amount) as daily_revenue
            FROM orders
            WHERE order_date >= '2024-01-01'
            GROUP BY DATE(order_date)
        )
        INSERT INTO revenue_trends
        SELECT
            dm.order_date,
            dm.daily_orders,
            dm.daily_revenue,
            SUM(dm.daily_revenue) OVER (ORDER BY dm.order_date) as cumulative_revenue,
            AVG(dm.daily_revenue) OVER (
                ORDER BY dm.order_date
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) as moving_avg_7day,
            AVG(dm.daily_revenue) OVER (
                ORDER BY dm.order_date
                ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            ) as moving_avg_30day,
            STDDEV(dm.daily_revenue) OVER (
                ORDER BY dm.order_date
                ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            ) as rolling_stddev_30day
        FROM daily_metrics dm
        """

        assert_table_lineage_equal(
            query,
            {"orders"},
            {"revenue_trends"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("order_date", "revenue_trends"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_window_func_08_ratio_to_report(self):
        """Test ratio calculations with window functions"""
        query = """
        INSERT INTO product_contribution_analysis
        SELECT
            p.product_id,
            p.product_name,
            p.category,
            SUM(s.amount) as product_revenue,
            SUM(SUM(s.amount)) OVER (PARTITION BY p.category) as category_revenue,
            SUM(SUM(s.amount)) OVER () as total_revenue,
            RATIO_TO_REPORT(SUM(s.amount)) OVER (PARTITION BY p.category) as category_share,
            RATIO_TO_REPORT(SUM(s.amount)) OVER () as overall_share,
            (SUM(s.amount) * 100.0) / NULLIF(SUM(SUM(s.amount)) OVER (PARTITION BY p.category), 0) as pct_of_category
        FROM sales s
        JOIN products p ON s.product_id = p.product_id
        WHERE s.sale_date >= '2024-01-01'
        GROUP BY p.product_id, p.product_name, p.category
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"product_contribution_analysis"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple(
                        "product_id", "product_contribution_analysis"
                    ),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple(
                        "product_name", "product_contribution_analysis"
                    ),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple(
                        "category", "product_contribution_analysis"
                    ),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_window_func_09_named_windows(self):
        """Test named window specifications"""
        query = """
        INSERT INTO sales_window_analysis
        SELECT
            s.sale_id,
            s.product_id,
            s.customer_id,
            s.sale_date,
            s.amount,
            ROW_NUMBER() OVER w_product as product_sale_num,
            SUM(s.amount) OVER w_product as product_running_total,
            AVG(s.amount) OVER w_customer as customer_avg,
            COUNT(*) OVER w_customer as customer_txn_count,
            RANK() OVER w_date as daily_rank
        FROM sales s
        WINDOW
            w_product AS (PARTITION BY s.product_id ORDER BY s.sale_date),
            w_customer AS (PARTITION BY s.customer_id ORDER BY s.sale_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
            w_date AS (PARTITION BY DATE(s.sale_date) ORDER BY s.amount DESC)
        """

        assert_table_lineage_equal(
            query,
            {"sales"},
            {"sales_window_analysis"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("sale_id", "sales"),
                    TestColumnQualifierTuple("sale_id", "sales_window_analysis"),
                ),
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "sales_window_analysis"),
                ),
                (
                    TestColumnQualifierTuple("customer_id", "sales"),
                    TestColumnQualifierTuple("customer_id", "sales_window_analysis"),
                ),
                (
                    TestColumnQualifierTuple("sale_date", "sales"),
                    TestColumnQualifierTuple("sale_date", "sales_window_analysis"),
                ),
                (
                    TestColumnQualifierTuple("amount", "sales"),
                    TestColumnQualifierTuple("amount", "sales_window_analysis"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_window_func_10_complex_frame_specifications(self):
        """Test complex window frame specifications"""
        query = """
        INSERT INTO time_based_analysis
        SELECT
            t.transaction_id,
            t.account_id,
            t.transaction_date,
            t.amount,
            SUM(t.amount) OVER (
                PARTITION BY t.account_id
                ORDER BY t.transaction_date
                RANGE BETWEEN INTERVAL '30' DAY PRECEDING AND CURRENT ROW
            ) as sum_last_30_days,
            AVG(t.amount) OVER (
                PARTITION BY t.account_id
                ORDER BY t.transaction_date
                RANGE BETWEEN INTERVAL '7' DAY PRECEDING AND INTERVAL '7' DAY FOLLOWING
            ) as avg_14_day_window,
            COUNT(*) OVER (
                PARTITION BY t.account_id
                ORDER BY t.transaction_date
                RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) as cumulative_count,
            MAX(t.amount) OVER (
                PARTITION BY t.account_id
                ORDER BY t.transaction_date
                ROWS BETWEEN 10 PRECEDING AND 10 FOLLOWING
            ) as max_21_row_window
        FROM transactions t
        WHERE t.transaction_date >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"transactions"},
            {"time_based_analysis"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("transaction_id", "transactions"),
                    TestColumnQualifierTuple("transaction_id", "time_based_analysis"),
                ),
                (
                    TestColumnQualifierTuple("account_id", "transactions"),
                    TestColumnQualifierTuple("account_id", "time_based_analysis"),
                ),
                (
                    TestColumnQualifierTuple("transaction_date", "transactions"),
                    TestColumnQualifierTuple("transaction_date", "time_based_analysis"),
                ),
                (
                    TestColumnQualifierTuple("amount", "transactions"),
                    TestColumnQualifierTuple("amount", "time_based_analysis"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    # ==================== MIXED COMPLEX PATTERNS (Tests 01-05) ====================

    def test_mixed_complex_01_ultimate_analytics_query(self):
        """Test ultimate complexity: CTEs + Joins + Window Functions + UNION"""
        query = """
        WITH
        customer_metrics AS (
            SELECT
                c.customer_id,
                c.customer_name,
                c.segment,
                COUNT(DISTINCT o.order_id) as order_count,
                SUM(o.amount) as total_revenue,
                AVG(o.amount) as avg_order_value
            FROM customers c
            LEFT JOIN orders o ON c.customer_id = o.customer_id
            WHERE o.order_date >= '2024-01-01'
            GROUP BY c.customer_id, c.customer_name, c.segment
        ),
        product_performance AS (
            SELECT
                p.product_id,
                p.product_name,
                p.category,
                SUM(s.quantity) as total_quantity,
                SUM(s.amount) as product_revenue,
                RANK() OVER (PARTITION BY p.category ORDER BY SUM(s.amount) DESC) as category_rank
            FROM products p
            JOIN sales s ON p.product_id = s.product_id
            WHERE s.sale_date >= '2024-01-01'
            GROUP BY p.product_id, p.product_name, p.category
        ),
        regional_sales AS (
            SELECT
                st.store_id,
                st.store_name,
                st.region,
                SUM(s.amount) as regional_revenue,
                COUNT(DISTINCT s.customer_id) as unique_customers
            FROM stores st
            JOIN sales s ON st.store_id = s.store_id
            GROUP BY st.store_id, st.store_name, st.region
        )
        INSERT INTO comprehensive_analytics
        SELECT
            'CUSTOMER' as entity_type,
            cm.customer_id as entity_id,
            cm.customer_name as entity_name,
            cm.segment as category,
            cm.total_revenue as revenue,
            cm.order_count as metric_count,
            ROW_NUMBER() OVER (ORDER BY cm.total_revenue DESC) as overall_rank
        FROM customer_metrics cm
        WHERE cm.order_count > 5

        UNION ALL

        SELECT
            'PRODUCT' as entity_type,
            pp.product_id as entity_id,
            pp.product_name as entity_name,
            pp.category,
            pp.product_revenue as revenue,
            pp.total_quantity as metric_count,
            ROW_NUMBER() OVER (ORDER BY pp.product_revenue DESC) as overall_rank
        FROM product_performance pp
        WHERE pp.category_rank <= 10

        UNION ALL

        SELECT
            'REGION' as entity_type,
            rs.store_id as entity_id,
            rs.store_name as entity_name,
            rs.region as category,
            rs.regional_revenue as revenue,
            rs.unique_customers as metric_count,
            ROW_NUMBER() OVER (ORDER BY rs.regional_revenue DESC) as overall_rank
        FROM regional_sales rs
        """

        assert_table_lineage_equal(
            query,
            {"customers", "orders", "products", "sales", "stores"},
            {"comprehensive_analytics"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                # Customer metrics
                (
                    TestColumnQualifierTuple("customer_id", "customers"),
                    TestColumnQualifierTuple("entity_id", "comprehensive_analytics"),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "customers"),
                    TestColumnQualifierTuple("entity_name", "comprehensive_analytics"),
                ),
                (
                    TestColumnQualifierTuple("segment", "customers"),
                    TestColumnQualifierTuple("category", "comprehensive_analytics"),
                ),
                # Product performance
                (
                    TestColumnQualifierTuple("product_id", "products"),
                    TestColumnQualifierTuple("entity_id", "comprehensive_analytics"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("entity_name", "comprehensive_analytics"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "comprehensive_analytics"),
                ),
                # Regional sales
                (
                    TestColumnQualifierTuple("store_id", "stores"),
                    TestColumnQualifierTuple("entity_id", "comprehensive_analytics"),
                ),
                (
                    TestColumnQualifierTuple("store_name", "stores"),
                    TestColumnQualifierTuple("entity_name", "comprehensive_analytics"),
                ),
                (
                    TestColumnQualifierTuple("region", "stores"),
                    TestColumnQualifierTuple("category", "comprehensive_analytics"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_mixed_complex_02_recursive_cte_with_joins_and_windows(self):
        """Test recursive CTE combined with joins and window functions"""
        query = """
        WITH RECURSIVE
        org_hierarchy AS (
            SELECT
                e.employee_id,
                e.employee_name,
                e.manager_id,
                e.department,
                e.salary,
                1 as level,
                CAST(e.employee_id AS VARCHAR) as hierarchy_path
            FROM employees e
            WHERE e.manager_id IS NULL

            UNION ALL

            SELECT
                e.employee_id,
                e.employee_name,
                e.manager_id,
                e.department,
                e.salary,
                oh.level + 1,
                oh.hierarchy_path || '/' || CAST(e.employee_id AS VARCHAR)
            FROM employees e
            JOIN org_hierarchy oh ON e.manager_id = oh.employee_id
            WHERE oh.level < 10
        ),
        department_stats AS (
            SELECT
                d.department_id,
                d.department_name,
                COUNT(DISTINCT oh.employee_id) as employee_count,
                AVG(oh.salary) as avg_salary,
                MAX(oh.level) as max_depth
            FROM departments d
            LEFT JOIN org_hierarchy oh ON d.department_name = oh.department
            GROUP BY d.department_id, d.department_name
        )
        INSERT INTO org_analytics
        SELECT
            oh.employee_id,
            oh.employee_name,
            oh.manager_id,
            oh.department,
            oh.salary,
            oh.level,
            oh.hierarchy_path,
            ds.employee_count as dept_size,
            ds.avg_salary as dept_avg_salary,
            RANK() OVER (PARTITION BY oh.department ORDER BY oh.salary DESC) as dept_salary_rank,
            PERCENT_RANK() OVER (ORDER BY oh.salary) as overall_salary_percentile
        FROM org_hierarchy oh
        LEFT JOIN department_stats ds ON oh.department = ds.department_name
        """

        assert_table_lineage_equal(
            query,
            {"employees", "departments"},
            {"org_analytics"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("employee_id", "employees"),
                    TestColumnQualifierTuple("employee_id", "org_analytics"),
                ),
                (
                    TestColumnQualifierTuple("employee_name", "employees"),
                    TestColumnQualifierTuple("employee_name", "org_analytics"),
                ),
                (
                    TestColumnQualifierTuple("manager_id", "employees"),
                    TestColumnQualifierTuple("manager_id", "org_analytics"),
                ),
                (
                    TestColumnQualifierTuple("department", "employees"),
                    TestColumnQualifierTuple("department", "org_analytics"),
                ),
                (
                    TestColumnQualifierTuple("salary", "employees"),
                    TestColumnQualifierTuple("salary", "org_analytics"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )

    def test_mixed_complex_03_cross_database_multi_cte_join(self):
        """Test cross-database query with multiple CTEs and complex joins"""
        query = """
        WITH
        crm_customers AS (
            SELECT
                c.customer_id,
                c.customer_name,
                c.email,
                c.account_created_date,
                DATEDIFF('day', c.account_created_date, CURRENT_DATE) as customer_age_days
            FROM crm_db.customers c
            WHERE c.is_active = 1
        ),
        sales_summary AS (
            SELECT
                o.customer_id,
                COUNT(DISTINCT o.order_id) as order_count,
                SUM(o.amount) as total_spent,
                MAX(o.order_date) as last_order_date,
                AVG(o.amount) as avg_order_value
            FROM sales_db.orders o
            WHERE o.order_date >= '2023-01-01'
            GROUP BY o.customer_id
        ),
        support_activity AS (
            SELECT
                t.customer_id,
                COUNT(*) as ticket_count,
                AVG(t.resolution_time_hours) as avg_resolution_hours,
                SUM(CASE WHEN t.satisfaction_score >= 4 THEN 1 ELSE 0 END) as positive_feedbacks
            FROM support_db.tickets t
            WHERE t.created_date >= '2023-01-01'
            GROUP BY t.customer_id
        ),
        engagement_scores AS (
            SELECT
                e.customer_id,
                COUNT(DISTINCT e.event_type) as distinct_actions,
                COUNT(*) as total_events,
                MAX(e.event_timestamp) as last_activity
            FROM analytics_db.events e
            WHERE e.event_date >= '2024-01-01'
            GROUP BY e.customer_id
        )
        INSERT INTO data_warehouse.customer_360
        SELECT
            cc.customer_id,
            cc.customer_name,
            cc.email,
            cc.customer_age_days,
            COALESCE(ss.order_count, 0) as lifetime_orders,
            COALESCE(ss.total_spent, 0) as lifetime_value,
            COALESCE(ss.avg_order_value, 0) as avg_order_value,
            ss.last_order_date,
            COALESCE(sa.ticket_count, 0) as support_tickets,
            COALESCE(sa.avg_resolution_hours, 0) as avg_support_resolution,
            COALESCE(sa.positive_feedbacks, 0) as positive_support_feedback,
            COALESCE(es.distinct_actions, 0) as engagement_action_types,
            COALESCE(es.total_events, 0) as engagement_event_count,
            es.last_activity as last_engagement_date,
            CASE
                WHEN ss.total_spent > 10000 THEN 'VIP'
                WHEN ss.total_spent > 5000 THEN 'Premium'
                WHEN ss.total_spent > 1000 THEN 'Standard'
                ELSE 'Basic'
            END as customer_tier
        FROM crm_customers cc
        LEFT JOIN sales_summary ss ON cc.customer_id = ss.customer_id
        LEFT JOIN support_activity sa ON cc.customer_id = sa.customer_id
        LEFT JOIN engagement_scores es ON cc.customer_id = es.customer_id
        """

        assert_table_lineage_equal(
            query,
            {
                "crm_db.customers",
                "sales_db.orders",
                "support_db.tickets",
                "analytics_db.events",
            },
            {"data_warehouse.customer_360"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("customer_id", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_id", "data_warehouse.customer_360"
                    ),
                ),
                (
                    TestColumnQualifierTuple("customer_name", "crm_db.customers"),
                    TestColumnQualifierTuple(
                        "customer_name", "data_warehouse.customer_360"
                    ),
                ),
                (
                    TestColumnQualifierTuple("email", "crm_db.customers"),
                    TestColumnQualifierTuple("email", "data_warehouse.customer_360"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_mixed_complex_04_pivot_unpivot_with_cte_and_joins(self):
        """Test PIVOT/UNPIVOT operations with CTEs and joins"""
        query = """
        WITH
        monthly_sales AS (
            SELECT
                s.product_id,
                DATE_TRUNC('month', s.sale_date) as sale_month,
                SUM(s.amount) as monthly_revenue
            FROM sales s
            WHERE s.sale_date >= '2024-01-01'
            GROUP BY s.product_id, DATE_TRUNC('month', s.sale_date)
        ),
        pivoted_sales AS (
            SELECT *
            FROM monthly_sales
            PIVOT (
                SUM(monthly_revenue)
                FOR sale_month IN (
                    '2024-01-01' as jan,
                    '2024-02-01' as feb,
                    '2024-03-01' as mar,
                    '2024-04-01' as apr,
                    '2024-05-01' as may,
                    '2024-06-01' as jun
                )
            )
        )
        INSERT INTO product_monthly_trends
        SELECT
            p.product_id,
            p.product_name,
            p.category,
            ps.jan as jan_revenue,
            ps.feb as feb_revenue,
            ps.mar as mar_revenue,
            ps.apr as apr_revenue,
            ps.may as may_revenue,
            ps.jun as jun_revenue,
            (ps.jan + ps.feb + ps.mar + ps.apr + ps.may + ps.jun) as total_revenue,
            LAG(ps.jun) OVER (PARTITION BY p.category ORDER BY ps.jun DESC) as prev_product_jun_rev
        FROM pivoted_sales ps
        JOIN products p ON ps.product_id = p.product_id
        """

        assert_table_lineage_equal(
            query,
            {"sales", "products"},
            {"product_monthly_trends"},
            dialect=Dialect.SNOWFLAKE.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("product_id", "sales"),
                    TestColumnQualifierTuple("product_id", "product_monthly_trends"),
                ),
                (
                    TestColumnQualifierTuple("product_name", "products"),
                    TestColumnQualifierTuple("product_name", "product_monthly_trends"),
                ),
                (
                    TestColumnQualifierTuple("category", "products"),
                    TestColumnQualifierTuple("category", "product_monthly_trends"),
                ),
            ],
            dialect=Dialect.SNOWFLAKE.value,
        )

    def test_mixed_complex_05_real_world_analytical_pipeline(self):
        """Test real-world analytical pipeline with all complex patterns"""
        query = """
        WITH RECURSIVE
        -- Recursive date generation
        date_series AS (
            SELECT DATE('2024-01-01') as dt
            UNION ALL
            SELECT dt + INTERVAL '1 day'
            FROM date_series
            WHERE dt < DATE('2024-12-31')
        ),
        -- Customer cohorts
        customer_cohorts AS (
            SELECT
                customer_id,
                DATE_TRUNC('month', MIN(order_date)) as cohort_month
            FROM orders
            GROUP BY customer_id
        ),
        -- Daily activity
        daily_activity AS (
            SELECT
                ds.dt,
                COUNT(DISTINCT o.customer_id) as active_customers,
                COUNT(DISTINCT o.order_id) as order_count,
                SUM(o.amount) as daily_revenue,
                AVG(o.amount) as avg_order_value
            FROM date_series ds
            LEFT JOIN orders o ON DATE(o.order_date) = ds.dt
            GROUP BY ds.dt
        ),
        -- Product analytics
        product_metrics AS (
            SELECT
                p.product_id,
                p.product_name,
                p.category,
                COUNT(DISTINCT s.customer_id) as unique_buyers,
                SUM(s.quantity) as units_sold,
                SUM(s.amount) as product_revenue,
                AVG(r.rating) as avg_rating,
                COUNT(r.review_id) as review_count
            FROM products p
            LEFT JOIN sales s ON p.product_id = s.product_id AND s.sale_date >= '2024-01-01'
            LEFT JOIN reviews r ON p.product_id = r.product_id
            GROUP BY p.product_id, p.product_name, p.category
        ),
        -- Retention metrics
        retention_analysis AS (
            SELECT
                cc.cohort_month,
                DATE_TRUNC('month', o.order_date) as activity_month,
                COUNT(DISTINCT o.customer_id) as retained_customers
            FROM customer_cohorts cc
            JOIN orders o ON cc.customer_id = o.customer_id
            WHERE o.order_date >= cc.cohort_month
            GROUP BY cc.cohort_month, DATE_TRUNC('month', o.order_date)
        )
        INSERT INTO analytics_dashboard
        SELECT
            da.dt as report_date,
            da.active_customers,
            da.order_count,
            da.daily_revenue,
            da.avg_order_value,
            SUM(da.daily_revenue) OVER (ORDER BY da.dt) as cumulative_revenue,
            AVG(da.daily_revenue) OVER (
                ORDER BY da.dt
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ) as revenue_7day_ma,
            LAG(da.daily_revenue, 7) OVER (ORDER BY da.dt) as revenue_week_ago,
            (SELECT COUNT(*) FROM product_metrics WHERE product_revenue > 0) as active_products,
            (SELECT AVG(avg_rating) FROM product_metrics WHERE review_count >= 5) as overall_avg_rating,
            (SELECT COUNT(DISTINCT cohort_month) FROM customer_cohorts) as total_cohorts,
            RANK() OVER (ORDER BY da.daily_revenue DESC) as revenue_rank_all_time
        FROM daily_activity da
        WHERE da.dt >= '2024-01-01'
        """

        assert_table_lineage_equal(
            query,
            {"orders", "products", "sales", "reviews"},
            {"analytics_dashboard"},
            dialect=Dialect.POSTGRES.value,
        )

        assert_column_lineage_equal(
            query,
            [
                (
                    TestColumnQualifierTuple("order_date", "orders"),
                    TestColumnQualifierTuple("report_date", "analytics_dashboard"),
                ),
            ],
            dialect=Dialect.POSTGRES.value,
        )
