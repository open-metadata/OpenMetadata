# Tag Usage Performance Analysis and Solution

## Root Cause Analysis

The 2-second latency in `getTagsInternalByPrefix` is caused by:

### 1. LIKE Pattern Matching Issue
```sql
WHERE tu.targetFQNHash LIKE :targetFQNHash
-- Actual query: WHERE tu.targetFQNHash LIKE 'hash123%'
```
- The LIKE operator with trailing wildcard cannot efficiently use standard B-tree indexes
- MySQL may perform a full index scan or table scan depending on data distribution

### 2. LEFT JOIN Overhead
```sql
LEFT JOIN glossary_term_entity gterm ON tu.source = 1 AND gterm.fqnHash = tu.tagFQNHash
LEFT JOIN tag ta ON tu.source = 0 AND ta.fqnHash = tu.tagFQNHash
```
- Each row requires checking both tables even when only one will match
- JSON extraction from large JSON columns adds overhead

### 3. Volume and Cardinality
- tag_usage table likely contains millions of rows
- Each entity can have multiple tags
- Hierarchical entities (tables with columns) multiply the rows

## Solution Approaches

### Immediate Fix: Query Optimization

1. **Use Range Query Instead of LIKE**
   - Store targetFQNHashPrefix separately
   - Use BETWEEN for range queries on hashes
   
2. **Separate Queries for Tag and GlossaryTerm**
   - Split into two queries based on source
   - Eliminate unnecessary LEFT JOINs

3. **Implement Prefix Index**
   - Create index on first N characters of targetFQNHash
   - ALTER TABLE tag_usage ADD INDEX idx_target_prefix ((LEFT(targetFQNHash, 16)));

### Long-term Solution: Architectural Changes

1. **Denormalized Tag Storage**
   ```json
   // Store tags directly in entity JSON
   {
     "id": "uuid",
     "name": "table1",
     "tags": [
       {"tagFQN": "PII.Sensitive", "source": 0, "labelType": "Manual"},
       {"tagFQN": "Classification.Internal", "source": 1, "labelType": "Derived"}
     ],
     "columns": [
       {
         "name": "column1",
         "tags": [...]
       }
     ]
   }
   ```

2. **Hybrid Approach**
   - Keep tag_usage for referential integrity
   - Cache complete tag hierarchy in entity JSON
   - Use tag_usage only for:
     - Tag deletion cascade
     - Tag usage reports
     - Cross-entity tag queries

3. **Materialized Views**
   - Create materialized view for entity-tag mappings
   - Refresh on tag changes
   - Query from pre-computed view

## Performance Comparison

| Approach | Query Time | Pros | Cons |
|----------|------------|------|------|
| Current (LIKE) | 2000ms | Simple implementation | Slow prefix matching |
| Range Query | ~50ms | Uses index efficiently | Requires schema change |
| Denormalized | <10ms | Fastest reads | Complex writes, data duplication |
| Hybrid | <20ms | Balance of speed and integrity | More complex caching |

## Recommended Implementation Plan

### Phase 1: Quick Win (Target: <500ms)
1. Add prefix column and index
2. Optimize query to use range instead of LIKE
3. Implement query result caching

### Phase 2: Architectural Improvement (Target: <100ms)  
1. Implement hybrid storage approach
2. Store tags in entity JSON for reads
3. Maintain tag_usage for writes and integrity

### Phase 3: Advanced Optimization (Target: <50ms)
1. Implement read-through cache with Redis
2. Use event-driven cache warming
3. Consider graph database for tag relationships

## Code Changes Required

### 1. Schema Migration
```sql
-- Add prefix column for efficient range queries
ALTER TABLE tag_usage ADD COLUMN targetFQNPrefix VARCHAR(64) 
  GENERATED ALWAYS AS (LEFT(targetFQNHash, 16)) STORED;
  
CREATE INDEX idx_tag_usage_prefix ON tag_usage(targetFQNPrefix, targetFQNHash);
```

### 2. Query Modification
```java
// Replace LIKE with range query
@SqlQuery(
  "SELECT * FROM tag_usage " +
  "WHERE targetFQNHash >= :prefixStart " +
  "AND targetFQNHash < :prefixEnd"
)
```

### 3. Entity Storage
```java
// Store tags in entity JSON
entity.setTags(tagList);
entity.setCachedTags(true);
// Maintain tag_usage for referential integrity
```

## Expected Results
- Immediate: 2000ms → 500ms (75% improvement)
- Phase 1: 500ms → 200ms (90% improvement)
- Phase 2: 200ms → 50ms (97.5% improvement)
- Phase 3: 50ms → <20ms (99% improvement)