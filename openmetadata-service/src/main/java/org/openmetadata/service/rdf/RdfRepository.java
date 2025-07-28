package org.openmetadata.service.rdf;

import java.io.IOException;
import java.util.List;
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
   * Get entity graph data for visualization
   */
  public String getEntityGraph(UUID entityId, String entityType, int depth) throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF Repository is not enabled");
    }

    String entityUri = config.getBaseUri().toString() + "entity/" + entityType + "/" + entityId;

    try {
      // Use a simpler query that's less likely to have syntax errors
      // First, get all relationships for this entity
      String sparql =
          "PREFIX om: <https://open-metadata.org/ontology/> "
              + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
              + "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> "
              + "SELECT DISTINCT ?subject ?predicate ?object WHERE { "
              + "  { "
              + "    GRAPH ?g { <"
              + entityUri
              + "> ?predicate ?object . "
              + "    FILTER(isIRI(?object) && "
              + "           ?predicate != rdf:type && "
              + "           ?predicate != rdfs:label) } "
              + "    BIND(<"
              + entityUri
              + "> AS ?subject) "
              + "  } UNION { "
              + "    GRAPH ?g { ?subject ?predicate <"
              + entityUri
              + "> . "
              + "    FILTER(isIRI(?subject) && "
              + "           ?predicate != rdf:type && "
              + "           ?predicate != rdfs:label) } "
              + "    BIND(<"
              + entityUri
              + "> AS ?object) "
              + "  } "
              + "} LIMIT 100";

      LOG.debug("Executing SPARQL query for entity graph: {}", sparql);

      String results = storageService.executeSparqlQuery(sparql, "application/sparql-results+json");
      LOG.debug("SPARQL query results: {}", results);

      // Check if the result is actually JSON
      if (results == null || results.trim().isEmpty()) {
        LOG.warn("Empty results from SPARQL query");
        return createEmptyGraphData();
      }

      if (!results.trim().startsWith("{") && !results.trim().startsWith("[")) {
        LOG.error("Invalid JSON response from SPARQL query: {}", results);
        return createEmptyGraphData();
      }

      return convertSimpleSparqlResultsToGraphData(results);
    } catch (Exception e) {
      LOG.error("Error getting entity graph for {}", entityUri, e);
      throw new IOException("Failed to get entity graph", e);
    }
  }

  private String convertSparqlResultsToGraphData(String sparqlResults) throws IOException {
    com.fasterxml.jackson.databind.JsonNode resultsJson = JsonUtils.readTree(sparqlResults);
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode edges =
        JsonUtils.getObjectMapper().createArrayNode();

    java.util.Set<String> addedNodes = new java.util.HashSet<>();

    if (resultsJson.has("results") && resultsJson.get("results").has("bindings")) {
      for (com.fasterxml.jackson.databind.JsonNode binding :
          resultsJson.get("results").get("bindings")) {
        String subjectUri = binding.get("subject").get("value").asText();
        String subjectLabel =
            binding.has("subjectLabel")
                ? binding.get("subjectLabel").get("value").asText()
                : extractEntityName(subjectUri);
        String subjectType =
            binding.has("subjectType")
                ? extractTypeName(binding.get("subjectType").get("value").asText())
                : "entity";

        String objectUri = binding.get("object").get("value").asText();
        String objectLabel =
            binding.has("objectLabel")
                ? binding.get("objectLabel").get("value").asText()
                : extractEntityName(objectUri);
        String objectType =
            binding.has("objectType")
                ? extractTypeName(binding.get("objectType").get("value").asText())
                : "entity";

        String predicate = extractPredicateName(binding.get("predicate").get("value").asText());

        // Add subject node
        if (!addedNodes.contains(subjectUri)) {
          com.fasterxml.jackson.databind.node.ObjectNode subjectNode =
              JsonUtils.getObjectMapper().createObjectNode();
          subjectNode.put("id", subjectUri);
          subjectNode.put("label", subjectLabel);
          subjectNode.put("type", subjectType);
          subjectNode.put("group", subjectType.toLowerCase());
          subjectNode.put("title", subjectType + ": " + subjectLabel);
          nodes.add(subjectNode);
          addedNodes.add(subjectUri);
        }

        // Add object node
        if (!addedNodes.contains(objectUri)) {
          com.fasterxml.jackson.databind.node.ObjectNode objectNode =
              JsonUtils.getObjectMapper().createObjectNode();
          objectNode.put("id", objectUri);
          objectNode.put("label", objectLabel);
          objectNode.put("type", objectType);
          objectNode.put("group", objectType.toLowerCase());
          objectNode.put("title", objectType + ": " + objectLabel);
          nodes.add(objectNode);
          addedNodes.add(objectUri);
        }

        // Add edge
        com.fasterxml.jackson.databind.node.ObjectNode edge =
            JsonUtils.getObjectMapper().createObjectNode();
        edge.put("from", subjectUri);
        edge.put("to", objectUri);
        edge.put("label", predicate);
        edge.put("arrows", "to");
        edges.add(edge);
      }
    }

    graphData.set("nodes", nodes);
    graphData.set("edges", edges);

    return JsonUtils.pojoToJson(graphData);
  }

  private String extractTypeName(String typeUri) {
    if (typeUri.contains("#")) {
      return typeUri.substring(typeUri.lastIndexOf('#') + 1);
    } else if (typeUri.contains("/")) {
      return typeUri.substring(typeUri.lastIndexOf('/') + 1);
    }
    return typeUri;
  }

  private String extractPredicateName(String predicateUri) {
    if (predicateUri.contains("#")) {
      return predicateUri.substring(predicateUri.lastIndexOf('#') + 1);
    } else if (predicateUri.contains("/")) {
      return predicateUri.substring(predicateUri.lastIndexOf('/') + 1);
    }
    return predicateUri;
  }

  private String extractEntityName(String entityUri) {
    // Extract entity name from URI like https://open-metadata.org/entity/table/uuid
    if (entityUri.contains("/entity/")) {
      String[] parts = entityUri.split("/entity/")[1].split("/");
      if (parts.length >= 2) {
        return parts[0] + ":" + parts[1];
      }
    }
    return extractTypeName(entityUri);
  }

  private String convertSimpleSparqlResultsToGraphData(String sparqlResults) throws IOException {
    com.fasterxml.jackson.databind.JsonNode resultsJson = JsonUtils.readTree(sparqlResults);
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode edges =
        JsonUtils.getObjectMapper().createArrayNode();

    java.util.Set<String> addedNodes = new java.util.HashSet<>();
    java.util.Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap =
        new java.util.HashMap<>();

    if (resultsJson.has("results") && resultsJson.get("results").has("bindings")) {
      for (com.fasterxml.jackson.databind.JsonNode binding :
          resultsJson.get("results").get("bindings")) {
        String subjectUri = binding.get("subject").get("value").asText();
        String objectUri = binding.get("object").get("value").asText();
        String predicate = extractPredicateName(binding.get("predicate").get("value").asText());

        // Add subject node
        if (!addedNodes.contains(subjectUri)) {
          com.fasterxml.jackson.databind.node.ObjectNode subjectNode =
              createNodeFromUri(subjectUri);
          nodes.add(subjectNode);
          nodeMap.put(subjectUri, subjectNode);
          addedNodes.add(subjectUri);
        }

        // Add object node
        if (!addedNodes.contains(objectUri)) {
          com.fasterxml.jackson.databind.node.ObjectNode objectNode = createNodeFromUri(objectUri);
          nodes.add(objectNode);
          nodeMap.put(objectUri, objectNode);
          addedNodes.add(objectUri);
        }

        // Add edge with formatted label
        com.fasterxml.jackson.databind.node.ObjectNode edge =
            JsonUtils.getObjectMapper().createObjectNode();
        edge.put("from", subjectUri);
        edge.put("to", objectUri);
        edge.put("label", formatRelationshipLabel(predicate));
        edge.put("arrows", "to");
        edges.add(edge);
      }
    }

    // Enhance nodes with entity details from database
    enhanceNodesWithEntityDetails(nodeMap);

    graphData.set("nodes", nodes);
    graphData.set("edges", edges);

    return JsonUtils.pojoToJson(graphData);
  }

  private String extractEntityTypeFromUri(String entityUri) {
    // Extract entity type from URI like https://open-metadata.org/entity/table/uuid
    if (entityUri.contains("/entity/")) {
      String[] parts = entityUri.split("/entity/")[1].split("/");
      if (parts.length >= 1) {
        return parts[0];
      }
    }
    return "entity";
  }

  private String createEmptyGraphData() throws IOException {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    graphData.set("nodes", JsonUtils.getObjectMapper().createArrayNode());
    graphData.set("edges", JsonUtils.getObjectMapper().createArrayNode());
    return JsonUtils.pojoToJson(graphData);
  }

  private com.fasterxml.jackson.databind.node.ObjectNode createNodeFromUri(String entityUri) {
    com.fasterxml.jackson.databind.node.ObjectNode node =
        JsonUtils.getObjectMapper().createObjectNode();

    String entityId = extractEntityIdFromUri(entityUri);
    String entityType = extractEntityTypeFromUri(entityUri);

    node.put("id", entityUri);
    node.put("entityId", entityId);
    node.put("type", entityType);
    node.put("group", entityType.toLowerCase());

    // Set temporary label - will be replaced with actual entity name
    node.put("label", entityId);

    return node;
  }

  private String extractEntityIdFromUri(String entityUri) {
    // Extract entity ID from URI like https://open-metadata.org/entity/table/uuid
    if (entityUri.contains("/entity/")) {
      String[] parts = entityUri.split("/entity/")[1].split("/");
      if (parts.length >= 2) {
        return parts[1];
      }
    }
    return entityUri.substring(entityUri.lastIndexOf('/') + 1);
  }

  private void enhanceNodesWithEntityDetails(
      java.util.Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap) {
    for (java.util.Map.Entry<String, com.fasterxml.jackson.databind.node.ObjectNode> entry :
        nodeMap.entrySet()) {
      com.fasterxml.jackson.databind.node.ObjectNode node = entry.getValue();
      String entityId = node.get("entityId").asText();
      String entityType = node.get("type").asText();

      try {
        // Fetch entity details from database
        EntityInterface entity = Entity.getEntity(entityType, UUID.fromString(entityId), "*", null);

        // Update node with actual entity details
        node.put(
            "label", entity.getDisplayName() != null ? entity.getDisplayName() : entity.getName());
        node.put("name", entity.getName());
        node.put("fullyQualifiedName", entity.getFullyQualifiedName());

        // Add description
        if (entity.getDescription() != null && !entity.getDescription().isEmpty()) {
          node.put("description", entity.getDescription());
        }

        // Add tags
        if (entity.getTags() != null && !entity.getTags().isEmpty()) {
          com.fasterxml.jackson.databind.node.ArrayNode tagsArray =
              JsonUtils.getObjectMapper().createArrayNode();
          entity
              .getTags()
              .forEach(
                  tag -> {
                    com.fasterxml.jackson.databind.node.ObjectNode tagNode =
                        JsonUtils.getObjectMapper().createObjectNode();
                    tagNode.put("tagFQN", tag.getTagFQN());
                    tagNode.put("name", tag.getLabelType() + "." + tag.getTagFQN());
                    tagsArray.add(tagNode);
                  });
          node.set("tags", tagsArray);
        }

        // Create enhanced title for tooltip
        StringBuilder titleBuilder = new StringBuilder();
        titleBuilder
            .append("<div style='padding: 8px; min-width: 200px;'>")
            .append("<div style='font-weight: 600; margin-bottom: 4px;'>")
            .append(entity.getDisplayName() != null ? entity.getDisplayName() : entity.getName())
            .append("</div>")
            .append("<div style='font-size: 12px; color: #8c8c8c; margin-bottom: 4px;'>")
            .append("Type: ")
            .append(entityType)
            .append("</div>")
            .append("<div style='font-size: 11px; color: #999; margin-bottom: 4px;'>")
            .append(entity.getFullyQualifiedName())
            .append("</div>");

        if (entity.getDescription() != null && !entity.getDescription().isEmpty()) {
          titleBuilder
              .append("<div style='font-size: 12px; margin-top: 4px;'>")
              .append(entity.getDescription())
              .append("</div>");
        }

        titleBuilder.append("</div>");
        node.put("title", titleBuilder.toString());

      } catch (Exception e) {
        LOG.warn("Failed to fetch entity details for {}: {}", entityId, e.getMessage());
        // Keep the basic information if entity details can't be fetched
        node.put("label", entityType + ": " + entityId);
      }
    }
  }

  private String formatRelationshipLabel(String relationship) {
    // Format relationship labels to be more user-friendly
    switch (relationship.toLowerCase()) {
      case "contains":
        return "Contains";
      case "uses":
        return "Uses";
      case "relatedto":
        return "Related To";
      case "ownedby":
        return "Owned By";
      case "belongsto":
        return "Belongs To";
      case "derivedfrom":
        return "Derived From";
      case "upstream":
        return "Upstream";
      case "downstream":
        return "Downstream";
      case "taggedwith":
        return "Tagged With";
      case "classifiedas":
        return "Classified As";
      case "indomain":
        return "In Domain";
      case "hascolumn":
        return "Has Column";
      case "hastable":
        return "Has Table";
      case "hasglossaryterm":
        return "Has Glossary Term";
      case "termreference":
        return "Term Reference";
      case "synonymof":
        return "Synonym Of";
      case "antonymof":
        return "Antonym Of";
      case "ispartof":
        return "Is Part Of";
      case "hasdataproduct":
        return "Has Data Product";
      case "producedby":
        return "Produced By";
      case "consumedby":
        return "Consumed By";
      case "processedby":
        return "Processed By";
      case "hasdatabase":
        return "Has Database";
      case "hasschema":
        return "Has Schema";
      case "hastopic":
        return "Has Topic";
      case "hascontainer":
        return "Has Container";
      case "hasmodel":
        return "Has Model";
      case "hasstoredprocedure":
        return "Has Stored Procedure";
      case "hasindex":
        return "Has Index";
      default:
        // Convert camelCase to Title Case
        return relationship.replaceAll("([a-z])([A-Z])", "$1 $2").substring(0, 1).toUpperCase()
            + relationship.replaceAll("([a-z])([A-Z])", "$1 $2").substring(1);
    }
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
  public void bulkSyncEntities(String entityType, List<? extends EntityInterface> entities) {
    if (!isEnabled()) {
      return;
    }

    try {
      LOG.info(
          "Starting bulk sync for entity type: {} with {} entities", entityType, entities.size());

      for (EntityInterface entity : entities) {
        try {
          createOrUpdate(entity);
        } catch (Exception e) {
          LOG.error("Failed to sync entity {} of type {}", entity.getId(), entityType, e);
        }
      }

      LOG.info("Completed bulk sync for entity type: {}", entityType);
    } catch (Exception e) {
      LOG.error("Failed bulk sync for entity type: {}", entityType, e);
    }
  }

  /**
   * Clear all data from RDF store
   */
  public void clearAll() {
    if (!isEnabled()) {
      return;
    }

    try {
      LOG.info("Clearing all data from RDF store");
      storageService.executeSparqlUpdate("CLEAR ALL");
      LOG.info("Successfully cleared all data from RDF store");
    } catch (Exception e) {
      LOG.error("Failed to clear RDF store", e);
      throw new RuntimeException("Failed to clear RDF store", e);
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
