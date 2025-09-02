#!/usr/bin/env python3
"""
Snowflake SSO Authentication POC for OpenMetadata Query Runner.

This script demonstrates:
1. SSO/OAuth authentication via browser for Snowflake
2. User context-based connections for non-admin users
3. Connection pooling and caching strategies
4. Role-based query execution

Similar to Atlan's approach: https://docs.atlan.com/product/integrations/identity-management/sso/how-tos/authenticate-sso-credentials-to-query-data
"""

import os
import json
import time
import logging
import hashlib
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from pathlib import Path
import snowflake.connector
from sqlalchemy import create_engine, text, pool
from sqlalchemy.engine import Engine
from cryptography.fernet import Fernet
import threading
from concurrent.futures import ThreadPoolExecutor

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@dataclass
class UserContext:
    """User context for SSO authentication."""
    email: str
    snowflake_username: str
    snowflake_role: Optional[str] = None
    idp_token: Optional[str] = None
    session_token: Optional[str] = None
    token_expiry: Optional[datetime] = None
    
    def is_token_valid(self) -> bool:
        """Check if the session token is still valid."""
        if not self.session_token or not self.token_expiry:
            return False
        return datetime.now() < self.token_expiry


class SnowflakeSSOAuthenticator:
    """
    Handles SSO authentication for Snowflake using external browser flow.
    This simulates what OpenMetadata would need to implement.
    """
    
    def __init__(
        self,
        account: str,
        warehouse: str,
        database: Optional[str] = None,
        schema: Optional[str] = None,
        authenticator: str = 'externalbrowser',
        cache_dir: str = '.snowflake_sso_cache'
    ):
        """
        Initialize SSO authenticator.
        
        Args:
            account: Snowflake account identifier
            warehouse: Default warehouse
            database: Default database (optional)
            schema: Default schema (optional)
            authenticator: Authentication method (externalbrowser, oauth, etc.)
            cache_dir: Directory to cache SSO tokens
        """
        self.account = account
        self.warehouse = warehouse
        self.database = database
        self.schema = schema
        self.authenticator = authenticator
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Initialize encryption for token storage
        self._init_encryption()
    
    def _init_encryption(self):
        """Initialize encryption for secure token storage."""
        key_file = self.cache_dir / 'token_key.key'
        if key_file.exists():
            with open(key_file, 'rb') as f:
                self.cipher = Fernet(f.read())
        else:
            key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(key)
            os.chmod(key_file, 0o600)
            self.cipher = Fernet(key)
    
    def authenticate_user_sso(self, user_context: UserContext) -> Engine:
        """
        Authenticate a user via SSO and return a SQLAlchemy engine.
        
        This method simulates browser-based SSO authentication flow.
        In production, this would integrate with your IDP (Okta, Azure AD, etc.)
        
        Args:
            user_context: User context with email and mapping info
        
        Returns:
            SQLAlchemy engine with SSO authentication
        """
        logger.info(f"Initiating SSO authentication for user: {user_context.email}")
        
        try:
            # Check for cached valid token
            cached_token = self._get_cached_token(user_context.email)
            if cached_token and self._is_token_valid(cached_token):
                logger.info("Using cached SSO token")
                return self._create_engine_with_token(user_context, cached_token)
            
            # Perform SSO authentication
            if self.authenticator == 'externalbrowser':
                engine = self._authenticate_browser(user_context)
            elif self.authenticator == 'oauth':
                engine = self._authenticate_oauth(user_context)
            else:
                raise ValueError(f"Unsupported authenticator: {self.authenticator}")
            
            # Cache the session for reuse
            self._cache_session(user_context)
            
            return engine
            
        except Exception as e:
            logger.error(f"SSO authentication failed: {e}")
            raise
    
    def _authenticate_browser(self, user_context: UserContext) -> Engine:
        """
        Authenticate using external browser (SSO).
        
        This opens the default browser for SSO login.
        """
        logger.info("Opening browser for SSO authentication...")
        
        # Create connection with externalbrowser authenticator
        conn_params = {
            'user': user_context.snowflake_username,
            'account': self.account.replace('.snowflakecomputing.com', ''),
            'authenticator': 'externalbrowser',
            'warehouse': self.warehouse,
            'database': self.database,
            'schema': self.schema,
            'role': user_context.snowflake_role,
            'client_session_keep_alive': True,
            'login_timeout': 60
        }
        
        # Remove None values
        conn_params = {k: v for k, v in conn_params.items() if v is not None}
        
        # Create SQLAlchemy engine with SSO
        engine = create_engine(
            'snowflake://',
            connect_args=conn_params,
            poolclass=pool.NullPool,  # Don't pool SSO connections
            echo=False
        )
        
        # Test the connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT CURRENT_USER(), CURRENT_ROLE()"))
            user, role = result.fetchone()
            logger.info(f"✅ SSO authentication successful! User: {user}, Role: {role}")
            
            # Store session info
            user_context.snowflake_role = role
            user_context.session_token = "sso_session_active"  # Placeholder
            user_context.token_expiry = datetime.now() + timedelta(hours=1)
        
        return engine
    
    def _authenticate_oauth(self, user_context: UserContext) -> Engine:
        """
        Authenticate using OAuth token.
        
        This would integrate with your OAuth provider.
        """
        logger.info("Authenticating with OAuth token...")
        
        # In production, you'd get the OAuth token from your IDP
        # For POC, we'll simulate this
        oauth_token = self._get_oauth_token(user_context)
        
        conn_params = {
            'user': user_context.snowflake_username,
            'account': self.account.replace('.snowflakecomputing.com', ''),
            'authenticator': 'oauth',
            'token': oauth_token,
            'warehouse': self.warehouse,
            'database': self.database,
            'schema': self.schema,
            'role': user_context.snowflake_role
        }
        
        conn_params = {k: v for k, v in conn_params.items() if v is not None}
        
        engine = create_engine(
            'snowflake://',
            connect_args=conn_params,
            echo=False
        )
        
        return engine
    
    def _get_oauth_token(self, user_context: UserContext) -> str:
        """
        Get OAuth token from IDP.
        
        In production, this would:
        1. Exchange IDP token for Snowflake OAuth token
        2. Use refresh tokens for long-lived sessions
        """
        # Placeholder for OAuth token exchange
        logger.info(f"Exchanging IDP token for Snowflake OAuth token for user: {user_context.email}")
        # In real implementation, call your OAuth provider's token endpoint
        return "mock_oauth_token"
    
    def _cache_session(self, user_context: UserContext):
        """Cache user session for reuse."""
        cache_file = self.cache_dir / f"{hashlib.md5(user_context.email.encode()).hexdigest()}.json"
        
        session_data = {
            'email': user_context.email,
            'snowflake_username': user_context.snowflake_username,
            'snowflake_role': user_context.snowflake_role,
            'session_token': user_context.session_token,
            'token_expiry': user_context.token_expiry.isoformat() if user_context.token_expiry else None
        }
        
        encrypted_data = self.cipher.encrypt(json.dumps(session_data).encode())
        with open(cache_file, 'wb') as f:
            f.write(encrypted_data)
        os.chmod(cache_file, 0o600)
    
    def _get_cached_token(self, email: str) -> Optional[Dict]:
        """Get cached token for user."""
        cache_file = self.cache_dir / f"{hashlib.md5(email.encode()).hexdigest()}.json"
        
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'rb') as f:
                encrypted_data = f.read()
            
            decrypted_data = self.cipher.decrypt(encrypted_data)
            session_data = json.loads(decrypted_data)
            
            if session_data.get('token_expiry'):
                session_data['token_expiry'] = datetime.fromisoformat(session_data['token_expiry'])
            
            return session_data
        except Exception as e:
            logger.warning(f"Failed to load cached token: {e}")
            return None
    
    def _is_token_valid(self, session_data: Dict) -> bool:
        """Check if cached token is still valid."""
        if not session_data.get('token_expiry'):
            return False
        
        expiry = session_data['token_expiry']
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry)
        
        return datetime.now() < expiry
    
    def _create_engine_with_token(self, user_context: UserContext, session_data: Dict) -> Engine:
        """Create engine using cached session."""
        # In production, you'd reuse the cached session/token
        # For POC, we'll create a new connection
        return self._authenticate_browser(user_context)


class QueryRunnerService:
    """
    Query Runner service that allows non-admin users to execute queries
    using their own SSO credentials and Snowflake roles.
    
    This is the core component that OpenMetadata would need to implement.
    """
    
    def __init__(
        self,
        sso_authenticator: SnowflakeSSOAuthenticator,
        admin_connection: Optional[Engine] = None,
        max_connections_per_user: int = 3,
        connection_ttl_minutes: int = 30
    ):
        """
        Initialize Query Runner service.
        
        Args:
            sso_authenticator: SSO authenticator instance
            admin_connection: Optional admin connection for metadata operations
            max_connections_per_user: Maximum concurrent connections per user
            connection_ttl_minutes: Connection TTL in minutes
        """
        self.sso_auth = sso_authenticator
        self.admin_connection = admin_connection
        self.max_connections_per_user = max_connections_per_user
        self.connection_ttl = timedelta(minutes=connection_ttl_minutes)
        
        # Connection pool per user
        self.user_connections: Dict[str, Dict[str, Any]] = {}
        self.connection_lock = threading.Lock()
        
        # Query execution thread pool
        self.executor = ThreadPoolExecutor(max_workers=10)
    
    def get_user_connection(self, user_context: UserContext) -> Engine:
        """
        Get or create a connection for the user.
        
        Args:
            user_context: User context with SSO info
        
        Returns:
            SQLAlchemy engine for the user
        """
        email = user_context.email
        
        with self.connection_lock:
            # Check if user has an active connection
            if email in self.user_connections:
                conn_info = self.user_connections[email]
                
                # Check if connection is still valid
                if datetime.now() < conn_info['expiry']:
                    logger.info(f"Reusing existing connection for user: {email}")
                    conn_info['last_used'] = datetime.now()
                    return conn_info['engine']
                else:
                    logger.info(f"Connection expired for user: {email}")
                    self._close_user_connection(email)
            
            # Create new SSO connection
            logger.info(f"Creating new SSO connection for user: {email}")
            engine = self.sso_auth.authenticate_user_sso(user_context)
            
            # Store connection info
            self.user_connections[email] = {
                'engine': engine,
                'created': datetime.now(),
                'last_used': datetime.now(),
                'expiry': datetime.now() + self.connection_ttl,
                'role': user_context.snowflake_role
            }
            
            return engine
    
    def execute_query(
        self,
        query: str,
        user_context: UserContext,
        limit: int = 1000,
        timeout_seconds: int = 30
    ) -> Dict[str, Any]:
        """
        Execute a query on behalf of a user using their SSO credentials.
        
        Args:
            query: SQL query to execute
            user_context: User context with SSO info
            limit: Maximum rows to return
            timeout_seconds: Query timeout
        
        Returns:
            Query results and metadata
        """
        start_time = time.time()
        
        try:
            # Get user's connection
            engine = self.get_user_connection(user_context)
            
            # Add safety limits to query
            safe_query = self._make_query_safe(query, limit)
            
            # Execute query with user's permissions
            with engine.connect() as conn:
                # Set query tag for tracking
                conn.execute(text(f"ALTER SESSION SET QUERY_TAG = 'QueryRunner_User:{user_context.email}'"))
                
                # Set query timeout
                conn.execute(text(f"ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = {timeout_seconds}"))
                
                # Execute the query
                result = conn.execute(text(safe_query))
                
                # Fetch results
                columns = list(result.keys())
                rows = []
                for row in result.fetchall():
                    rows.append(dict(zip(columns, row)))
                    if len(rows) >= limit:
                        break
                
                execution_time = time.time() - start_time
                
                return {
                    'success': True,
                    'user': user_context.email,
                    'role': user_context.snowflake_role,
                    'columns': columns,
                    'rows': rows,
                    'row_count': len(rows),
                    'execution_time': f"{execution_time:.2f}s",
                    'limited': len(rows) == limit
                }
                
        except Exception as e:
            logger.error(f"Query execution failed for user {user_context.email}: {e}")
            return {
                'success': False,
                'user': user_context.email,
                'error': str(e),
                'execution_time': f"{time.time() - start_time:.2f}s"
            }
    
    def _make_query_safe(self, query: str, limit: int) -> str:
        """
        Add safety measures to the query.
        
        Args:
            query: Original query
            limit: Row limit
        
        Returns:
            Safe query with limits
        """
        query = query.strip().rstrip(';')
        
        # Check if query already has LIMIT
        if 'LIMIT' not in query.upper():
            query = f"{query} LIMIT {limit}"
        
        return query
    
    def _close_user_connection(self, email: str):
        """Close a user's connection."""
        if email in self.user_connections:
            try:
                conn_info = self.user_connections[email]
                conn_info['engine'].dispose()
                logger.info(f"Closed connection for user: {email}")
            except Exception as e:
                logger.error(f"Error closing connection: {e}")
            finally:
                del self.user_connections[email]
    
    def cleanup_expired_connections(self):
        """Clean up expired connections."""
        with self.connection_lock:
            expired_users = []
            
            for email, conn_info in self.user_connections.items():
                if datetime.now() > conn_info['expiry']:
                    expired_users.append(email)
            
            for email in expired_users:
                self._close_user_connection(email)
                logger.info(f"Cleaned up expired connection for: {email}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get statistics about active connections."""
        with self.connection_lock:
            stats = {
                'active_users': len(self.user_connections),
                'connections': []
            }
            
            for email, conn_info in self.user_connections.items():
                stats['connections'].append({
                    'user': email,
                    'role': conn_info['role'],
                    'created': conn_info['created'].isoformat(),
                    'last_used': conn_info['last_used'].isoformat(),
                    'expires': conn_info['expiry'].isoformat()
                })
            
            return stats


class UserRoleMapper:
    """
    Maps OpenMetadata users to Snowflake roles based on their groups/permissions.
    """
    
    def __init__(self, mapping_config: Dict[str, Any]):
        """
        Initialize role mapper.
        
        Args:
            mapping_config: Configuration for user to role mapping
        """
        self.mapping_config = mapping_config
        self.default_role = mapping_config.get('default_role', 'PUBLIC')
    
    def get_user_context(self, omd_user: Dict[str, Any]) -> UserContext:
        """
        Map OpenMetadata user to Snowflake user context.
        
        Args:
            omd_user: OpenMetadata user object
        
        Returns:
            UserContext with Snowflake mapping
        """
        email = omd_user['email']
        
        # Map email to Snowflake username
        snowflake_username = self._get_snowflake_username(email)
        
        # Map user groups to Snowflake role
        snowflake_role = self._get_snowflake_role(omd_user)
        
        return UserContext(
            email=email,
            snowflake_username=snowflake_username,
            snowflake_role=snowflake_role
        )
    
    def _get_snowflake_username(self, email: str) -> str:
        """
        Map email to Snowflake username.
        
        In production, this could:
        1. Use the email directly (if SSO is configured)
        2. Look up in a mapping table
        3. Transform based on rules (e.g., remove domain)
        """
        # For SSO, typically the email is the username
        return email.upper()
    
    def _get_snowflake_role(self, omd_user: Dict[str, Any]) -> str:
        """
        Map user groups/teams to Snowflake role.
        
        Args:
            omd_user: OpenMetadata user with groups/teams
        
        Returns:
            Snowflake role name
        """
        # Example mapping logic
        user_teams = omd_user.get('teams', [])
        
        # Priority-based role assignment
        if 'data-engineers' in user_teams:
            return 'DATA_ENGINEER_ROLE'
        elif 'data-analysts' in user_teams:
            return 'DATA_ANALYST_ROLE'
        elif 'data-scientists' in user_teams:
            return 'DATA_SCIENTIST_ROLE'
        else:
            return self.default_role


def test_sso_authentication():
    """Test SSO authentication flow."""
    print("\n" + "="*60)
    print("Testing Snowflake SSO Authentication")
    print("="*60 + "\n")
    
    # Configuration
    config = {
        'account': input("Enter Snowflake account (e.g., xy12345.us-east-1.aws): "),
        'warehouse': input("Enter warehouse name: "),
        'database': input("Enter database (optional): ") or None,
        'schema': input("Enter schema (optional): ") or None
    }
    
    # Initialize SSO authenticator
    sso_auth = SnowflakeSSOAuthenticator(
        account=config['account'],
        warehouse=config['warehouse'],
        database=config['database'],
        schema=config['schema'],
        authenticator='externalbrowser'
    )
    
    # Create user context
    user_email = input("Enter your email: ")
    user_context = UserContext(
        email=user_email,
        snowflake_username=user_email.upper(),
        snowflake_role=input("Enter Snowflake role (optional): ") or None
    )
    
    try:
        # Test SSO authentication
        print("\n🔐 Initiating SSO authentication...")
        print("A browser window will open for authentication.")
        print("Please complete the SSO login process.\n")
        
        engine = sso_auth.authenticate_user_sso(user_context)
        
        # Test query execution
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT 
                    CURRENT_USER() as user,
                    CURRENT_ROLE() as role,
                    CURRENT_WAREHOUSE() as warehouse,
                    CURRENT_DATABASE() as database
            """))
            
            for row in result:
                print("✅ SSO Authentication Successful!")
                print(f"   User: {row[0]}")
                print(f"   Role: {row[1]}")
                print(f"   Warehouse: {row[2]}")
                print(f"   Database: {row[3]}")
        
        return engine
        
    except Exception as e:
        print(f"❌ SSO authentication failed: {e}")
        return None


def test_query_runner():
    """Test the Query Runner service."""
    print("\n" + "="*60)
    print("Testing Query Runner Service")
    print("="*60 + "\n")
    
    # Setup SSO authenticator
    config = {
        'account': input("Enter Snowflake account: "),
        'warehouse': input("Enter warehouse: ")
    }
    
    sso_auth = SnowflakeSSOAuthenticator(
        account=config['account'],
        warehouse=config['warehouse'],
        authenticator='externalbrowser'
    )
    
    # Initialize Query Runner
    query_runner = QueryRunnerService(sso_auth)
    
    # Simulate multiple users
    users = [
        {
            'email': 'analyst@company.com',
            'teams': ['data-analysts'],
            'query': 'SELECT COUNT(*) as table_count FROM INFORMATION_SCHEMA.TABLES'
        },
        {
            'email': 'engineer@company.com',
            'teams': ['data-engineers'],
            'query': 'SHOW DATABASES'
        }
    ]
    
    # Role mapper
    role_mapper = UserRoleMapper({
        'default_role': 'PUBLIC'
    })
    
    for user_data in users:
        print(f"\n--- Testing for user: {user_data['email']} ---")
        
        # Get user context
        user_context = role_mapper.get_user_context(user_data)
        
        # Execute query
        result = query_runner.execute_query(
            query=user_data['query'],
            user_context=user_context,
            limit=10
        )
        
        if result['success']:
            print(f"✅ Query executed successfully")
            print(f"   Role used: {result['role']}")
            print(f"   Rows returned: {result['row_count']}")
            print(f"   Execution time: {result['execution_time']}")
            
            if result['rows']:
                print(f"   Sample result: {result['rows'][0]}")
        else:
            print(f"❌ Query failed: {result['error']}")
    
    # Show connection stats
    stats = query_runner.get_connection_stats()
    print(f"\n📊 Connection Statistics:")
    print(f"   Active users: {stats['active_users']}")
    for conn in stats['connections']:
        print(f"   - {conn['user']}: Role={conn['role']}, Expires={conn['expires']}")


def main():
    """Main entry point for POC."""
    print("\n" + "="*80)
    print("Snowflake SSO Authentication & Query Runner POC")
    print("="*80)
    print("\nThis POC demonstrates:")
    print("1. Browser-based SSO authentication for Snowflake")
    print("2. User context-based connections for non-admin users")
    print("3. Query execution with user's own credentials and roles")
    print("4. Connection pooling and session management")
    print("\nSimilar to Atlan's approach for SSO-based data querying")
    print("="*80 + "\n")
    
    choice = input("""
Choose an option:
1. Test SSO Authentication
2. Test Query Runner Service
3. Run Full Demo

Enter choice (1-3): """)
    
    if choice == '1':
        test_sso_authentication()
    elif choice == '2':
        test_query_runner()
    elif choice == '3':
        engine = test_sso_authentication()
        if engine:
            test_query_runner()
    else:
        print("Invalid choice")


if __name__ == "__main__":
    main()