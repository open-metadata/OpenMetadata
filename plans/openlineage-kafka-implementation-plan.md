# OpenLineage Kafka Topic Support - Implementation Plan

## Current Status Analysis

### ✅ Already Implemented (in metadata.py)

1. **Entity Detection Logic** (Lines 102-116)
   - [`_get_entity_details()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:103) - Detects entity type based on namespace
   - Checks for `kafka://` prefix to identify topics
   - Returns `EntityDetails` with either table or topic details

2. **Topic Details Extraction** (Lines 158-174)
   - [`_get_topic_details()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:159) - Extracts topic name and namespace
   - Validates presence of namespace and name fields
   - Returns `TopicDetails` object with name and namespace

3. **Model Extensions** (in models.py)
   - [`TopicFQN`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/models.py:44) class - Holds topic FQN
   - [`TopicDetails`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/models.py:93) class - Holds topic name and namespace
   - [`EntityDetails`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/models.py:102) class - Union type for table/topic
   - [`LineageNode`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/models.py:62) - Updated to support both TableFQN and TopicFQN

### ❌ Missing Components

## Required Changes

### 1. Add `get_messaging_service_names()` Method
**File**: [`ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py`](ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py:480)

**Location**: After [`get_storage_service_names()`](ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py:480) method (around line 488)

**Implementation**:
```python
def get_messaging_service_names(self) -> List[str]:
    """
    Get the list of messaging service names
    """
    return (
        self.source_config.lineageInformation.messagingServiceNames or []
        if self.source_config.lineageInformation
        else []
    )
```

**Rationale**: Similar to [`get_db_service_names()`](ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py:470) and [`get_storage_service_names()`](ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py:480), this method retrieves messaging service names from the configuration for topic FQN resolution.

---

### 2. Add `_get_topic_fqn()` Method
**File**: [`ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:176)

**Location**: After [`_get_table_fqn()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:176) method (around line 185)

**Implementation**:
```python
def _get_topic_fqn(self, topic_details: TopicDetails) -> Optional[str]:
    """
    Based on partial topic name, look for any matching Topic object in OpenMetadata.
    
    :param topic_details: TopicDetails object with name and namespace
    :return: fully qualified name of a Topic in OpenMetadata
    """
    services = self.get_messaging_service_names()
    
    for messaging_service in services:
        topic_fqn = fqn.build(
            metadata=self.metadata,
            entity_type=Topic,
            service_name=messaging_service,
            topic_name=topic_details.name,
            skip_es_search=False,
        )
        
        if topic_fqn:
            return topic_fqn
    
    return None
```

**Rationale**: 
- Mirrors the logic of [`_get_table_fqn()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:176)
- Searches across all configured messaging services
- Uses the existing [`fqn.build()`](ingestion/src/metadata/utils/fqn.py:138) utility with Topic entity type
- The FQN builder at [`fqn.py:355`](ingestion/src/metadata/utils/fqn.py:355) already supports Topic entities
- Uses ES search via [`search_topic_from_es()`](ingestion/src/metadata/utils/fqn.py:839) when `skip_es_search=False`

---

### 3. Add Missing Import
**File**: [`ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:26)

**Location**: After line 26 (after Table import)

**Implementation**:
```python
from metadata.generated.schema.entity.data.topic import Topic
```

**Rationale**: Required for Topic entity type in FQN building and metadata operations.

---

### 4. Update `yield_pipeline_lineage_details()` Method
**File**: [`ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:416)

**Current Issue**: 
- Lines 424-443 only handle table entities
- Calls [`get_create_table_request()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:269) for all inputs/outputs
- Uses [`_get_table_details()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:119) and [`_get_table_fqn()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:176) exclusively

**Required Changes**:

Replace the loop at lines 424-443 with:

```python
for spec in [(inputs, input_edges), (outputs, output_edges)]:
    entities, entity_list = spec

    for entity_data in entities:
        # Detect entity type (table or topic)
        entity_details = OpenlineageSource._get_entity_details(entity_data)
        
        if entity_details.entity_type == "table":
            # Handle table entities (existing logic)
            create_table_request = self.get_create_table_request(entity_data)
            
            if create_table_request:
                yield create_table_request
            
            table_fqn = self._get_table_fqn(entity_details.table_details)
            
            if table_fqn:
                entity_list.append(
                    LineageNode(
                        fqn=TableFQN(value=table_fqn),
                        uuid=self.metadata.get_by_name(Table, table_fqn).id,
                        node_type="table"
                    )
                )
        
        elif entity_details.entity_type == "topic":
            # Handle topic entities (new logic)
            topic_fqn = self._get_topic_fqn(entity_details.topic_details)
            
            if topic_fqn:
                entity_list.append(
                    LineageNode(
                        fqn=TopicFQN(value=topic_fqn),
                        uuid=self.metadata.get_by_name(Topic, topic_fqn).id,
                        node_type="topic"
                    )
                )
            else:
                logger.warning(
                    f"Topic FQN not found for topic: {entity_details.topic_details.name}. "
                    f"Ensure the topic exists in one of the configured messaging services."
                )
```

**Key Changes**:
1. Use [`_get_entity_details()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:103) to detect entity type
2. Branch logic based on `entity_type` ("table" or "topic")
3. For tables: Keep existing logic unchanged
4. For topics: 
   - Call [`_get_topic_fqn()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:176) to resolve FQN
   - Create `LineageNode` with `TopicFQN` and `node_type="topic"`
   - Skip table creation logic (topics must already exist)
5. Add warning logging when topic FQN cannot be resolved

**Rationale**:
- Supports all 4 lineage combinations: Table→Table, Table→Topic, Topic→Table, Topic→Topic
- Reuses existing entity detection logic
- Maintains backward compatibility with table-only events
- Topics are not auto-created (unlike tables) - they must exist in messaging services

---

### 5. Update `_get_column_lineage()` Method (Optional Enhancement)
**File**: [`ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:359)

**Current Limitation**: 
- Lines 359-390 assume all entities are tables
- Column lineage only makes sense for table-to-table relationships

**Recommendation**: 
- Add entity type check before processing column lineage
- Skip column lineage for topic entities (topics don't have columns in the same way)
- This is a **nice-to-have** enhancement, not critical for initial implementation

**Suggested Change** (at line 366):
```python
for table in outputs:
    # Skip column lineage for non-table entities
    entity_details = OpenlineageSource._get_entity_details(table)
    if entity_details.entity_type != "table":
        continue
    
    output_table_fqn = self._get_table_fqn(entity_details.table_details)
    # ... rest of existing logic
```

---

## Configuration Schema Update

### Add `messagingServiceNames` to Lineage Configuration

**File**: Likely in `openmetadata-spec/src/main/resources/json/schema/entity/services/connections/pipeline/openLineageConnection.json`

**Required Field**:
```json
{
  "messagingServiceNames": {
    "description": "List of messaging service names to search for topics when building lineage",
    "type": "array",
    "items": {
      "type": "string"
    }
  }
}
```

**Usage Example**:
```yaml
lineageInformation:
  dbServiceNames:
    - "mysql_prod"
    - "postgres_analytics"
  messagingServiceNames:
    - "kafka_prod"
    - "kafka_staging"
```

---

## Testing Strategy

### Unit Tests
**File**: `ingestion/tests/unit/topology/pipeline/test_openlineage.py`

**Test Cases to Add**:

1. **Test Topic Detection**
   ```python
   def test_kafka_namespace_detection():
       """Test that kafka:// namespaces are correctly identified as topics"""
       data = {
           "namespace": "kafka://localhost:9092",
           "name": "test_topic"
       }
       entity_details = OpenlineageSource._get_entity_details(data)
       assert entity_details.entity_type == "topic"
       assert entity_details.topic_details.name == "test_topic"
   ```

2. **Test Table Detection (Backward Compatibility)**
   ```python
   def test_database_namespace_detection():
       """Test that non-kafka namespaces are identified as tables"""
       data = {
           "namespace": "s3a://test_db",
           "name": "schema.table"
       }
       entity_details = OpenlineageSource._get_entity_details(data)
       assert entity_details.entity_type == "table"
   ```

3. **Test Mixed Lineage**
   ```python
   def test_mixed_table_topic_lineage():
       """Test lineage creation with both tables and topics"""
       event = {
           "inputs": [{
               "namespace": "s3a://db",
               "name": "schema.input_table"
           }],
           "outputs": [{
               "namespace": "kafka://localhost:9092",
               "name": "output_topic"
           }]
       }
       # Assert lineage is created correctly
   ```

4. **Test Topic FQN Resolution**
   ```python
   def test_topic_fqn_resolution():
       """Test that topic FQN is correctly resolved across messaging services"""
       # Mock messaging services
       # Test FQN building
   ```

---

## Implementation Checklist

- [ ] Add `get_messaging_service_names()` to [`pipeline_service.py`](ingestion/src/metadata/ingestion/source/pipeline/pipeline_service.py:480)
- [ ] Add `_get_topic_fqn()` to [`metadata.py`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:176)
- [ ] Add Topic import to [`metadata.py`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:26)
- [ ] Update [`yield_pipeline_lineage_details()`](ingestion/src/metadata/ingestion/source/pipeline/openlineage/metadata.py:416) to handle mixed entities
- [ ] Update configuration schema to include `messagingServiceNames`
- [ ] Add unit tests for topic detection and mixed lineage
- [ ] Test with real OpenLineage Kafka events
- [ ] Update documentation

---

## Backward Compatibility

✅ **Fully Backward Compatible**
- Existing table-only OpenLineage events work unchanged
- Topic detection only activates for `kafka://` namespaces
- No breaking changes to existing APIs
- Configuration is additive (new optional field)

---

## Success Criteria

1. ✅ **Kafka topic detection**: Correctly identify `kafka://` namespaces
2. ✅ **Topic FQN resolution**: Find topics across configured messaging services
3. ✅ **Mixed lineage creation**: Support all 4 combinations:
   - Table → Table (existing)
   - Table → Topic (new)
   - Topic → Table (new)
   - Topic → Topic (new)
4. ✅ **No regression**: Existing table-only events continue to work
5. ✅ **Test coverage**: >90% coverage for new functionality

---

## Estimated Effort

- **Code Changes**: ~150 lines across 2 files
- **Configuration**: ~20 lines
- **Tests**: ~200 lines
- **Total**: ~370 lines of code
- **Time**: 4-6 hours for implementation + testing

---

## Next Steps

1. Implement `get_messaging_service_names()` in pipeline_service.py
2. Implement `_get_topic_fqn()` in metadata.py
3. Add Topic import
4. Update `yield_pipeline_lineage_details()` with mixed entity handling
5. Write unit tests
6. Test with sample Kafka OpenLineage events
7. Update configuration schema
8. Document the feature
