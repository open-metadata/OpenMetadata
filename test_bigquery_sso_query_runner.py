#!/usr/bin/env python3
"""
BigQuery SSO Token Query Runner
Uses Google SSO (Application Default Credentials) to execute queries in BigQuery
with role-based access control for admin and non-admin users.
"""

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from google.auth import default
from google.auth.transport.requests import Request
from google.cloud import bigquery

# Try to load .env file if it exists
try:
    from dotenv import load_dotenv
    env_path = Path('.') / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print(f"✓ Loaded configuration from .env file")
except ImportError:
    print("Note: python-dotenv not installed. Using environment variables only.")
    print("Install with: pip install python-dotenv")


@dataclass
class BigQuerySSO:
    """BigQuery SSO authentication configuration"""
    project_id: str
    location: str = "US"
    scopes: List[str] = None

    def __post_init__(self):
        if not self.scopes:
            self.scopes = [
                "https://www.googleapis.com/auth/cloud-platform",
                "https://www.googleapis.com/auth/bigquery",
            ]


class BigQueryQueryRunner:
    """Execute BigQuery queries using Google SSO tokens"""

    def __init__(self, config: BigQuerySSO):
        self.config = config
        self.credentials = None
        self.client: Optional[bigquery.Client] = None

    def authenticate(self):
        """
        Authenticate using Application Default Credentials (ADC)
        Works with Google SSO when user has done: gcloud auth application-default login
        """
        credentials, detected_project = default(scopes=self.config.scopes)

        # Use detected project if not specified
        if not self.config.project_id and detected_project:
            self.config.project_id = detected_project
            print(f"Using detected project: {detected_project}")

        # Ensure credentials are valid
        if not credentials.valid:
            if credentials.expired and credentials.refresh_token:
                credentials.refresh(Request())

        self.credentials = credentials
        return credentials

    def initialize_client(self) -> bigquery.Client:
        """Initialize BigQuery client with SSO credentials"""
        if not self.credentials:
            self.authenticate()

        self.client = bigquery.Client(
            project=self.config.project_id,
            credentials=self.credentials,
            location=self.config.location,
        )
        return self.client

    def execute_query(
        self,
        query: str,
        parameters: Optional[List[bigquery.ScalarQueryParameter]] = None,
        as_admin: bool = False,
    ) -> pd.DataFrame:
        """
        Execute a BigQuery query with role-based settings
        
        Args:
            query: SQL query to execute
            parameters: Optional query parameters
            as_admin: Whether to use admin privileges
        
        Returns:
            Query results as pandas DataFrame
        """
        if not self.client:
            raise RuntimeError("Client not initialized. Call initialize_client first.")

        # Configure job based on user role
        job_config = bigquery.QueryJobConfig()
        
        if parameters:
            job_config.query_parameters = parameters

        # Admin users get interactive priority, non-admins get batch
        if as_admin:
            job_config.priority = bigquery.QueryPriority.INTERACTIVE
        else:
            job_config.priority = bigquery.QueryPriority.BATCH
            # Optional: Add byte limit for non-admins
            # job_config.maximum_bytes_billed = 10485760  # 10 MB

        print(f"Executing query as {'admin' if as_admin else 'non-admin'} user...")

        try:
            # Run the query
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()

            # Convert to DataFrame
            df = results.to_dataframe()
            print(f"✓ Query completed. Rows returned: {len(df)}")

            # Log statistics
            if query_job.total_bytes_processed:
                gb_processed = query_job.total_bytes_processed / 1e9
                print(f"  Bytes processed: {gb_processed:.3f} GB")

            return df

        except Exception as e:
            print(f"✗ Query execution failed: {e}")
            raise

    def test_permissions(self) -> Dict[str, bool]:
        """Test what permissions the current user has in BigQuery"""
        permissions = {
            "can_list_datasets": False,
            "can_run_query": False,
            "can_access_information_schema": False,
            "is_admin": False,
        }

        if not self.client:
            print("Client not initialized")
            return permissions

        # Test listing datasets
        try:
            datasets = list(self.client.list_datasets(max_results=1))
            permissions["can_list_datasets"] = True
            print(f"✓ Can list datasets - \n{len(datasets)}")
        except Exception as e:
            print(f"✗ Cannot list datasets: {e}")

        # Test running a simple query
        try:
            query = "SELECT 1 as test"
            query = "SELECT * FROM `modified-leaf-330420.hk_test.sample_table` LIMIT 1000"
            query = "SELECT * FROM `modified-leaf-330420.test_omd.test_arr` LIMIT 10"
            result = self.client.query(query).result()
            permissions["can_run_query"] = True
            print(f"✓ Can run queries - \n{result}")
            for r in result:
                print(r)
        except Exception as e:
            print(f"✗ Cannot run queries: {e}")

        # Test accessing INFORMATION_SCHEMA (usually admin only)
        try:
            query = f"""
            SELECT table_name 
            FROM `{self.config.project_id}.region-{self.config.location.lower()}.INFORMATION_SCHEMA.TABLES` 
            LIMIT 1
            """
            result = self.client.query(query).result()
            permissions["can_access_information_schema"] = True
            permissions["is_admin"] = True
            print("✓ Can access INFORMATION_SCHEMA (admin access)")
        except Exception:
            print("✗ Cannot access INFORMATION_SCHEMA (non-admin)")

        return permissions


def run_demo():
    """Run a demonstration of BigQuery SSO query execution"""
    
    print("\n" + "=" * 60)
    print("BigQuery SSO Query Runner Demo")
    print("=" * 60 + "\n")

    # Get configuration from environment or use defaults
    project_id = os.getenv("BIGQUERY_PROJECT_ID")
    location = os.getenv("BIGQUERY_LOCATION", "US")

    # Try to detect project if not set
    if not project_id:
        try:
            _, detected_project = default()
            if detected_project:
                project_id = detected_project
                print(f"Detected project from ADC: {project_id}")
        except Exception:
            pass

    if not project_id:
        print("⚠️  No project ID found!")
        print("\nTo configure:")
        print("1. Run: ./setup_bigquery_sso.sh")
        print("2. Or set: export BIGQUERY_PROJECT_ID=your-project-id")
        print("3. Or authenticate: gcloud auth application-default login")
        sys.exit(1)

    # Create configuration
    config = BigQuerySSO(project_id=project_id, location=location)
    print(f"Configuration:")
    print(f"  Project: {config.project_id}")
    print(f"  Location: {config.location}\n")

    # Initialize query runner
    runner = BigQueryQueryRunner(config)
    
    try:
        # Connect to BigQuery
        runner.initialize_client()
        print("✓ Connected to BigQuery with Google SSO\n")

        # Test permissions
        print("Testing permissions...")
        permissions = runner.test_permissions()
        print(f"\nPermissions summary:")
        for perm, value in permissions.items():
            status = "✓" if value else "✗"
            print(f"  {status} {perm}")
        
        is_admin = permissions["is_admin"]
        print(f"\nUser type: {'Admin' if is_admin else 'Non-admin'}")

        # Run example queries if user has access
        if permissions["can_run_query"]:
            print("\n" + "-" * 40)
            print("Running example queries...")
            print("-" * 40 + "\n")

            # Basic query
            print("1. Basic query:")
            query = """
            SELECT 
                CURRENT_TIMESTAMP() as current_time,
                SESSION_USER() as user,
                @@project_id as project_id
            """
            df = runner.execute_query(query, as_admin=is_admin)
            print(df.to_string())

            # Public dataset query (if user can list datasets)
            if permissions["can_list_datasets"]:
                print("\n2. Public dataset query:")
                query = """
                SELECT name, state
                FROM `bigquery-public-data.usa_names.usa_1910_current`
                LIMIT 3
                """
                df = runner.execute_query(query, as_admin=is_admin)
                print(df.to_string())

            # Admin-only query
            if is_admin:
                print("\n3. Information schema query (admin only):")
                query = f"""
                SELECT 
                    table_schema,
                    table_name,
                    table_type
                FROM `{config.project_id}.region-{config.location.lower()}.INFORMATION_SCHEMA.TABLES`
                LIMIT 3
                """
                df = runner.execute_query(query, as_admin=True)
                print(df.to_string())
        else:
            print("\n⚠️  User doesn't have query execution permissions")

    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure you're authenticated: gcloud auth application-default login")
        print("2. Check project permissions in Google Cloud Console")
        print("3. Verify the project ID is correct")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("Demo completed successfully!")
    print("=" * 60 + "\n")


def main():
    """Main entry point"""
    # Suppress warnings for cleaner output
    import warnings
    warnings.filterwarnings('ignore', category=UserWarning)
    
    run_demo()


if __name__ == "__main__":
    main()