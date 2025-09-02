#!/usr/bin/env python3
"""
Get OAuth Integration Details from Snowflake

This script properly retrieves OAuth client credentials and endpoints.
"""

import getpass
import json
import sys
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus


def connect_to_snowflake():
    """Connect to Snowflake."""
    print("\n" + "="*60)
    print("Connect to Snowflake")
    print("="*60 + "\n")
    
    account = input("Enter Snowflake account (e.g., tshirvw-ve46548): ").strip()
    username = input("Enter username: ").strip()
    password = getpass.getpass("Enter password: ")
    
    account = account.replace('.snowflakecomputing.com', '')
    
    try:
        conn_str = f'snowflake://{quote_plus(username)}:{quote_plus(password)}@{account}'
        engine = create_engine(conn_str, echo=False)
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, role = result.fetchone()
            print(f"✅ Connected as {user} with role {role}")
            
        return engine, account
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return None, None


def get_oauth_integration_details(engine, integration_name):
    """Get OAuth integration details."""
    print(f"\n" + "="*60)
    print(f"Getting details for OAuth integration: {integration_name}")
    print("="*60 + "\n")
    
    try:
        with engine.connect() as conn:
            # Switch to ACCOUNTADMIN role
            try:
                conn.execute(text("USE ROLE ACCOUNTADMIN"))
                print("✅ Using ACCOUNTADMIN role")
            except Exception as e:
                print(f"⚠️  Cannot switch to ACCOUNTADMIN: {e}")
            
            # Get the integration details
            result = conn.execute(text(f"DESC SECURITY INTEGRATION {integration_name}"))
            
            details = {}
            for row in result:
                property_name = row[0]
                property_value = row[1]
                property_default = row[2] if len(row) > 2 else None
                
                details[property_name] = {
                    'value': property_value,
                    'default': property_default
                }
            
            # Extract important fields
            oauth_config = {
                'integration_name': integration_name,
                'client_id': details.get('OAUTH_CLIENT_ID', {}).get('value', ''),
                'client_secret': details.get('OAUTH_CLIENT_SECRET', {}).get('value', ''),
                'authorization_endpoint': details.get('OAUTH_AUTHORIZATION_ENDPOINT', {}).get('value', ''),
                'token_endpoint': details.get('OAUTH_TOKEN_ENDPOINT', {}).get('value', ''),
                'allowed_scopes': details.get('OAUTH_ALLOWED_SCOPES', {}).get('value', ''),
                'refresh_token_validity': details.get('OAUTH_REFRESH_TOKEN_VALIDITY', {}).get('value', ''),
                'enabled': details.get('ENABLED', {}).get('value', ''),
                'comment': details.get('COMMENT', {}).get('value', '')
            }
            
            # Check if we got actual values or just "String"
            if oauth_config['client_id'] == 'String':
                print("⚠️  Snowflake returned masked values.")
                print("\nTo get the actual values, you need to:")
                print("1. Run SHOW INTEGRATIONS to see if it exists")
                print("2. The client_id and secret might be shown when first created")
                print("3. Or regenerate the OAuth secret\n")
                
                # Try to get more info
                print("Attempting alternative method...")
                
                # Check system$show_oauth_client_secrets
                try:
                    result = conn.execute(text(f"SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('{integration_name}')"))
                    secrets = result.fetchone()[0]
                    print(f"\n📋 OAuth Secrets Response:\n{secrets}")
                    
                    # Parse the JSON response
                    import json
                    secrets_data = json.loads(secrets)
                    if 'OAUTH_CLIENT_SECRET' in secrets_data:
                        oauth_config['client_secret'] = secrets_data['OAUTH_CLIENT_SECRET']
                        print(f"\n✅ Retrieved client secret!")
                except Exception as e:
                    print(f"Could not retrieve secrets: {e}")
            
            return oauth_config, details
            
    except Exception as e:
        print(f"❌ Error getting integration details: {e}")
        return None, None


def list_oauth_integrations(engine):
    """List all OAuth integrations."""
    print("\n" + "="*60)
    print("Available OAuth Integrations")
    print("="*60 + "\n")
    
    try:
        with engine.connect() as conn:
            # Switch to ACCOUNTADMIN
            try:
                conn.execute(text("USE ROLE ACCOUNTADMIN"))
            except:
                pass
            
            result = conn.execute(text("SHOW INTEGRATIONS"))
            
            oauth_integrations = []
            print("Found integrations:")
            print("-" * 40)
            
            for row in result:
                name = row[0]
                int_type = row[1]
                category = row[2] if len(row) > 2 else ''
                enabled = row[3] if len(row) > 3 else ''
                
                if 'OAUTH' in str(int_type).upper():
                    oauth_integrations.append(name)
                    status = "✅ Enabled" if enabled else "❌ Disabled"
                    print(f"  {name} ({int_type}) - {status}")
            
            if not oauth_integrations:
                print("  No OAuth integrations found")
                return None
            
            print("-" * 40)
            return oauth_integrations
            
    except Exception as e:
        print(f"Error listing integrations: {e}")
        return None


def generate_config_file(oauth_config, account):
    """Generate proper configuration file."""
    if not oauth_config:
        return
    
    # Build proper URLs if they're missing or showing as "String"
    if oauth_config['authorization_endpoint'] == 'String' or not oauth_config['authorization_endpoint']:
        # Construct URLs based on account
        base_url = f"https://{account}.snowflakecomputing.com"
        oauth_config['authorization_endpoint'] = f"{base_url}/oauth/authorize"
        oauth_config['token_endpoint'] = f"{base_url}/oauth/token-request"
        print(f"\n⚠️  Using constructed URLs based on account: {account}")
    
    config = {
        "snowflake": {
            "account": account,
            "warehouse": "COMPUTE_WH"  # You can modify this
        },
        "oauth": {
            "integration_name": oauth_config['integration_name'],
            "client_id": oauth_config['client_id'],
            "client_secret": oauth_config['client_secret'],
            "authorization_url": oauth_config['authorization_endpoint'],
            "token_url": oauth_config['token_endpoint'],
            "redirect_uris": [
                "http://localhost:8080/callback",
                "http://localhost:3000/callback",
                "http://localhost:8088/callback"
            ],
            "scope": oauth_config.get('allowed_scopes', 'session:role-any')
        },
        "status": {
            "enabled": oauth_config.get('enabled', 'false'),
            "comment": oauth_config.get('comment', '')
        }
    }
    
    # Save to file
    filename = 'snowflake_oauth_config_complete.json'
    with open(filename, 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"\n✅ Configuration saved to '{filename}'")
    
    # Display the configuration
    print("\n" + "="*60)
    print("OAuth Configuration:")
    print("="*60)
    print(f"Integration Name: {config['oauth']['integration_name']}")
    print(f"Client ID: {config['oauth']['client_id']}")
    
    # Mask the secret for display
    secret = config['oauth']['client_secret']
    if secret and secret != 'String' and secret != '':
        masked_secret = secret[:10] + "..." + secret[-10:] if len(secret) > 20 else "***"
    else:
        masked_secret = "Not retrieved (needs to be regenerated)"
    print(f"Client Secret: {masked_secret}")
    
    print(f"Auth URL: {config['oauth']['authorization_url']}")
    print(f"Token URL: {config['oauth']['token_url']}")
    print(f"Status: {config['status']['enabled']}")
    
    if config['oauth']['client_id'] == 'String' or not config['oauth']['client_secret']:
        print("\n" + "="*60)
        print("⚠️  IMPORTANT: Client credentials not fully retrieved")
        print("="*60)
        print("\nThe client_id and client_secret couldn't be retrieved.")
        print("This happens when viewing an existing integration.")
        print("\nTo get working credentials, you need to:")
        print("1. Drop and recreate the integration (to get new credentials)")
        print("2. Or check if credentials were saved when first created")
        print("\nTo recreate the integration:")
        print(f"  DROP INTEGRATION {config['oauth']['integration_name']};")
        print(f"  Then run setup_snowflake_oauth_fixed.py again")
    
    return config


def main():
    """Main function."""
    print("\n" + "="*80)
    print("Snowflake OAuth Configuration Retriever")
    print("="*80)
    
    # Connect to Snowflake
    engine, account = connect_to_snowflake()
    if not engine:
        return
    
    # List available integrations
    integrations = list_oauth_integrations(engine)
    
    if not integrations:
        print("\nNo OAuth integrations found.")
        print("Run setup_snowflake_oauth_fixed.py to create one.")
        return
    
    # Select integration
    if len(integrations) == 1:
        selected = integrations[0]
        print(f"\nUsing integration: {selected}")
    else:
        print("\nSelect integration:")
        for i, name in enumerate(integrations, 1):
            print(f"  {i}. {name}")
        choice = int(input("Choice: ")) - 1
        selected = integrations[choice]
    
    # Get details
    oauth_config, full_details = get_oauth_integration_details(engine, selected)
    
    if oauth_config:
        # Generate config file
        config = generate_config_file(oauth_config, account)
        
        # Show all properties if requested
        show_all = input("\nShow all integration properties? (y/n): ").lower() == 'y'
        if show_all:
            print("\n" + "="*60)
            print("All Integration Properties:")
            print("="*60)
            for prop, values in full_details.items():
                print(f"{prop}: {values['value']}")
    
    print("\n✅ Done!")


if __name__ == "__main__":
    main()