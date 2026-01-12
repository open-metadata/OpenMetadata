-- StarRocks Test Data Setup Script
-- Run this in StarRocks to create test tables and generate lineage/usage data

-- Create test database
CREATE DATABASE IF NOT EXISTS quickstart;
USE quickstart;

-- ============================================
-- Source Tables (Raw Data)
-- ============================================

-- Customers table with various data types
CREATE TABLE IF NOT EXISTS customers (
    customer_id BIGINT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address VARCHAR(500),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(20),
    date_of_birth DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    credit_score DECIMAL(5,2),
    preferences JSON
) ENGINE=OLAP
DUPLICATE KEY(customer_id)
DISTRIBUTED BY HASH(customer_id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

-- Products table
CREATE TABLE IF NOT EXISTS products (
    product_id BIGINT NOT NULL,
    product_name VARCHAR(200),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    price DECIMAL(10,2),
    cost DECIMAL(10,2),
    stock_quantity INT,
    weight DOUBLE,
    dimensions VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    is_available BOOLEAN DEFAULT TRUE,
    tags ARRAY<VARCHAR(50)>,
    attributes JSON
) ENGINE=OLAP
DUPLICATE KEY(product_id)
DISTRIBUTED BY HASH(product_id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

-- Orders table (partitioned by date)
CREATE TABLE IF NOT EXISTS orders (
    order_id BIGINT NOT NULL,
    customer_id BIGINT NOT NULL,
    order_date DATE NOT NULL,
    order_status VARCHAR(50),
    shipping_address VARCHAR(500),
    billing_address VARCHAR(500),
    subtotal DECIMAL(12,2),
    tax DECIMAL(10,2),
    shipping_cost DECIMAL(10,2),
    total_amount DECIMAL(12,2),
    payment_method VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=OLAP
DUPLICATE KEY(order_id, customer_id, order_date)
PARTITION BY RANGE(order_date) (
    PARTITION p202401 VALUES LESS THAN ("2024-02-01"),
    PARTITION p202402 VALUES LESS THAN ("2024-03-01"),
    PARTITION p202403 VALUES LESS THAN ("2024-04-01"),
    PARTITION p202404 VALUES LESS THAN ("2024-05-01"),
    PARTITION p202405 VALUES LESS THAN ("2024-06-01"),
    PARTITION p202406 VALUES LESS THAN ("2024-07-01"),
    PARTITION pmax VALUES LESS THAN MAXVALUE
)
DISTRIBUTED BY HASH(order_id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    item_id BIGINT NOT NULL,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT,
    unit_price DECIMAL(10,2),
    discount DECIMAL(5,2),
    total_price DECIMAL(12,2)
) ENGINE=OLAP
DUPLICATE KEY(item_id, order_id)
DISTRIBUTED BY HASH(item_id) BUCKETS 3
PROPERTIES ("replication_num" = "1");

-- ============================================
-- Insert Sample Data
-- ============================================

INSERT INTO customers (customer_id, first_name, last_name, email, phone, city, state, country, postal_code, date_of_birth, credit_score) VALUES
(1, 'John', 'Doe', 'john.doe@email.com', '555-0101', 'New York', 'NY', 'USA', '10001', '1985-03-15', 750.50),
(2, 'Jane', 'Smith', 'jane.smith@email.com', '555-0102', 'Los Angeles', 'CA', 'USA', '90001', '1990-07-22', 680.25),
(3, 'Bob', 'Johnson', 'bob.j@email.com', '555-0103', 'Chicago', 'IL', 'USA', '60601', '1978-11-08', 720.00),
(4, 'Alice', 'Williams', 'alice.w@email.com', '555-0104', 'Houston', 'TX', 'USA', '77001', '1995-01-30', 695.75),
(5, 'Charlie', 'Brown', 'charlie.b@email.com', '555-0105', 'Phoenix', 'AZ', 'USA', '85001', '1988-09-12', 710.50);

INSERT INTO products (product_id, product_name, category, subcategory, brand, price, cost, stock_quantity, weight) VALUES
(101, 'Laptop Pro 15', 'Electronics', 'Computers', 'TechBrand', 1299.99, 899.00, 50, 2.1),
(102, 'Wireless Mouse', 'Electronics', 'Accessories', 'TechBrand', 29.99, 12.00, 200, 0.1),
(103, 'USB-C Hub', 'Electronics', 'Accessories', 'ConnectPlus', 49.99, 22.00, 150, 0.2),
(104, 'Mechanical Keyboard', 'Electronics', 'Accessories', 'KeyMaster', 149.99, 75.00, 100, 0.8),
(105, 'Monitor 27 inch', 'Electronics', 'Displays', 'ViewMax', 399.99, 250.00, 75, 5.5),
(106, 'Headphones Pro', 'Electronics', 'Audio', 'SoundWave', 199.99, 95.00, 120, 0.3),
(107, 'Webcam HD', 'Electronics', 'Accessories', 'CamView', 79.99, 35.00, 180, 0.2),
(108, 'Desk Lamp LED', 'Home', 'Lighting', 'BrightLife', 39.99, 18.00, 250, 0.5);

INSERT INTO orders (order_id, customer_id, order_date, order_status, subtotal, tax, shipping_cost, total_amount, payment_method) VALUES
(1001, 1, '2024-01-15', 'Completed', 1329.98, 106.40, 0.00, 1436.38, 'Credit Card'),
(1002, 2, '2024-01-20', 'Completed', 229.98, 18.40, 5.99, 254.37, 'PayPal'),
(1003, 3, '2024-02-10', 'Shipped', 449.98, 36.00, 0.00, 485.98, 'Credit Card'),
(1004, 1, '2024-02-25', 'Processing', 79.99, 6.40, 5.99, 92.38, 'Debit Card'),
(1005, 4, '2024-03-05', 'Completed', 1699.97, 136.00, 0.00, 1835.97, 'Credit Card'),
(1006, 5, '2024-03-15', 'Completed', 269.97, 21.60, 5.99, 297.56, 'PayPal'),
(1007, 2, '2024-04-01', 'Shipped', 399.99, 32.00, 0.00, 431.99, 'Credit Card'),
(1008, 3, '2024-04-20', 'Processing', 189.98, 15.20, 5.99, 211.17, 'Debit Card');

INSERT INTO order_items (item_id, order_id, product_id, quantity, unit_price, discount, total_price) VALUES
(1, 1001, 101, 1, 1299.99, 0.00, 1299.99),
(2, 1001, 102, 1, 29.99, 0.00, 29.99),
(3, 1002, 104, 1, 149.99, 0.00, 149.99),
(4, 1002, 107, 1, 79.99, 0.00, 79.99),
(5, 1003, 105, 1, 399.99, 0.00, 399.99),
(6, 1003, 103, 1, 49.99, 0.00, 49.99),
(7, 1004, 107, 1, 79.99, 0.00, 79.99),
(8, 1005, 101, 1, 1299.99, 0.00, 1299.99),
(9, 1005, 105, 1, 399.99, 0.00, 399.99),
(10, 1006, 106, 1, 199.99, 0.00, 199.99),
(11, 1006, 102, 1, 29.99, 0.00, 29.99),
(12, 1006, 108, 1, 39.99, 0.00, 39.99);

-- ============================================
-- Create Views (for View Lineage)
-- ============================================

CREATE VIEW IF NOT EXISTS v_customer_orders AS
SELECT
    c.customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.city,
    c.state,
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_spent,
    MAX(o.order_date) as last_order_date
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.city, c.state;

CREATE VIEW IF NOT EXISTS v_product_sales AS
SELECT
    p.product_id,
    p.product_name,
    p.category,
    p.brand,
    p.price,
    COALESCE(SUM(oi.quantity), 0) as units_sold,
    COALESCE(SUM(oi.total_price), 0) as total_revenue
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.product_id, p.product_name, p.category, p.brand, p.price;

-- ============================================
-- Create Tables via CTAS (for Lineage)
-- ============================================

-- Customer summary table (CTAS - Creates Lineage)
CREATE TABLE IF NOT EXISTS customer_summary AS
SELECT
    c.customer_id,
    c.first_name,
    c.last_name,
    c.email,
    c.city,
    c.state,
    c.credit_score,
    COUNT(DISTINCT o.order_id) as order_count,
    COALESCE(SUM(o.total_amount), 0) as lifetime_value,
    MIN(o.order_date) as first_order_date,
    MAX(o.order_date) as last_order_date
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name, c.email, c.city, c.state, c.credit_score;

-- Monthly sales summary (CTAS - Creates Lineage)
CREATE TABLE IF NOT EXISTS monthly_sales_summary AS
SELECT
    DATE_FORMAT(o.order_date, '%Y-%m') as month,
    COUNT(DISTINCT o.order_id) as total_orders,
    COUNT(DISTINCT o.customer_id) as unique_customers,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value
FROM orders o
WHERE o.order_status = 'Completed'
GROUP BY DATE_FORMAT(o.order_date, '%Y-%m');

-- Product performance table (CTAS - Creates Lineage)
CREATE TABLE IF NOT EXISTS product_performance AS
SELECT
    p.product_id,
    p.product_name,
    p.category,
    p.brand,
    p.price,
    p.cost,
    (p.price - p.cost) as margin,
    COALESCE(SUM(oi.quantity), 0) as units_sold,
    COALESCE(SUM(oi.total_price), 0) as total_revenue,
    COALESCE(SUM(oi.quantity) * p.cost, 0) as total_cost,
    COALESCE(SUM(oi.total_price) - SUM(oi.quantity) * p.cost, 0) as gross_profit
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.product_id, p.product_name, p.category, p.brand, p.price, p.cost;

-- ============================================
-- Run some SELECT queries (for Usage tracking)
-- ============================================

-- Query 1: Top customers
SELECT customer_id, first_name, last_name, lifetime_value
FROM customer_summary
ORDER BY lifetime_value DESC
LIMIT 10;

-- Query 2: Monthly revenue trend
SELECT month, total_revenue, total_orders
FROM monthly_sales_summary
ORDER BY month;

-- Query 3: Best selling products
SELECT product_name, category, units_sold, total_revenue
FROM product_performance
ORDER BY units_sold DESC
LIMIT 5;

-- Query 4: Customer orders detail
SELECT
    c.first_name,
    c.last_name,
    o.order_id,
    o.order_date,
    o.total_amount,
    o.order_status
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
ORDER BY o.order_date DESC
LIMIT 20;

-- Query 5: Product category analysis
SELECT
    p.category,
    COUNT(DISTINCT p.product_id) as product_count,
    SUM(oi.quantity) as total_units_sold,
    SUM(oi.total_price) as category_revenue
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.category
ORDER BY category_revenue DESC;

-- ============================================
-- INSERT INTO SELECT (for Lineage)
-- ============================================

-- Create a high value customers table
CREATE TABLE IF NOT EXISTS high_value_customers (
    customer_id BIGINT,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    lifetime_value DECIMAL(12,2),
    order_count BIGINT,
    segment VARCHAR(50)
) ENGINE=OLAP
DUPLICATE KEY(customer_id)
DISTRIBUTED BY HASH(customer_id) BUCKETS 1
PROPERTIES ("replication_num" = "1");

-- Insert high value customers (INSERT INTO SELECT - Creates Lineage)
INSERT INTO high_value_customers
SELECT
    customer_id,
    first_name,
    last_name,
    email,
    lifetime_value,
    order_count,
    CASE
        WHEN lifetime_value > 1000 THEN 'Platinum'
        WHEN lifetime_value > 500 THEN 'Gold'
        ELSE 'Silver'
    END as segment
FROM customer_summary
WHERE lifetime_value > 200;

-- ============================================
-- Additional queries for Usage
-- ============================================

SELECT * FROM high_value_customers WHERE segment = 'Platinum';
SELECT COUNT(*) FROM orders WHERE order_status = 'Completed';
SELECT AVG(total_amount) FROM orders;
SELECT * FROM v_customer_orders LIMIT 10;
SELECT * FROM v_product_sales ORDER BY total_revenue DESC LIMIT 5;

-- Done!
SELECT 'StarRocks test data setup complete!' as status;
