package org.openmetadata.service.rdf;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
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

      // Load ontologies on initialization
      loadOntologies();
    } else {
      this.storageService = null;
      this.translator = null;
      LOG.info("RDF Repository disabled");
    }
  }

  private void loadOntologies() {
    try {
      OntologyLoader loader = new OntologyLoader(this);
      if (!loader.areOntologiesLoaded()) {
        LOG.info("Loading OpenMetadata ontologies into RDF store");
        loader.loadOntologies();
      } else {
        LOG.info("OpenMetadata ontologies already loaded");
      }
    } catch (Exception e) {
      LOG.error("Failed to load ontologies", e);
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

      // Remove entity and all its relationships from all graphs
      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                  + "DELETE WHERE { GRAPH ?g { ?s ?p <%s> } }; "
                  + "DELETE WHERE { GRAPH ?g { <%s> ?p ?o } }",
              graphUri, entityUri, entityUri, entityUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Deleted entity {} from RDF store", entityReference.getId());
    } catch (Exception e) {
      LOG.error("Failed to delete entity {} from RDF", entityReference.getId(), e);
    }
  }

  public void addRelationship(EntityRelationship relationship) {
    if (!isEnabled()) {
      return;
    }

    try {
      // Create a model for the relationship with proper RDF predicates
      Model relationshipModel = createRelationshipModel(relationship);

      // Store the relationship model
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

      // Add to the entity's graph
      Model fromEntityModel =
          storageService.getEntity(relationship.getFromEntity(), relationship.getFromId());
      
      if (fromEntityModel == null) {
        // During initialization, relationships might be added before entities are created in RDF
        // This is expected behavior, so we'll handle it gracefully without warnings
        LOG.debug(
            "Entity {} with ID {} not yet in RDF store, creating model for relationship",
            relationship.getFromEntity(),
            relationship.getFromId());
        fromEntityModel = ModelFactory.createDefaultModel();
        
        // Add basic entity information to make the model valid
        Resource entityResource = fromEntityModel.createResource(fromUri);
        entityResource.addProperty(
            fromEntityModel.createProperty(config.getBaseUri() + "ontology/entityType"),
            relationship.getFromEntity());
      }
      
      fromEntityModel.add(relationshipModel);
      storageService.storeEntity(
          relationship.getFromEntity(), relationship.getFromId(), fromEntityModel);

      LOG.debug("Added relationship {} to RDF store", relationship);
    } catch (Exception e) {
      LOG.error("Failed to add relationship to RDF", e);
    }
  }

  private Model createRelationshipModel(EntityRelationship relationship) {
    Model model = ModelFactory.createDefaultModel();

    // Set namespace prefixes
    model.setNsPrefix("om", "https://open-metadata.org/ontology/");
    model.setNsPrefix("prov", "http://www.w3.org/ns/prov#");
    model.setNsPrefix("dct", "http://purl.org/dc/terms/");

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

    Resource fromResource = model.createResource(fromUri);
    Resource toResource = model.createResource(toUri);

    // Map relationship type to RDF predicate based on entityRelationship context
    String relationshipType = relationship.getRelationshipType().value();
    Property predicate = getRelationshipPredicate(relationshipType, model);

    // Add the relationship triple
    fromResource.addProperty(predicate, toResource);

    return model;
  }

  private Property getRelationshipPredicate(String relationshipType, Model model) {
    // Map OpenMetadata relationship types to RDF predicates from context
    return switch (relationshipType.toLowerCase()) {
      case "contains" -> model.createProperty("https://open-metadata.org/ontology/", "contains");
      case "uses" -> model.createProperty("http://www.w3.org/ns/prov#", "used");
      case "owns" -> model.createProperty("https://open-metadata.org/ontology/", "owns");
      case "parentof" -> model.createProperty("https://open-metadata.org/ontology/", "parentOf");
      case "childof" -> model.createProperty("https://open-metadata.org/ontology/", "childOf");
      case "relatedto" -> model.createProperty("https://open-metadata.org/ontology/", "relatedTo");
      case "appliedto" -> model.createProperty("https://open-metadata.org/ontology/", "appliedTo");
      case "testedby" -> model.createProperty("https://open-metadata.org/ontology/", "testedBy");
      case "upstream" -> model.createProperty("http://www.w3.org/ns/prov#", "wasDerivedFrom");
      case "downstream" -> model.createProperty("http://www.w3.org/ns/prov#", "wasInfluencedBy");
      case "joinedwith" -> model.createProperty(
          "https://open-metadata.org/ontology/", "joinedWith");
      case "processedby" -> model.createProperty("http://www.w3.org/ns/prov#", "wasGeneratedBy");
      default -> model.createProperty("https://open-metadata.org/ontology/", relationshipType);
    };
  }

  public void bulkAddRelationships(List<EntityRelationship> relationships) {
    if (!isEnabled() || relationships.isEmpty()) {
      return;
    }

    try {
      List<RdfStorageInterface.RelationshipData> relationshipDataList = new ArrayList<>();
      for (EntityRelationship relationship : relationships) {
        relationshipDataList.add(
            new RdfStorageInterface.RelationshipData(
                relationship.getFromEntity(),
                relationship.getFromId(),
                relationship.getToEntity(),
                relationship.getToId(),
                relationship.getRelationshipType().value()));
      }
      storageService.bulkStoreRelationships(relationshipDataList);
      LOG.debug("Bulk added {} relationships to RDF store", relationships.size());
    } catch (Exception e) {
      LOG.error("Failed to bulk add relationships to RDF", e);
    }
  }

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

  public String getEntityAsJsonLd(String entityType, UUID entityId) throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF/JSON-LD not enabled");
    }

    try {
      // Get entity to convert to JSON-LD directly
      EntityInterface entity = Entity.getEntity(entityType, entityId, "*", null);

      // Convert directly to JSON-LD without going through RDF model
      return translator.toJsonLdString(entity, true);

    } catch (EntityNotFoundException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Failed to get entity {} as JSON-LD", entityId, e);
      throw new IOException("Failed to get entity as JSON-LD", e);
    }
  }

  public String getEntityAsRdf(String entityType, UUID entityId, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    try {
      // Get the entity and convert to RDF
      EntityInterface entity = Entity.getEntity(entityType, entityId, "*", null);
      Model rdfModel = translator.toRdf(entity);

      // Convert model to requested format
      java.io.StringWriter writer = new java.io.StringWriter();
      String rdfFormat =
          switch (format.toLowerCase()) {
            case "turtle", "ttl" -> "TURTLE";
            case "rdfxml", "xml" -> "RDF/XML";
            case "ntriples", "nt" -> "N-TRIPLES";
            default -> "TURTLE";
          };

      rdfModel.write(writer, rdfFormat);
      return writer.toString();

    } catch (EntityNotFoundException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Failed to get entity {} as RDF", entityId, e);
      throw new RuntimeException("Failed to get entity as RDF", e);
    }
  }

  public String executeSparqlQuery(String query, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    return storageService.executeSparqlQuery(query, format);
  }

  public List<Map<String, String>> executeSparqlQueryAsJson(String query) {
    String result = executeSparqlQuery(query, "json");
    return parseSparqlJsonResults(result);
  }

  public List<Map<String, String>> executeSparqlQueryWithInferenceAsJson(
      String query, String inferenceLevel) {
    String result = executeSparqlQueryWithInference(query, "json", inferenceLevel);
    return parseSparqlJsonResults(result);
  }

  private List<Map<String, String>> parseSparqlJsonResults(String jsonResult) {
    List<Map<String, String>> results = new ArrayList<>();
    try {
      JsonNode root = JsonUtils.readTree(jsonResult);
      JsonNode bindings = root.path("results").path("bindings");

      for (JsonNode binding : bindings) {
        Map<String, String> row = new HashMap<>();
        binding
            .fields()
            .forEachRemaining(
                entry -> {
                  JsonNode value = entry.getValue();
                  String val = value.path("value").asText();
                  row.put(entry.getKey(), val);
                });
        results.add(row);
      }
    } catch (Exception e) {
      LOG.error("Failed to parse SPARQL JSON results", e);
    }
    return results;
  }

  public String executeSparqlQueryWithInference(
      String query, String format, String inferenceLevel) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    try {
      // Convert inference level string to enum
      org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel level =
          switch (inferenceLevel.toLowerCase()) {
            case "rdfs" -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel
                .RDFS;
            case "owl" -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel
                .OWL_LITE;
            case "custom" -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel
                .CUSTOM;
            default -> org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel.NONE;
          };

      if (level == org.openmetadata.service.rdf.reasoning.InferenceEngine.ReasoningLevel.NONE) {
        return executeSparqlQuery(query, format);
      }

      // For inference queries, we need to work with the full model
      // This is a simplified implementation - in production, you'd want to cache the inference
      // model
      LOG.info("Executing SPARQL query with {} inference", inferenceLevel);

      // Get all data from the store (simplified - in production, use named graphs)
      String allDataQuery = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";
      String allData = storageService.executeSparqlQuery(allDataQuery, "text/turtle");

      // Create models
      org.apache.jena.rdf.model.Model baseModel =
          org.apache.jena.rdf.model.ModelFactory.createDefaultModel();
      baseModel.read(new java.io.StringReader(allData), null, "TURTLE");

      // Load ontology model
      org.apache.jena.rdf.model.Model ontologyModel =
          org.apache.jena.rdf.model.ModelFactory.createDefaultModel();
      String ontologyQuery =
          "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <https://open-metadata.org/graph/ontology> { ?s ?p ?o } }";
      String ontologyData = storageService.executeSparqlQuery(ontologyQuery, "text/turtle");
      if (ontologyData != null && !ontologyData.isEmpty()) {
        ontologyModel.read(new java.io.StringReader(ontologyData), null, "TURTLE");
      }

      // Create inference engine and inference model
      org.openmetadata.service.rdf.reasoning.InferenceEngine engine =
          new org.openmetadata.service.rdf.reasoning.InferenceEngine(level);
      org.apache.jena.rdf.model.InfModel infModel =
          engine.createInferenceModel(baseModel, ontologyModel);

      // Execute query on inference model
      org.apache.jena.query.Query jenaQuery = org.apache.jena.query.QueryFactory.create(query);
      org.apache.jena.query.QueryExecution qe =
          org.apache.jena.query.QueryExecutionFactory.create(jenaQuery, infModel);

      // Format results based on query type
      java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
      if (jenaQuery.isSelectType()) {
        org.apache.jena.query.ResultSet results = qe.execSelect();
        if (format.contains("json")) {
          org.apache.jena.query.ResultSetFormatter.outputAsJSON(out, results);
        } else if (format.contains("xml")) {
          org.apache.jena.query.ResultSetFormatter.outputAsXML(out, results);
        } else if (format.contains("csv")) {
          org.apache.jena.query.ResultSetFormatter.outputAsCSV(out, results);
        } else if (format.contains("tsv")) {
          org.apache.jena.query.ResultSetFormatter.outputAsTSV(out, results);
        }
      } else if (jenaQuery.isConstructType()) {
        org.apache.jena.rdf.model.Model constructModel = qe.execConstruct();
        constructModel.write(out, getJenaFormat(format));
      } else if (jenaQuery.isAskType()) {
        boolean result = qe.execAsk();
        out.write(("{\"head\":{},\"boolean\":" + result + "}").getBytes());
      } else if (jenaQuery.isDescribeType()) {
        org.apache.jena.rdf.model.Model describeModel = qe.execDescribe();
        describeModel.write(out, getJenaFormat(format));
      }

      qe.close();
      return out.toString();

    } catch (Exception e) {
      LOG.error("Error executing SPARQL query with inference", e);
      throw new RuntimeException("Failed to execute query with inference: " + e.getMessage(), e);
    }
  }

  private String getJenaFormat(String mimeType) {
    if (mimeType.contains("turtle")) return "TURTLE";
    if (mimeType.contains("rdf+xml")) return "RDF/XML";
    if (mimeType.contains("n-triples")) return "N-TRIPLES";
    if (mimeType.contains("json-ld") || mimeType.contains("ld+json")) return "JSON-LD";
    return "TURTLE"; // default
  }

  public String getEntityGraph(UUID entityId, String entityType, int depth) throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF Repository is not enabled");
    }

    String entityUri = config.getBaseUri().toString() + "entity/" + entityType + "/" + entityId;

    try {
      Set<String> visitedNodes = new HashSet<>();
      Set<String> currentLevelNodes = new HashSet<>();
      List<EdgeInfo> allEdges = new ArrayList<>();

      currentLevelNodes.add(entityUri);
      visitedNodes.add(entityUri);

      for (int currentDepth = 0;
          currentDepth < depth && !currentLevelNodes.isEmpty();
          currentDepth++) {
        Set<String> nextLevelNodes = new HashSet<>();

        // For each node at current level, get its relationships
        for (String nodeUri : currentLevelNodes) {
          String sparql = buildSingleNodeQuery(nodeUri);
          String results =
              storageService.executeSparqlQuery(sparql, "application/sparql-results+json");

          if (results != null && !results.trim().isEmpty()) {
            List<EdgeInfo> edges = parseEdgesFromResults(results, visitedNodes, nextLevelNodes);
            allEdges.addAll(edges);
          }
        }

        currentLevelNodes = nextLevelNodes;
        visitedNodes.addAll(nextLevelNodes);
      }

      return convertEdgesToGraphData(allEdges);
    } catch (Exception e) {
      LOG.error("Error getting entity graph for {}", entityUri, e);
      throw new IOException("Failed to get entity graph", e);
    }
  }

  private String extractPredicateName(String predicateUri) {
    if (predicateUri.contains("#")) {
      return predicateUri.substring(predicateUri.lastIndexOf('#') + 1);
    } else if (predicateUri.contains("/")) {
      return predicateUri.substring(predicateUri.lastIndexOf('/') + 1);
    }
    return predicateUri;
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
        EntityInterface entity = Entity.getEntity(entityType, UUID.fromString(entityId), "*", null);
        node.put(
            "label", entity.getDisplayName() != null ? entity.getDisplayName() : entity.getName());
        node.put("name", entity.getName());
        node.put("fullyQualifiedName", entity.getFullyQualifiedName());

        if (entity.getDescription() != null && !entity.getDescription().isEmpty()) {
          node.put("description", entity.getDescription());
        }

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
        node.put("label", entityType + ": " + entityId);
      }
    }
  }

  private String formatRelationshipLabel(String relationship) {
    return switch (relationship.toLowerCase()) {
      case "contains" -> "Contains";
      case "uses" -> "Uses";
      case "relatedto" -> "Related To";
      case "ownedby" -> "Owned By";
      case "belongsto" -> "Belongs To";
      case "derivedfrom" -> "Derived From";
      case "upstream" -> "Upstream";
      case "downstream" -> "Downstream";
      case "taggedwith" -> "Tagged With";
      case "classifiedas" -> "Classified As";
      case "indomain" -> "In Domain";
      case "hascolumn" -> "Has Column";
      case "hastable" -> "Has Table";
      case "hasglossaryterm" -> "Has Glossary Term";
      case "termreference" -> "Term Reference";
      case "synonymof" -> "Synonym Of";
      case "antonymof" -> "Antonym Of";
      case "ispartof" -> "Is Part Of";
      case "hasdataproduct" -> "Has Data Product";
      case "producedby" -> "Produced By";
      case "consumedby" -> "Consumed By";
      case "processedby" -> "Processed By";
      case "hasdatabase" -> "Has Database";
      case "hasschema" -> "Has Schema";
      case "hastopic" -> "Has Topic";
      case "hascontainer" -> "Has Container";
      case "hasmodel" -> "Has Model";
      case "hasstoredprocedure" -> "Has Stored Procedure";
      case "hasindex" -> "Has Index";
      default ->
      // Convert camelCase to Title Case
      relationship.replaceAll("([a-z])([A-Z])", "$1 $2").substring(0, 1).toUpperCase()
          + relationship.replaceAll("([a-z])([A-Z])", "$1 $2").substring(1);
    };
  }

  private String buildSingleNodeQuery(String nodeUri) {
    return "PREFIX om: <https://open-metadata.org/ontology/> "
        + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
        + "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> "
        + "SELECT DISTINCT ?subject ?predicate ?object WHERE { "
        + "  { "
        + "    GRAPH ?g { <"
        + nodeUri
        + "> ?predicate ?object . "
        + "    FILTER(isIRI(?object) && "
        + "           ?predicate != rdf:type && "
        + "           ?predicate != rdfs:label) } "
        + "    BIND(<"
        + nodeUri
        + "> AS ?subject) "
        + "  } UNION { "
        + "    GRAPH ?g { ?subject ?predicate <"
        + nodeUri
        + "> . "
        + "    FILTER(isIRI(?subject) && "
        + "           ?predicate != rdf:type && "
        + "           ?predicate != rdfs:label) } "
        + "    BIND(<"
        + nodeUri
        + "> AS ?object) "
        + "  } "
        + "} LIMIT 200";
  }

  private List<EdgeInfo> parseEdgesFromResults(
      String sparqlResults, Set<String> visitedNodes, Set<String> nextLevelNodes) {
    List<EdgeInfo> edges = new ArrayList<>();
    com.fasterxml.jackson.databind.JsonNode resultsJson = JsonUtils.readTree(sparqlResults);

    if (resultsJson.has("results") && resultsJson.get("results").has("bindings")) {
      for (com.fasterxml.jackson.databind.JsonNode binding :
          resultsJson.get("results").get("bindings")) {
        String subjectUri = binding.get("subject").get("value").asText();
        String objectUri = binding.get("object").get("value").asText();
        String predicate = binding.get("predicate").get("value").asText();

        EdgeInfo edge = new EdgeInfo(subjectUri, objectUri, extractPredicateName(predicate));
        edges.add(edge);

        if (!visitedNodes.contains(objectUri)) {
          nextLevelNodes.add(objectUri);
        }
        if (!visitedNodes.contains(subjectUri)) {
          nextLevelNodes.add(subjectUri);
        }
      }
    }

    return edges;
  }

  private static class EdgeInfo {
    final String fromUri;
    final String toUri;
    final String relation;

    EdgeInfo(String fromUri, String toUri, String relation) {
      this.fromUri = fromUri;
      this.toUri = toUri;
      this.relation = relation;
    }
  }

  private String convertEdgesToGraphData(List<EdgeInfo> edges) {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode graphEdges =
        JsonUtils.getObjectMapper().createArrayNode();

    Set<String> addedNodes = new HashSet<>();
    Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap = new HashMap<>();

    for (EdgeInfo edge : edges) {
      String fromUri = edge.fromUri;
      String toUri = edge.toUri;

      if (!addedNodes.contains(fromUri)) {
        com.fasterxml.jackson.databind.node.ObjectNode fromNode = createNodeFromUri(fromUri);
        nodes.add(fromNode);
        nodeMap.put(fromUri, fromNode);
        addedNodes.add(fromUri);
      }

      if (!addedNodes.contains(toUri)) {
        com.fasterxml.jackson.databind.node.ObjectNode toNode = createNodeFromUri(toUri);
        nodes.add(toNode);
        nodeMap.put(toUri, toNode);
        addedNodes.add(toUri);
      }

      com.fasterxml.jackson.databind.node.ObjectNode graphEdge =
          JsonUtils.getObjectMapper().createObjectNode();
      graphEdge.put("from", fromUri);
      graphEdge.put("to", toUri);
      graphEdge.put("label", formatRelationshipLabel(edge.relation));
      graphEdge.put("arrows", "to");
      graphEdges.add(graphEdge);
    }

    enhanceNodesWithEntityDetails(nodeMap);

    graphData.set("nodes", nodes);
    graphData.set("edges", graphEdges);

    return JsonUtils.pojoToJson(graphData);
  }

  public void executeSparqlUpdate(String update) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    storageService.executeSparqlUpdate(update);
  }

  /**
   * Load a Turtle file directly into a named graph
   */
  public void loadTurtleFile(InputStream turtleStream, String graphUri) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }

    storageService.loadTurtleFile(turtleStream, graphUri);
  }

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
