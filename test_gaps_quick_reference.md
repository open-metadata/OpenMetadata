# Test Connection Gaps - Quick Reference Guide

## Risk Assessment Matrix

```
┌────────────────────┬──────────────┬──────────────┬─────────────────────┐
│ Connector          │ Coverage %   │ Critical Gap │ Recommended Action  │
├────────────────────┼──────────────┼──────────────┼─────────────────────┤
│ GCS                │ 75%          │ LOW ✅       │ Review next quarter │
│ S3                 │ 60%          │ MEDIUM 🟡    │ Add download tests  │
│ Kafka              │ 45%          │ MEDIUM 🟡    │ Test describe, msgs │
│ Redpanda           │ 45%          │ MEDIUM 🟡    │ Same as Kafka       │
│ Airflow            │ 40%          │ HIGH 🔴      │ IMMEDIATE           │
│ DBT Cloud          │ 35%          │ HIGH 🔴      │ IMMEDIATE           │
│ Airbyte            │ 30%          │ HIGH 🔴      │ IMMEDIATE           │
│ SageMaker          │ 30%          │ HIGH 🔴      │ IMMEDIATE           │
│ Amundsen           │ 30%          │ HIGH 🔴      │ NEXT SPRINT         │
│ Atlas              │ 30%          │ HIGH 🔴      │ NEXT SPRINT         │
│ Fivetran           │ 25%          │ HIGH 🔴      │ IMMEDIATE           │
│ Alation            │ 25%          │ HIGH 🔴      │ NEXT SPRINT         │
│ MLflow             │ 25%          │ HIGH 🔴      │ NEXT SPRINT         │
│ Kinesis            │ 25%          │ HIGH 🔴      │ IMMEDIATE           │
│ Dagster            │ 20%          │ HIGH 🔴      │ IMMEDIATE           │
│ ADLS               │ 20%          │ HIGH 🔴      │ IMMEDIATE           │
└────────────────────┴──────────────┴──────────────┴─────────────────────┘
```

---

## What Gets Tested vs. What Doesn't

### PIPELINE CONNECTORS

#### Airflow
```
✅ TESTED:
   - Engine connectivity
   - SerializedDagModel table access
   - Task details from serialized DAG

❌ NOT TESTED (CRITICAL):
   - DagRun table access → Pipeline status extraction FAILS
   - TaskInstance table access → Task status FAILS
   - DagTag table access → Tags won't be ingested
```

#### DBT Cloud
```
✅ TESTED:
   - Generic job listing
   - Generic run listing

❌ NOT TESTED (CRITICAL):
   - Specific job_id accessibility → Mid-run failures
   - Model dependency API (GraphQL) → Lineage extraction FAILS
```

#### Fivetran
```
✅ TESTED:
   - Group listing

❌ NOT TESTED (CRITICAL):
   - Connector listing → Empty ingestion
   - Schema details → Lineage extraction FAILS
   - Column lineage → Table-level lineage FAILS
```

#### Airbyte
```
✅ TESTED:
   - Workspace listing

❌ NOT TESTED (CRITICAL):
   - Connection listing → No pipelines discovered
   - Job listing → Job history unavailable
   - Source/destination details → Configuration missing
```

#### Dagster
```
✅ TESTED:
   - Basic GraphQL connectivity

❌ NOT TESTED (CRITICAL):
   - Repository accessibility → Discovery FAILS
   - Job/asset listing → Empty ingestion
   - Run history → Status tracking unavailable
```

---

### MESSAGING CONNECTORS

#### Kafka
```
✅ TESTED:
   - list_topics()
   - Schema Registry subjects (optional)

❌ NOT TESTED (CRITICAL):
   - Topic metadata (describe) → Partition info missing
   - Consumer group access → Lag monitoring impossible
   - Message consumption → Sampling unavailable
```

#### Kinesis
```
✅ TESTED:
   - list_streams()

❌ NOT TESTED (CRITICAL):
   - DescribeStream → No metadata (partitions, retention)
   - GetRecords → Sample data unavailable
   - CloudWatch metrics → Performance data missing
```

---

### ML MODEL CONNECTORS

#### MLflow
```
✅ TESTED:
   - search_registered_models()

❌ NOT TESTED (CRITICAL):
   - Model versions → Version history unavailable
   - Artifacts → Model inspection impossible
   - Runs/metrics → Model metrics not captured
```

#### SageMaker
```
✅ TESTED:
   - list_models()

❌ NOT TESTED (CRITICAL):
   - describe_model → No metadata
   - Training jobs → Lineage unavailable
   - Endpoints → Deployment info missing
```

---

### STORAGE CONNECTORS

#### S3
```
✅ TESTED:
   - list_buckets() / list_objects()
   - CloudWatch metrics

❌ NOT TESTED (CRITICAL):
   - GetObject → File sampling impossible
   - GetBucketLocation → Regional access may fail
   - KMS → Encrypted buckets may fail
```

#### GCS ✅ BEST COVERAGE
```
✅ TESTED:
   - list_buckets()
   - get_bucket()
   - list_blobs()
   - get_blob() (if exists)
   - CloudWatch metrics

⚠️ MINOR:
   - GetObject download not tested
```

#### ADLS
```
✅ TESTED:
   - list_containers()

❌ NOT TESTED (CRITICAL):
   - list_blobs → File enumeration FAILS
   - Blob read → File attributes unavailable
   - HNS support → Advanced features not detected
```

---

### METADATA CONNECTORS

#### Amundsen
```
✅ TESTED:
   - Generic Neo4j query

❌ NOT TESTED (CRITICAL):
   - Table nodes access → Discovery FAILS
   - Relationships → Lineage extraction FAILS
   - Attributes → Metadata unavailable
```

#### Atlas
```
✅ TESTED:
   - list_entities()

❌ NOT TESTED (CRITICAL):
   - Entity type filtering → Discovery may FAIL
   - Lineage relationships → Lineage extraction FAILS
   - Custom attributes → Metadata may be incomplete
```

#### Alation
```
✅ TESTED:
   - list_native_datasources()

❌ NOT TESTED (CRITICAL):
   - Search API → Discovery FAILS
   - Object details → No metadata
   - Lineage queries → Lineage extraction FAILS
```

---

## Impact by Feature

### Data Discovery
```
HIGH IMPACT:
- Airbyte (connection listing) → 0 pipelines discovered
- Fivetran (connector listing) → 0 pipelines discovered
- Kinesis (describe) → No stream metadata
- ADLS (blob listing) → No files found

MEDIUM IMPACT:
- Dagster (repo access) → Limited discovery
- Atlas (entity types) → Incomplete entities
```

### Lineage Extraction
```
COMPLETE FAILURE:
- Fivetran (schema/column lineage) → No lineage at all
- DBT Cloud (GraphQL) → No model dependencies
- Alation (search/lineage API) → No lineage

PARTIAL FAILURE:
- Airflow (lineage parser permissions) → May fail on some DAGs
- Amundsen (relationships) → Graph traversal impossible
```

### Metadata Quality
```
MISSING COMPLETELY:
- S3 (GetObject) → No file samples
- Kinesis (describe) → No partition info
- Kafka (describe) → No topic configuration
- SageMaker (describe) → No model details
- MLflow (versions/artifacts) → No version history

INCOMPLETE:
- ADLS (blob props) → No file attributes
- Airflow (DagRun) → No execution history
- Alation (search) → Limited discovery
```

---

## Quick Troubleshooting

### "Test passed but ingestion failed"

Likely causes (by connector):
- **Airflow**: Missing DagRun, TaskInstance, or DagTag permissions
- **Fivetran**: Missing connector or schema access
- **Airbyte**: Missing workspace permission or connection listing
- **DBT Cloud**: Job doesn't exist or GraphQL API unavailable
- **Kinesis**: Missing DescribeStream permission
- **ADLS**: Missing blob listing or read permission

### "Ingestion incomplete - missing data"

- **S3/GCS/ADLS**: Missing GetObject/read permissions → no file samples
- **Kafka**: Missing describe → no topic metadata
- **SageMaker/MLflow**: Missing detail queries → no model attributes
- **Atlas/Alation/Amundsen**: Missing entity type filters → incomplete discovery

---

## Implementation Priority (Suggested Order)

### PHASE 1 - CRITICAL (Sprint 1)
```
1. Airflow - DagRun, TaskInstance, DagTag tests
   Effort: Low | Impact: High
   
2. Fivetran - Connector + Lineage tests
   Effort: Low | Impact: High
   
3. DBT Cloud - Job validation + Lineage API test
   Effort: Low | Impact: High
   
4. ADLS - Blob listing + properties tests
   Effort: Low | Impact: High
   
5. Kinesis - Describe + GetRecords tests
   Effort: Low | Impact: High
   
6. Dagster - Repository + Job access tests
   Effort: Medium | Impact: High
```

### PHASE 2 - HIGH (Sprint 2)
```
1. Airbyte - Connection + Job listing tests
   Effort: Medium | Impact: High
   
2. Kafka - Describe + Consumer group tests
   Effort: Low | Impact: Medium
   
3. S3 - GetObject + KMS permission tests
   Effort: Low | Impact: Medium
   
4. MLflow - Versions + Artifacts tests
   Effort: Low | Impact: Medium
   
5. SageMaker - Describe + Training job tests
   Effort: Low | Impact: Medium
```

### PHASE 3 - MEDIUM (Sprint 3-4)
```
1. Amundsen - Table nodes + Relationships tests
   Effort: Medium | Impact: Medium
   
2. Atlas - Entity types + Lineage tests
   Effort: Medium | Impact: Medium
   
3. Alation - Search + Details tests
   Effort: Medium | Impact: Medium
   
4. Redpanda - Same as Kafka
   Effort: Low | Impact: Medium
   
5. GCS - GetObject download test (minor enhancement)
   Effort: Low | Impact: Low
```

---

## Test Count Summary

### Before Improvements
```
Total test steps: 21
Average per connector: 1.3
Range: 1-3 steps
```

### After Recommended Fixes
```
Total test steps: ~50-60 (estimated)
Average per connector: 3-4
Range: 2-6 steps
```

### By Risk Level
```
🔴 CRITICAL (8 connectors): +30 test steps
🟡 HIGH (8 connectors): +15 test steps
✅ ACCEPTABLE (2 connectors): +2 test steps
```

---

## File Locations for Modifications

### Core Connection Files
```
Pipeline:
- ingestion/src/metadata/ingestion/source/pipeline/airflow/connection.py
- ingestion/src/metadata/ingestion/source/pipeline/dbtcloud/connection.py
- ingestion/src/metadata/ingestion/source/pipeline/dagster/connection.py
- ingestion/src/metadata/ingestion/source/pipeline/fivetran/connection.py
- ingestion/src/metadata/ingestion/source/pipeline/airbyte/connection.py

Messaging:
- ingestion/src/metadata/ingestion/source/messaging/kafka/connection.py
- ingestion/src/metadata/ingestion/source/messaging/kinesis/connection.py

ML Model:
- ingestion/src/metadata/ingestion/source/mlmodel/mlflow/connection.py
- ingestion/src/metadata/ingestion/source/mlmodel/sagemaker/connection.py

Storage:
- ingestion/src/metadata/ingestion/source/storage/s3/connection.py
- ingestion/src/metadata/ingestion/source/storage/gcs/connection.py
- ingestion/src/metadata/ingestion/source/database/datalake/connection.py

Metadata:
- ingestion/src/metadata/ingestion/source/metadata/amundsen/connection.py
- ingestion/src/metadata/ingestion/source/metadata/atlas/connection.py
- ingestion/src/metadata/ingestion/source/metadata/alationsink/connection.py
```

---

## Validation Checklist

After implementing fixes, verify:

- [ ] Each test has clear error message with required permission
- [ ] Critical tests fail hard (raise exception)
- [ ] Optional tests warn but don't fail
- [ ] Tests work with minimal valid data
- [ ] Tests gracefully handle empty results
- [ ] Error messages mention specific table/API/permission
- [ ] All changes documented in CHANGELOG
- [ ] Unit tests added for each new test scenario
- [ ] Integration tests pass with restricted credentials
- [ ] Documentation updated for users

