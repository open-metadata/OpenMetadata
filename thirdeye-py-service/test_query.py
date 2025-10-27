"""Quick test to verify database queries are working."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from thirdeye.config import settings


async def test_queries():
    """Test actual database queries."""
    
    print("=" * 60)
    print("ThirdEye Database Query Test")
    print("=" * 60)
    print("")
    
    # Create engine
    print(f"Connecting to: {settings.te_mysql_host}:{settings.te_mysql_port}/{settings.te_mysql_db}")
    print(f"User: {settings.te_mysql_user}")
    print("")
    
    engine = create_async_engine(settings.te_mysql_url, echo=False)
    
    try:
        async with engine.connect() as conn:
            # Test 1: Check if view exists
            print("Test 1: Checking if view exists...")
            result = await conn.execute(text("SHOW TABLES LIKE 'v_datalake_health_metrics'"))
            if result.fetchone():
                print("✅ View v_datalake_health_metrics EXISTS")
            else:
                print("❌ View v_datalake_health_metrics NOT FOUND")
                return
            
            print("")
            
            # Test 2: Get row count
            print("Test 2: Checking row count...")
            result = await conn.execute(text("SELECT COUNT(*) as cnt FROM v_datalake_health_metrics"))
            count = result.fetchone()[0]
            print(f"📊 Rows in view: {count}")
            
            if count == 0:
                print("⚠️  View has NO DATA - checking base table...")
                
                # Check if fact table exists
                result = await conn.execute(text("SHOW TABLES LIKE 'fact_datalake_table_usage_inventory'"))
                if result.fetchone():
                    result = await conn.execute(text("SELECT COUNT(*) as cnt FROM fact_datalake_table_usage_inventory"))
                    base_count = result.fetchone()[0]
                    print(f"   Base table has {base_count} rows")
                else:
                    print("   ❌ Base table 'fact_datalake_table_usage_inventory' not found")
                
                return
            
            print("")
            
            # Test 3: Get actual data
            print("Test 3: Fetching actual data from view...")
            query = text("""
                SELECT 
                    health_score,
                    health_status,
                    utilization_rate,
                    storage_efficiency,
                    access_freshness,
                    total_tables,
                    active_tables,
                    inactive_tables,
                    total_storage_tb,
                    waste_storage_tb,
                    waste_percentage,
                    total_monthly_cost_usd,
                    monthly_savings_opportunity_usd,
                    annual_savings_opportunity_usd,
                    zombie_tables,
                    zombie_percentage,
                    stale_tables,
                    stale_percentage,
                    calculated_at
                FROM v_datalake_health_metrics
                LIMIT 1
            """)
            
            result = await conn.execute(query)
            row = result.fetchone()
            
            if row:
                print("✅ Data retrieved successfully!")
                print("")
                print("Data values:")
                print(f"  Health Score: {row[0]}")
                print(f"  Health Status: {row[1]}")
                print(f"  Utilization Rate: {row[2]}%")
                print(f"  Storage Efficiency: {row[3]}%")
                print(f"  Access Freshness: {row[4]}%")
                print(f"  Total Tables: {row[5]}")
                print(f"  Active Tables: {row[6]}")
                print(f"  Inactive Tables: {row[7]}")
                print(f"  Total Storage (TB): {row[8]}")
                print(f"  Waste Storage (TB): {row[9]}")
                print(f"  Waste %: {row[10]}%")
                print(f"  Monthly Cost: ${row[11]}")
                print(f"  Monthly Savings: ${row[12]}")
                print(f"  Annual Savings: ${row[13]}")
                print(f"  Zombie Tables: {row[14]}")
                print(f"  Zombie %: {row[15]}%")
                print(f"  Stale Tables: {row[16]}")
                print(f"  Stale %: {row[17]}%")
                print(f"  Calculated At: {row[18]}")
            else:
                print("❌ No data returned from view")
            
    finally:
        await engine.dispose()
    
    print("")
    print("=" * 60)
    print("Test Complete")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_queries())

