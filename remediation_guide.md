# Test Connection Gaps - Remediation Guide

## Critical Issues with Code Examples

---

## 1. AIRFLOW - Missing DagRun and TaskInstance Tests

### Current Code (Incomplete)
```python
# From: ingestion/src/metadata/ingestion/source/pipeline/airflow/connection.py
def test_connection(...):
    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "PipelineDetailsAccess": partial(test_pipeline_details_access, session),
        "TaskDetailAccess": partial(test_task_detail_access, session),
    }
```

### Problem
- ✅ Tests SerializedDagModel access
- ❌ Does NOT test DagRun table (for pipeline status)
- ❌ Does NOT test TaskInstance table (for task status)
- ❌ Does NOT test DagTag table (for tags)

### Recommended Fix
```python
def test_pipeline_status_access(session):
    """Test access to DagRun table for pipeline status"""
    try:
        result = session.query(DagRun.dag_id).limit(1).first()
        if result is None:
            logger.warning("DagRun table accessible but empty - this is acceptable")
        return result
    except Exception as e:
        raise AirflowPipelineStatusAccessError(
            f"Cannot access DagRun table: {e}. "
            "Ensure SELECT permission on airflow.dag_run table"
        )

def test_task_status_access(session):
    """Test access to TaskInstance table for task execution status"""
    try:
        result = session.query(TaskInstance.task_id).limit(1).first()
        if result is None:
            logger.warning("TaskInstance table accessible but empty - this is acceptable")
        return result
    except Exception as e:
        raise AirflowTaskStatusAccessError(
            f"Cannot access TaskInstance table: {e}. "
            "Ensure SELECT permission on airflow.task_instance table"
        )

def test_tags_access(session):
    """Test access to DagTag table for Airflow tags"""
    try:
        result = session.query(DagTag.name).limit(1).first()
        return result
    except Exception as e:
        logger.warning(f"DagTag table not accessible: {e}. Tags will not be ingested.")
        # Don't raise - tags are optional
        return None

# Update test_fn dictionary
test_fn = {
    "CheckAccess": partial(test_connection_engine_step, engine),
    "PipelineDetailsAccess": partial(test_pipeline_details_access, session),
    "TaskDetailAccess": partial(test_task_detail_access, session),
    "PipelineStatusAccess": partial(test_pipeline_status_access, session),  # NEW
    "TaskStatusAccess": partial(test_task_status_access, session),          # NEW
    "TagsAccess": partial(test_tags_access, session),                       # NEW
}
```

### Why This Matters
**Ingestion currently fails with cryptic errors if user lacks access to these tables:**
- DagRun: Pipeline run history, execution dates, state
- TaskInstance: Task execution status, start/end times, logs
- DagTag: Airflow tags/labels for pipelines

---

## 2. FIVETRAN - Missing Lineage Permission Tests

### Current Code (Incomplete)
```python
# From: ingestion/src/metadata/ingestion/source/pipeline/fivetran/connection.py
def test_connection(...):
    test_fn = {"GetPipelines": client.list_groups}
```

### Problem
- ✅ Tests group listing (minimal permission)
- ❌ Does NOT test connector listing capability
- ❌ Does NOT test schema details access (critical for lineage)
- ❌ Does NOT test column lineage access

### Recommended Fix
```python
def test_connection(...):
    def test_groups():
        """Test basic access to groups"""
        try:
            groups = client.list_groups()
            if not groups:
                logger.warning("No groups found - ensure account has groups with connectors")
            return groups
        except Exception as e:
            raise FivetranConnectionError(f"Cannot list groups: {e}")

    def test_connector_access():
        """Test access to connectors within groups"""
        try:
            groups = client.list_groups()
            if not groups:
                logger.warning("No groups to test connector access")
                return None
            
            first_group = groups[0]
            connectors = client.list_group_connectors(first_group['id'])
            if not connectors:
                raise FivetranConnectorAccessError(
                    f"Group '{first_group['name']}' has no connectors. "
                    "Ensure account has active connectors."
                )
            return connectors
        except Exception as e:
            raise FivetranConnectorAccessError(
                f"Cannot list connectors: {e}. "
                "Ensure user has 'Connector Viewer' or higher role."
            )

    def test_schema_lineage():
        """Test access to schema details for lineage extraction"""
        try:
            groups = client.list_groups()
            if not groups:
                return None
            
            connectors = client.list_group_connectors(groups[0]['id'])
            if not connectors:
                return None
            
            connector = connectors[0]
            schema_details = client.get_connector_schema_details(connector['id'])
            if not schema_details:
                raise FivetranLineageAccessError(
                    "Cannot fetch schema details for lineage extraction"
                )
            return schema_details
        except Exception as e:
            raise FivetranLineageAccessError(
                f"Lineage extraction will fail: {e}. "
                "Ensure user has access to connector schema configuration."
            )

    test_fn = {
        "GetGroups": test_groups,
        "GetConnectors": test_connector_access,           # NEW
        "GetSchemaLineage": test_schema_lineage,          # NEW
    }
```

### Why This Matters
**Without these tests:**
- Pipeline discovery succeeds (groups are listed)
- But actual connectors can't be accessed → empty ingestion
- Lineage completely fails without schema_details permission

---

## 3. KINESIS - Missing Metadata Tests

### Current Code (Incomplete)
```python
# From: ingestion/src/metadata/ingestion/source/messaging/kinesis/connection.py
def test_connection(...):
    test_fn = {"GetTopics": client.list_streams}
```

### Problem
- ✅ Tests stream listing
- ❌ Does NOT test DescribeStream (critical for metadata)
- ❌ Does NOT test GetRecords (for sample data)
- ❌ Does NOT test CloudWatch metrics

### Recommended Fix
```python
def test_connection(...):
    def test_stream_metadata():
        """Test access to stream metadata (partitions, retention, etc.)"""
        try:
            streams = client.list_streams()
            if not streams.get('StreamNames'):
                logger.warning("No streams found to test metadata access")
                return None
            
            stream_name = streams['StreamNames'][0]
            description = client.describe_stream(StreamName=stream_name)
            
            if not description:
                raise KinesisMetadataAccessError(
                    f"Cannot describe stream '{stream_name}'"
                )
            
            return description
        except Exception as e:
            raise KinesisMetadataAccessError(
                f"Cannot access stream metadata: {e}. "
                "Ensure IAM policy includes kinesis:DescribeStream permission."
            )

    def test_record_access():
        """Test ability to get sample records"""
        try:
            streams = client.list_streams()
            if not streams.get('StreamNames'):
                return None
            
            stream_name = streams['StreamNames'][0]
            description = client.describe_stream(StreamName=stream_name)
            
            shard = description['StreamDescription']['Shards'][0]
            shard_iterator_response = client.get_shard_iterator(
                StreamName=stream_name,
                ShardId=shard['ShardId'],
                ShardIteratorType='LATEST'
            )
            
            return shard_iterator_response
        except Exception as e:
            logger.warning(f"Cannot access records for sampling: {e}")
            # This is not critical but nice to have
            return None

    test_fn = {
        "GetTopics": client.list_streams,
        "GetStreamMetadata": test_stream_metadata,        # NEW - CRITICAL
        "GetRecordAccess": test_record_access,           # NEW
    }
```

### Why This Matters
**Missing these permissions means:**
- Stream enumeration works
- But metadata (partition count, retention) fails
- Sample data collection fails → no preview in UI
- Stream configuration won't be captured

---

## 4. ADLS - Almost Non-existent Testing

### Current Code (Minimal)
```python
# From: ingestion/src/metadata/ingestion/source/database/datalake/connection.py
def test_connection(...):
    test_fn = {
        "ListBuckets": self.client.get_test_list_buckets_fn(
            self.service_connection.bucketName
        ),
    }
```

### Problem
- ✅ Tests listing containers
- ❌ Does NOT test blob listing (no files → empty metadata)
- ❌ Does NOT test blob read access
- ❌ Does NOT test hierarchical namespace (HNS) support

### Recommended Fix
```python
def test_connection(...):
    def test_list_blobs():
        """Test ability to list blobs within containers"""
        try:
            bucket_name = self.service_connection.bucketName
            if not bucket_name:
                logger.warning("No bucket name specified, listing containers instead")
                return None
            
            container_client = self.client._client.get_container_client(bucket_name)
            blobs = list(container_client.list_blobs(name_starts_with=""))
            
            if not blobs:
                logger.warning(
                    f"Container '{bucket_name}' is empty - metadata extraction will be limited"
                )
            return blobs
        except Exception as e:
            raise ADLSBlobAccessError(
                f"Cannot list blobs in container: {e}. "
                "Ensure user has Storage Blob Data Reader or higher role."
            )

    def test_blob_properties():
        """Test access to blob metadata"""
        try:
            bucket_name = self.service_connection.bucketName
            container_client = self.client._client.get_container_client(bucket_name)
            blobs = container_client.list_blobs(name_starts_with="")
            
            blob_list = list(blobs)
            if not blob_list:
                logger.warning("No blobs found to test property access")
                return None
            
            blob = blob_list[0]
            properties = blob.properties
            
            if not properties:
                raise ADLSBlobMetadataError("Cannot access blob properties")
            
            return properties
        except Exception as e:
            logger.warning(f"Cannot access blob metadata: {e}")
            # Non-critical but limits metadata quality

    test_fn = {
        "ListContainers": self.client.get_test_list_buckets_fn(
            self.service_connection.bucketName
        ),
        "ListBlobs": test_list_blobs,                    # NEW - CRITICAL
        "GetBlobProperties": test_blob_properties,       # NEW
    }
```

### Why This Matters
**Without blob access testing:**
- Container listing passes
- But no files found → empty schema
- File attributes unavailable (size, modified date)
- HNS issues not detected

---

## 5. DBT CLOUD - Missing Job Validation

### Current Code (Incomplete)
```python
# From: ingestion/src/metadata/ingestion/source/pipeline/dbtcloud/connection.py
def test_connection(...):
    test_fn = {
        "GetJobs": client.test_get_jobs,
        "GetRuns": partial(client.test_get_runs),
    }
```

### Problem
- ✅ Tests job listing for account
- ❌ Does NOT validate specified job_ids exist
- ❌ Does NOT test lineage API (GraphQL Discovery)
- ❌ Does NOT verify project access

### Recommended Fix
```python
def test_connection(...):
    def test_configured_jobs():
        """Validate that configured job_ids are accessible"""
        try:
            config = service_connection
            if not config.jobIds:
                logger.warning("No job IDs configured - will discover all jobs")
                return None
            
            for job_id in config.jobIds:
                try:
                    # Try to get a single run for this job
                    runs = client.get_runs(job_id=int(job_id))
                    if not runs:
                        logger.warning(
                            f"Job {job_id} has no runs. "
                            "Ensure job is configured and has executed."
                        )
                except Exception as e:
                    raise DBTJobAccessError(
                        f"Cannot access job {job_id}: {e}. "
                        "Ensure job_id is correct and user has access."
                    )
            
            return True
        except Exception as e:
            raise DBTJobAccessError(f"Job validation failed: {e}")

    def test_lineage_api():
        """Test access to Discovery API for lineage extraction"""
        try:
            # Simple GraphQL query to test Discovery API
            from metadata.ingestion.source.pipeline.dbtcloud.queries import (
                DBT_GET_MODELS_SEEDS
            )
            
            # Try a minimal query
            result = client.graphql_client.post(
                "/graphql",
                data=json.dumps({
                    "query": "{ account { id } }"
                })
            )
            
            if result.get('errors'):
                raise DBTLineageAccessError(
                    f"GraphQL query failed: {result['errors']}"
                )
            
            return result
        except Exception as e:
            logger.warning(
                f"Discovery API (lineage extraction) not accessible: {e}. "
                "Model lineage won't be extracted."
            )
            # Lineage is optional, don't fail hard

    test_fn = {
        "GetJobs": client.test_get_jobs,
        "GetRuns": partial(client.test_get_runs),
        "ValidateJobIds": test_configured_jobs,          # NEW - CRITICAL
        "TestLineageAPI": test_lineage_api,              # NEW
    }
```

---

## Implementation Checklist

### For Each Connector (Template):

- [ ] Identify all API/DB operations used during full ingestion
- [ ] Check which operations are tested in `test_connection`
- [ ] For each untested operation:
  - [ ] Create dedicated test function
  - [ ] Include helpful error messages with required permissions
  - [ ] Mark as critical or optional (fail hard vs. warn)
- [ ] Add to test_fn dictionary
- [ ] Test with credentials that lack each permission
- [ ] Verify error messages are clear and actionable

### Priority Order:
1. **Critical** (data access failures): Database tables, API permissions
2. **High** (partial data): Lineage APIs, metadata queries
3. **Medium** (nice-to-have): Sampling, metrics, optional attributes

---

## Testing These Changes

### Test with Restricted Permissions:
```bash
# Create test user with minimal permissions
# Then run test_connection

# Should FAIL clearly:
test_connection(restrictive_credentials)

# Should PASS:
test_connection(full_credentials)
```

### Expected Error Messages:
```
DBTJobAccessError: Cannot access job 12345: Forbidden. 
Ensure job_id is correct and user has access.

KinesisMetadataAccessError: Cannot access stream metadata: 
User: arn:aws:iam::xxx:user/test is not authorized to perform: 
kinesis:DescribeStream on resource: ...
```

---

## Testing Recommendations

### Unit Tests to Add
```python
def test_airflow_missing_dagruntable(mock_engine):
    """Test that we catch missing DagRun table access"""
    session = mock_engine.return_value
    session.query.side_effect = [
        successful_query,  # SerializedDagModel
        successful_query,  # TaskDetail
        Exception("ERROR 1142 (42000): SELECT command denied for table 'dag_run'")
    ]
    
    with pytest.raises(AirflowPipelineStatusAccessError):
        test_connection(metadata, engine, connection)

def test_fivetran_no_connector_access(mock_client):
    """Test that connector access failure is caught early"""
    mock_client.list_groups.return_value = [{"id": "g1", "name": "group1"}]
    mock_client.list_group_connectors.side_effect = Exception("Forbidden")
    
    with pytest.raises(FivetranConnectorAccessError):
        test_connection(metadata, mock_client, connection)
```

