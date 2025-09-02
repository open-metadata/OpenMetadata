#!/usr/bin/env python3
"""
Snowflake OAuth Authentication for Query Runner

This script demonstrates OAuth authentication for Snowflake, which allows
users to authenticate via OAuth providers (like Azure AD, Okta) and get
access tokens for API-based access.
"""

import os
import json
import time
import logging
import secrets
import hashlib
import webbrowser
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from urllib.parse import urlencode, parse_qs, urlparse
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import requests
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
import snowflake.connector
import jwt

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class OAuthConfig:
    """OAuth configuration for Snowflake."""
    client_id: str
    client_secret: str
    authorization_url: str
    token_url: str
    redirect_uri: str = "http://localhost:8080/callback"
    scope: str = "openid profile email"
    snowflake_account: str = ""
    snowflake_warehouse: str = ""


@dataclass
class OAuthToken:
    """OAuth token response."""
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: int = 3600
    token_type: str = "Bearer"
    id_token: Optional[str] = None
    expires_at: Optional[datetime] = None
    
    def is_expired(self) -> bool:
        """Check if token is expired."""
        if not self.expires_at:
            return False
        return datetime.now() >= self.expires_at


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP handler for OAuth callback."""
    
    def do_GET(self):
        """Handle OAuth callback."""
        query = urlparse(self.path).query
        params = parse_qs(query)
        
        if 'code' in params:
            self.server.auth_code = params['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"""
                <html>
                <body>
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to the application.</p>
                <script>window.close();</script>
                </body>
                </html>
            """)
        else:
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            error = params.get('error', ['Unknown error'])[0]
            self.wfile.write(f"<h1>Authentication Failed</h1><p>Error: {error}</p>".encode())
    
    def log_message(self, format, *args):
        """Suppress default logging."""
        pass


class SnowflakeOAuthAuthenticator:
    """
    Handles OAuth authentication for Snowflake.
    
    Supports multiple OAuth providers:
    1. Snowflake OAuth (native)
    2. Azure AD
    3. Okta
    4. Custom OAuth providers
    """
    
    def __init__(self, config: OAuthConfig):
        """
        Initialize OAuth authenticator.
        
        Args:
            config: OAuth configuration
        """
        self.config = config
        self.tokens: Dict[str, OAuthToken] = {}
    
    def authenticate_oauth_flow(self, user_email: str) -> OAuthToken:
        """
        Perform OAuth authentication flow.
        
        Args:
            user_email: User's email for tracking
        
        Returns:
            OAuth token
        """
        logger.info(f"Starting OAuth flow for user: {user_email}")
        
        # Step 1: Generate state and PKCE parameters
        state = secrets.token_urlsafe(32)
        code_verifier = secrets.token_urlsafe(32)
        code_challenge = hashlib.sha256(code_verifier.encode()).hexdigest()
        
        # Step 2: Build authorization URL
        auth_params = {
            'client_id': self.config.client_id,
            'response_type': 'code',
            'redirect_uri': self.config.redirect_uri,
            'scope': self.config.scope,
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256'
        }
        
        auth_url = f"{self.config.authorization_url}?{urlencode(auth_params)}"
        
        # Step 3: Start local server for callback
        server = HTTPServer(('localhost', 8080), OAuthCallbackHandler)
        server.auth_code = None
        server_thread = threading.Thread(target=server.serve_forever)
        server_thread.daemon = True
        server_thread.start()
        
        # Step 4: Open browser for authentication
        logger.info("Opening browser for OAuth authentication...")
        webbrowser.open(auth_url)
        
        # Step 5: Wait for callback
        timeout = 120  # 2 minutes timeout
        start_time = time.time()
        
        while server.auth_code is None and (time.time() - start_time) < timeout:
            time.sleep(0.5)
        
        server.shutdown()
        
        if server.auth_code is None:
            raise TimeoutError("OAuth authentication timed out")
        
        # Step 6: Exchange code for token
        token = self._exchange_code_for_token(
            server.auth_code,
            code_verifier
        )
        
        # Store token for user
        self.tokens[user_email] = token
        
        logger.info(f"✅ OAuth authentication successful for {user_email}")
        return token
    
    def _exchange_code_for_token(self, code: str, code_verifier: str) -> OAuthToken:
        """
        Exchange authorization code for access token.
        
        Args:
            code: Authorization code
            code_verifier: PKCE code verifier
        
        Returns:
            OAuth token
        """
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.config.redirect_uri,
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret,
            'code_verifier': code_verifier
        }
        
        response = requests.post(
            self.config.token_url,
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code != 200:
            raise Exception(f"Token exchange failed: {response.text}")
        
        token_response = response.json()
        
        return OAuthToken(
            access_token=token_response['access_token'],
            refresh_token=token_response.get('refresh_token'),
            expires_in=token_response.get('expires_in', 3600),
            token_type=token_response.get('token_type', 'Bearer'),
            id_token=token_response.get('id_token'),
            expires_at=datetime.now() + timedelta(seconds=token_response.get('expires_in', 3600))
        )
    
    def refresh_token(self, user_email: str) -> OAuthToken:
        """
        Refresh an expired token.
        
        Args:
            user_email: User's email
        
        Returns:
            New OAuth token
        """
        if user_email not in self.tokens:
            raise ValueError(f"No token found for user {user_email}")
        
        old_token = self.tokens[user_email]
        
        if not old_token.refresh_token:
            raise ValueError("No refresh token available")
        
        token_data = {
            'grant_type': 'refresh_token',
            'refresh_token': old_token.refresh_token,
            'client_id': self.config.client_id,
            'client_secret': self.config.client_secret
        }
        
        response = requests.post(
            self.config.token_url,
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code != 200:
            raise Exception(f"Token refresh failed: {response.text}")
        
        token_response = response.json()
        
        new_token = OAuthToken(
            access_token=token_response['access_token'],
            refresh_token=token_response.get('refresh_token', old_token.refresh_token),
            expires_in=token_response.get('expires_in', 3600),
            token_type=token_response.get('token_type', 'Bearer'),
            id_token=token_response.get('id_token'),
            expires_at=datetime.now() + timedelta(seconds=token_response.get('expires_in', 3600))
        )
        
        self.tokens[user_email] = new_token
        return new_token
    
    def connect_with_oauth(self, user_email: str, role: Optional[str] = None) -> Engine:
        """
        Connect to Snowflake using OAuth token.
        
        Args:
            user_email: User's email
            role: Optional Snowflake role to use
        
        Returns:
            SQLAlchemy engine
        """
        # Get or refresh token
        if user_email not in self.tokens:
            token = self.authenticate_oauth_flow(user_email)
        else:
            token = self.tokens[user_email]
            if token.is_expired():
                logger.info(f"Token expired for {user_email}, refreshing...")
                token = self.refresh_token(user_email)
        
        # Create Snowflake connection with OAuth token
        logger.info(f"Connecting to Snowflake with OAuth token for {user_email}")
        
        conn_params = {
            'account': self.config.snowflake_account.replace('.snowflakecomputing.com', ''),
            'authenticator': 'oauth',
            'token': token.access_token,
            'warehouse': self.config.snowflake_warehouse
        }
        
        if role:
            conn_params['role'] = role
        
        engine = create_engine(
            'snowflake://',
            connect_args=conn_params,
            echo=False
        )
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, current_role = result.fetchone()
            logger.info(f"✅ Connected as {user} with role {current_role}")
        
        return engine


class SnowflakeNativeOAuth:
    """
    Snowflake Native OAuth implementation.
    This uses Snowflake's built-in OAuth server.
    """
    
    @staticmethod
    def setup_oauth_integration(admin_connection: Engine, integration_name: str = "OPENMETADATA_OAUTH"):
        """
        Setup OAuth integration in Snowflake (requires ACCOUNTADMIN role).
        
        Args:
            admin_connection: Admin connection to Snowflake
            integration_name: Name for the OAuth integration
        """
        setup_sql = f"""
        CREATE OR REPLACE SECURITY INTEGRATION {integration_name}
            TYPE = OAUTH
            ENABLED = TRUE
            OAUTH_CLIENT = CUSTOM
            OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
            OAUTH_REDIRECT_URI = 'http://localhost:8080/callback'
            OAUTH_ISSUE_REFRESH_TOKENS = TRUE
            OAUTH_REFRESH_TOKEN_VALIDITY = 86400
            BLOCKED_ROLES_LIST = ('ACCOUNTADMIN', 'SECURITYADMIN')
            COMMENT = 'OAuth integration for OpenMetadata Query Runner';
        """
        
        with admin_connection.connect() as conn:
            conn.execute(text(setup_sql))
            
            # Get OAuth client details
            result = conn.execute(text(f"DESC SECURITY INTEGRATION {integration_name}"))
            
            oauth_details = {}
            for row in result:
                oauth_details[row[0]] = row[1]
            
            print("\n✅ OAuth Integration Created!")
            print(f"Client ID: {oauth_details.get('OAUTH_CLIENT_ID', 'N/A')}")
            print(f"Authorization URL: {oauth_details.get('OAUTH_AUTHORIZATION_ENDPOINT', 'N/A')}")
            print(f"Token URL: {oauth_details.get('OAUTH_TOKEN_ENDPOINT', 'N/A')}")
            
            return oauth_details


class QueryRunnerWithOAuth:
    """
    Query Runner that uses OAuth for user authentication.
    Each user authenticates once and gets a token for queries.
    """
    
    def __init__(self, oauth_config: OAuthConfig):
        """
        Initialize Query Runner with OAuth.
        
        Args:
            oauth_config: OAuth configuration
        """
        self.oauth = SnowflakeOAuthAuthenticator(oauth_config)
        self.user_engines: Dict[str, Engine] = {}
    
    def execute_query_for_user(
        self,
        query: str,
        user_email: str,
        role: Optional[str] = None,
        limit: int = 1000
    ) -> Dict[str, Any]:
        """
        Execute query for a user using their OAuth token.
        
        Args:
            query: SQL query to execute
            user_email: User's email
            role: Optional Snowflake role
            limit: Row limit
        
        Returns:
            Query results
        """
        try:
            # Get or create connection for user
            if user_email not in self.user_engines:
                self.user_engines[user_email] = self.oauth.connect_with_oauth(user_email, role)
            
            engine = self.user_engines[user_email]
            
            # Add limit to query if not present
            if 'LIMIT' not in query.upper():
                query = f"{query.rstrip(';')} LIMIT {limit}"
            
            # Execute query
            with engine.connect() as conn:
                # Set query tag
                conn.execute(text(f"ALTER SESSION SET QUERY_TAG = 'QueryRunner_OAuth_{user_email}'"))
                
                # Switch role if specified
                if role:
                    conn.execute(text(f"USE ROLE {role}"))
                
                # Execute query
                result = conn.execute(text(query))
                
                # Fetch results
                columns = list(result.keys())
                rows = [dict(zip(columns, row)) for row in result.fetchall()]
                
                return {
                    'success': True,
                    'user': user_email,
                    'columns': columns,
                    'rows': rows,
                    'row_count': len(rows)
                }
                
        except Exception as e:
            logger.error(f"Query failed for {user_email}: {e}")
            return {
                'success': False,
                'user': user_email,
                'error': str(e)
            }


def test_oauth_providers():
    """Test different OAuth provider configurations."""
    print("\n" + "="*60)
    print("OAuth Provider Configuration Examples")
    print("="*60 + "\n")
    
    providers = {
        "1": {
            "name": "Snowflake Native OAuth",
            "config": OAuthConfig(
                client_id="<from DESCRIBE SECURITY INTEGRATION>",
                client_secret="<from DESCRIBE SECURITY INTEGRATION>",
                authorization_url="https://<account>.snowflakecomputing.com/oauth/authorize",
                token_url="https://<account>.snowflakecomputing.com/oauth/token-request",
                snowflake_account="<account>",
                snowflake_warehouse="<warehouse>"
            )
        },
        "2": {
            "name": "Azure AD OAuth",
            "config": OAuthConfig(
                client_id="<your-azure-app-id>",
                client_secret="<your-azure-app-secret>",
                authorization_url="https://login.microsoftonline.com/<tenant>/oauth2/v2.0/authorize",
                token_url="https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token",
                scope="api://<app-id>/session:role-any",
                snowflake_account="<account>",
                snowflake_warehouse="<warehouse>"
            )
        },
        "3": {
            "name": "Okta OAuth",
            "config": OAuthConfig(
                client_id="<your-okta-client-id>",
                client_secret="<your-okta-client-secret>",
                authorization_url="https://<your-domain>.okta.com/oauth2/default/v1/authorize",
                token_url="https://<your-domain>.okta.com/oauth2/default/v1/token",
                snowflake_account="<account>",
                snowflake_warehouse="<warehouse>"
            )
        }
    }
    
    print("Select OAuth provider:")
    for key, provider in providers.items():
        print(f"{key}. {provider['name']}")
    
    choice = input("\nEnter choice: ")
    
    if choice in providers:
        provider = providers[choice]
        print(f"\nConfiguration template for {provider['name']}:")
        print(json.dumps(provider['config'].__dict__, indent=2))
        print("\nReplace the placeholder values with your actual configuration.")
    
    return choice


def setup_native_oauth():
    """Setup Snowflake native OAuth integration."""
    print("\n" + "="*60)
    print("Setup Snowflake Native OAuth")
    print("="*60 + "\n")
    
    print("This will create an OAuth integration in Snowflake.")
    print("You need ACCOUNTADMIN role for this.\n")
    
    account = input("Enter Snowflake account: ")
    admin_user = input("Enter admin username: ")
    admin_pass = input("Enter admin password: ")
    warehouse = input("Enter warehouse: ")
    
    try:
        # Connect as admin
        engine = create_engine(
            f'snowflake://{admin_user}:{admin_pass}@{account}/{warehouse}'
        )
        
        with engine.connect() as conn:
            # Switch to ACCOUNTADMIN role
            conn.execute(text("USE ROLE ACCOUNTADMIN"))
            
            # Create OAuth integration
            oauth_details = SnowflakeNativeOAuth.setup_oauth_integration(engine)
            
            print("\n✅ OAuth integration created successfully!")
            print("\nNow you can use these details in your OAuth configuration.")
            
    except Exception as e:
        print(f"❌ Failed to setup OAuth: {e}")


def main():
    """Main entry point."""
    print("\n" + "="*80)
    print("Snowflake OAuth Authentication for Query Runner")
    print("="*80 + "\n")
    
    print("Options:")
    print("1. Setup Snowflake Native OAuth (requires admin)")
    print("2. Test OAuth authentication flow")
    print("3. View OAuth provider examples")
    print("4. Test Query Runner with OAuth")
    
    choice = input("\nEnter choice (1-4): ")
    
    if choice == "1":
        setup_native_oauth()
    
    elif choice == "2":
        print("\nEnter OAuth configuration:")
        config = OAuthConfig(
            client_id=input("Client ID: "),
            client_secret=input("Client Secret: "),
            authorization_url=input("Authorization URL: "),
            token_url=input("Token URL: "),
            snowflake_account=input("Snowflake account: "),
            snowflake_warehouse=input("Warehouse: ")
        )
        
        oauth = SnowflakeOAuthAuthenticator(config)
        user_email = input("Enter your email: ")
        
        try:
            token = oauth.authenticate_oauth_flow(user_email)
            print(f"\n✅ OAuth authentication successful!")
            print(f"Access token: {token.access_token[:20]}...")
            
            # Test connection
            engine = oauth.connect_with_oauth(user_email)
            print("✅ Successfully connected to Snowflake with OAuth!")
            
        except Exception as e:
            print(f"❌ OAuth authentication failed: {e}")
    
    elif choice == "3":
        test_oauth_providers()
    
    elif choice == "4":
        print("\nConfigure OAuth for Query Runner:")
        config = OAuthConfig(
            client_id=input("Client ID: "),
            client_secret=input("Client Secret: "),
            authorization_url=input("Authorization URL: "),
            token_url=input("Token URL: "),
            snowflake_account=input("Snowflake account: "),
            snowflake_warehouse=input("Warehouse: ")
        )
        
        runner = QueryRunnerWithOAuth(config)
        
        user_email = input("Enter user email: ")
        query = input("Enter query to execute: ") or "SELECT CURRENT_USER(), CURRENT_ROLE()"
        
        result = runner.execute_query_for_user(query, user_email)
        
        if result['success']:
            print(f"\n✅ Query executed successfully!")
            print(f"Rows returned: {result['row_count']}")
            if result['rows']:
                print(f"Sample: {result['rows'][0]}")
        else:
            print(f"❌ Query failed: {result['error']}")


if __name__ == "__main__":
    main()