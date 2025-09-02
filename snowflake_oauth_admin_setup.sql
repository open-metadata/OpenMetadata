-- Snowflake OAuth Security Integration Setup for Browser-Based SSO
-- Run these commands as ACCOUNTADMIN or SECURITYADMIN role

-- Step 1: Switch to ACCOUNTADMIN role
USE ROLE ACCOUNTADMIN;

-- Step 2: Create OAuth Security Integration for Browser-Based Authentication
CREATE OR REPLACE SECURITY INTEGRATION BROWSER_SSO_INTEGRATION
    TYPE = OAUTH
    ENABLED = TRUE
    OAUTH_CLIENT = CUSTOM
    OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
    OAUTH_REDIRECT_URI = 'http://localhost:8080'  -- For local development
    OAUTH_ISSUE_REFRESH_TOKENS = TRUE
    OAUTH_REFRESH_TOKEN_VALIDITY = 86400  -- 24 hours in seconds
    -- Optional: Add network policy if needed
    -- NETWORK_POLICY = 'YOUR_NETWORK_POLICY'
    COMMENT = 'OAuth integration for browser-based SSO authentication';

-- Step 3: Grant usage on the integration to specific roles
-- Grant to the role that user HK will use
GRANT USAGE ON INTEGRATION BROWSER_SSO_INTEGRATION TO ROLE PUBLIC;  -- Replace PUBLIC with HK's role
GRANT USAGE ON INTEGRATION BROWSER_SSO_INTEGRATION TO ROLE SYSADMIN;
GRANT USAGE ON INTEGRATION BROWSER_SSO_INTEGRATION TO ROLE DEVELOPER;  -- If you have a DEVELOPER role

-- Step 4: If using Okta/Azure AD/Other IdP for SSO, create SAML2 integration instead
CREATE OR REPLACE SECURITY INTEGRATION SSO_OKTA_INTEGRATION
    TYPE = SAML2
    ENABLED = TRUE
    SAML2_ISSUER = 'http://www.okta.com/your_okta_id'  -- Replace with your Okta issuer
    SAML2_SSO_URL = 'https://your-domain.okta.com/app/snowflake/your_app_id/sso/saml'  -- Your Okta SSO URL
    SAML2_PROVIDER = 'OKTA'  -- Or 'ADFS', 'Custom', etc.
    SAML2_X509_CERT = '-----BEGIN CERTIFICATE-----
    MIIDxjCCAq6gAwIBAgIGAV2...your_certificate_here...
    -----END CERTIFICATE-----'  -- Your IdP certificate
    SAML2_SP_INITIATED_LOGIN_PAGE_LABEL = 'Okta SSO'
    SAML2_ENABLE_SP_INITIATED = TRUE
    SAML2_SNOWFLAKE_X509_CERT = ''  -- Optional: Snowflake certificate for IdP
    SAML2_SIGN_REQUEST = FALSE  -- Set to TRUE if your IdP requires signed requests
    SAML2_REQUESTED_NAMEID_FORMAT = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
    SAML2_POST_LOGOUT_REDIRECT_URL = 'https://your-domain.okta.com'  -- Optional
    COMMENT = 'SAML SSO integration for Okta';

-- Step 5: Create or update user HK to use SSO
-- Option A: Create new user with SSO
CREATE USER IF NOT EXISTS HK
    LOGIN_NAME = 'hk@yourdomain.com'  -- Must match the email/login from your IdP
    DISPLAY_NAME = 'HK'
    EMAIL = 'hk@yourdomain.com'
    DEFAULT_ROLE = 'PUBLIC'  -- Set appropriate default role
    DEFAULT_WAREHOUSE = 'COMPUTE_WH'
    MUST_CHANGE_PASSWORD = FALSE  -- No password needed for SSO
    COMMENT = 'User HK with SSO authentication';

-- Option B: Alter existing user to use SSO
ALTER USER HK SET
    LOGIN_NAME = 'hk@yourdomain.com'  -- Must match IdP login
    EMAIL = 'hk@yourdomain.com';

-- Step 6: Grant necessary roles to user HK
GRANT ROLE PUBLIC TO USER HK;
GRANT ROLE DEVELOPER TO USER HK;  -- If you have this role
-- Grant specific database/schema privileges
GRANT USAGE ON WAREHOUSE COMPUTE_WH TO ROLE PUBLIC;
GRANT USAGE ON DATABASE YOUR_DATABASE TO ROLE PUBLIC;
GRANT USAGE ON SCHEMA YOUR_DATABASE.PUBLIC TO ROLE PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA YOUR_DATABASE.PUBLIC TO ROLE PUBLIC;
GRANT SELECT ON FUTURE TABLES IN SCHEMA YOUR_DATABASE.PUBLIC TO ROLE PUBLIC;

-- Step 7: Verify the security integration
DESCRIBE SECURITY INTEGRATION BROWSER_SSO_INTEGRATION;
-- Or for SAML
DESCRIBE SECURITY INTEGRATION SSO_OKTA_INTEGRATION;

-- Step 8: Get the OAuth client credentials (for OAuth integration)
-- Save these values - you'll need them for external OAuth flows
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('BROWSER_SSO_INTEGRATION');

-- Step 9: Test the integration
-- Have user HK try to login using browser-based authentication

-- Step 10: Monitor login attempts (optional)
-- Check login history for user HK
SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE USER_NAME = 'HK'
ORDER BY EVENT_TIMESTAMP DESC
LIMIT 10;

-- Troubleshooting: Check for any authentication errors
SELECT * FROM SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY
WHERE USER_NAME = 'HK'
  AND IS_SUCCESS = 'NO'
ORDER BY EVENT_TIMESTAMP DESC
LIMIT 10;