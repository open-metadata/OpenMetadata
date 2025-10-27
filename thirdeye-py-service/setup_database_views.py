"""
Setup script to create ThirdEye database views in MySQL.

This script reads the SQL file and executes it to create the required views:
- v_table_purge_scores
- v_datalake_health_metrics
"""

import asyncio
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from loguru import logger

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from thirdeye.config import settings


async def create_views():
    """Create database views from SQL file."""
    
    # Read SQL file
    sql_file = Path(__file__).parent / "../thirdeye-ui/react-app-old/thirdeye/setup/scores_init.sql"
    
    if not sql_file.exists():
        logger.error(f"SQL file not found: {sql_file}")
        return False
    
    logger.info(f"Reading SQL file: {sql_file}")
    sql_content = sql_file.read_text()
    
    # Split into individual statements
    statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
    
    logger.info(f"Found {len(statements)} SQL statements")
    
    # Connect to database
    logger.info(f"Connecting to {settings.om_mysql_host}:{settings.om_mysql_port}/{settings.om_mysql_db}")
    
    # Use pymysql URL for executing raw SQL
    engine = create_async_engine(
        settings.om_mysql_url,
        echo=False,
        pool_pre_ping=True
    )
    
    try:
        async with engine.begin() as conn:
            success_count = 0
            error_count = 0
            
            for i, statement in enumerate(statements, 1):
                # Skip empty statements and comments
                if not statement or statement.startswith('--'):
                    continue
                
                try:
                    logger.info(f"Executing statement {i}/{len(statements)}: {statement[:50]}...")
                    await conn.execute(text(statement))
                    success_count += 1
                    logger.success(f"✅ Statement {i} executed successfully")
                except Exception as e:
                    error_count += 1
                    # Check if it's just a "view already exists" error
                    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
                        logger.warning(f"⚠️  Statement {i}: View already exists (skipping)")
                    else:
                        logger.error(f"❌ Statement {i} failed: {e}")
            
            logger.info(f"Execution complete: {success_count} succeeded, {error_count} errors/skipped")
            
        # Verify views were created
        logger.info("Verifying views...")
        
        async with engine.connect() as conn:
            from sqlalchemy import text
            
            # Check for v_datalake_health_metrics
            result = await conn.execute(text("SHOW TABLES LIKE 'v_datalake_health_metrics'"))
            if result.fetchone():
                logger.success("✅ v_datalake_health_metrics view exists")
            else:
                logger.warning("⚠️  v_datalake_health_metrics view not found")
            
            # Check for v_table_purge_scores  
            result = await conn.execute(text("SHOW TABLES LIKE 'v_table_purge_scores'"))
            if result.fetchone():
                logger.success("✅ v_table_purge_scores view exists")
            else:
                logger.warning("⚠️  v_table_purge_scores view not found")
        
        logger.success("🎉 Database setup complete!")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create views: {e}")
        return False
    finally:
        await engine.dispose()


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("ThirdEye Database Views Setup")
    logger.info("=" * 60)
    logger.info("")
    
    success = asyncio.run(create_views())
    
    logger.info("")
    if success:
        logger.success("✅ Setup completed successfully!")
        logger.info("")
        logger.info("You can now restart the ThirdEye service to use real data.")
        sys.exit(0)
    else:
        logger.error("❌ Setup failed!")
        logger.info("")
        logger.info("Check the errors above and try again.")
        sys.exit(1)

