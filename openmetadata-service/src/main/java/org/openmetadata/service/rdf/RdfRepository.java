package org.openmetadata.service.rdf;

import java.io.IOException;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.storage.RdfStorageFactory;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

@Slf4j
public class RdfRepository {

  private final RdfConfiguration config;
  private final RdfStorageInterface storageService;
  private final JsonLdTranslator translator;
  private static RdfRepository INSTANCE;

  private RdfRepository(RdfConfiguration config) {
    this.config = config;
    if (config.getEnabled() != null && config.getEnabled()) {
      this.storageService = RdfStorageFactory.createStorage(config);
      this.translator =
          new JsonLdTranslator(JsonUtils.getObjectMapper(), config.getBaseUri().toString());
      LOG.info("RDF Repository initialized with {} storage", config.getStorageType());
    } else {
      this.storageService = null;
      this.translator = null;
      LOG.info("RDF Repository disabled");
    }
  }

  public static void initialize(RdfConfiguration config) {
    if (INSTANCE != null) {
      throw new IllegalStateException("RdfRepository already initialized");
    }
    INSTANCE = new RdfRepository(config);
  }

  public static RdfRepository getInstance() {
    if (INSTANCE == null) {
      throw new IllegalStateException("RdfRepository not initialized");
    }
    return INSTANCE;
  }

  public boolean isEnabled() {
    return config.getEnabled() != null && config.getEnabled() && storageService != null;
  }

  /**
   * Create or update entity in RDF store
   */
  public void createOrUpdate(EntityInterface entity) {
    if (!isEnabled()) {
      return;
    }

    try {
      String entityType = entity.getEntityReference().getType();
      LOG.info(
          "Storing entity in RDF - Type: {}, FQN: {}, Name: {}, ID: {}",
          entityType,
          entity.getFullyQualifiedName(),
          entity.getName(),
          entity.getId());
      Model rdfModel = translator.toRdf(entity);
      storageService.storeEntity(entityType, entity.getId(), rdfModel);
      LOG.debug("Created/Updated entity {} in RDF store", entity.getId());
    } catch (Exception e) {
      LOG.error(
          "Failed to create/update entity {} in RDF - Type: {}, FQN: {}",
          entity.getId(),
          entity.getEntityReference().getType(),
          entity.getFullyQualifiedName(),
          e);
    }
  }

  /**
   * Delete entity from RDF store
   */
  public void delete(EntityReference entityReference) {
    if (!isEnabled()) {
      return;
    }

    try {
      // Clear the entity from its graph
      String graphUri = config.getBaseUri().toString() + "graph/" + entityReference.getType();
      String entityUri =
          config.getBaseUri().toString()
              + "entity/"
              + entityReference.getType()
              + "/"
              + entityReference.getId();

      // Remove entity and all its relationships
      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                  + "DELETE WHERE { ?s ?p <%s> }; "
                  + "DELETE WHERE { <%s> ?p ?o }",
              graphUri, entityUri, entityUri, entityUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Deleted entity {} from RDF store", entityReference.getId());
    } catch (Exception e) {
      LOG.error("Failed to delete entity {} from RDF", entityReference.getId(), e);
    }
  }

  /**
   * Add relationship to RDF store
   */
  public void addRelationship(EntityRelationship relationship) {
    if (!isEnabled()) {
      return;
    }

    try {
      storageService.storeRelationship(
          relationship.getFromEntity(),
          relationship.getFromId(),
          relationship.getToEntity(),
          relationship.getToId(),
          relationship.getRelationshipType().value());
      LOG.debug("Added relationship {} to RDF store", relationship);
    } catch (Exception e) {
      LOG.error("Failed to add relationship to RDF", e);
    }
  }

  /**
   * Remove relationship from RDF store
   */
  public void removeRelationship(EntityRelationship relationship) {
    if (!isEnabled()) {
      return;
    }

    try {
      String fromUri =
          config.getBaseUri().toString()
              + "entity/"
              + relationship.getFromEntity()
              + "/"
              + relationship.getFromId();
      String toUri =
          config.getBaseUri().toString()
              + "entity/"
              + relationship.getToEntity()
              + "/"
              + relationship.getToId();
      String predicateUri =
          config.getBaseUri().toString() + "ontology/" + relationship.getRelationshipType().value();

      String sparqlUpdate =
          String.format("DELETE WHERE { <%s> <%s> <%s> }", fromUri, predicateUri, toUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Removed relationship {} from RDF store", relationship);
    } catch (Exception e) {
      LOG.error("Failed to remove relationship from RDF", e);
    }
  }

  /**
   * Get entity as JSON-LD
   */
  public String getEntityAsJsonLd(String entityType, UUID entityId) throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF/JSON-LD not enabled");
    }

    try {
      // First get entity from primary store
      EntityInterface entity = Entity.getEntity(entityType, entityId, "*", null);
      return translator.toJsonLdString(entity, true);
    } catch (EntityNotFoundException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Failed to get entity {} as JSON-LD", entityId, e);
      throw new IOException("Failed to get entity as JSON-LD", e);
    }
  }

  /**
   * Get entity as RDF (various formats)
   */
  public String getEntityAsRdf(String entityType, UUID entityId, String format) throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    Model model = storageService.getEntity(entityType, entityId);
    if (model.isEmpty()) {
      throw new EntityNotFoundException(
          String.format("Entity %s not found in RDF store", entityId));
    }

    // Use SPARQL CONSTRUCT to get entity with all properties
    String entityUri = config.getBaseUri().toString() + "entity/" + entityType + "/" + entityId;
    String sparql =
        String.format("CONSTRUCT { <%s> ?p ?o } WHERE { <%s> ?p ?o }", entityUri, entityUri);

    return storageService.executeSparqlQuery(sparql, format);
  }

  /**
   * Execute SPARQL query
   */
  public String executeSparqlQuery(String query, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    return storageService.executeSparqlQuery(query, format);
  }

  /**
   * Execute SPARQL update
   */
  public void executeSparqlUpdate(String update) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    storageService.executeSparqlUpdate(update);
  }

  /**
   * Get RDF statistics
   */
  public RdfStatistics getStatistics() {
    if (!isEnabled()) {
      return new RdfStatistics(false, 0, 0, null);
    }

    return new RdfStatistics(
        true,
        storageService.getTripleCount(),
        storageService.getAllGraphs().size(),
        config.getStorageType().toString());
  }

  /**
   * Bulk sync entities (for migration/recovery)
   */
  public void bulkSyncEntities(String entityType) {
    if (!isEnabled()) {
      return;
    }

    try {
      LOG.info("Starting bulk sync for entity type: {}", entityType);

      // Get repository for this entity type
      // TODO: Implement bulk loading of entities
      LOG.warn("Bulk sync not implemented yet for entity type: {}", entityType);
    } catch (Exception e) {
      LOG.error("Failed bulk sync for entity type: {}", entityType, e);
    }
  }

  public void close() {
    if (storageService != null) {
      storageService.close();
    }
  }

  public static class RdfStatistics {
    public final boolean enabled;
    public final long tripleCount;
    public final int graphCount;
    public final String storageType;

    public RdfStatistics(boolean enabled, long tripleCount, int graphCount, String storageType) {
      this.enabled = enabled;
      this.tripleCount = tripleCount;
      this.graphCount = graphCount;
      this.storageType = storageType;
    }
  }
}
