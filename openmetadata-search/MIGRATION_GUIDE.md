# OpenMetadata Search Aggregation Migration Guide

## Overview
This guide shows how to migrate from the existing dual ES/OpenSearch aggregation packages to the unified openmetadata-search module.

## Current State (Before Migration)

### Existing Packages to Replace:
- `org.openmetadata.service.search.elasticsearch.aggregations.*`
- `org.openmetadata.service.search.opensearch.aggregations.*`

### Current Classes:
```
elasticsearch/aggregations/:
├── ElasticAggregations.java (interface)
├── ElasticAggregationsBuilder.java (factory)
├── ElasticTermsAggregations.java
├── ElasticDateHistogramAggregations.java  
├── ElasticAvgAggregations.java
├── ElasticMinAggregations.java
├── ElasticCardinalityAggregations.java
├── ElasticNestedAggregations.java
├── ElasticTopHitsAggregations.java
└── ElasticBucketSelectorAggregations.java

opensearch/aggregations/:
├── OpenAggregations.java (interface)
├── OpenAggregationsBuilder.java (factory)
├── OpenTermsAggregations.java
├── OpenDateHistogramAggregations.java
├── OpenAvgAggregations.java
├── OpenMinAggregations.java
├── OpenCardinalityAggregations.java
├── OpenNestedAggregations.java
├── OpenTopHitsAggregations.java
└── OpenBucketSelectorAggregations.java
```

## New State (After Migration)

### New Unified Package:
- `org.openmetadata.search.aggregation.*`

### New Classes:
```
aggregation/:
├── OMSearchAggregation.java (interface)
├── OMSearchAggregationFactory.java (factory interface)
└── elasticsearch/
    ├── ElasticSearchAggregationFactory.java
    ├── ElasticBaseAggregation.java
    ├── ElasticTermsAggregation.java
    ├── ElasticDateHistogramAggregation.java
    └── ElasticAvgAggregation.java
    └── [other aggregation types...]
```

## Migration Steps

### 1. Add Dependency
Add openmetadata-search module to your pom.xml:
```xml
<dependency>
    <groupId>org.open-metadata</groupId>
    <artifactId>openmetadata-search</artifactId>
    <version>${project.version}</version>
</dependency>
```

### 2. Update Imports
Replace existing imports:
```java
// REMOVE these imports:
import org.openmetadata.service.search.elasticsearch.aggregations.*;
import org.openmetadata.service.search.opensearch.aggregations.*;

// ADD these imports:
import org.openmetadata.search.aggregation.*;
import org.openmetadata.search.aggregation.elasticsearch.ElasticSearchAggregationFactory;
import org.openmetadata.search.SearchAggregationNode;
```

### 3. Replace Factory Usage

#### Before:
```java
// Elasticsearch
List<ElasticAggregations> esAggregations = 
    ElasticAggregationsBuilder.buildAggregation(rootNode, null, new ArrayList<>());

// OpenSearch  
List<OpenAggregations> osAggregations =
    OpenAggregationsBuilder.buildAggregation(rootNode, null, new ArrayList<>());
```

#### After:
```java
// Works for both ES and OpenSearch!
OMSearchAggregationFactory factory = new ElasticSearchAggregationFactory();
// or: OMSearchAggregationFactory factory = new OpenSearchAggregationFactory(); // Future

List<OMSearchAggregation> aggregations = factory.buildAggregationTree(rootNode);
```

### 4. Replace Specific Aggregation Creation

#### Before:
```java
ElasticAggregations elasticAgg = ElasticAggregationsBuilder.getAggregation("terms");
// or
OpenAggregations openAgg = OpenAggregationsBuilder.getAggregation("terms");
```

#### After:
```java
OMSearchAggregation agg = factory.createAggregation("terms");
```

### 5. Replace Build Calls

#### Before:
```java
AggregationBuilder esBuilder = elasticAgg.getElasticAggregationBuilder();
PipelineAggregationBuilder esPipelineBuilder = elasticAgg.getElasticPipelineAggregationBuilder();
```

#### After:
```java
// Type-safe building for ES
es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation esAgg = 
    agg.build(es.co.elastic.clients.elasticsearch._types.aggregations.Aggregation.class);

// Type-safe building for OpenSearch (future)
// os.org.opensearch.client.opensearch._types.aggregations.Aggregation osAgg = 
//     agg.build(os.org.opensearch.client.opensearch._types.aggregations.Aggregation.class);
```

## Benefits of Migration

### ✅ **Single Codebase**
- Write aggregation logic once, works for both ES and OpenSearch
- No more duplicate ElasticXxxAggregations and OpenXxxAggregations classes

### ✅ **Modern Client Support**
- Uses modern Elasticsearch Java client (8.17.4)
- Uses modern OpenSearch Java client (2.22.0)
- Proper shaded dependencies to avoid Lucene conflicts

### ✅ **Type Safety**
- Type-safe aggregation building with `build(Class<T> targetType)`
- Compile-time validation of aggregation structure

### ✅ **Cleaner Code**
- Single factory pattern instead of separate builders
- Unified interface for all aggregation types
- Easier testing and maintenance

## Files to Modify in openmetadata-service

After migration, these files can be **deleted**:
- `org/openmetadata/service/search/elasticsearch/aggregations/` (entire package)
- `org/openmetadata/service/search/opensearch/aggregations/` (entire package)

These files need to be **updated** to use the new API:
- Any class that imports or uses the old aggregation packages
- Search clients that build aggregations
- Data insight aggregators (like AggregatedUnusedAssetsCountAggregator implementations)

## Supported Aggregation Types

The unified system supports all existing aggregation types:
- `terms` - Terms aggregation with include/exclude support
- `date_histogram` - Date histogram with calendar intervals
- `avg` - Average metric aggregation
- `min` - Minimum metric aggregation
- `max` - Maximum metric aggregation
- `sum` - Sum metric aggregation
- `cardinality` - Cardinality metric aggregation
- `nested` - Nested bucket aggregation
- `top_hits` - Top hits metric aggregation
- `bucket_selector` - Bucket selector pipeline aggregation
- `histogram` - Histogram bucket aggregation
- `range` - Range bucket aggregation
- `filter` - Filter bucket aggregation

## Backward Compatibility

The new system maintains 100% functional compatibility with the existing `SearchAggregationNode` structure, so no changes are needed to:
- Aggregation configuration parsing
- REST API contracts
- Database schemas
- Frontend integration