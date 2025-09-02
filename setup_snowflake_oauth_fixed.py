#!/usr/bin/env python3
"""
Fixed Snowflake OAuth Setup Script

This handles the OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST restriction.
"""

import getpass
import json
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus


def test_connection_and_get_info():
    """Test connection and get account info."""
    print("\n" + "="*60)
    print("Testing Snowflake Connection")
    print("="*60 + "\n")
    
    account = input("Enter Snowflake account (e.g., tshirvw-ve46548): ").strip()
    username = input("Enter username: ").strip()
    password = getpass.getpass("Enter password: ")
    
    account = account.replace('.snowflakecomputing.com', '')
    
    try:
        conn_str = f'snowflake://{quote_plus(username)}:{quote_plus(password)}@{account}'
        engine = create_engine(conn_str, echo=False)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_WAREHOUSE(), CURRENT_ACCOUNT()"))
            user, role, warehouse, current_account = result.fetchone()
            
            print(f"✅ Connection successful!")
            print(f"   User: {user}")
            print(f"   Role: {role}")
            print(f"   Warehouse: {warehouse}")
            print(f"   Account: {current_account}")
            
            return engine, {
                'account': account,
                'username': username,
                'warehouse': warehouse,
                'current_account': current_account
            }
            
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None, None


def create_oauth_integration_safe(engine, integration_name="OPENMETADATA_OAUTH"):
    """Create OAuth integration with proper blocked roles handling."""
    print("\n" + "="*60)
    print("Creating OAuth Integration")
    print("="*60 + "\n")
    
    try:
        with engine.connect() as conn:
            # Check current role
            result = conn.execute(text("SELECT CURRENT_ROLE()"))
            current_role = result.fetchone()[0]
            print(f"Current role: {current_role}")
            
            # Switch to ACCOUNTADMIN if not already
            if current_role != 'ACCOUNTADMIN':
                try:
                    conn.execute(text("USE ROLE ACCOUNTADMIN"))
                    print("✅ Switched to ACCOUNTADMIN role")
                except Exception as e:
                    print(f"⚠️  Cannot switch to ACCOUNTADMIN: {e}")
                    return None
            
            # First, check if OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST is enabled
            try:
                result = conn.execute(text("SHOW PARAMETERS LIKE 'OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST' IN ACCOUNT"))
                for row in result:
                    if row[1] == 'true':
                        print("ℹ️  OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST is enabled")
                        print("   Privileged roles will be automatically blocked")
            except:
                pass
            
            # Create OAuth integration WITHOUT specifying BLOCKED_ROLES_LIST
            # Let Snowflake handle the blocking automatically
            create_sql = f"""
            CREATE OR REPLACE SECURITY INTEGRATION {integration_name}
                TYPE = OAUTH
                ENABLED = TRUE
                OAUTH_CLIENT = CUSTOM
                OAUTH_CLIENT_TYPE = 'CONFIDENTIAL'
                OAUTH_REDIRECT_URI = 'http://localhost:8080/callback,http://localhost:3000/callback,http://localhost:8088/callback'
                OAUTH_ISSUE_REFRESH_TOKENS = TRUE
                OAUTH_REFRESH_TOKEN_VALIDITY = 86400
                OAUTH_ALLOW_NON_TLS_REDIRECT_URI = TRUE
                COMMENT = 'OAuth integration for OpenMetadata Query Runner'
            """
            
            # Note: We're NOT specifying BLOCKED_ROLES_LIST because Snowflake
            # will automatically block privileged roles when OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST is true
            
            conn.execute(text(create_sql))
            print(f"✅ OAuth integration '{integration_name}' created successfully!")
            
            # Get OAuth details
            result = conn.execute(text(f"DESC SECURITY INTEGRATION {integration_name}"))
            
            oauth_config = {}
            important_fields = {
                'OAUTH_CLIENT_ID': 'Client ID',
                'OAUTH_CLIENT_SECRET': 'Client Secret', 
                'OAUTH_AUTHORIZATION_ENDPOINT': 'Authorization URL',
                'OAUTH_TOKEN_ENDPOINT': 'Token URL',
                'OAUTH_ALLOWED_SCOPES': 'Allowed Scopes',
                'OAUTH_CLIENT_TYPE': 'Client Type',
                'ENABLED': 'Enabled'
            }
            
            print("\n" + "="*60)
            print("OAuth Integration Details:")
            print("="*60)
            
            for row in result:
                key = row[0]
                value = row[1]
                
                if key in important_fields:
                    oauth_config[key] = value
                    
                    # Mask the secret for display
                    display_value = value
                    if 'SECRET' in key and value:
                        display_value = value[:10] + "..." + value[-10:] if len(value) > 20 else "***"
                    
                    print(f"{important_fields[key]}: {display_value}")
            
            return oauth_config
            
    except Exception as e:
        print(f"❌ Failed to create OAuth integration: {e}")
        
        # Provide more specific guidance based on the error
        if "OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST" in str(e):
            print("\n💡 Solution: The error is due to automatic blocking of privileged roles.")
            print("   Run the script again - the fixed version should work.")
        elif "already exists" in str(e).lower():
            print(f"\n💡 Integration '{integration_name}' already exists.")
            print("   Try using option 2 to check existing integrations.")
        elif "insufficient privileges" in str(e).lower():
            print("\n💡 You need ACCOUNTADMIN role to create OAuth integrations.")
        
        return None


def check_existing_integrations(engine):
    """List and describe existing OAuth integrations."""
    print("\n" + "="*60)
    print("Checking Existing OAuth Integrations")
    print("="*60 + "\n")
    
    try:
        with engine.connect() as conn:
            # Try to switch to ACCOUNTADMIN
            try:
                conn.execute(text("USE ROLE ACCOUNTADMIN"))
            except:
                pass
            
            # List all security integrations
            result = conn.execute(text("SHOW SECURITY INTEGRATIONS"))
            oauth_integrations = []
            
            for row in result:
                name = row[0]
                int_type = row[1]
                enabled = row[3]
                
                if 'OAUTH' in str(int_type).upper():
                    oauth_integrations.append({
                        'name': name,
                        'type': int_type,
                        'enabled': enabled
                    })
            
            if not oauth_integrations:
                print("No OAuth integrations found")
                return None
            
            print("Found OAuth integrations:")
            for i, integration in enumerate(oauth_integrations, 1):
                status = "✅" if integration['enabled'] else "❌"
                print(f"{i}. {integration['name']} ({integration['type']}) {status}")
            
            # Ask which one to describe
            if len(oauth_integrations) == 1:
                choice = 0
            else:
                choice = int(input(f"\nSelect integration to view details (1-{len(oauth_integrations)}): ")) - 1
            
            selected = oauth_integrations[choice]
            print(f"\nGetting details for '{selected['name']}'...")
            
            # Get details
            result = conn.execute(text(f"DESC SECURITY INTEGRATION {selected['name']}"))
            
            oauth_config = {}
            for row in result:
                key = row[0]
                value = row[1]
                
                if 'OAUTH' in key or 'CLIENT' in key:
                    oauth_config[key] = value
            
            return oauth_config
            
    except Exception as e:
        print(f"Error: {e}")
        return None


def save_oauth_config(oauth_details, connection_info):
    """Save OAuth configuration for use in applications."""
    if not oauth_details:
        return None
    
    # Extract account URL from authorization endpoint if available
    auth_endpoint = oauth_details.get('OAUTH_AUTHORIZATION_ENDPOINT', '')
    account_url = ''
    if auth_endpoint:
        # Extract account from URL like https://account.snowflakecomputing.com/oauth/authorize
        import re
        match = re.match(r'https://([^/]+)\.snowflakecomputing\.com', auth_endpoint)
        if match:
            account_url = match.group(1)
    
    config = {
        "snowflake": {
            "account": connection_info.get('account', account_url),
            "warehouse": connection_info.get('warehouse', 'COMPUTE_WH')
        },
        "oauth": {
            "client_id": oauth_details.get('OAUTH_CLIENT_ID', ''),
            "client_secret": oauth_details.get('OAUTH_CLIENT_SECRET', ''),
            "authorization_url": oauth_details.get('OAUTH_AUTHORIZATION_ENDPOINT', ''),
            "token_url": oauth_details.get('OAUTH_TOKEN_ENDPOINT', ''),
            "redirect_uris": [
                "http://localhost:8080/callback",
                "http://localhost:3000/callback",
                "http://localhost:8088/callback"
            ],
            "scope": "session:role-any"
        }
    }
    
    # Save to file
    filename = 'snowflake_oauth_config.json'
    with open(filename, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"\n✅ Configuration saved to '{filename}'")
    print("\n" + "="*60)
    print("OAuth Configuration Summary:")
    print("="*60)
    print(f"Client ID: {config['oauth']['client_id'][:20]}...")
    print(f"Auth URL: {config['oauth']['authorization_url']}")
    print(f"Token URL: {config['oauth']['token_url']}")
    
    return config


def test_oauth_with_python():
    """Show how to test OAuth with Python."""
    print("\n" + "="*60)
    print("Testing OAuth Authentication")
    print("="*60 + "\n")
    
    print("To test OAuth authentication, you can:")
    print("\n1. Use the test script:")
    print("   python test_snowflake_oauth.py")
    print("\n2. Or use this simple test code:")
    print("-" * 40)
    
    test_code = '''
import webbrowser
import requests
from urllib.parse import urlencode

# Load config
import json
with open('snowflake_oauth_config.json', 'r') as f:
    config = json.load(f)

# Build authorization URL
params = {
    'client_id': config['oauth']['client_id'],
    'response_type': 'code',
    'redirect_uri': 'http://localhost:8080/callback',
    'scope': 'session:role-any'
}

auth_url = f"{config['oauth']['authorization_url']}?{urlencode(params)}"
print(f"Opening browser to: {auth_url}")
webbrowser.open(auth_url)
'''
    
    print(test_code)
    print("-" * 40)


def main():
    """Main setup flow."""
    print("\n" + "="*80)
    print("Snowflake OAuth Setup (Fixed Version)")
    print("="*80)
    print("\nThis script handles the OAUTH_ADD_PRIVILEGED_ROLES_TO_BLOCKED_LIST setting.")
    print("="*80 + "\n")
    
    # Test connection
    engine, connection_info = test_connection_and_get_info()
    
    if not engine:
        print("\n❌ Could not connect to Snowflake")
        return
    
    while True:
        print("\n" + "="*60)
        print("Options:")
        print("="*60)
        print("1. Create new OAuth integration")
        print("2. View existing OAuth integrations")
        print("3. Test OAuth authentication")
        print("4. Exit")
        
        choice = input("\nChoice (1-4): ").strip()
        
        if choice == "1":
            name = input("Integration name (default: OPENMETADATA_OAUTH): ").strip() or "OPENMETADATA_OAUTH"
            oauth_config = create_oauth_integration_safe(engine, name)
            if oauth_config:
                save_oauth_config(oauth_config, connection_info)
                test_oauth_with_python()
            
        elif choice == "2":
            oauth_config = check_existing_integrations(engine)
            if oauth_config:
                save_oauth_config(oauth_config, connection_info)
                
        elif choice == "3":
            test_oauth_with_python()
            
        elif choice == "4":
            break
        
        else:
            print("Invalid choice")
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()