#!/usr/bin/env python3
"""
Snowflake OAuth Authentication with SQLAlchemy
Demonstrates different OAuth authentication methods for local Python development
"""

import os
import json
import webbrowser
from typing import Optional, Dict, Any
from urllib.parse import quote_plus

import snowflake.connector
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
import pandas as pd


class SnowflakeOAuthConnector:
    """Handle Snowflake OAuth connections with SQLAlchemy"""
    
    def __init__(self, account: str, warehouse: str, database: str, schema: str, role: str):
        self.account = account
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self.role = role
        self.engine: Optional[Engine] = None
    
    def connect_browser_oauth(self) -> Engine:
        """
        Connect using browser-based OAuth (Snowflake OAuth)
        This will open your browser for authentication
        """
        print("Initiating browser-based OAuth authentication...")
        
        # Create connection string for browser-based OAuth
        connection_params = {
            'account': self.account,
            'authenticator': 'externalbrowser',  # This triggers browser OAuth
            'warehouse': self.warehouse,
            'database': self.database,
            'schema': self.schema,
            'role': self.role,
            'client_session_keep_alive': True
        }
        
        # Build SQLAlchemy connection URL
        conn_string = self._build_sqlalchemy_url(connection_params)
        
        # Create engine
        self.engine = create_engine(conn_string, echo=False)
        
        print("Browser will open for authentication...")
        print("Please login with your SSO credentials")
        
        # Test connection
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, role = result.fetchone()
            print(f"Successfully connected as: {user} with role: {role}")
        
        return self.engine
    
    def connect_external_oauth(self, token: str) -> Engine:
        """
        Connect using external OAuth with a pre-obtained token
        Token can be obtained from your OAuth provider (Okta, Azure AD, etc.)
        """
        print("Connecting with external OAuth token...")
        
        # Create connection string for token-based OAuth
        connection_params = {
            'account': self.account,
            'authenticator': 'oauth',
            'token': token,
            'warehouse': self.warehouse,
            'database': self.database,
            'schema': self.schema,
            'role': self.role
        }
        
        # Build SQLAlchemy connection URL
        conn_string = self._build_sqlalchemy_url(connection_params)
        
        # Create engine
        self.engine = create_engine(conn_string, echo=False)
        
        # Test connection
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, role = result.fetchone()
            print(f"Successfully connected as: {user} with role: {role}")
        
        return self.engine
    
    def connect_keypair_with_oauth(self, private_key_path: str, private_key_passphrase: Optional[str] = None) -> Engine:
        """
        Connect using key-pair authentication (alternative to OAuth)
        Useful when OAuth is not available but you have key-pair access
        """
        print("Connecting with key-pair authentication...")
        
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization
        
        # Load private key
        with open(private_key_path, "rb") as key_file:
            private_key = serialization.load_pem_private_key(
                key_file.read(),
                password=private_key_passphrase.encode() if private_key_passphrase else None,
                backend=default_backend()
            )
        
        # Get private key bytes
        pkb = private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        connection_params = {
            'account': self.account,
            'user': os.getenv('SNOWFLAKE_USER'),  # Must be set
            'private_key': pkb,
            'warehouse': self.warehouse,
            'database': self.database,
            'schema': self.schema,
            'role': self.role
        }
        
        # Build SQLAlchemy connection URL
        conn_string = self._build_sqlalchemy_url_keypair(connection_params)
        
        # Create engine
        self.engine = create_engine(conn_string, echo=False)
        
        # Test connection
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, role = result.fetchone()
            print(f"Successfully connected as: {user} with role: {role}")
        
        return self.engine
    
    def _build_sqlalchemy_url(self, params: Dict[str, Any]) -> str:
        """Build SQLAlchemy connection URL for OAuth"""
        # For OAuth connections, we need to use snowflake-connector-python directly
        # then wrap it with SQLAlchemy
        
        # URL encode the token if present
        if 'token' in params:
            params['token'] = quote_plus(params['token'])
        
        # Build connection string
        conn_str = "snowflake://"
        
        # Add parameters
        param_str = "&".join([f"{k}={v}" for k, v in params.items()])
        conn_str = f"snowflake:///?{param_str}"
        
        return conn_str
    
    def _build_sqlalchemy_url_keypair(self, params: Dict[str, Any]) -> str:
        """Build SQLAlchemy connection URL for key-pair auth"""
        # For key-pair, we use a different approach
        return snowflake.connector.connect(**params).get_sqlalchemy_engine().url
    
    def execute_query(self, query: str) -> pd.DataFrame:
        """Execute a query and return results as DataFrame"""
        if not self.engine:
            raise RuntimeError("Not connected. Call a connect method first.")
        
        return pd.read_sql(query, self.engine)
    
    def close(self):
        """Close the connection"""
        if self.engine:
            self.engine.dispose()
            print("Connection closed")


def get_oauth_token_from_provider() -> str:
    """
    Example function to get OAuth token from your provider
    In practice, this would involve:
    1. Making a request to your OAuth provider (Okta, Azure AD, etc.)
    2. Going through the OAuth flow
    3. Returning the access token
    """
    # This is a placeholder - replace with actual OAuth flow
    # For example, using requests-oauthlib or similar library
    
    # Example for getting token from environment (for testing)
    token = os.getenv('SNOWFLAKE_OAUTH_TOKEN')
    if not token:
        raise ValueError("SNOWFLAKE_OAUTH_TOKEN environment variable not set")
    
    return token


def main():
    """Example usage of different authentication methods"""
    
    # Load configuration
    config = {
        'account': os.getenv('SNOWFLAKE_ACCOUNT', 'your_account.snowflakecomputing.com'),
        'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
        'database': os.getenv('SNOWFLAKE_DATABASE', 'YOUR_DB'),
        'schema': os.getenv('SNOWFLAKE_SCHEMA', 'PUBLIC'),
        'role': os.getenv('SNOWFLAKE_ROLE', 'PUBLIC')
    }
    
    # Create connector
    connector = SnowflakeOAuthConnector(**config)
    
    print("Choose authentication method:")
    print("1. Browser-based OAuth (SSO)")
    print("2. External OAuth with token")
    print("3. Key-pair authentication")
    
    choice = input("Enter choice (1-3): ").strip()
    
    try:
        if choice == '1':
            # Browser-based OAuth
            engine = connector.connect_browser_oauth()
            
        elif choice == '2':
            # External OAuth with token
            token = get_oauth_token_from_provider()
            engine = connector.connect_external_oauth(token)
            
        elif choice == '3':
            # Key-pair authentication
            private_key_path = os.getenv('SNOWFLAKE_PRIVATE_KEY_PATH', 'rsa_key.p8')
            passphrase = os.getenv('SNOWFLAKE_PRIVATE_KEY_PASSPHRASE')
            engine = connector.connect_keypair_with_oauth(private_key_path, passphrase)
            
        else:
            print("Invalid choice")
            return
        
        # Example query
        print("\nExecuting sample query...")
        df = connector.execute_query("SELECT CURRENT_TIMESTAMP() as current_time, CURRENT_VERSION() as version")
        print(df)
        
        # More complex example
        print("\nListing databases...")
        df = connector.execute_query("SHOW DATABASES")
        print(df[['name', 'owner', 'created_on']].head())
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        connector.close()


if __name__ == "__main__":
    main()