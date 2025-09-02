-- Simplified Browser-Based OAuth Setup for User HK
-- Execute as ACCOUNTADMIN (Himanshu)

USE ROLE ACCOUNTADMIN;

-- 1. Create Browser-Based OAuth Security Integration
-- This allows users to authenticate via browser without passwords
CREATE OR REPLACE SECURITY INTEGRATION BROWSER_OAUTH_HK
    TYPE = OAUTH
    ENABLED = TRUE
    OAUTH_CLIENT = CUSTOM
    OAUTH_CLIENT_TYPE = 'PUBLIC'  -- PUBLIC for browser-based flows
    OAUTH_REDIRECT_URI = 'http://localhost:8080'
    OAUTH_ISSUE_REFRESH_TOKENS = TRUE
    OAUTH_REFRESH_TOKEN_VALIDITY = 86400
    OAUTH_ALLOW_NON_TLS_REDIRECT_URI = TRUE  -- For local development
    COMMENT = 'Browser OAuth for HK local development';

-- 2. Create or update user HK
CREATE USER IF NOT EXISTS HK
    PASSWORD = 'TempPassword123!'  -- Can still use password as backup
    LOGIN_NAME = 'HK'
    DISPLAY_NAME = 'HK User'
    DEFAULT_ROLE = 'TEMP'
    DEFAULT_WAREHOUSE = 'COMPUTE_WH'
    DEFAULT_NAMESPACE = 'HK_TEST_DB.HK_TEST_SCHEMA'
    MUST_CHANGE_PASSWORD = FALSE
    COMMENT = 'User HK with OAuth access';

-- 3. Create TEMP role if it doesn't exist
CREATE ROLE IF NOT EXISTS TEMP
    COMMENT = 'Temporary role for HK testing';

-- 4. Grant the TEMP role to user HK
GRANT ROLE TEMP TO USER HK;

-- 5. Grant integration usage to TEMP role
GRANT USAGE ON INTEGRATION BROWSER_OAUTH_HK TO ROLE TEMP;

-- 6. Grant necessary permissions to TEMP role
-- Warehouse access
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE TEMP;

-- Database and schema access
CREATE DATABASE IF NOT EXISTS HK_TEST_DB;
CREATE SCHEMA IF NOT EXISTS HK_TEST_DB.HK_TEST_SCHEMA;

GRANT USAGE ON DATABASE HK_TEST_DB TO ROLE TEMP;
GRANT USAGE ON SCHEMA HK_TEST_DB.HK_TEST_SCHEMA TO ROLE TEMP;
GRANT CREATE TABLE ON SCHEMA HK_TEST_DB.HK_TEST_SCHEMA TO ROLE TEMP;
GRANT CREATE VIEW ON SCHEMA HK_TEST_DB.HK_TEST_SCHEMA TO ROLE TEMP;

-- Grant permissions on all existing and future objects
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA HK_TEST_DB.HK_TEST_SCHEMA TO ROLE TEMP;
GRANT SELECT, INSERT, UPDATE, DELETE ON FUTURE TABLES IN SCHEMA HK_TEST_DB.HK_TEST_SCHEMA TO ROLE TEMP;

-- 7. Verify the setup
DESCRIBE SECURITY INTEGRATION BROWSER_OAUTH_HK;

-- 8. Show OAuth client details (note these down)
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('BROWSER_OAUTH_HK');

-- 9. Test query to verify setup
SHOW GRANTS TO ROLE TEMP;
SHOW GRANTS TO USER HK;

-- After running these commands, user HK can connect using:
-- authenticator='externalbrowser' in their Python code
-- No password needed - browser will handle authentication