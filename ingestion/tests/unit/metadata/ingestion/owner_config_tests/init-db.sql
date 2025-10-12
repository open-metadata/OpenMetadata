-- ============================================
-- OpenMetadata Owner Config Test Database
-- ============================================
-- Structure: 2 databases, each with 2 schemas, each schema with 2 tables
-- ============================================

-- Create Database 1: finance_db
CREATE DATABASE finance_db;

-- Create Database 2: marketing_db  
CREATE DATABASE marketing_db;

-- ============================================
-- Setup finance_db
-- ============================================
\c finance_db

-- Create Schema 1: accounting
CREATE SCHEMA accounting;

-- Create Schema 2: treasury
CREATE SCHEMA treasury;

-- Tables in accounting schema
CREATE TABLE accounting.revenue (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    source VARCHAR(100),
    category VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounting.expenses (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    department VARCHAR(100),
    category VARCHAR(50),
    vendor VARCHAR(200),
    description TEXT,
    approved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tables in accounting schema (additional)
CREATE TABLE accounting.budgets (
    id SERIAL PRIMARY KEY,
    fiscal_year INTEGER NOT NULL,
    department VARCHAR(100),
    category VARCHAR(50),
    allocated_amount DECIMAL(15, 2),
    spent_amount DECIMAL(15, 2),
    remaining_amount DECIMAL(15, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tables in treasury schema
CREATE TABLE treasury.cash_flow (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    inflow DECIMAL(15, 2),
    outflow DECIMAL(15, 2),
    balance DECIMAL(15, 2),
    account_type VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treasury.investments (
    id SERIAL PRIMARY KEY,
    investment_name VARCHAR(200) NOT NULL,
    investment_type VARCHAR(50),
    amount DECIMAL(15, 2) NOT NULL,
    purchase_date DATE,
    maturity_date DATE,
    interest_rate DECIMAL(5, 2),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treasury.forecasts (
    id SERIAL PRIMARY KEY,
    forecast_date DATE NOT NULL,
    forecast_type VARCHAR(50),
    projected_revenue DECIMAL(15, 2),
    projected_expenses DECIMAL(15, 2),
    net_projection DECIMAL(15, 2),
    confidence_level DECIMAL(5, 2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data into finance_db
INSERT INTO accounting.revenue (date, amount, source, category, description) VALUES
    ('2024-01-15', 150000.00, 'Product Sales', 'Sales', 'Q1 product revenue'),
    ('2024-02-20', 200000.00, 'Service Revenue', 'Services', 'Consulting services Q1'),
    ('2024-03-10', 175000.00, 'Product Sales', 'Sales', 'Q1 enterprise deals'),
    ('2024-04-05', 225000.00, 'Subscription', 'Recurring', 'Annual subscriptions'),
    ('2024-05-12', 190000.00, 'Product Sales', 'Sales', 'Q2 product revenue');

INSERT INTO accounting.expenses (date, amount, department, category, vendor, description, approved_by) VALUES
    ('2024-01-10', 50000.00, 'Engineering', 'Salaries', 'Payroll', 'January salaries', 'CFO'),
    ('2024-01-15', 15000.00, 'Marketing', 'Advertising', 'Google Ads', 'Q1 marketing campaign', 'CMO'),
    ('2024-02-05', 52000.00, 'Engineering', 'Salaries', 'Payroll', 'February salaries', 'CFO'),
    ('2024-02-20', 8000.00, 'Operations', 'Software', 'AWS', 'Cloud infrastructure', 'CTO'),
    ('2024-03-10', 25000.00, 'Sales', 'Travel', 'Travel Agency', 'Client meetings', 'VP Sales');

INSERT INTO treasury.cash_flow (date, inflow, outflow, balance, account_type, notes) VALUES
    ('2024-01-01', 500000.00, 0.00, 500000.00, 'Operating', 'Opening balance'),
    ('2024-01-31', 150000.00, 65000.00, 585000.00, 'Operating', 'January net cash flow'),
    ('2024-02-28', 200000.00, 60000.00, 725000.00, 'Operating', 'February net cash flow'),
    ('2024-03-31', 175000.00, 33000.00, 867000.00, 'Operating', 'March net cash flow'),
    ('2024-04-30', 225000.00, 70000.00, 1022000.00, 'Operating', 'April net cash flow');

INSERT INTO treasury.investments (investment_name, investment_type, amount, purchase_date, maturity_date, interest_rate, status) VALUES
    ('US Treasury Bond 2Y', 'Government Bond', 100000.00, '2024-01-15', '2026-01-15', 4.50, 'Active'),
    ('Corporate Bond XYZ', 'Corporate Bond', 50000.00, '2024-02-01', '2027-02-01', 5.25, 'Active'),
    ('Money Market Fund A', 'Money Market', 200000.00, '2024-01-05', NULL, 3.75, 'Active'),
    ('Certificate of Deposit', 'CD', 75000.00, '2024-03-10', '2025-03-10', 4.00, 'Active');

-- ============================================
-- Setup marketing_db
-- ============================================
\c marketing_db

-- Create Schema 1: campaigns
CREATE SCHEMA campaigns;

-- Create Schema 2: analytics
CREATE SCHEMA analytics;

-- Tables in campaigns schema
CREATE TABLE campaigns.email_campaigns (
    id SERIAL PRIMARY KEY,
    campaign_name VARCHAR(200) NOT NULL,
    launch_date DATE,
    target_audience VARCHAR(100),
    total_sent INTEGER,
    opened INTEGER,
    clicked INTEGER,
    converted INTEGER,
    status VARCHAR(20),
    budget DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns.social_media (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    post_date TIMESTAMP,
    content_type VARCHAR(50),
    impressions INTEGER,
    engagements INTEGER,
    clicks INTEGER,
    shares INTEGER,
    budget DECIMAL(10, 2),
    campaign_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns.social_ads (
    id SERIAL PRIMARY KEY,
    ad_name VARCHAR(200) NOT NULL,
    platform VARCHAR(50),
    ad_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    total_budget DECIMAL(10, 2),
    spent_budget DECIMAL(10, 2),
    impressions INTEGER,
    clicks INTEGER,
    conversions INTEGER,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tables in analytics schema
CREATE TABLE analytics.customer_segments (
    id SERIAL PRIMARY KEY,
    segment_name VARCHAR(100) NOT NULL,
    segment_description TEXT,
    total_customers INTEGER,
    avg_lifetime_value DECIMAL(10, 2),
    churn_rate DECIMAL(5, 2),
    acquisition_cost DECIMAL(10, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analytics.conversion_funnel (
    id SERIAL PRIMARY KEY,
    funnel_stage VARCHAR(50) NOT NULL,
    visitors INTEGER,
    conversion_rate DECIMAL(5, 2),
    dropoff_rate DECIMAL(5, 2),
    avg_time_in_stage INTEGER,
    date DATE,
    channel VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analytics.web_traffic (
    id SERIAL PRIMARY KEY,
    page_url VARCHAR(500),
    visit_date DATE,
    unique_visitors INTEGER,
    page_views INTEGER,
    avg_session_duration INTEGER,
    bounce_rate DECIMAL(5, 2),
    traffic_source VARCHAR(100),
    device_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data into marketing_db
INSERT INTO campaigns.email_campaigns (campaign_name, launch_date, target_audience, total_sent, opened, clicked, converted, status, budget) VALUES
    ('Spring Product Launch', '2024-03-01', 'All Customers', 50000, 22500, 8500, 1250, 'Completed', 15000.00),
    ('Q1 Newsletter', '2024-01-15', 'Subscribers', 35000, 18200, 4500, 890, 'Completed', 5000.00),
    ('Summer Sale Announcement', '2024-06-01', 'Active Customers', 42000, 21000, 9800, 1680, 'Active', 12000.00),
    ('Customer Retention Program', '2024-04-10', 'Inactive Customers', 15000, 6750, 2100, 450, 'Completed', 8000.00);

INSERT INTO campaigns.social_media (platform, post_date, content_type, impressions, engagements, clicks, shares, budget, campaign_id) VALUES
    ('LinkedIn', '2024-03-01 10:00:00', 'Product Announcement', 125000, 8500, 2100, 450, 3000.00, 'CAMP-001'),
    ('Twitter', '2024-03-01 14:00:00', 'Product Announcement', 89000, 5200, 1580, 320, 2000.00, 'CAMP-001'),
    ('Facebook', '2024-03-15 09:00:00', 'Customer Story', 156000, 12400, 3800, 890, 4500.00, 'CAMP-002'),
    ('Instagram', '2024-04-01 11:00:00', 'Visual Content', 203000, 18500, 4200, 1120, 5000.00, 'CAMP-003'),
    ('LinkedIn', '2024-04-20 15:00:00', 'Thought Leadership', 98000, 7200, 1900, 380, 2500.00, 'CAMP-004');

INSERT INTO analytics.customer_segments (segment_name, segment_description, total_customers, avg_lifetime_value, churn_rate, acquisition_cost) VALUES
    ('Enterprise', 'Large enterprise customers with 1000+ employees', 125, 250000.00, 5.50, 15000.00),
    ('SMB', 'Small and medium businesses with 50-999 employees', 850, 45000.00, 12.30, 3500.00),
    ('Startup', 'Early-stage startups with less than 50 employees', 1200, 12000.00, 22.50, 1200.00),
    ('Individual', 'Individual professionals and freelancers', 3500, 2500.00, 35.80, 250.00);

INSERT INTO analytics.conversion_funnel (funnel_stage, visitors, conversion_rate, dropoff_rate, avg_time_in_stage, date, channel) VALUES
    ('Landing Page', 100000, 45.50, 54.50, 120, '2024-03-01', 'Organic Search'),
    ('Product Page', 45500, 32.80, 67.20, 180, '2024-03-01', 'Organic Search'),
    ('Pricing Page', 14924, 25.60, 74.40, 240, '2024-03-01', 'Organic Search'),
    ('Checkout', 3820, 68.50, 31.50, 300, '2024-03-01', 'Organic Search'),
    ('Landing Page', 75000, 48.20, 51.80, 110, '2024-03-01', 'Paid Ads'),
    ('Product Page', 36150, 35.40, 64.60, 175, '2024-03-01', 'Paid Ads');

-- Create some views for testing
\c finance_db
CREATE VIEW accounting.monthly_summary AS
SELECT 
    DATE_TRUNC('month', date) as month,
    SUM(amount) as total_revenue,
    COUNT(*) as transaction_count
FROM accounting.revenue
GROUP BY DATE_TRUNC('month', date);

\c marketing_db
CREATE VIEW analytics.campaign_performance AS
SELECT 
    ec.campaign_name,
    ec.total_sent,
    ec.opened,
    ec.clicked,
    ec.converted,
    ROUND(100.0 * ec.opened / NULLIF(ec.total_sent, 0), 2) as open_rate,
    ROUND(100.0 * ec.clicked / NULLIF(ec.opened, 0), 2) as click_through_rate,
    ROUND(100.0 * ec.converted / NULLIF(ec.clicked, 0), 2) as conversion_rate
FROM campaigns.email_campaigns ec;

-- Grant permissions
\c finance_db
GRANT USAGE ON SCHEMA accounting TO admin;
GRANT USAGE ON SCHEMA treasury TO admin;
GRANT SELECT ON ALL TABLES IN SCHEMA accounting TO admin;
GRANT SELECT ON ALL TABLES IN SCHEMA treasury TO admin;

\c marketing_db
GRANT USAGE ON SCHEMA campaigns TO admin;
GRANT USAGE ON SCHEMA analytics TO admin;
GRANT SELECT ON ALL TABLES IN SCHEMA campaigns TO admin;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO admin;
