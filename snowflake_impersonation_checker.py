#!/usr/bin/env python3
"""
Snowflake Query Runner with Impersonation Support.

This module checks for IMPERSONATE privileges and provides a workflow
for running queries as different users through Snowflake Tasks.
"""

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ImpersonationPrivilege:
    """Represents an IMPERSONATE privilege grant."""
    grantee_role: str
    target_user: str
    granted_by: str
    granted_on: str
    
    def __repr__(self):
        return f"Role '{self.grantee_role}' can impersonate user '{self.target_user}'"


class SnowflakeImpersonationChecker:
    """
    Checks and manages IMPERSONATE privileges for query execution workflows.
    """
    
    def __init__(
        self,
        username: str,
        password: str,
        account: str,
        warehouse: str,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        role: Optional[str] = None
    ):
        self.username = username
        self.password = password
        self.account = account
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self.role = role
        self.engine: Optional[Engine] = None
        self.current_role: Optional[str] = None
        self.current_user: Optional[str] = None
    
    def connect(self) -> Engine:
        """Establish connection to Snowflake."""
        url = f"snowflake://{quote_plus(self.username)}:{quote_plus(self.password)}@{self.account}"
        
        if self.database:
            url += f"/{self.database}"
            if self.schema:
                url += f"/{self.schema}"
        
        params = [f"warehouse={self.warehouse}"]
        if self.role:
            params.append(f"role={self.role}")
        
        if params:
            url += "?" + "&".join(params)
        
        self.engine = create_engine(url, echo=False)
        
        # Get current context
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            self.current_user, self.current_role = result.fetchone()
            logger.info(f"Connected as user: {self.current_user}, role: {self.current_role}")
        
        return self.engine
    
    def check_impersonate_privileges(self) -> List[ImpersonationPrivilege]:
        """
        Check what IMPERSONATE privileges the current user's roles have.
        
        Returns:
            List of ImpersonationPrivilege objects
        """
        if not self.engine:
            raise ValueError("Not connected. Call connect() first.")
        
        privileges = []
        
        with self.engine.connect() as conn:
            # Check IMPERSONATE privileges granted to current role
            query = """
            SELECT 
                grantee_name as role_name,
                name as target_user,
                granted_by,
                granted_on
            FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_ROLES
            WHERE privilege = 'IMPERSONATE'
                AND granted_on = 'USER'
                AND grantee_name IN (
                    SELECT role_name 
                    FROM SNOWFLAKE.ACCOUNT_USAGE.GRANTS_TO_USERS
                    WHERE grantee_name = :current_user
                    AND deleted_on IS NULL
                )
                AND deleted_on IS NULL
            ORDER BY granted_on DESC
            """
            
            try:
                result = conn.execute(text(query), {"current_user": self.current_user})
                for row in result:
                    priv = ImpersonationPrivilege(
                        grantee_role=row[0],
                        target_user=row[1],
                        granted_by=row[2],
                        granted_on=str(row[3])
                    )
                    privileges.append(priv)
                    logger.info(f"Found: {priv}")
                    
                if not privileges:
                    logger.warning("No IMPERSONATE privileges found for current user's roles")
                    
            except Exception as e:
                # Fallback: Try using SHOW GRANTS if ACCOUNT_USAGE is not accessible
                logger.warning(f"Cannot access ACCOUNT_USAGE, trying SHOW GRANTS: {e}")
                
                try:
                    # Get all roles for current user
                    result = conn.execute(text("SHOW GRANTS TO USER identifier(:username)"), 
                                        {"username": self.current_user})
                    user_roles = [row[1] for row in result if row[0] == 'ROLE']
                    
                    # Check each role for IMPERSONATE privileges
                    for role in user_roles:
                        conn.execute(text(f"USE ROLE {role}"))
                        result = conn.execute(text("SHOW GRANTS ON ACCOUNT"))
                        
                        for row in result:
                            if row[1] == 'IMPERSONATE' and row[2] == 'USER':
                                priv = ImpersonationPrivilege(
                                    grantee_role=role,
                                    target_user=row[3],  # The name column
                                    granted_by=row[5],
                                    granted_on=str(row[0])
                                )
                                privileges.append(priv)
                                logger.info(f"Found: {priv}")
                                
                except Exception as fallback_error:
                    logger.error(f"Cannot check IMPERSONATE privileges: {fallback_error}")
        
        return privileges
    
    def can_impersonate_user(self, target_user: str) -> Tuple[bool, Optional[str]]:
        """
        Check if current user can impersonate a target user.
        
        Returns:
            Tuple of (can_impersonate, role_to_use)
        """
        privileges = self.check_impersonate_privileges()
        
        for priv in privileges:
            if priv.target_user.upper() == target_user.upper():
                return True, priv.grantee_role
        
        return False, None
    
    def create_query_runner_task(
        self,
        query: str,
        target_user: str,
        task_name: Optional[str] = None,
        warehouse: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a task to run a query as a different user.
        
        This is the key workflow for query-runner with impersonation.
        """
        if not self.engine:
            raise ValueError("Not connected. Call connect() first.")
        
        can_impersonate, role_to_use = self.can_impersonate_user(target_user)
        
        if not can_impersonate:
            raise PermissionError(
                f"Cannot impersonate user '{target_user}'. "
                f"No IMPERSONATE privilege found for current user's roles."
            )
        
        # Generate unique task name if not provided
        if not task_name:
            query_hash = hashlib.md5(query.encode()).hexdigest()[:8]
            task_name = f"QUERY_RUNNER_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{query_hash}"
        
        warehouse = warehouse or self.warehouse
        
        with self.engine.connect() as conn:
            # Switch to the role that has IMPERSONATE privilege
            conn.execute(text(f"USE ROLE {role_to_use}"))
            logger.info(f"Switched to role: {role_to_use}")
            
            # Create the task
            create_task_sql = f"""
            CREATE OR REPLACE TASK {task_name}
                WAREHOUSE = '{warehouse}'
                EXECUTE AS USER = '{target_user}'
                SCHEDULE = 'USING CRON 0 0 * * * UTC'  -- Dummy schedule, will run manually
                USER_TASK_MANAGED_INITIAL_WAREHOUSE_SIZE = 'XSMALL'
            AS
            {query}
            """
            
            try:
                conn.execute(text(create_task_sql))
                logger.info(f"Created task: {task_name}")
                
                # Execute the task immediately (one-time run)
                conn.execute(text(f"EXECUTE TASK {task_name}"))
                logger.info(f"Executed task: {task_name}")
                
                # Get task execution details
                result = conn.execute(text(f"""
                    SELECT 
                        NAME,
                        STATE,
                        COMPLETED_TIME,
                        SCHEDULED_TIME,
                        ERROR_CODE,
                        ERROR_MESSAGE
                    FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(
                        TASK_NAME => '{task_name}',
                        SCHEDULED_TIME_RANGE_START => DATEADD('MINUTE', -5, CURRENT_TIMESTAMP())
                    ))
                    ORDER BY SCHEDULED_TIME DESC
                    LIMIT 1
                """))
                
                execution_details = result.fetchone()
                
                # Clean up - drop the task after execution
                conn.execute(text(f"DROP TASK IF EXISTS {task_name}"))
                logger.info(f"Cleaned up task: {task_name}")
                
                return {
                    "task_name": task_name,
                    "target_user": target_user,
                    "role_used": role_to_use,
                    "execution_status": execution_details[1] if execution_details else "UNKNOWN",
                    "completed_time": str(execution_details[2]) if execution_details else None,
                    "error": execution_details[5] if execution_details and execution_details[4] else None
                }
                
            except Exception as e:
                logger.error(f"Failed to create/execute task: {e}")
                raise
    
    def test_impersonation_workflow(self) -> Dict[str, Any]:
        """
        Test the complete impersonation workflow for OpenMetadata.
        """
        results = {
            "connection_successful": False,
            "current_user": None,
            "current_role": None,
            "impersonate_privileges": [],
            "can_use_impersonation": False,
            "workflow_test": None
        }
        
        try:
            # Connect
            self.connect()
            results["connection_successful"] = True
            results["current_user"] = self.current_user
            results["current_role"] = self.current_role
            
            # Check privileges
            privileges = self.check_impersonate_privileges()
            results["impersonate_privileges"] = [
                {
                    "role": p.grantee_role,
                    "can_impersonate": p.target_user,
                    "granted_by": p.granted_by
                }
                for p in privileges
            ]
            results["can_use_impersonation"] = len(privileges) > 0
            
            # Test workflow if privileges exist
            if privileges:
                test_query = "SELECT CURRENT_USER(), CURRENT_ROLE(), CURRENT_TIMESTAMP()"
                target_user = privileges[0].target_user
                
                logger.info(f"Testing workflow: Running query as {target_user}")
                
                try:
                    workflow_result = self.create_query_runner_task(
                        query=test_query,
                        target_user=target_user,
                        task_name=f"TEST_IMPERSONATION_{int(time.time())}"
                    )
                    results["workflow_test"] = workflow_result
                    logger.info(f"Workflow test successful: {workflow_result}")
                except Exception as e:
                    results["workflow_test"] = {"error": str(e)}
                    logger.error(f"Workflow test failed: {e}")
            
        except Exception as e:
            logger.error(f"Test failed: {e}")
            results["error"] = str(e)
        
        return results


def add_impersonation_to_connection_test():
    """
    Add this to the existing test_snowflake_basic.py script.
    """
    test_code = '''
    def test_impersonation_support(self) -> Dict[str, Any]:
        """
        Test if the user has IMPERSONATE privileges for query-runner workflow.
        """
        if not self.connection_successful:
            logger.error("Not connected. Run connect() first.")
            return {}
        
        logger.info("\\n" + "="*50)
        logger.info("Testing IMPERSONATE Privileges for Query Runner")
        logger.info("="*50)
        
        results = {
            "has_impersonate": False,
            "impersonate_targets": [],
            "workflow_supported": False
        }
        
        with self.engine.connect() as conn:
            # Check for IMPERSONATE privileges
            try:
                # First try: Check via SHOW GRANTS
                result = conn.execute(text("SHOW GRANTS TO USER identifier(:user)"), 
                                    {"user": self.username})
                user_roles = set()
                for row in result:
                    if row[1] == "ROLE":
                        user_roles.add(row[2])
                
                # Check grants for each role
                for role in user_roles:
                    try:
                        conn.execute(text(f"USE ROLE {role}"))
                        result = conn.execute(text("SHOW GRANTS TO ROLE identifier(:role)"), 
                                            {"role": role})
                        for row in result:
                            if "IMPERSONATE" in str(row):
                                results["has_impersonate"] = True
                                # Extract target user from the grant
                                if row[2] == "USER" and row[1] == "IMPERSONATE":
                                    results["impersonate_targets"].append({
                                        "role": role,
                                        "target_user": row[3],
                                        "privilege": "IMPERSONATE"
                                    })
                    except Exception as e:
                        logger.debug(f"Could not check role {role}: {e}")
                
                if results["has_impersonate"]:
                    logger.info(f"✅ IMPERSONATE privileges found!")
                    for target in results["impersonate_targets"]:
                        logger.info(f"   Role '{target['role']}' can impersonate '{target['target_user']}'")
                    results["workflow_supported"] = True
                else:
                    logger.warning("❌ No IMPERSONATE privileges found")
                    logger.info("   Query-runner workflow will need alternative approach")
                    
            except Exception as e:
                logger.error(f"Could not check IMPERSONATE privileges: {e}")
                results["error"] = str(e)
        
        return results
    '''
    
    return test_code


def main():
    """
    Example usage for testing impersonation workflow.
    """
    print("\n" + "="*60)
    print("Snowflake Query Runner - Impersonation Checker")
    print("="*60 + "\n")
    
    # Configuration
    config = {
        "username": "your_username",
        "password": "your_password",
        "account": "your_account",
        "warehouse": "COMPUTE_WH",
        "database": "TEST_DB",
        "schema": "PUBLIC"
    }
    
    checker = SnowflakeImpersonationChecker(**config)
    
    try:
        # Connect
        checker.connect()
        
        # Test impersonation workflow
        results = checker.test_impersonation_workflow()
        
        print("\n" + "="*60)
        print("Impersonation Test Results")
        print("="*60)
        print(json.dumps(results, indent=2))
        
        # Check if workflow is supported
        if results["can_use_impersonation"]:
            print("\n✅ Query-runner workflow with impersonation is SUPPORTED")
            print("You can run queries as the following users:")
            for priv in results["impersonate_privileges"]:
                print(f"  • {priv['can_impersonate']} (using role: {priv['role']})")
        else:
            print("\n❌ Query-runner workflow with impersonation is NOT SUPPORTED")
            print("Alternative approaches:")
            print("  1. Request IMPERSONATE privilege from admin")
            print("  2. Use role-based access control")
            print("  3. Use secondary roles for combined privileges")
            
    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        if checker.engine:
            checker.engine.dispose()


if __name__ == "__main__":
    main()