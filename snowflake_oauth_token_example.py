#!/usr/bin/env python3
"""
External OAuth Token Example for Snowflake with SQLAlchemy
Use this when you have an OAuth token from an external provider (Okta, Azure AD, etc.)
"""

import os
import requests
from typing import Optional
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus
import pandas as pd


class SnowflakeExternalOAuth:
    """Handle external OAuth token authentication with Snowflake"""
    
    def __init__(self, oauth_config: dict):
        """
        Initialize with OAuth configuration
        
        oauth_config should contain:
        - client_id: OAuth client ID
        - client_secret: OAuth client secret (keep secure!)
        - token_endpoint: OAuth provider's token endpoint
        - scope: Required scopes (optional)
        """
        self.oauth_config = oauth_config
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
    
    def get_token_from_provider(self, username: str, password: str) -> str:
        """
        Get OAuth token from external provider
        This example shows password grant flow (not recommended for production)
        """
        token_data = {
            'grant_type': 'password',
            'client_id': self.oauth_config['client_id'],
            'client_secret': self.oauth_config['client_secret'],
            'username': username,
            'password': password,
            'scope': self.oauth_config.get('scope', 'session:role-any')
        }
        
        response = requests.post(
            self.oauth_config['token_endpoint'],
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code == 200:
            token_response = response.json()
            self.access_token = token_response['access_token']
            self.refresh_token = token_response.get('refresh_token')
            return self.access_token
        else:
            raise Exception(f"Failed to get token: {response.text}")
    
    def get_token_client_credentials(self) -> str:
        """
        Get OAuth token using client credentials flow (for service accounts)
        This is more suitable for automated/production use
        """
        token_data = {
            'grant_type': 'client_credentials',
            'client_id': self.oauth_config['client_id'],
            'client_secret': self.oauth_config['client_secret'],
            'scope': self.oauth_config.get('scope', 'session:role-any')
        }
        
        response = requests.post(
            self.oauth_config['token_endpoint'],
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code == 200:
            token_response = response.json()
            self.access_token = token_response['access_token']
            return self.access_token
        else:
            raise Exception(f"Failed to get token: {response.text}")
    
    def refresh_access_token(self) -> str:
        """Refresh the access token using refresh token"""
        if not self.refresh_token:
            raise Exception("No refresh token available")
        
        token_data = {
            'grant_type': 'refresh_token',
            'client_id': self.oauth_config['client_id'],
            'client_secret': self.oauth_config['client_secret'],
            'refresh_token': self.refresh_token
        }
        
        response = requests.post(
            self.oauth_config['token_endpoint'],
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        if response.status_code == 200:
            token_response = response.json()
            self.access_token = token_response['access_token']
            self.refresh_token = token_response.get('refresh_token', self.refresh_token)
            return self.access_token
        else:
            raise Exception(f"Failed to refresh token: {response.text}")


def connect_with_external_token(token: str, account: str, warehouse: str, database: str, schema: str, role: str):
    """
    Connect to Snowflake using an external OAuth token
    """
    
    # URL encode the token for safe transmission
    encoded_token = quote_plus(token)
    
    # Build connection string with OAuth token
    connection_string = (
        f"snowflake://"
        f"?account={account}"
        f"&authenticator=oauth"  # Use oauth authenticator
        f"&token={encoded_token}"  # Provide the OAuth token
        f"&warehouse={warehouse}"
        f"&database={database}"
        f"&schema={schema}"
        f"&role={role}"
    )
    
    print("Connecting to Snowflake with external OAuth token...")
    
    # Create SQLAlchemy engine
    engine = create_engine(
        connection_string,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    
    # Test connection
    with engine.connect() as conn:
        result = conn.execute(text("SELECT CURRENT_USER() as user, CURRENT_ROLE() as role"))
        user_info = result.fetchone()
        print(f"✓ Connected as: {user_info.user}")
        print(f"✓ Current role: {user_info.role}")
    
    return engine


def example_okta_configuration():
    """Example configuration for Okta OAuth"""
    return {
        'client_id': os.getenv('OKTA_CLIENT_ID', 'your_client_id'),
        'client_secret': os.getenv('OKTA_CLIENT_SECRET', 'your_client_secret'),
        'token_endpoint': os.getenv('OKTA_TOKEN_ENDPOINT', 
                                   'https://your-domain.okta.com/oauth2/default/v1/token'),
        'scope': 'session:role-any'
    }


def example_azure_ad_configuration():
    """Example configuration for Azure AD OAuth"""
    tenant_id = os.getenv('AZURE_TENANT_ID', 'your_tenant_id')
    return {
        'client_id': os.getenv('AZURE_CLIENT_ID', 'your_client_id'),
        'client_secret': os.getenv('AZURE_CLIENT_SECRET', 'your_client_secret'),
        'token_endpoint': f'https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token',
        'scope': 'https://your-snowflake-account.snowflakecomputing.com/.default'
    }


def main():
    """Main function demonstrating external OAuth token usage"""
    
    # Snowflake configuration
    snowflake_config = {
        'account': os.getenv('SNOWFLAKE_ACCOUNT', 'your_account.snowflakecomputing.com'),
        'warehouse': os.getenv('SNOWFLAKE_WAREHOUSE', 'COMPUTE_WH'),
        'database': os.getenv('SNOWFLAKE_DATABASE', 'YOUR_DB'),
        'schema': os.getenv('SNOWFLAKE_SCHEMA', 'PUBLIC'),
        'role': os.getenv('SNOWFLAKE_ROLE', 'PUBLIC')
    }
    
    # Method 1: Use a pre-existing token (e.g., from environment variable)
    existing_token = os.getenv('SNOWFLAKE_OAUTH_TOKEN')
    if existing_token:
        print("Using existing OAuth token from environment...")
        try:
            engine = connect_with_external_token(
                token=existing_token,
                **snowflake_config
            )
            
            # Run a query
            df = pd.read_sql("SELECT CURRENT_TIMESTAMP() as time", engine)
            print("\nQuery result:")
            print(df)
            
            engine.dispose()
        except Exception as e:
            print(f"Error with existing token: {e}")
    
    # Method 2: Get token from OAuth provider (example with Okta)
    else:
        print("\nNo existing token found. Demonstrating OAuth token retrieval...")
        print("Note: This requires proper OAuth provider configuration\n")
        
        # Example OAuth configuration (choose your provider)
        oauth_config = example_okta_configuration()
        # oauth_config = example_azure_ad_configuration()
        
        oauth_client = SnowflakeExternalOAuth(oauth_config)
        
        try:
            # For service accounts (recommended)
            print("Attempting client credentials flow...")
            token = oauth_client.get_token_client_credentials()
            
            # OR for user authentication (not recommended for production)
            # username = input("Enter username: ")
            # password = getpass.getpass("Enter password: ")
            # token = oauth_client.get_token_from_provider(username, password)
            
            # Connect with the obtained token
            engine = connect_with_external_token(
                token=token,
                **snowflake_config
            )
            
            # Run queries
            df = pd.read_sql("SELECT CURRENT_TIMESTAMP() as time", engine)
            print("\nQuery result:")
            print(df)
            
            engine.dispose()
            
        except Exception as e:
            print(f"Error: {e}")
            print("\nTo use external OAuth, you need to:")
            print("1. Configure OAuth integration in Snowflake (admin task)")
            print("2. Register your application with OAuth provider")
            print("3. Set the appropriate environment variables")
            print("4. Ensure your OAuth provider is configured to issue tokens for Snowflake")


if __name__ == "__main__":
    main()