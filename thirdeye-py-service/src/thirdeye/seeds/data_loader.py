#!/usr/bin/env python
"""
Data loader utility for ThirdEye fact tables.
Loads CSV data into fact_datalake_table_usage_inventory.

Based on: react-app-old/thirdeye/setup/data_load.ipynb
"""

import pandas as pd
import asyncio
from pathlib import Path
from sqlalchemy import text
from loguru import logger
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from thirdeye.db import get_session
from thirdeye.config import get_settings


async def load_csv_to_fact_table(csv_file: str) -> int:
    """
    Load CSV data into fact_datalake_table_usage_inventory table.
    
    Args:
        csv_file: Path to CSV file with table usage data
        
    Returns:
        Number of rows loaded
        
    Expected CSV columns:
        DATABASE_NAME, DB_SCHEMA, TABLE_NAME, TABLE_TYPE,
        ROLL_30D_TBL_UC, ROLL_30D_SCHEMA_UC, ROLL_30D_DB_UC, ROLL_30D_TBL_QC,
        CREATE_DATE, LAST_ACCESSED_DATE, LAST_REFRESHED_DATE, SIZE_GB,
        RUN_DATE, START_DATE, END_DATE, ROLL_30D_START_DATE,
        SERVICE, CREATED_BY
    """
    logger.info(f"Loading data from: {csv_file}")
    
    # Load CSV file
    df = pd.read_csv(csv_file)
    logger.info(f"Loaded {len(df)} rows from CSV")
    
    # Add SERVICE and CREATED_BY if not present
    if 'SERVICE' not in df.columns:
        df['SERVICE'] = 'snowflake'
    if 'CREATED_BY' not in df.columns:
        df['CREATED_BY'] = 'system'
    
    # Fill NaN values for dates
    date_columns = ['CREATE_DATE', 'LAST_ACCESSED_DATE', 'LAST_REFRESHED_DATE', 
                    'RUN_DATE', 'START_DATE', 'END_DATE', 'ROLL_30D_START_DATE']
    for col in date_columns:
        if col in df.columns:
            df[col] = df[col].fillna('2024-01-01')
    
    # Fill NaN numeric values with 0
    numeric_columns = ['ROLL_30D_TBL_UC', 'ROLL_30D_SCHEMA_UC', 'ROLL_30D_DB_UC', 
                      'ROLL_30D_TBL_QC', 'SIZE_GB']
    for col in numeric_columns:
        if col in df.columns:
            df[col] = df[col].fillna(0)
    
    logger.info("Data cleaned and prepared for insertion")
    
    # Insert data using SQLAlchemy
    async with get_session() as session:
        try:
            # Prepare INSERT statement
            insert_sql = text("""
                INSERT INTO fact_datalake_table_usage_inventory (
                    DATABASE_NAME, DB_SCHEMA, TABLE_NAME, TABLE_TYPE,
                    ROLL_30D_TBL_UC, ROLL_30D_SCHEMA_UC, ROLL_30D_DB_UC, ROLL_30D_TBL_QC,
                    CREATE_DATE, LAST_ACCESSED_DATE, LAST_REFRESHED_DATE, SIZE_GB,
                    RUN_DATE, START_DATE, END_DATE, ROLL_30D_START_DATE,
                    SERVICE, CREATED_BY
                ) VALUES (
                    :database_name, :db_schema, :table_name, :table_type,
                    :roll_30d_tbl_uc, :roll_30d_schema_uc, :roll_30d_db_uc, :roll_30d_tbl_qc,
                    :create_date, :last_accessed_date, :last_refreshed_date, :size_gb,
                    :run_date, :start_date, :end_date, :roll_30d_start_date,
                    :service, :created_by
                )
                ON DUPLICATE KEY UPDATE
                    ROLL_30D_TBL_UC = VALUES(ROLL_30D_TBL_UC),
                    ROLL_30D_TBL_QC = VALUES(ROLL_30D_TBL_QC),
                    LAST_ACCESSED_DATE = VALUES(LAST_ACCESSED_DATE),
                    SIZE_GB = VALUES(SIZE_GB)
            """)
            
            # Batch insert (1000 rows at a time)
            batch_size = 1000
            total_inserted = 0
            
            for i in range(0, len(df), batch_size):
                batch = df[i:i+batch_size]
                records = batch.to_dict('records')
                
                # Convert column names to lowercase for SQL params
                records_clean = [
                    {k.lower(): v for k, v in record.items()}
                    for record in records
                ]
                
                await session.execute(insert_sql, records_clean)
                total_inserted += len(records_clean)
                
                if total_inserted % 10000 == 0:
                    logger.info(f"Inserted {total_inserted} / {len(df)} rows...")
            
            await session.commit()
            logger.success(f"✅ Successfully loaded {total_inserted} rows")
            return total_inserted
            
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            await session.rollback()
            raise


async def update_health_snapshot():
    """
    Update health score snapshot after loading new data.
    Queries v_datalake_health_metrics and stores in health_score_history.
    """
    logger.info("Updating health snapshot...")
    
    async with get_session() as session:
        try:
            # Get current health metrics from view
            result = await session.execute(text("""
                SELECT 
                    health_score,
                    health_status,
                    utilization_rate,
                    storage_efficiency,
                    access_freshness,
                    total_tables,
                    active_tables,
                    total_storage_tb,
                    waste_storage_tb,
                    monthly_savings_opportunity_usd,
                    zombie_tables
                FROM v_datalake_health_metrics
                LIMIT 1
            """))
            
            row = result.fetchone()
            
            if not row:
                logger.warning("No data in v_datalake_health_metrics view")
                return
            
            # Insert into health_score_history
            insert_sql = text("""
                INSERT INTO health_score_history (
                    captured_at, score, meta
                ) VALUES (
                    NOW(),
                    :score,
                    :meta
                )
            """)
            
            meta = {
                "breakdown": {
                    "storage": float(row[2] * 0.35) if row[2] else 0,  # utilization_rate * 40%
                    "compute": float(row[1] * 0.40) if row[1] else 0,  # storage_efficiency * 35%
                    "query": float(row[3] * 0.25) if row[3] else 0,    # access_freshness * 25%
                    "others": 0
                },
                "total_tables": int(row[5]) if row[5] else 0,
                "active_tables": int(row[6]) if row[6] else 0,
                "total_storage_tb": float(row[7]) if row[7] else 0,
                "waste_storage_tb": float(row[8]) if row[8] else 0,
                "monthly_savings_usd": float(row[9]) if row[9] else 0,
                "zombie_tables": int(row[10]) if row[10] else 0
            }
            
            import json
            await session.execute(insert_sql, {
                "score": int(row[0]) if row[0] else 0,
                "meta": json.dumps(meta)
            })
            
            await session.commit()
            logger.success(f"✅ Health snapshot updated: score={row[0]}")
            
        except Exception as e:
            logger.error(f"Error updating health snapshot: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    """
    Usage:
        python -m thirdeye.seeds.data_loader path/to/file.csv
    """
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python -m thirdeye.seeds.data_loader <csv_file>")
        print("Example: python -m thirdeye.seeds.data_loader ./data/table_usage.csv")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    if not Path(csv_file).exists():
        logger.error(f"File not found: {csv_file}")
        sys.exit(1)
    
    # Load data
    rows = asyncio.run(load_csv_to_fact_table(csv_file))
    
    # Update health snapshot
    asyncio.run(update_health_snapshot())
    
    logger.success(f"✅ Data load complete: {rows} rows loaded")

