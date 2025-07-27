# RDF Integration Guide

This guide shows how to integrate RDF updates into OpenMetadata's entity lifecycle.

## 1. Initialize RDF in OpenMetadataApplication

In `OpenMetadataApplication.java`, add RDF initialization:

```java
// In initialize() method, after search repository initialization:
SearchRepository searchRepository = new SearchRepository(config.getElasticSearchConfiguration());
Entity.setSearchRepository(searchRepository);

// Add RDF initialization
RdfConfiguration rdfConfig = config.getRdfConfiguration();
if (rdfConfig != null && rdfConfig.isEnabled()) {
  RdfUpdater.initialize(rdfConfig);
}
```

## 2. Add RDF Configuration to OpenMetadataApplicationConfig

```java
public class OpenMetadataApplicationConfig extends Configuration {
  // ... existing fields ...
  
  @JsonProperty("rdf")
  private RdfConfiguration rdfConfiguration = new RdfConfiguration();
  
  public RdfConfiguration getRdfConfiguration() {
    return rdfConfiguration;
  }
  
  public void setRdfConfiguration(RdfConfiguration rdfConfiguration) {
    this.rdfConfiguration = rdfConfiguration;
  }
}
```

## 3. Integration Points in EntityRepository

The RDF updates should be integrated into the existing post-operation hooks in EntityRepository:

### 3.1. After Entity Creation

In `EntityRepository.java`, update the `postCreate()` method:

```java
@SuppressWarnings("unused")
protected void postCreate(T entity) {
  EntityLifecycleEventDispatcher.getInstance().onEntityCreated(entity, null);
  
  // Update RDF
  RdfUpdater.updateEntity(entity);
}

protected void postCreate(List<T> entities) {
  for (T entity : entities) {
    EntityLifecycleEventDispatcher.getInstance().onEntityCreated(entity, null);
    
    // Update RDF
    RdfUpdater.updateEntity(entity);
  }
}
```

### 3.2. After Entity Update

In `EntityRepository.java`, update the `postUpdate()` methods:

```java
@SuppressWarnings("unused")
protected void postUpdate(T original, T updated) {
  EntityLifecycleEventDispatcher.getInstance()
      .onEntityUpdated(updated, updated.getChangeDescription(), null);
  
  // Update RDF
  RdfUpdater.updateEntity(updated);
}

@SuppressWarnings("unused")
protected void postUpdate(T updated) {
  EntityLifecycleEventDispatcher.getInstance()
      .onEntityUpdated(updated, updated.getChangeDescription(), null);
  
  // Update RDF
  RdfUpdater.updateEntity(updated);
}
```

### 3.3. After Entity Deletion

In `EntityRepository.java`, update the `postDelete()` method:

```java
protected void postDelete(T entity) {
  // Update RDF
  RdfUpdater.deleteEntity(entity.getEntityReference());
}
```

### 3.4. After Relationship Addition

In `EntityRepository.java`, update the `addRelationship()` method:

```java
public void addRelationship(UUID fromId, UUID toId, String fromEntity, String toEntity, 
                           Relationship relationshipType, boolean bidirectional) {
  // ... existing logic to add relationship ...
  
  // Create EntityRelationship object
  EntityRelationship relationship = new EntityRelationship()
      .withFromId(fromId)
      .withToId(toId)
      .withFromEntity(fromEntity)
      .withToEntity(toEntity)
      .withRelationshipType(relationshipType);
  
  // Update RDF
  RdfUpdater.addRelationship(relationship);
  
  if (bidirectional) {
    // Also add the reverse relationship to RDF
    EntityRelationship reverseRelationship = new EntityRelationship()
        .withFromId(toId)
        .withToId(fromId)
        .withFromEntity(toEntity)
        .withToEntity(fromEntity)
        .withRelationshipType(inverseRelationship);
    
    RdfUpdater.addRelationship(reverseRelationship);
  }
}
```

### 3.5. After Relationship Removal

In `EntityRepository.java`, update the `deleteRelationship()` method:

```java
public void deleteRelationship(UUID fromId, String fromEntity, UUID toId, String toEntity,
                              Relationship relationshipType) {
  // ... existing logic to delete relationship ...
  
  // Create EntityRelationship object
  EntityRelationship relationship = new EntityRelationship()
      .withFromId(fromId)
      .withToId(toId)
      .withFromEntity(fromEntity)
      .withToEntity(toEntity)
      .withRelationshipType(relationshipType);
  
  // Update RDF
  RdfUpdater.removeRelationship(relationship);
}

## 4. Configuration Example

Add to `openmetadata.yaml`:

```yaml
rdf:
  enabled: true
  baseUri: "https://open-metadata.org/"
  storageType: "TDB2"
  storagePath: "./rdf-store"
  jsonLdEnabled: true
  sparqlEndpointEnabled: true
  sparqlPort: 3030
```

## 5. Register RDF Resource

In `OpenMetadataApplication.registerResources()`:

```java
private void registerResources(OpenMetadataApplicationConfig config, Environment environment,
                              Authorizer authorizer) {
  // ... existing resources ...
  
  // Add RDF resource if enabled
  if (config.getRdfConfiguration() != null && config.getRdfConfiguration().isEnabled()) {
    environment.jersey().register(new RdfResource(authorizer, config));
  }
}
```

## 6. API Endpoints

Once integrated, the following endpoints will be available:

- `GET /api/v1/rdf/entity/{entityType}/{id}?format=jsonld` - Get entity as JSON-LD
- `GET /api/v1/rdf/entity/{entityType}/{id}?format=turtle` - Get entity as Turtle
- `POST /api/v1/rdf/sparql` - Execute SPARQL queries

## 7. Example SPARQL Queries

### Find all tables with PII tags:
```sparql
PREFIX om: <https://open-metadata.org/ontology/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?table ?name WHERE {
  ?table a om:Table ;
         rdfs:label ?name ;
         om:hasTag ?tag .
  ?tag om:tagFQN "PII.Sensitive" .
}
```

### Get lineage upstream of a table:
```sparql
PREFIX om: <https://open-metadata.org/ontology/>

SELECT ?upstream ?name WHERE {
  <https://open-metadata.org/entity/table/12345> om:upstream+ ?upstream .
  ?upstream rdfs:label ?name .
}
```

### Find all assets owned by a team:
```sparql
PREFIX om: <https://open-metadata.org/ontology/>

SELECT ?asset ?type WHERE {
  ?asset om:hasOwner <https://open-metadata.org/entity/team/data-team> ;
         a ?type .
}
```

## 8. Migration Strategy

For existing deployments:

1. Enable RDF in configuration
2. Use bulk sync endpoint to migrate existing data:
   ```bash
   curl -X POST http://localhost:8585/api/v1/rdf/sync/table
   curl -X POST http://localhost:8585/api/v1/rdf/sync/database
   # ... for each entity type
   ```

3. Once sync is complete, new changes will be automatically reflected in RDF store

## 9. Performance Considerations

- RDF updates happen asynchronously and don't block main operations
- TDB2 storage provides efficient triple storage
- SPARQL queries run against separate RDF index
- No impact on existing JSON/SQL query performance