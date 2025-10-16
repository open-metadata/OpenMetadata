# ThirdEye Database Migrations & Data Loading

## Overview

This document describes the database schema, migrations, and data loading utilities for ThirdEye Analytics Service.

---

## Migration Files (Ordered)

### 001_init.sql
**Basic tables**: `health_score_history`, `action_items`

Simple tables for initial testing.

### 002_fact_table.sql
**Fact table**: `fact_datalake_table_usage_inventory`

Daily snapshots of table usage from data platforms (Snowflake, Databricks, etc.).

**Key features**:
- Generated FQN column
- 30-day rolling metrics (users, queries)
- Storage and access metrics
- Supports multi-service (SNOWFLAKE, DATABRICKS, BIGQUERY)

### 003_campaigns_decisions.sql
**Core tables**:
- `opportunity_campaigns` - Groups optimization opportunities
- `entity_decisions` - Audit trail for decisions
- `notification_engagement_tracking` - User engagement
- `cost_tracking` - Savings measurement

### 004_detection_rules_config.sql
**Configuration tables**:
- `detection_rules` - Automated detection rules
- `cost_basis_config` - Pricing configuration

**Includes**: Default Snowflake pricing ($18/TB storage, $2/credit compute)

### 005_views.sql
**Analytical views**:
- `v_table_purge_scores` - Calculates purge scores for tables
- `v_datalake_health_metrics` - Overall health score (ZI Score)
- `v_campaign_summary` - Campaign summaries
- `v_savings_summary` - Monthly savings summaries

**ZI Score Calculation**:
- 40% Utilization Rate (active vs total tables)
- 35% Storage Efficiency (active vs waste storage)
- 25% Access Freshness (recently accessed tables)

### 006_seed_detection_rules.sql
**Sample detection rules**:
- Tables not accessed 30-60 days
- Tables not accessed 60-90 days
- Tables not accessed 90+ days
- Zombie tables (no activity)

---

## Data Loading Utilities

### 1. Load CSV Data

Load table usage data from CSV files:

```bash
cd thirdeye-py-service

# Load CSV data into fact table
python -m thirdeye.seeds.data_loader path/to/table_usage.csv

# Expected CSV columns:
# DATABASE_NAME, DB_SCHEMA, TABLE_NAME, TABLE_TYPE,
# ROLL_30D_TBL_UC, ROLL_30D_SCHEMA_UC, ROLL_30D_DB_UC, ROLL_30D_TBL_QC,
# CREATE_DATE, LAST_ACCESSED_DATE, LAST_REFRESHED_DATE, SIZE_GB,
# RUN_DATE, START_DATE, END_DATE, ROLL_30D_START_DATE,
# SERVICE, CREATED_BY
```

**What it does**:
1. Loads CSV data using pandas
2. Cleans and validates data
3. Inserts into `fact_datalake_table_usage_inventory`
4. Updates health snapshot automatically

### 2. Load Techniques Catalog

Load optimization techniques from JSON:

```bash
# Load techniques from JSON
python -m thirdeye.seeds.load_techniques path/to/techniques_clean.json

# Or use default location
python -m thirdeye.seeds.load_techniques
```

**What it does**:
1. Loads techniques catalog from JSON
2. Inserts into `techniques` table
3. Shows statistics by category/impact

---

## Database Schema (Complete)

### Fact Tables

#### fact_datalake_table_usage_inventory
Daily snapshots of table metrics from data platforms.

```sql
- FQN (generated): service-database-schema-table
- Usage metrics: ROLL_30D_TBL_UC, ROLL_30D_TBL_QC
- Dates: CREATE_DATE, LAST_ACCESSED_DATE, LAST_REFRESHED_DATE
- Storage: SIZE_GB
- Service: SNOWFLAKE, DATABRICKS, etc.
```

### Campaign Tables

#### opportunity_campaigns
Groups of optimization opportunities.

```sql
- campaign_id (PK)
- fqn_list (JSON array)
- opportunity_type: UNUSED_TABLE, OVERSIZED_WAREHOUSE, etc.
- projected_savings, current_monthly_cost
- status: OPEN, IN_REVIEW, COMPLETED, EXPIRED
```

#### entity_decisions
Audit trail for optimization decisions.

```sql
- decision_id (PK)
- campaign_id (FK)
- fqn, final_decision (DELETE, ARCHIVE, KEEP, OPTIMIZE, DEFER)
- decision_date, created_by
```

#### cost_tracking
Tracks realized savings over time.

```sql
- tracking_id (PK)
- decision_id (FK), campaign_id (FK)
- baseline_cost, current_cost
- realized_savings (generated column)
```

### Configuration Tables

#### detection_rules
Automated detection rules configuration.

```sql
- rule_id (PK)
- rule_sql (detection query)
- threshold_config (JSON)
- grouping_strategy: BY_SCHEMA, BY_PATTERN, BY_AGE
```

#### cost_basis_config
Pricing configuration for cost calculations.

```sql
- service, resource_type
- cost_metric, unit_cost
- tier_name (volume discounts)
```

#### techniques
Catalog of optimization techniques.

```sql
- id (PK)
- title, category, subcategory
- estimated_savings_pct, effort_minutes
- how_to_implement, code_snippet
```

### Analytics Tables

#### health_score_history
Historical health scores for trending.

```sql
- id (PK)
- captured_at, score
- meta (JSON with breakdown and stats)
```

#### action_items
Cost optimization action items.

```sql
- id (PK)
- title, status (OPEN, IN_PROGRESS, DONE)
- estimated_savings_usd
```

---

## Views

### v_table_purge_scores

Calculates purge priority for each table based on:
- Size score (10% weight)
- Access staleness (70% weight) - **primary driver**
- Usage frequency (10% weight)
- Refresh waste (5% weight)
- User engagement (5% weight)

**Output**: purge_score (0-10), recommendation (EXCELLENT_CANDIDATE, GOOD_CANDIDATE, REVIEW_REQUIRED, KEEP)

### v_datalake_health_metrics

Calculates overall data lake health score (ZI Score):

**Formula**:
```
Health Score = (utilization_rate × 0.40) + 
               (storage_efficiency × 0.35) + 
               (access_freshness × 0.25)
```

**Where**:
- `utilization_rate` = active_tables / total_tables * 100
- `storage_efficiency` = active_storage / total_storage * 100
- `access_freshness` = recently_accessed_tables / total_tables * 100

**Classification**:
- ≥80: EXCELLENT
- ≥60: GOOD
- ≥40: FAIR
- ≥20: POOR
- <20: CRITICAL

### v_campaign_summary

Aggregates campaign metrics with decision counts.

### v_savings_summary

Monthly savings by service.

---

## Data Flow

```
1. CSV Data → fact_datalake_table_usage_inventory
              ↓
2. Views calculate → v_table_purge_scores
              ↓
3. View aggregates → v_datalake_health_metrics (ZI Score)
              ↓
4. API returns → Dashboard endpoints
              ↓
5. UI displays → ZIScoreGauge component
```

---

## Example Workflow

### Load Sample Data

```bash
cd thirdeye-py-service

# 1. Ensure service is running (creates schema + tables)
uvicorn thirdeye.app:app --port 8586

# 2. Load table usage data
python -m thirdeye.seeds.data_loader ../react-app-old/data/table_usage.csv

# 3. Load techniques catalog  
python -m thirdeye.seeds.load_techniques ../react-app-old/thirdeye/setup/techniques_clean.json

# 4. Verify data
curl http://localhost:8586/api/v1/thirdeye/dashboard/zi-score
```

### Manual Verification

```sql
-- Check fact table
SELECT COUNT(*) FROM thirdeye.fact_datalake_table_usage_inventory;

-- Check purge scores view
SELECT FQN, purge_score, recommendation 
FROM thirdeye.v_table_purge_scores 
ORDER BY purge_score DESC 
LIMIT 10;

-- Check health metrics
SELECT health_score, health_status, total_tables, monthly_savings_opportunity_usd
FROM thirdeye.v_datalake_health_metrics;

-- Check techniques
SELECT category, COUNT(*) as count
FROM thirdeye.techniques
GROUP BY category;
```

---

## Troubleshooting

### Views return empty

**Problem**: No data in `fact_datalake_table_usage_inventory`

**Solution**:
```bash
# Load sample data
python -m thirdeye.seeds.data_loader sample_data.csv
```

### Purge score calculation errors

**Problem**: Division by zero or NULL values

**Solution**: Views handle NULL values with `COALESCE()` and `NULLIF()`

### Migrations fail

**Problem**: Foreign key constraints

**Solution**: Run migrations in order (001 → 002 → 003 → 004 → 005 → 006)

---

## References

**Old app files**:
- `thirdeye_db_ddl.sql` → Migrated to 002-004
- `scores_init.sql` → Migrated to 005
- `sample_datasets_ingestion.sql` → Migrated to 006
- `techniques_clean.json` → Loaded via load_techniques.py
- `data_load.ipynb` → Converted to data_loader.py

---

**Complete schema ready for production!** 🚀

