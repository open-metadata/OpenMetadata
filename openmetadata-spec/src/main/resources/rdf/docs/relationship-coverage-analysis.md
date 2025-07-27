# RDF Relationship Coverage Analysis

This document analyzes how well our current RDF implementation captures all relationships in OpenMetadata.

## Current Implementation Status

### ✅ Entity Relationships (Well Covered)

Our RDF implementation properly captures standard entity relationships through the `EntityRelationship` model:

1. **Data Asset Relationships**
   - `contains`: Database → Schema → Table → Column
   - `parentOf`/`childOf`: Hierarchical relationships
   - `upstream`/`downstream`: Data lineage

2. **Ownership & Team Relationships**
   - `owns`: User/Team → Entity
   - `createdBy`: User → Entity
   - `follows`: User → Entity

3. **Service Relationships**
   - `uses`: Entity → Service
   - `contains`: Service → Database/Dashboard/Pipeline

### ⚠️ Special Relationships (Need Enhancement)

These relationships are handled differently in OpenMetadata and need special RDF handling:

#### 1. Tags (tag_usage table)
Tags are not stored as entity relationships but in a separate `tag_usage` table. We need to:

```java
// Add to RdfUpdater.java
public static void updateTagUsage(String tagFQN, String targetFQN, TagLabel.LabelType labelType) {
  if (rdfRepository != null && rdfRepository.isEnabled()) {
    try {
      // Create RDF triple: targetEntity --hasTag--> Tag
      String targetUri = convertFQNToUri(targetFQN);
      String tagUri = convertFQNToUri(tagFQN);
      
      String sparqlUpdate = String.format(
        "INSERT DATA { <%s> om:hasTag <%s> . <%s> a om:TagLabel ; om:labelType \"%s\" . }",
        targetUri, tagUri, tagUri, labelType
      );
      
      rdfRepository.executeSparqlUpdate(sparqlUpdate);
    } catch (Exception e) {
      LOG.error("Failed to update tag usage in RDF", e);
    }
  }
}
```

#### 2. Glossary Terms (Similar to Tags)
Glossary terms are also applied like tags and need similar handling:

```java
public static void updateGlossaryTermUsage(String glossaryTermFQN, String targetFQN) {
  // Similar to tag usage but with om:hasGlossaryTerm predicate
}
```

#### 3. Domain Assignment
Domains are stored as entity references but need special handling:

```java
public static void updateDomainAssignment(String domainId, String entityId) {
  // Create: Entity --belongsToDomain--> Domain
}
```

#### 4. Data Products
Similar to domains:

```java
public static void updateDataProductAssignment(String dataProductId, String entityId) {
  // Create: Entity --partOfDataProduct--> DataProduct
}
```

## Required Enhancements

### 1. Update EntityRepository Integration Points

Add RDF updates to these methods in EntityRepository:

```java
// In EntityRepository.java

@Transaction
public final void applyTags(List<TagLabel> tagLabels, String targetFQN) {
  for (TagLabel tagLabel : listOrEmpty(tagLabels)) {
    if (!tagLabel.getLabelType().equals(TagLabel.LabelType.DERIVED)) {
      // Existing tag storage logic...
      
      // Add RDF update
      RdfUpdater.updateTagUsage(
        tagLabel.getTagFQN(), 
        targetFQN, 
        tagLabel.getLabelType()
      );
    }
  }
}

// Similar updates for:
// - applyGlossaryTags
// - storeDomains
// - storeDataProducts
```

### 2. Enhance JSON-LD Contexts

Update base.jsonld to include all special relationships:

```json
{
  "@context": {
    "hasTag": {
      "@id": "om:hasTag",
      "@type": "@id"
    },
    "hasGlossaryTerm": {
      "@id": "om:hasGlossaryTerm",
      "@type": "@id"
    },
    "belongsToDomain": {
      "@id": "om:belongsToDomain",
      "@type": "@id"
    },
    "partOfDataProduct": {
      "@id": "om:partOfDataProduct",
      "@type": "@id"
    },
    "TagLabel": "om:TagLabel",
    "labelType": "om:labelType",
    "tagSource": "om:tagSource"
  }
}
```

### 3. Add Custom Relationship Queries

Create SPARQL templates for common relationship queries:

```sparql
# Find all entities with a specific tag
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?entity WHERE {
  ?entity om:hasTag <tag:Classification.PII> .
}

# Find all entities in a domain
PREFIX om: <https://open-metadata.org/ontology/>
SELECT ?entity WHERE {
  ?entity om:belongsToDomain <domain:Sales> .
}

# Get complete entity graph with all relationships
PREFIX om: <https://open-metadata.org/ontology/>
CONSTRUCT {
  ?entity ?p ?o .
  ?entity om:hasTag ?tag .
  ?entity om:hasGlossaryTerm ?term .
  ?entity om:belongsToDomain ?domain .
} WHERE {
  ?entity a ?type .
  OPTIONAL { ?entity ?p ?o }
  OPTIONAL { ?entity om:hasTag ?tag }
  OPTIONAL { ?entity om:hasGlossaryTerm ?term }
  OPTIONAL { ?entity om:belongsToDomain ?domain }
}
```

## Testing Checklist

To verify complete relationship coverage:

1. **Create Test Entity**
   - Table with columns
   - Apply tags at table and column level
   - Apply glossary terms
   - Assign to domain
   - Set owner (user and team)

2. **Verify RDF Triples**
   ```sparql
   # Should return all relationships
   SELECT * WHERE {
     <table:sales.customers> ?predicate ?object
   }
   ```

3. **Test Relationship Queries**
   - Find all tables with PII tag
   - Find all assets owned by a team
   - Find all entities in a domain
   - Trace lineage relationships

## Implementation Priority

1. **High Priority**
   - Tag relationships (most used)
   - Glossary term relationships
   - Owner relationships

2. **Medium Priority**
   - Domain assignments
   - Data product assignments
   - Column-level relationships

3. **Low Priority**
   - Custom properties
   - Extension attributes

## Current Gaps Summary

| Relationship Type | Storage Method | RDF Status | Priority |
|------------------|----------------|------------|----------|
| Entity Relations | entity_relationship table | ✅ Implemented | - |
| Tags | tag_usage table | ❌ Not implemented | High |
| Glossary Terms | tag_usage table | ❌ Not implemented | High |
| Domains | entity_relationship | ✅ Implemented | Medium |
| Data Products | entity_relationship | ✅ Implemented | Medium |
| Owners | entity_relationship | ✅ Implemented | High |
| Column Tags | tag_usage table | ❌ Not implemented | High |

## Next Steps

1. Implement `RdfUpdater.updateTagUsage()` method
2. Add hooks in `EntityRepository.applyTags()`
3. Test with sample data
4. Add integration tests
5. Document SPARQL query patterns