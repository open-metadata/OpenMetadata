#!/usr/bin/env python3
"""
Test script for HK to use browser-based OAuth with Snowflake
After admin (Himanshu) runs the setup SQL script
"""

from sqlalchemy import create_engine, text
import pandas as pd


def test_browser_oauth_connection():
    """
    Test connection for user HK using browser-based OAuth
    Browser will open automatically for authentication
    """
    
    # Connection parameters for HK
    account = 'tshirvw-ve46548'  # Just the account identifier, not full domain
    warehouse = 'COMPUTE_WH'
    database = 'HK_TEST_DB'
    schema = 'HK_TEST_SCHEMA'
    role = 'TEMP'
    user = 'HK'  # The Snowflake username
    
    # Build connection string with browser-based authentication
    # Format: snowflake://user:password@account/database/schema?params
    connection_string = (
        f"snowflake://{user}@{account}/"
        f"{database}/{schema}"
        f"?authenticator=externalbrowser"  # This triggers browser SSO
        f"&warehouse={warehouse}"
        f"&role={role}"
    )
    
    print("=" * 60)
    print("Snowflake Browser OAuth Test for User HK")
    print("=" * 60)
    print(f"Account: {account}")
    print(f"Role: {role}")
    print(f"Database: {database}.{schema}")
    print("-" * 60)
    print("Your browser will open for authentication...")
    print("Please complete the login in your browser")
    print("-" * 60)
    
    try:
        # Create connection
        engine = create_engine(
            connection_string,
            echo=False,
            pool_pre_ping=True
        )
        
        # Test 1: Verify user identity
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT 
                    CURRENT_USER() as user,
                    CURRENT_ROLE() as role,
                    CURRENT_WAREHOUSE() as warehouse,
                    CURRENT_DATABASE() as database,
                    CURRENT_SCHEMA() as schema
            """))
            info = result.fetchone()
            
            print("\n✅ Successfully connected!")
            print(f"User: {info.user}")
            print(f"Role: {info.role}")
            print(f"Warehouse: {info.warehouse}")
            print(f"Database: {info.database}")
            print(f"Schema: {info.schema}")
        
        # Test 2: Create a test table
        print("\n" + "-" * 60)
        print("Testing permissions...")
        
        with engine.connect() as conn:
            # Create a test table
            conn.execute(text("""
                CREATE OR REPLACE TABLE HK_OAUTH_TEST (
                    id INTEGER,
                    message VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
                )
            """))
            conn.commit()
            print("✅ Created test table HK_OAUTH_TEST")
            
            # Insert test data
            conn.execute(text("""
                INSERT INTO HK_OAUTH_TEST (id, message) 
                VALUES 
                    (1, 'OAuth test successful!'),
                    (2, 'HK can access via browser SSO')
            """))
            conn.commit()
            print("✅ Inserted test data")
            
            # Read the data
            result = conn.execute(text("SELECT * FROM HK_OAUTH_TEST"))
            df = pd.DataFrame(result.fetchall(), columns=result.keys())
            print("\n✅ Retrieved test data:")
            print(df)
            
            # Clean up
            conn.execute(text("DROP TABLE IF EXISTS HK_OAUTH_TEST"))
            conn.commit()
            print("\n✅ Cleaned up test table")
        
        print("\n" + "=" * 60)
        print("🎉 SUCCESS! Browser OAuth is working correctly for user HK")
        print("=" * 60)
        
        return engine
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure admin has run setup_browser_oauth_for_hk.sql")
        print("2. Check that browser opens and you can login")
        print("3. Verify your Snowflake account allows browser authentication")
        print("4. Check network/firewall settings")
        raise
    finally:
        if 'engine' in locals():
            engine.dispose()


if __name__ == "__main__":
    # Install required packages first:
    # pip install snowflake-connector-python[secure-local-storage] snowflake-sqlalchemy sqlalchemy pandas
    
    test_browser_oauth_connection()