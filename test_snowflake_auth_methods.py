#!/usr/bin/env python3
"""
Snowflake Authentication Methods Tester

This script tests different authentication methods to find what works
for your Snowflake account setup.
"""

import os
import getpass
from sqlalchemy import create_engine, text
import snowflake.connector

def test_password_auth():
    """Test basic username/password authentication."""
    print("\n" + "="*60)
    print("Testing Password Authentication")
    print("="*60 + "\n")
    
    account = input("Enter Snowflake account (e.g., tshirvw-ve46548): ")
    username = input("Enter username: ")
    password = getpass.getpass("Enter password: ")
    warehouse = input("Enter warehouse name: ")
    
    # Remove .snowflakecomputing.com if present
    account = account.replace('.snowflakecomputing.com', '')
    
    try:
        # Method 1: Using SQLAlchemy
        print("\nTesting with SQLAlchemy...")
        engine = create_engine(
            f'snowflake://{username}:{password}@{account}/{warehouse}'
        )
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, role = result.fetchone()
            print(f"✅ Password auth successful! User: {user}, Role: {role}")
            return True
            
    except Exception as e:
        print(f"❌ Password auth failed: {e}")
        
        # Method 2: Try direct connector
        print("\nTrying direct snowflake-connector...")
        try:
            conn = snowflake.connector.connect(
                user=username,
                password=password,
                account=account,
                warehouse=warehouse
            )
            cursor = conn.cursor()
            cursor.execute("SELECT CURRENT_USER(), CURRENT_ROLE()")
            user, role = cursor.fetchone()
            print(f"✅ Direct connector successful! User: {user}, Role: {role}")
            conn.close()
            return True
        except Exception as e2:
            print(f"❌ Direct connector also failed: {e2}")
            return False


def test_sso_variations():
    """Test different SSO configuration variations."""
    print("\n" + "="*60)
    print("Testing SSO/SAML Variations")
    print("="*60 + "\n")
    
    account = input("Enter Snowflake account (e.g., tshirvw-ve46548): ")
    username = input("Enter username/email for SSO: ")
    warehouse = input("Enter warehouse name: ")
    
    # Remove .snowflakecomputing.com if present
    account = account.replace('.snowflakecomputing.com', '')
    
    variations = [
        {
            "name": "External Browser (Default SSO)",
            "params": {
                'user': username,
                'account': account,
                'authenticator': 'externalbrowser',
                'warehouse': warehouse
            }
        },
        {
            "name": "External Browser with Full Account URL",
            "params": {
                'user': username,
                'account': f"{account}.snowflakecomputing.com",
                'authenticator': 'externalbrowser',
                'warehouse': warehouse
            }
        },
        {
            "name": "SAML 2.0 Specific",
            "params": {
                'user': username,
                'account': account,
                'authenticator': 'https://login.microsoftonline.com',  # Example for Azure AD
                'warehouse': warehouse
            }
        },
        {
            "name": "Okta SSO",
            "params": {
                'user': username,
                'account': account,
                'authenticator': 'https://company.okta.com',  # Replace with your Okta domain
                'warehouse': warehouse
            }
        }
    ]
    
    for variation in variations:
        print(f"\nTrying: {variation['name']}")
        print(f"Parameters: {variation['params']}")
        
        try:
            engine = create_engine(
                'snowflake://',
                connect_args=variation['params'],
                echo=False
            )
            
            with engine.connect() as conn:
                result = conn.execute(text("SELECT CURRENT_USER()"))
                user = result.fetchone()[0]
                print(f"✅ Success with {variation['name']}! User: {user}")
                return variation['params']
                
        except Exception as e:
            error_msg = str(e)
            if "SAML" in error_msg:
                print(f"❌ SAML error - SSO might not be configured")
            elif "browser" in error_msg:
                print(f"❌ Browser auth error - check browser settings")
            else:
                print(f"❌ Failed: {error_msg[:100]}...")
    
    return None


def check_account_settings():
    """Check what authentication methods are available."""
    print("\n" + "="*60)
    print("Checking Account Authentication Settings")
    print("="*60 + "\n")
    
    print("First, let's connect with admin credentials to check settings...")
    
    account = input("Enter Snowflake account: ")
    admin_user = input("Enter admin username: ")
    admin_pass = getpass.getpass("Enter admin password: ")
    
    account = account.replace('.snowflakecomputing.com', '')
    
    try:
        conn = snowflake.connector.connect(
            user=admin_user,
            password=admin_pass,
            account=account
        )
        
        cursor = conn.cursor()
        
        # Check SSO configuration
        print("\nChecking SSO/SAML configuration...")
        try:
            cursor.execute("SHOW PARAMETERS LIKE 'SSO%' IN ACCOUNT")
            print("\nSSO Parameters:")
            for row in cursor.fetchall():
                print(f"  {row[0]}: {row[1]}")
        except:
            print("  Unable to query SSO parameters (might need ACCOUNTADMIN role)")
        
        # Check SAML configuration
        try:
            cursor.execute("SHOW PARAMETERS LIKE 'SAML%' IN ACCOUNT")
            print("\nSAML Parameters:")
            for row in cursor.fetchall():
                print(f"  {row[0]}: {row[1]}")
        except:
            print("  Unable to query SAML parameters")
        
        # Check available authentication policies
        try:
            cursor.execute("SHOW AUTHENTICATION POLICIES")
            print("\nAuthentication Policies:")
            for row in cursor.fetchall():
                print(f"  Policy: {row[1]}")
        except:
            print("  No authentication policies found or insufficient privileges")
        
        # Check user's authentication settings
        test_user = input("\nEnter username to check their auth settings: ")
        try:
            cursor.execute(f"DESC USER {test_user}")
            print(f"\nUser {test_user} settings:")
            for row in cursor.fetchall():
                if 'AUTH' in row[0].upper() or 'SSO' in row[0].upper() or 'SAML' in row[0].upper():
                    print(f"  {row[0]}: {row[1]}")
        except Exception as e:
            print(f"  Unable to describe user: {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Failed to connect as admin: {e}")


def test_oauth_token():
    """Test OAuth token authentication (for programmatic access)."""
    print("\n" + "="*60)
    print("Testing OAuth Token Authentication")
    print("="*60 + "\n")
    
    print("Note: This requires OAuth to be configured in Snowflake")
    print("and you need to have an OAuth access token.\n")
    
    account = input("Enter Snowflake account: ")
    token = input("Enter OAuth token (or 'skip' to skip): ")
    
    if token.lower() == 'skip':
        return False
    
    warehouse = input("Enter warehouse name: ")
    account = account.replace('.snowflakecomputing.com', '')
    
    try:
        conn_params = {
            'account': account,
            'authenticator': 'oauth',
            'token': token,
            'warehouse': warehouse
        }
        
        engine = create_engine(
            'snowflake://',
            connect_args=conn_params
        )
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER()"))
            user = result.fetchone()[0]
            print(f"✅ OAuth authentication successful! User: {user}")
            return True
            
    except Exception as e:
        print(f"❌ OAuth authentication failed: {e}")
        return False


def main():
    """Main menu for testing authentication methods."""
    print("\n" + "="*80)
    print("Snowflake Authentication Methods Tester")
    print("="*80)
    print("\nThis tool helps identify which authentication methods work with your account.")
    print("="*80 + "\n")
    
    while True:
        print("\nChoose an option:")
        print("1. Test password authentication")
        print("2. Test SSO/SAML variations")
        print("3. Check account authentication settings (requires admin)")
        print("4. Test OAuth token authentication")
        print("5. Test all methods")
        print("0. Exit")
        
        choice = input("\nEnter choice (0-5): ")
        
        if choice == '1':
            test_password_auth()
        elif choice == '2':
            result = test_sso_variations()
            if result:
                print(f"\n✅ Working configuration found!")
                print("You can use these parameters in your connection.")
        elif choice == '3':
            check_account_settings()
        elif choice == '4':
            test_oauth_token()
        elif choice == '5':
            print("\nTesting all authentication methods...")
            
            # Test password first (most likely to work)
            if test_password_auth():
                print("\n✅ Password authentication works!")
            
            # Test SSO variations
            result = test_sso_variations()
            if result:
                print(f"\n✅ SSO authentication works with: {result}")
            
            # Test OAuth
            test_oauth_token()
            
            print("\n" + "="*60)
            print("Testing complete. Check results above.")
            
        elif choice == '0':
            break
        else:
            print("Invalid choice")
    
    print("\nGoodbye!")


if __name__ == "__main__":
    main()