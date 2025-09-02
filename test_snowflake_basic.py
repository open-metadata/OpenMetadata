#!/usr/bin/env python3
"""
Simple Snowflake connection tester for non-admin users.
Tests only what you have access to, gracefully handles permission errors.
"""

import logging
import sys
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Changed to DEBUG to see more details
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SnowflakeConnectionTester:
    def __init__(
        self,
        username: str,
        password: str,
        account: str,
        warehouse: str,
        role: Optional[str] = None,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        use_secondary_roles: bool = False
    ):
        """
        Initialize connection tester for non-admin Snowflake users.
        
        Args:
            username: Your Snowflake username
            password: Your Snowflake password
            account: Account identifier (e.g., 'abc12345.us-east-1.aws')
            warehouse: Warehouse you have access to
            role: Optional - Your role (if not specified, uses default role)
            database: Optional - Database to connect to
            schema: Optional - Schema to use
            use_secondary_roles: Enable all secondary roles for combined permissions
        """
        self.username = username
        self.password = password
        self.account = account
        self.warehouse = warehouse
        self.role = role
        self.database = database
        self.schema = schema
        self.use_secondary_roles = use_secondary_roles
        self.engine = None
        self.connection_successful = False
    
    def build_connection_url(self) -> str:
        """Build SQLAlchemy connection URL for Snowflake."""
        # Basic URL: snowflake://user:pass@account/database/schema?warehouse=X&role=Y
        url = f"snowflake://{quote_plus(self.username)}:{quote_plus(self.password)}@{self.account}"
        
        # Add database and schema if provided
        if self.database:
            url += f"/{self.database}"
            if self.schema:
                url += f"/{self.schema}"
        
        # Add query parameters
        params = []
        params.append(f"warehouse={self.warehouse}")
        
        if self.role:
            params.append(f"role={self.role}")
        
        if params:
            url += "?" + "&".join(params)
        
        return url
    
    def connect(self) -> bool:
        """
        Establish connection to Snowflake.
        Returns True if successful, False otherwise.
        """
        try:
            connection_url = self.build_connection_url()
            
            # Mask password in logs
            safe_url = connection_url.replace(
                f":{quote_plus(self.password)}@", 
                ":****@"
            )
            logger.info(f"Connecting to: {safe_url}")
            
            # Create engine with minimal pool for testing
            self.engine = create_engine(
                connection_url,
                echo=False,  # Set to True to see SQL statements
                pool_size=1,
                max_overflow=0,
                pool_pre_ping=True  # Test connection before using
            )
            
            # Test connection
            with self.engine.connect() as conn:
                # Get current context
                result = conn.execute(text("""
                    SELECT 
                        CURRENT_USER() as user,
                        CURRENT_ROLE() as role,
                        CURRENT_WAREHOUSE() as warehouse,
                        CURRENT_DATABASE() as database,
                        CURRENT_SCHEMA() as schema
                """))
                context = result.fetchone()
                
                logger.info("✅ Connection successful!")
                logger.info(f"Connected as: {context.user}")
                logger.info(f"Current role: {context.role}")
                logger.info(f"Warehouse: {context.warehouse}")
                logger.info(f"Database: {context.database or 'None selected'}")
                logger.info(f"Schema: {context.schema or 'None selected'}")
                
                # Enable secondary roles if requested
                if self.use_secondary_roles:
                    try:
                        conn.execute(text("USE SECONDARY ROLES ALL"))
                        logger.info("✅ Secondary roles enabled")
                    except Exception as e:
                        logger.warning(f"⚠️  Could not enable secondary roles: {e}")
                
                self.connection_successful = True
                return True
                
        except Exception as e:
            logger.error(f"❌ Connection failed: {e}")
            self.connection_successful = False
            return False
    
    def test_permissions(self) -> Dict[str, Any]:
        """
        Test what permissions you have.
        Returns a dictionary of test results.
        """
        if not self.connection_successful:
            logger.error("Not connected. Run connect() first.")
            return {}
        
        results = {
            "databases": {"accessible": False, "count": 0, "error": None},
            "schemas": {"accessible": False, "count": 0, "error": None},
            "tables": {"accessible": False, "count": 0, "error": None},
            "warehouses": {"accessible": False, "list": [], "error": None},
            "roles": {"accessible": False, "list": [], "error": None}
        }
        
        with self.engine.connect() as conn:
            # Test 1: List accessible databases
            logger.info("\n" + "="*50)
            logger.info("Testing permissions...")
            logger.info("="*50)
            
            try:
                result = conn.execute(text("SHOW DATABASES"))
                databases = result.fetchall()
                results["databases"]["accessible"] = True
                results["databases"]["count"] = len(databases)
                logger.info(f"✅ Can list databases: {len(databases)} found")
                
                # Show first few databases
                for i, db in enumerate(databases[:3]):
                    logger.info(f"   - {db[1]}")  # Name is usually in column 1
                if len(databases) > 3:
                    logger.info(f"   ... and {len(databases) - 3} more")
                    
            except Exception as e:
                results["databases"]["error"] = str(e)
                logger.info(f"❌ Cannot list databases: {e}")
            
            # Test 2: List schemas in current database
            if self.database:
                try:
                    conn.execute(text(f"USE DATABASE {self.database}"))
                    result = conn.execute(text("SHOW SCHEMAS"))
                    schemas = result.fetchall()
                    results["schemas"]["accessible"] = True
                    results["schemas"]["count"] = len(schemas)
                    logger.info(f"✅ Can list schemas in {self.database}: {len(schemas)} found")
                    
                    # Show first few schemas
                    for i, schema in enumerate(schemas[:3]):
                        logger.info(f"   - {schema[1]}")  # Name in column 1
                    if len(schemas) > 3:
                        logger.info(f"   ... and {len(schemas) - 3} more")
                        
                except Exception as e:
                    results["schemas"]["error"] = str(e)
                    logger.info(f"❌ Cannot list schemas: {e}")
            
            # Test 3: List tables in current schema
            if self.database and self.schema:
                try:
                    conn.execute(text(f"USE SCHEMA {self.database}.{self.schema}"))
                    result = conn.execute(text("SHOW TABLES"))
                    tables = result.fetchall()
                    results["tables"]["accessible"] = True
                    results["tables"]["count"] = len(tables)
                    logger.info(f"✅ Can list tables in {self.database}.{self.schema}: {len(tables)} found")
                    
                    # Show first few tables
                    for i, table in enumerate(tables[:3]):
                        logger.info(f"   - {table[1]}")  # Name in column 1
                    if len(tables) > 3:
                        logger.info(f"   ... and {len(tables) - 3} more")
                        
                except Exception as e:
                    results["tables"]["error"] = str(e)
                    logger.info(f"❌ Cannot list tables: {e}")
            
            # Test 4: List accessible warehouses
            try:
                result = conn.execute(text("SHOW WAREHOUSES"))
                warehouses = result.fetchall()
                wh_names = [wh[0] for wh in warehouses]  # Name in column 0
                results["warehouses"]["accessible"] = True
                results["warehouses"]["list"] = wh_names
                logger.info(f"✅ Can list warehouses: {wh_names}")
            except Exception as e:
                results["warehouses"]["error"] = str(e)
                logger.info(f"❌ Cannot list warehouses: {e}")
            
            # Test 5: List granted roles
            try:
                result = conn.execute(text("SHOW ROLES"))
                roles = result.fetchall()
                role_names = [role[1] for role in roles]  # Name in column 1
                results["roles"]["accessible"] = True
                results["roles"]["list"] = role_names
                logger.info(f"✅ Granted roles: {role_names}")
            except Exception as e:
                results["roles"]["error"] = str(e)
                logger.info(f"❌ Cannot list roles: {e}")
        
        return results
    
    def test_minimal_access(self) -> bool:
        """
        Test if you have minimum required access for basic operations.
        This is useful for OpenMetadata ingestion testing.
        """
        if not self.connection_successful:
            return False
        
        logger.info("\n" + "="*50)
        logger.info("Testing minimal access requirements...")
        logger.info("="*50)
        
        minimal_requirements = {
            "can_execute_queries": False,
            "has_warehouse_access": False,
            "has_any_database_access": False
        }
        
        with self.engine.connect() as conn:
            # Test basic query execution
            try:
                result = conn.execute(text("SELECT 1 as test"))
                minimal_requirements["can_execute_queries"] = True
                logger.info("✅ Can execute basic queries")
            except Exception as e:
                logger.error(f"❌ Cannot execute queries: {e}")
            
            # Test warehouse access
            try:
                result = conn.execute(text("SELECT CURRENT_WAREHOUSE()"))
                warehouse = result.scalar()
                if warehouse:
                    minimal_requirements["has_warehouse_access"] = True
                    logger.info(f"✅ Has warehouse access: {warehouse}")
                else:
                    logger.warning("⚠️  No warehouse selected")
            except Exception as e:
                logger.error(f"❌ Warehouse access issue: {e}")
            
            # Test database access
            try:
                result = conn.execute(text("SHOW DATABASES"))
                databases = result.fetchall()
                if databases:
                    minimal_requirements["has_any_database_access"] = True
                    logger.info(f"✅ Has access to {len(databases)} database(s)")
                else:
                    logger.warning("⚠️  No database access")
            except Exception:
                # Try current database as fallback
                try:
                    result = conn.execute(text("SELECT CURRENT_DATABASE()"))
                    db = result.scalar()
                    if db:
                        minimal_requirements["has_any_database_access"] = True
                        logger.info(f"✅ Has access to current database: {db}")
                except Exception:
                    logger.error("❌ No database access")
        
        all_passed = all(minimal_requirements.values())
        
        logger.info("\n" + "="*50)
        if all_passed:
            logger.info("✅ PASSED: You have minimal required access")
        else:
            logger.warning("⚠️  WARNING: Some minimal requirements not met")
            logger.warning("You may encounter issues with OpenMetadata ingestion")
        logger.info("="*50)
        
        return all_passed
    
    def test_openmetadata_style(self, account_usage_schema: str = "SNOWFLAKE.ACCOUNT_USAGE") -> Dict[str, Any]:
        """
        Test connection using OpenMetadata's test patterns.
        This matches what OpenMetadata's test_connection does.
        """
        if not self.connection_successful:
            logger.error("Not connected. Run connect() first.")
            return {}
        
        logger.info("\n" + "="*50)
        logger.info("Running OpenMetadata-style Connection Tests")
        logger.info("="*50)
        
        test_results = {}
        
        with self.engine.connect() as conn:
            # 1. CheckAccess - Basic connectivity
            try:
                conn.execute(text("SELECT 1"))
                test_results["CheckAccess"] = "✅ PASSED"
                logger.info("✅ CheckAccess: Connection established")
            except Exception as e:
                test_results["CheckAccess"] = f"❌ FAILED: {e}"
                logger.error(f"❌ CheckAccess: {e}")
            
            # 2. GetDatabases - List databases
            try:
                result = conn.execute(text("SHOW DATABASES"))
                databases = result.fetchall()
                test_results["GetDatabases"] = f"✅ PASSED ({len(databases)} databases)"
                logger.info(f"✅ GetDatabases: Found {len(databases)} databases")
            except Exception as e:
                test_results["GetDatabases"] = f"❌ FAILED: {e}"
                logger.error(f"❌ GetDatabases: {e}")
            
            # 3. GetSchemas - List schemas (needs a database context)
            if self.database:
                try:
                    conn.execute(text(f'USE DATABASE "{self.database}"'))
                    result = conn.execute(text("SHOW SCHEMAS"))
                    schemas = result.fetchall()
                    test_results["GetSchemas"] = f"✅ PASSED ({len(schemas)} schemas)"
                    logger.info(f"✅ GetSchemas: Found {len(schemas)} schemas in {self.database}")
                except Exception as e:
                    test_results["GetSchemas"] = f"❌ FAILED: {e}"
                    logger.error(f"❌ GetSchemas: {e}")
            else:
                test_results["GetSchemas"] = "⚠️  SKIPPED (no database specified)"
                logger.warning("⚠️  GetSchemas: Skipped - no database specified")
            
            # 4. GetTables - List tables
            if self.database:
                try:
                    query = f'SELECT TABLE_NAME FROM "{self.database}".information_schema.tables LIMIT 10'
                    result = conn.execute(text(query))
                    tables = result.fetchall()
                    test_results["GetTables"] = f"✅ PASSED ({len(tables)} tables sampled)"
                    logger.info(f"✅ GetTables: Can access tables in {self.database}")
                except Exception as e:
                    test_results["GetTables"] = f"❌ FAILED: {e}"
                    logger.error(f"❌ GetTables: {e}")
            else:
                test_results["GetTables"] = "⚠️  SKIPPED (no database specified)"
                logger.warning("⚠️  GetTables: Skipped - no database specified")
            
            # 5. GetViews - List views
            if self.database:
                try:
                    query = f'SELECT TABLE_NAME FROM "{self.database}".information_schema.views LIMIT 10'
                    result = conn.execute(text(query))
                    views = result.fetchall()
                    test_results["GetViews"] = f"✅ PASSED ({len(views)} views sampled)"
                    logger.info(f"✅ GetViews: Can access views in {self.database}")
                except Exception as e:
                    test_results["GetViews"] = f"⚠️  NO ACCESS: {e}"
                    logger.warning(f"⚠️  GetViews: {e}")
            else:
                test_results["GetViews"] = "⚠️  SKIPPED (no database specified)"
            
            # 6. GetStreams - List streams (Snowflake-specific)
            if self.database:
                try:
                    query = f'SHOW STREAMS IN DATABASE "{self.database}"'
                    result = conn.execute(text(query))
                    streams = result.fetchall()
                    test_results["GetStreams"] = f"✅ PASSED ({len(streams)} streams)"
                    logger.info(f"✅ GetStreams: Found {len(streams)} streams")
                except Exception as e:
                    test_results["GetStreams"] = f"⚠️  NO ACCESS: {e}"
                    logger.warning(f"⚠️  GetStreams: {e}")
            else:
                test_results["GetStreams"] = "⚠️  SKIPPED (no database specified)"
            
            # 7. GetQueries - Access query history (requires ACCOUNT_USAGE access)
            try:
                query = f"SELECT query_text FROM {account_usage_schema}.query_history LIMIT 1"
                result = conn.execute(text(query))
                test_results["GetQueries"] = "✅ PASSED (can access query history)"
                logger.info("✅ GetQueries: Can access ACCOUNT_USAGE.QUERY_HISTORY")
            except Exception as e:
                test_results["GetQueries"] = f"❌ NO ACCESS to {account_usage_schema}"
                logger.warning(f"❌ GetQueries: No access to {account_usage_schema}.QUERY_HISTORY - {e}")
            
            # 8. GetTags - Access tag references (requires ACCOUNT_USAGE access)
            try:
                query = f"SELECT TAG_NAME FROM {account_usage_schema}.tag_references LIMIT 1"
                result = conn.execute(text(query))
                test_results["GetTags"] = "✅ PASSED (can access tags)"
                logger.info("✅ GetTags: Can access ACCOUNT_USAGE.TAG_REFERENCES")
            except Exception as e:
                test_results["GetTags"] = f"❌ NO ACCESS to {account_usage_schema}"
                logger.warning(f"❌ GetTags: No access to {account_usage_schema}.TAG_REFERENCES - {e}")
        
        return test_results
    
    def test_impersonate_privileges(self) -> Dict[str, Any]:
        """
        Check if the current user has any IMPERSONATE privileges.
        This is useful for understanding if task-based impersonation is available.
        """
        if not self.connection_successful:
            logger.error("Not connected. Run connect() first.")
            return {}
        
        logger.info("\n" + "="*50)
        logger.info("Checking IMPERSONATE Privileges")
        logger.info("="*50)
        
        results = {
            "has_impersonate": False,
            "impersonate_grants": [],
            "user_roles": []
        }
        
        with self.engine.connect() as conn:
            try:
                # Get current user info
                result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
                current_user, current_role = result.fetchone()
                logger.info(f"Checking for user: {current_user}, current role: {current_role}")
                
                # Check current role for IMPERSONATE privileges
                result = conn.execute(text(f"SHOW GRANTS TO ROLE {current_role}"))
                for row in result:
                    # logger.info(f"row: {row}")
                    # Format: created_on, privilege, granted_on, name, granted_to, grantee_name, grant_option, granted_by
                    if row[1] == 'IMPERSONATE' and row[2] == 'USER':
                        grant = {
                            "role": current_role,
                            "can_impersonate_user": row[3],  # The user we can impersonate
                            "privilege": "IMPERSONATE",
                            "granted_by": row[7] if len(row) > 7 else "UNKNOWN"
                        }
                        results["impersonate_grants"].append(grant)
                        results["has_impersonate"] = True
                        logger.info(f"✅ Found: Current role '{current_role}' can impersonate user '{row[3]}'")
                        break
                
                # Also check other roles the user has
                result = conn.execute(text(f"SHOW GRANTS TO USER {current_user}"))
                for row in result:
                    if row[1] == "ROLE" and row[2] != current_role:
                        results["user_roles"].append(row[2])
                
                # Check each additional role for IMPERSONATE privileges
                for role in results["user_roles"]:
                    try:
                        conn.execute(text(f"USE ROLE {role}"))
                        result = conn.execute(text(f"SHOW GRANTS TO ROLE {role}"))
                        for row in result:
                            if row[1] == 'IMPERSONATE' and row[2] == 'USER':
                                grant = {
                                    "role": role,
                                    "can_impersonate_user": row[3],
                                    "privilege": "IMPERSONATE",
                                    "granted_by": row[7] if len(row) > 7 else "UNKNOWN"
                                }
                                if grant not in results["impersonate_grants"]:
                                    results["impersonate_grants"].append(grant)
                                    results["has_impersonate"] = True
                                    logger.info(f"✅ Found: Role '{role}' can impersonate user '{row[3]}'")
                    except Exception as role_error:
                        logger.debug(f"Could not check role {role}: {role_error}")
                    finally:
                        # Switch back to original role
                        conn.execute(text(f"USE ROLE {current_role}"))
                
                # Summary
                if results["has_impersonate"]:
                    logger.info("\n✅ IMPERSONATE privileges detected!")
                    logger.info("This user can create tasks that run as other users:")
                    for grant in results["impersonate_grants"]:
                        logger.info(f"  • Role '{grant['role']}' → User '{grant['can_impersonate_user']}'")
                else:
                    logger.info("\n❌ No IMPERSONATE privileges found")
                    logger.info("This user cannot create tasks that run as other users")
                    if results["user_roles"]:
                        logger.info(f"User has these roles: {', '.join(results['user_roles'])}")
                
            except Exception as e:
                logger.error(f"Error checking IMPERSONATE privileges: {e}")
                results["error"] = str(e)
        
        return results
    
    def test_advanced_features(self) -> Dict[str, Any]:
        """
        Test advanced Snowflake features that OpenMetadata might use.
        """
        if not self.connection_successful:
            logger.error("Not connected. Run connect() first.")
            return {}
        
        logger.info("\n" + "="*50)
        logger.info("Testing Advanced Snowflake Features")
        logger.info("="*50)
        
        features = {}
        
        with self.engine.connect() as conn:
            # Test organization and account info
            try:
                result = conn.execute(text("SELECT CURRENT_ORGANIZATION_NAME() AS NAME"))
                org_name = result.scalar()
                features["Organization"] = org_name or "Not available"
                logger.info(f"Organization: {features['Organization']}")
            except Exception:
                features["Organization"] = "Not accessible"
            
            try:
                result = conn.execute(text("SELECT CURRENT_ACCOUNT_NAME() AS ACCOUNT"))
                account_name = result.scalar()
                features["Account Name"] = account_name or "Not available"
                logger.info(f"Account Name: {features['Account Name']}")
            except Exception:
                features["Account Name"] = "Not accessible"
            
            # Test external tables access
            if self.database:
                try:
                    query = f'SHOW EXTERNAL TABLES IN DATABASE "{self.database}"'
                    result = conn.execute(text(query))
                    external_tables = result.fetchall()
                    features["External Tables"] = f"{len(external_tables)} found"
                    logger.info(f"External Tables: {features['External Tables']}")
                except Exception:
                    features["External Tables"] = "Not accessible"
            
            # Test stored procedures and functions
            if self.database and self.schema:
                try:
                    query = f"""
                    SELECT PROCEDURE_NAME 
                    FROM "{self.database}".information_schema.procedures 
                    WHERE PROCEDURE_SCHEMA = '{self.schema}'
                    LIMIT 5
                    """
                    result = conn.execute(text(query))
                    procedures = result.fetchall()
                    features["Stored Procedures"] = f"{len(procedures)} found in {self.schema}"
                    logger.info(f"Stored Procedures: {features['Stored Procedures']}")
                except Exception:
                    features["Stored Procedures"] = "Not accessible"
            
            # Test query tagging capability
            try:
                conn.execute(text('ALTER SESSION SET QUERY_TAG="OpenMetadata_Test"'))
                features["Query Tagging"] = "Supported"
                logger.info("✅ Query tagging is supported")
            except Exception:
                features["Query Tagging"] = "Not allowed"
                logger.warning("⚠️  Cannot set query tags")
            
            # Test clustering key information
            if self.database:
                try:
                    query = f"""
                    SELECT COUNT(*) 
                    FROM "{self.database}".information_schema.tables 
                    WHERE CLUSTERING_KEY IS NOT NULL
                    """
                    result = conn.execute(text(query))
                    clustered_count = result.scalar()
                    features["Clustered Tables"] = f"{clustered_count} tables with clustering keys"
                    logger.info(f"Clustered Tables: {features['Clustered Tables']}")
                except Exception:
                    features["Clustered Tables"] = "Not accessible"
        
        return features
    
    def close(self):
        """Close the connection."""
        if self.engine:
            self.engine.dispose()
            logger.info("Connection closed")


def main():
    """
    Example usage - replace with your actual credentials.
    """
    print("\n" + "="*60)
    print("Snowflake Connection Tester for Non-Admin Users")
    print("="*60 + "\n")
    
    # Configuration - REPLACE WITH YOUR CREDENTIALS
    config = {
        "username": "Himanshu", #"your_username",
        "password": "johnSnow@012389", #"your_password",
        "account": "tshirvw-ve46548", #"abc12345.us-east-1.aws",  # Your account identifier
        "warehouse": "COMPUTE_WH",  # Warehouse you have access to
        "role": None,  # Optional - leave None to use default role
        "database": "SNOWFLAKE",  # Optional - specify if you know which DB you can access
        "schema": "ACCOUNT_USAGE",  # Optional - specify if you know the schema
        "use_secondary_roles": False  # Set to True to use all your secondary roles
    }
    config2 = {
        "username": "hk", #"your_username",
        "password": "johnSnow@012389", #"your_password",
        "account": "tshirvw-ve46548", #"abc12345.us-east-1.aws",  # Your account identifier
        "warehouse": "COMPUTE_WH",  # Warehouse you have access to
        "role": None,  # Optional - leave None to use default role
        "database": "SNOWFLAKE",  # Optional - specify if you know which DB you can access
        "schema": "ACCOUNT_USAGE",  # Optional - specify if you know the schema
        "use_secondary_roles": False  # Set to True to use all your secondary roles
    }
    
    # Create tester instance
    tester = SnowflakeConnectionTester(**config)
    
    try:
        # Step 1: Connect
        if not tester.connect():
            logger.error("Failed to connect. Check your credentials.")
            sys.exit(1)
        
        # Step 2: Test permissions
        # permissions = tester.test_permissions()
        
        # Step 3: Test minimal access
        # has_minimal = tester.test_minimal_access()
        
        # Step 4: Run OpenMetadata-style tests
        # om_tests = tester.test_openmetadata_style()
        
        # Step 5: Check IMPERSONATE privileges
        impersonate = tester.test_impersonate_privileges()
        
        # Step 6: Test advanced features
        # advanced = tester.test_advanced_features()
        
        # Summary
        print("\n" + "="*60)
        print("SUMMARY")
        print("="*60)
        
        if False and has_minimal:
            print("✅ Your connection works for basic operations!")
            print("\nYou can:")
            if permissions["databases"]["accessible"]:
                print(f"  • Access {permissions['databases']['count']} database(s)")
            if permissions["schemas"]["accessible"]:
                print(f"  • Access {permissions['schemas']['count']} schema(s)")
            if permissions["tables"]["accessible"]:
                print(f"  • Access {permissions['tables']['count']} table(s)")
            if permissions["warehouses"]["list"]:
                print(f"  • Use warehouses: {', '.join(permissions['warehouses']['list'])}")
            if permissions["roles"]["list"]:
                print(f"  • Use roles: {', '.join(permissions['roles']['list'])}")
        else:
            print("⚠️  Limited access detected. You may need additional permissions for full OpenMetadata ingestion.")
            print("\nConsider asking your admin for:")
            print("  • USAGE privilege on required databases")
            print("  • USAGE privilege on required schemas")
            print("  • SELECT privilege on tables you need to ingest")
            print("  • USAGE privilege on a warehouse")
        
        # OpenMetadata Test Results Summary
        print("\n" + "="*60)
        print("OpenMetadata Connection Test Results")
        print("="*60)
        for test_name, result in om_tests.items():
            print(f"{test_name}: {result}")
        
        # IMPERSONATE Privileges Summary
        print("\n" + "="*60)
        print("IMPERSONATE Privileges (for Task-based execution)")
        print("="*60)
        if impersonate.get("has_impersonate"):
            print("✅ User has IMPERSONATE privileges!")
            for grant in impersonate.get("impersonate_grants", []):
                print(f"  • Role '{grant['role']}' can impersonate user '{grant['can_impersonate_user']}'")
        else:
            print("❌ No IMPERSONATE privileges found")
            print("  User cannot create tasks that run as other users")
        
        # Advanced Features Summary
        if False and advanced:
            print("\n" + "="*60)
            print("Advanced Features")
            print("="*60)
            for feature, status in advanced.items():
                print(f"{feature}: {status}")
        
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        tester.close()


if __name__ == "__main__":
    # First, check if required library is installed
    try:
        import snowflake.sqlalchemy
    except ImportError:
        print("❌ Missing required library!")
        print("Please install: pip install snowflake-sqlalchemy")
        sys.exit(1)
    
    main()