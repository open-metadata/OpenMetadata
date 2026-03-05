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
import org.openmetadata.schema.configuration.RelationCardinality;
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

  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";

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

  public static void reset() {
    if (INSTANCE != null) {
      INSTANCE.close();
    }
    INSTANCE = null;
  }

  public boolean isEnabled() {
    return config.getEnabled() != null && config.getEnabled() && storageService != null;
  }

  public String getBaseUri() {
    return config.getBaseUri().toString();
  }

  public void createOrUpdate(EntityInterface entity) {
    if (!isEnabled()) {
      return;
    }

    try {
      String entityType = entity.getEntityReference().getType();
      LOG.debug(
          "Storing entity in RDF - Type: {}, FQN: {}, Name: {}, ID: {}",
          entityType,
          entity.getFullyQualifiedName(),
          entity.getName(),
          entity.getId());
      Model rdfModel = translator.toRdf(entity);

      // Preserve existing relationship triples before updating
      // This prevents postCreate() from overwriting relationships added by storeRelationships()
      Model existingModel = storageService.getEntity(entityType, entity.getId());
      if (existingModel != null && !existingModel.isEmpty()) {
        String entityUri =
            config.getBaseUri().toString() + "entity/" + entityType + "/" + entity.getId();
        // Extract and preserve relationship triples (where entity is subject and object is a URI)
        Model relationshipTriples = extractRelationshipTriples(existingModel, entityUri);
        if (!relationshipTriples.isEmpty()) {
          rdfModel.add(relationshipTriples);
          LOG.debug(
              "Preserved {} relationship triples for entity {}",
              relationshipTriples.size(),
              entity.getId());
        }
      }

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

  private Model extractRelationshipTriples(Model model, String entityUri) {
    Model relationshipTriples = ModelFactory.createDefaultModel();
    Resource entityResource = model.createResource(entityUri);

    // Find all triples where entity is subject and object is a URI resource (relationships)
    model
        .listStatements(entityResource, null, (org.apache.jena.rdf.model.RDFNode) null)
        .forEachRemaining(
            stmt -> {
              if (stmt.getObject().isURIResource()) {
                String objectUri = stmt.getObject().asResource().getURI();
                // Only preserve triples that link to other entities (not type/label predicates)
                if (objectUri.contains("/entity/")) {
                  relationshipTriples.add(stmt);
                }
              }
            });

    return relationshipTriples;
  }

  public void delete(EntityReference entityReference) {
    if (!isEnabled()) {
      return;
    }

    try {
      String entityUri =
          config.getBaseUri().toString()
              + "entity/"
              + entityReference.getType()
              + "/"
              + entityReference.getId();

      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> ?p ?o } }; "
                  + "DELETE WHERE { GRAPH <%s> { ?s ?p <%s> } }",
              KNOWLEDGE_GRAPH, entityUri, KNOWLEDGE_GRAPH, entityUri);

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
      Model relationshipModel = createRelationshipModel(relationship);

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

    String relationshipType = relationship.getRelationshipType().value();
    Property predicate = getRelationshipPredicate(relationshipType, model);

    fromResource.addProperty(predicate, toResource);

    return model;
  }

  private Property getRelationshipPredicate(String relationshipType, Model model) {
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

  /**
   * Add a lineage relationship with full details (SQL query, pipeline, column lineage). This stores
   * the lineage as structured RDF triples instead of a single JSON literal, enabling rich SPARQL
   * queries like: "Find all tables derived from table X via pipeline Y" or "What columns from
   * source table feed into column Z"
   */
  public void addLineageWithDetails(
      String fromType,
      UUID fromId,
      String toType,
      UUID toId,
      org.openmetadata.schema.type.LineageDetails lineageDetails) {
    if (!isEnabled()) {
      return;
    }

    try {
      Model model = ModelFactory.createDefaultModel();

      model.setNsPrefix("om", "https://open-metadata.org/ontology/");
      model.setNsPrefix("prov", "http://www.w3.org/ns/prov#");
      model.setNsPrefix("dct", "http://purl.org/dc/terms/");

      String fromUri = config.getBaseUri().toString() + "entity/" + fromType + "/" + fromId;
      String toUri = config.getBaseUri().toString() + "entity/" + toType + "/" + toId;

      Resource fromResource = model.createResource(fromUri);
      Resource toResource = model.createResource(toUri);

      // PROV-O: to wasDerivedFrom from (reverse direction for semantic correctness)
      Property derivedFrom = model.createProperty("http://www.w3.org/ns/prov#", "wasDerivedFrom");
      toResource.addProperty(derivedFrom, fromResource);

      // OpenMetadata-specific upstream for compatibility
      Property upstream = model.createProperty("https://open-metadata.org/ontology/", "UPSTREAM");
      fromResource.addProperty(upstream, toResource);

      if (lineageDetails != null) {
        String detailsUri =
            config.getBaseUri().toString()
                + "lineageDetails/"
                + fromId
                + "/"
                + toId
                + "/"
                + System.currentTimeMillis();
        Resource detailsResource = model.createResource(detailsUri);

        Property hasLineageDetails =
            model.createProperty("https://open-metadata.org/ontology/", "hasLineageDetails");
        fromResource.addProperty(hasLineageDetails, detailsResource);

        detailsResource.addProperty(
            model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
            model.createResource("https://open-metadata.org/ontology/LineageDetails"));

        if (lineageDetails.getSqlQuery() != null && !lineageDetails.getSqlQuery().isEmpty()) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "sqlQuery"),
              lineageDetails.getSqlQuery());
        }

        if (lineageDetails.getSource() != null) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "lineageSource"),
              lineageDetails.getSource().value());
        }

        if (lineageDetails.getDescription() != null && !lineageDetails.getDescription().isEmpty()) {
          detailsResource.addProperty(
              model.createProperty("http://purl.org/dc/terms/", "description"),
              lineageDetails.getDescription());
        }

        if (lineageDetails.getPipeline() != null && lineageDetails.getPipeline().getId() != null) {
          EntityReference pipeline = lineageDetails.getPipeline();
          String pipelineType = pipeline.getType() != null ? pipeline.getType() : "pipeline";
          String pipelineUri =
              config.getBaseUri().toString() + "entity/" + pipelineType + "/" + pipeline.getId();
          Resource pipelineResource = model.createResource(pipelineUri);

          detailsResource.addProperty(
              model.createProperty("http://www.w3.org/ns/prov#", "wasGeneratedBy"),
              pipelineResource);
        }

        if (lineageDetails.getColumnsLineage() != null
            && !lineageDetails.getColumnsLineage().isEmpty()) {
          Property hasColumnLineage =
              model.createProperty("https://open-metadata.org/ontology/", "hasColumnLineage");

          for (org.openmetadata.schema.type.ColumnLineage colLineage :
              lineageDetails.getColumnsLineage()) {
            String colLineageUri = detailsUri + "/columnLineage/" + System.nanoTime();
            Resource colLineageResource = model.createResource(colLineageUri);

            detailsResource.addProperty(hasColumnLineage, colLineageResource);
            colLineageResource.addProperty(
                model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
                model.createResource("https://open-metadata.org/ontology/ColumnLineage"));

            if (colLineage.getFromColumns() != null) {
              Property fromColumnProp =
                  model.createProperty("https://open-metadata.org/ontology/", "fromColumn");
              for (String fromCol : colLineage.getFromColumns()) {
                colLineageResource.addProperty(fromColumnProp, fromCol);
              }
            }

            if (colLineage.getToColumn() != null) {
              colLineageResource.addProperty(
                  model.createProperty("https://open-metadata.org/ontology/", "toColumn"),
                  colLineage.getToColumn());
            }

            if (colLineage.getFunction() != null) {
              colLineageResource.addProperty(
                  model.createProperty("https://open-metadata.org/ontology/", "transformFunction"),
                  colLineage.getFunction());
            }
          }
        }

        if (lineageDetails.getCreatedAt() != null) {
          detailsResource.addProperty(
              model.createProperty("http://purl.org/dc/terms/", "created"),
              model.createTypedLiteral(
                  lineageDetails.getCreatedAt().toString(),
                  org.apache.jena.datatypes.xsd.XSDDatatype.XSDlong));
        }
        if (lineageDetails.getUpdatedAt() != null) {
          detailsResource.addProperty(
              model.createProperty("http://purl.org/dc/terms/", "modified"),
              model.createTypedLiteral(
                  lineageDetails.getUpdatedAt().toString(),
                  org.apache.jena.datatypes.xsd.XSDDatatype.XSDlong));
        }

        if (lineageDetails.getCreatedBy() != null) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "lineageCreatedBy"),
              lineageDetails.getCreatedBy());
        }
        if (lineageDetails.getUpdatedBy() != null) {
          detailsResource.addProperty(
              model.createProperty("https://open-metadata.org/ontology/", "lineageUpdatedBy"),
              lineageDetails.getUpdatedBy());
        }
      }

      // Idempotent delete/insert pattern ensures no duplicate triples
      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, "N-TRIPLES");
      String triples = writer.toString();

      if (!triples.isEmpty()) {
        String deleteQuery =
            String.format(
                "DELETE WHERE { GRAPH <%s> { <%s> <https://open-metadata.org/ontology/UPSTREAM> <%s> . } }; "
                    + "DELETE WHERE { GRAPH <%s> { <%s> <http://www.w3.org/ns/prov#wasDerivedFrom> <%s> . } }",
                KNOWLEDGE_GRAPH, fromUri, toUri, KNOWLEDGE_GRAPH, toUri, fromUri);

        storageService.executeSparqlUpdate(deleteQuery);

        StringBuilder insertQuery = new StringBuilder();
        insertQuery.append("INSERT DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");
        insertQuery.append(triples);
        insertQuery.append(" } }");

        storageService.executeSparqlUpdate(insertQuery.toString());
        LOG.debug("Added lineage with details from {}/{} to {}/{}", fromType, fromId, toType, toId);
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to add lineage with details from {}/{} to {}/{}",
          fromType,
          fromId,
          toType,
          toId,
          e);
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

    // Check if inference is enabled by default in configuration
    if (isInferenceEnabledByDefault()) {
      String defaultLevel = getDefaultInferenceLevel();
      return executeSparqlQueryWithInference(query, format, defaultLevel);
    }

    return storageService.executeSparqlQuery(query, format);
  }

  /**
   * Execute SPARQL query without inference, regardless of configuration. Use this for internal
   * queries where inference overhead is not needed.
   */
  public String executeSparqlQueryDirect(String query, String format) {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF not enabled");
    }
    return storageService.executeSparqlQuery(query, format);
  }

  public boolean isInferenceEnabledByDefault() {
    return config.getInferenceEnabled() != null && config.getInferenceEnabled();
  }

  public String getDefaultInferenceLevel() {
    if (config.getDefaultInferenceLevel() != null) {
      return config.getDefaultInferenceLevel().value();
    }
    return "NONE";
  }

  public RdfConfiguration getConfig() {
    return config;
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
        return executeSparqlQueryDirect(query, format);
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

  /**
   * Get glossary term relationship graph with pagination support.
   * This method queries the RDF store for glossary terms and their relationships,
   * supporting filtering by glossary and relation types.
   *
   * @param glossaryId Optional glossary ID to filter terms
   * @param relationTypes Comma-separated list of relation types to include (e.g., "relatedTo,synonym")
   * @param limit Maximum number of terms to return
   * @param offset Pagination offset
   * @param includeIsolated Whether to include terms without relationships
   * @return JSON string with nodes and edges
   */
  public String getGlossaryTermGraph(
      UUID glossaryId, String relationTypes, int limit, int offset, boolean includeIsolated)
      throws IOException {
    if (!isEnabled()) {
      throw new IllegalStateException("RDF Repository is not enabled");
    }

    try {
      String sparqlQuery =
          buildGlossaryTermGraphQuery(glossaryId, relationTypes, limit, offset, includeIsolated);
      LOG.info("SPARQL Query for glossary term graph:\n{}", sparqlQuery);

      String results =
          storageService.executeSparqlQuery(sparqlQuery, "application/sparql-results+json");
      LOG.info(
          "SPARQL Results (first 2000 chars): {}",
          results.length() > 2000 ? results.substring(0, 2000) + "..." : results);

      return parseGlossaryTermGraphResults(results, includeIsolated, glossaryId, limit, offset);
    } catch (Exception e) {
      LOG.error("Error getting glossary term graph", e);
      throw new IOException("Failed to get glossary term graph", e);
    }
  }

  private String buildGlossaryTermGraphQuery(
      UUID glossaryId, String relationTypes, int limit, int offset, boolean includeIsolated) {
    StringBuilder queryBuilder = new StringBuilder();
    queryBuilder.append("PREFIX om: <https://open-metadata.org/ontology/> ");
    queryBuilder.append("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> ");
    queryBuilder.append("PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> ");
    queryBuilder.append("PREFIX skos: <http://www.w3.org/2004/02/skos/core#> ");
    queryBuilder.append("PREFIX prov: <http://www.w3.org/ns/prov#> ");
    queryBuilder.append(
        "SELECT DISTINCT ?term1 ?term2 ?relationType ?term1Name ?term2Name ?term1FQN ?term2FQN ?term1DisplayName ?term2DisplayName ?glossary ");
    queryBuilder.append("WHERE { ");
    queryBuilder.append("  GRAPH ?g { ");
    // Note: glossaryTerm entities are typed as skos:Concept (see RdfUtils.getRdfType)
    queryBuilder.append("    ?term1 a skos:Concept . ");
    // Filter to only include glossaryTerm URIs (not tags or other skos:Concept types)
    queryBuilder.append("    FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) ");
    queryBuilder.append("    OPTIONAL { ?term1 om:name ?term1Name } ");
    queryBuilder.append("    OPTIONAL { ?term1 skos:prefLabel ?term1DisplayName } ");
    queryBuilder.append("    OPTIONAL { ?term1 om:fullyQualifiedName ?term1FQN } ");
    queryBuilder.append("    OPTIONAL { ?term1 om:belongsTo ?glossary } ");

    // Build relation type filter
    List<String> relationPredicates = new ArrayList<>();
    if (relationTypes != null && !relationTypes.isEmpty()) {
      for (String relType : relationTypes.split(",")) {
        String trimmed = relType.trim().toLowerCase();
        relationPredicates.add(getRelationPredicate(trimmed));
      }
    } else {
      // Default: all glossary term relations (must match predicates from settings/storage)
      // OpenMetadata ontology predicates
      relationPredicates.add("om:relatedTo");
      relationPredicates.add("om:typeOf");
      relationPredicates.add("om:hasTypes");
      relationPredicates.add("om:componentOf");
      relationPredicates.add("om:composedOf");
      relationPredicates.add("om:calculatedFrom");
      relationPredicates.add("om:usedToCalculate");
      relationPredicates.add("om:partOf");
      relationPredicates.add("om:hasPart");
      relationPredicates.add("om:antonym");
      // SKOS predicates (as configured in settings)
      relationPredicates.add("skos:broader");
      relationPredicates.add("skos:narrower");
      relationPredicates.add("skos:related");
      relationPredicates.add("skos:exactMatch"); // synonym
      // RDFS predicates
      relationPredicates.add("rdfs:seeAlso");
      relationPredicates.add("rdfs:subClassOf");
      // PROV-O predicates (for calculatedFrom, usedToCalculate)
      relationPredicates.add("prov:wasDerivedFrom");
      relationPredicates.add("prov:wasInfluencedBy");
    }

    queryBuilder.append("    OPTIONAL { ");
    queryBuilder.append("      ?term1 ?relationType ?term2 . ");
    // Note: glossaryTerm entities are typed as skos:Concept (see RdfUtils.getRdfType)
    queryBuilder.append("      ?term2 a skos:Concept . ");
    queryBuilder.append("      FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) ");
    queryBuilder.append("      OPTIONAL { ?term2 om:name ?term2Name } ");
    queryBuilder.append("      OPTIONAL { ?term2 skos:prefLabel ?term2DisplayName } ");
    queryBuilder.append("      OPTIONAL { ?term2 om:fullyQualifiedName ?term2FQN } ");
    queryBuilder.append("      FILTER(?relationType IN (");
    queryBuilder.append(String.join(", ", relationPredicates));
    queryBuilder.append(")) ");
    queryBuilder.append("    } ");

    // Filter by glossary if specified
    if (glossaryId != null) {
      String glossaryUri = config.getBaseUri().toString() + "entity/glossary/" + glossaryId;
      queryBuilder.append("    FILTER(?glossary = <").append(glossaryUri).append(">) ");
    }

    queryBuilder.append("  } ");
    queryBuilder.append("} ");
    queryBuilder.append("ORDER BY ?term1Name ");
    queryBuilder.append("LIMIT ").append(limit * 10); // Get more to account for relations
    queryBuilder.append(" OFFSET ").append(offset);

    return queryBuilder.toString();
  }

  private String getRelationPredicate(String relationType) {
    // Must match the predicates configured in GlossaryTermRelationSettings
    return switch (relationType) {
      case "relatedto", "related" -> "om:relatedTo";
      case "synonym" -> "skos:exactMatch"; // matches settings config
      case "typeof", "type" -> "om:typeOf";
      case "hastypes" -> "om:hasTypes";
      case "componentof" -> "om:componentOf";
      case "composedof" -> "om:composedOf";
      case "calculatedfrom" -> "om:calculatedFrom";
      case "usedtocalculate" -> "om:usedToCalculate";
      case "seealso" -> "rdfs:seeAlso"; // matches settings config
      case "broader" -> "skos:broader";
      case "narrower" -> "skos:narrower";
      case "skosrelated" -> "skos:related";
      case "partof" -> "om:partOf";
      case "haspart" -> "om:hasPart";
      case "antonym" -> "om:antonym";
      default -> {
        if (!relationType.matches("[a-zA-Z][a-zA-Z0-9]*")) {
          LOG.warn("Invalid relation type rejected: {}", relationType);
          yield "om:relatedTo";
        }
        yield "om:" + relationType;
      }
    };
  }

  private String parseGlossaryTermGraphResults(
      String sparqlResults, boolean includeIsolated, UUID glossaryId, int limit, int offset)
      throws IOException {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode edges =
        JsonUtils.getObjectMapper().createArrayNode();

    Set<String> addedNodes = new HashSet<>();
    Map<String, com.fasterxml.jackson.databind.node.ObjectNode> nodeMap = new HashMap<>();
    Set<String> edgeKeys = new HashSet<>();
    Set<String> termsWithRelations = new HashSet<>();

    com.fasterxml.jackson.databind.JsonNode resultsJson = JsonUtils.readTree(sparqlResults);

    if (resultsJson.has("results") && resultsJson.get("results").has("bindings")) {
      for (com.fasterxml.jackson.databind.JsonNode binding :
          resultsJson.get("results").get("bindings")) {

        String term1Uri = binding.has("term1") ? binding.get("term1").get("value").asText() : null;
        String term2Uri =
            binding.has("term2") && !binding.get("term2").isNull()
                ? binding.get("term2").get("value").asText()
                : null;
        String relationTypeUri =
            binding.has("relationType") && !binding.get("relationType").isNull()
                ? binding.get("relationType").get("value").asText()
                : null;
        String term1Name =
            binding.has("term1Name") && !binding.get("term1Name").isNull()
                ? binding.get("term1Name").get("value").asText()
                : null;
        String term2Name =
            binding.has("term2Name") && !binding.get("term2Name").isNull()
                ? binding.get("term2Name").get("value").asText()
                : null;
        String term1DisplayName =
            binding.has("term1DisplayName") && !binding.get("term1DisplayName").isNull()
                ? binding.get("term1DisplayName").get("value").asText()
                : null;
        String term2DisplayName =
            binding.has("term2DisplayName") && !binding.get("term2DisplayName").isNull()
                ? binding.get("term2DisplayName").get("value").asText()
                : null;
        String term1FQN =
            binding.has("term1FQN") && !binding.get("term1FQN").isNull()
                ? binding.get("term1FQN").get("value").asText()
                : null;
        String term2FQN =
            binding.has("term2FQN") && !binding.get("term2FQN").isNull()
                ? binding.get("term2FQN").get("value").asText()
                : null;

        // Use displayName if available, otherwise fall back to name
        String term1Label = term1DisplayName != null ? term1DisplayName : term1Name;
        String term2Label = term2DisplayName != null ? term2DisplayName : term2Name;

        if (term1Uri == null) continue;

        // Add term1 node
        if (!addedNodes.contains(term1Uri) && addedNodes.size() < limit) {
          com.fasterxml.jackson.databind.node.ObjectNode node =
              createGlossaryTermNode(term1Uri, term1Label, term1FQN, term2Uri != null);
          nodes.add(node);
          nodeMap.put(term1Uri, node);
          addedNodes.add(term1Uri);
        }

        // If there's a relation, add term2 and the edge
        if (term2Uri != null && relationTypeUri != null) {
          termsWithRelations.add(term1Uri);
          termsWithRelations.add(term2Uri);

          if (!addedNodes.contains(term2Uri) && addedNodes.size() < limit) {
            com.fasterxml.jackson.databind.node.ObjectNode node =
                createGlossaryTermNode(term2Uri, term2Label, term2FQN, true);
            nodes.add(node);
            nodeMap.put(term2Uri, node);
            addedNodes.add(term2Uri);
          }

          // Add edge (avoid duplicates)
          String edgeKey = term1Uri + "-" + relationTypeUri + "-" + term2Uri;
          String reverseKey = term2Uri + "-" + relationTypeUri + "-" + term1Uri;
          if (!edgeKeys.contains(edgeKey) && !edgeKeys.contains(reverseKey)) {
            edgeKeys.add(edgeKey);

            String extractedRelationType = extractPredicateName(relationTypeUri);
            String formattedLabel = formatGlossaryRelationType(relationTypeUri);
            LOG.info(
                "RDF Edge: {} -> {}, predicateUri={}, extractedType={}, label={}",
                extractEntityIdFromUri(term1Uri),
                extractEntityIdFromUri(term2Uri),
                relationTypeUri,
                extractedRelationType,
                formattedLabel);

            com.fasterxml.jackson.databind.node.ObjectNode edge =
                JsonUtils.getObjectMapper().createObjectNode();
            edge.put("from", extractEntityIdFromUri(term1Uri));
            edge.put("to", extractEntityIdFromUri(term2Uri));
            edge.put("label", formattedLabel);
            edge.put("relationType", extractedRelationType);
            edges.add(edge);
          }
        }
      }
    }

    // Mark isolated nodes
    for (com.fasterxml.jackson.databind.node.ObjectNode node : nodeMap.values()) {
      String nodeId = node.get("id").asText();
      String nodeUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + nodeId;
      if (!termsWithRelations.contains(nodeUri)) {
        node.put("type", "glossaryTermIsolated");
        node.put("isolated", true);
      }
    }

    // If RDF didn't return enough results, fall back to database query
    if (nodes.isEmpty()) {
      LOG.info("RDF query returned no nodes, falling back to database");
      return getGlossaryTermGraphFromDatabase(glossaryId, limit, offset, includeIsolated);
    }
    LOG.info("RDF query returned {} nodes and {} edges", nodes.size(), edges.size());

    graphData.set("nodes", nodes);
    graphData.set("edges", edges);
    graphData.put("totalNodes", addedNodes.size());
    graphData.put("totalEdges", edges.size());

    return JsonUtils.pojoToJson(graphData);
  }

  private com.fasterxml.jackson.databind.node.ObjectNode createGlossaryTermNode(
      String termUri, String name, String fqn, boolean hasRelations) {
    com.fasterxml.jackson.databind.node.ObjectNode node =
        JsonUtils.getObjectMapper().createObjectNode();

    String entityId = extractEntityIdFromUri(termUri);
    node.put("id", entityId);
    node.put("label", name != null ? name : entityId);
    node.put("type", hasRelations ? "glossaryTerm" : "glossaryTermIsolated");
    if (fqn != null) {
      node.put("fullyQualifiedName", fqn);
    }
    node.put("isolated", !hasRelations);

    return node;
  }

  private String formatGlossaryRelationType(String relationUri) {
    String relation = extractPredicateName(relationUri);
    return formatRelationTypeName(relation);
  }

  private String formatRelationTypeName(String relationType) {
    if (relationType == null) {
      return "Related To";
    }

    // Look up display name from settings
    try {
      org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
          org.openmetadata.service.resources.settings.SettingsCache.getSetting(
              org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
              org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

      if (settings != null && settings.getRelationTypes() != null) {
        for (var configuredType : settings.getRelationTypes()) {
          // Match by name (case-insensitive)
          if (configuredType.getName().equalsIgnoreCase(relationType)) {
            return configuredType.getDisplayName();
          }
          // Also check if this is an RDF predicate local name that maps to a configured type
          if (configuredType.getRdfPredicate() != null) {
            String predicateLocalName =
                extractLocalName(configuredType.getRdfPredicate().toString());
            if (predicateLocalName != null && predicateLocalName.equalsIgnoreCase(relationType)) {
              return configuredType.getDisplayName();
            }
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not load settings for display name lookup: {}", e.getMessage());
    }

    // Fallback: format the relation type name nicely
    return formatRelationshipLabel(relationType);
  }

  private String extractLocalName(String uri) {
    if (uri == null) return null;
    if (uri.contains("#")) {
      return uri.substring(uri.lastIndexOf('#') + 1);
    } else if (uri.contains("/")) {
      return uri.substring(uri.lastIndexOf('/') + 1);
    }
    return uri;
  }

  /**
   * Fallback method to get glossary terms from database when RDF store is empty or returns no results.
   */
  private String getGlossaryTermGraphFromDatabase(
      UUID glossaryId, int limit, int offset, boolean includeIsolated) throws IOException {
    com.fasterxml.jackson.databind.node.ObjectNode graphData =
        JsonUtils.getObjectMapper().createObjectNode();
    com.fasterxml.jackson.databind.node.ArrayNode nodes =
        JsonUtils.getObjectMapper().createArrayNode();
    com.fasterxml.jackson.databind.node.ArrayNode edges =
        JsonUtils.getObjectMapper().createArrayNode();

    try {
      // Get glossary terms from database
      var glossaryTermRepository = Entity.getEntityRepository("glossaryTerm");
      var listFilter = new org.openmetadata.service.jdbi3.ListFilter(null);

      if (glossaryId != null) {
        listFilter.addQueryParam("glossary", glossaryId.toString());
      }

      var terms =
          glossaryTermRepository.listAll(
              glossaryTermRepository.getFields("relatedTerms,parent,children"), listFilter);

      Set<String> addedNodes = new HashSet<>();
      Set<String> termsWithRelations = new HashSet<>();
      Set<String> edgeKeys = new HashSet<>();
      int count = 0;

      for (var entity : terms) {
        if (count >= limit) break;

        var term = (org.openmetadata.schema.entity.data.GlossaryTerm) entity;
        String termId = term.getId().toString();

        boolean hasRelations =
            (term.getRelatedTerms() != null && !term.getRelatedTerms().isEmpty())
                || (term.getChildren() != null && !term.getChildren().isEmpty())
                || term.getParent() != null;

        if (!includeIsolated && !hasRelations) {
          continue;
        }

        if (!addedNodes.contains(termId)) {
          com.fasterxml.jackson.databind.node.ObjectNode node =
              JsonUtils.getObjectMapper().createObjectNode();
          node.put("id", termId);
          node.put("label", term.getDisplayName() != null ? term.getDisplayName() : term.getName());
          node.put("type", hasRelations ? "glossaryTerm" : "glossaryTermIsolated");
          node.put("fullyQualifiedName", term.getFullyQualifiedName());
          node.put("isolated", !hasRelations);
          if (term.getDescription() != null) {
            node.put("description", term.getDescription());
          }
          nodes.add(node);
          addedNodes.add(termId);
          count++;
        }

        if (hasRelations) {
          termsWithRelations.add(termId);

          // Add related term edges
          if (term.getRelatedTerms() != null) {
            for (var relatedTerm : term.getRelatedTerms()) {
              var relatedTermRef = relatedTerm.getTerm();
              if (relatedTermRef == null || relatedTermRef.getId() == null) continue;

              String relatedId = relatedTermRef.getId().toString();
              String relationType =
                  relatedTerm.getRelationType() != null
                      ? relatedTerm.getRelationType()
                      : "relatedTo";
              termsWithRelations.add(relatedId);

              String edgeKey =
                  termId.compareTo(relatedId) < 0
                      ? termId + "-" + relationType + "-" + relatedId
                      : relatedId + "-" + relationType + "-" + termId;

              if (!edgeKeys.contains(edgeKey)) {
                edgeKeys.add(edgeKey);
                String formattedLabel = formatRelationTypeName(relationType);
                LOG.info(
                    "DB Edge: {} -> {}, rawType={}, formattedLabel={}",
                    termId,
                    relatedId,
                    relationType,
                    formattedLabel);
                com.fasterxml.jackson.databind.node.ObjectNode edge =
                    JsonUtils.getObjectMapper().createObjectNode();
                edge.put("from", termId);
                edge.put("to", relatedId);
                edge.put("label", formattedLabel);
                edge.put("relationType", relationType);
                edges.add(edge);

                // Add related term node if not already added
                if (!addedNodes.contains(relatedId) && count < limit) {
                  com.fasterxml.jackson.databind.node.ObjectNode relatedNode =
                      JsonUtils.getObjectMapper().createObjectNode();
                  relatedNode.put("id", relatedId);
                  String relatedLabel =
                      relatedTermRef.getDisplayName() != null
                          ? relatedTermRef.getDisplayName()
                          : (relatedTermRef.getName() != null
                              ? relatedTermRef.getName()
                              : relatedId);
                  relatedNode.put("label", relatedLabel);
                  relatedNode.put("type", "glossaryTerm");
                  if (relatedTermRef.getFullyQualifiedName() != null) {
                    relatedNode.put("fullyQualifiedName", relatedTermRef.getFullyQualifiedName());
                  }
                  relatedNode.put("isolated", false);
                  nodes.add(relatedNode);
                  addedNodes.add(relatedId);
                  count++;
                }
              }
            }
          }

          // Add parent edge
          if (term.getParent() != null) {
            String parentId = term.getParent().getId().toString();
            String edgeKey = parentId + "-parent-" + termId;
            if (!edgeKeys.contains(edgeKey)) {
              edgeKeys.add(edgeKey);
              com.fasterxml.jackson.databind.node.ObjectNode edge =
                  JsonUtils.getObjectMapper().createObjectNode();
              edge.put("from", parentId);
              edge.put("to", termId);
              edge.put("label", "Parent Of");
              edge.put("relationType", "parentOf");
              edges.add(edge);
            }
          }
        }
      }

      graphData.set("nodes", nodes);
      graphData.set("edges", edges);
      graphData.put("totalNodes", addedNodes.size());
      graphData.put("totalEdges", edges.size());
      graphData.put("source", "database");

      return JsonUtils.pojoToJson(graphData);

    } catch (Exception e) {
      LOG.error("Error getting glossary terms from database", e);
      // Return empty graph
      graphData.set("nodes", nodes);
      graphData.set("edges", edges);
      graphData.put("totalNodes", 0);
      graphData.put("totalEdges", 0);
      graphData.put("error", e.getMessage());
      return JsonUtils.pojoToJson(graphData);
    }
  }

  private String extractPredicateName(String predicateUri) {
    // Map standard vocabulary predicates back to our relation type names
    if (predicateUri != null) {
      // SKOS predicates
      if (predicateUri.endsWith("#exactMatch") || predicateUri.endsWith("/exactMatch")) {
        return "synonym";
      }
      if (predicateUri.endsWith("#broader") || predicateUri.endsWith("/broader")) {
        return "broader";
      }
      if (predicateUri.endsWith("#narrower") || predicateUri.endsWith("/narrower")) {
        return "narrower";
      }
      if (predicateUri.endsWith("#related") || predicateUri.endsWith("/related")) {
        return "related";
      }
      // RDFS predicates
      if (predicateUri.endsWith("#seeAlso") || predicateUri.endsWith("/seeAlso")) {
        return "seeAlso";
      }
      if (predicateUri.endsWith("#subClassOf") || predicateUri.endsWith("/subClassOf")) {
        return "broader"; // treat rdfs:subClassOf as broader
      }
      // PROV-O predicates
      if (predicateUri.endsWith("#wasDerivedFrom") || predicateUri.endsWith("/wasDerivedFrom")) {
        return "calculatedFrom"; // map prov:wasDerivedFrom back to calculatedFrom
      }
      if (predicateUri.endsWith("#wasInfluencedBy") || predicateUri.endsWith("/wasInfluencedBy")) {
        return "usedToCalculate"; // map prov:wasInfluencedBy back to usedToCalculate
      }
    }

    // Extract local name from URI
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

  /**
   * Add a glossary term relation to RDF store. This creates typed semantic relationships between
   * glossary terms using appropriate RDF predicates based on the relation type.
   *
   * @param fromTermId The source glossary term ID
   * @param toTermId The target glossary term ID
   * @param relationType The type of relation (e.g., 'synonym', 'broader', 'relatedTo')
   */
  public void addGlossaryTermRelation(UUID fromTermId, UUID toTermId, String relationType) {
    if (!isEnabled()) {
      return;
    }

    try {
      Model model = ModelFactory.createDefaultModel();
      model.setNsPrefix("om", "https://open-metadata.org/ontology/");
      model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");

      String fromUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + fromTermId;
      String toUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + toTermId;

      Resource fromResource = model.createResource(fromUri);
      Resource toResource = model.createResource(toUri);

      Property predicate = getGlossaryTermRelationPredicate(relationType, model);
      fromResource.addProperty(predicate, toResource);

      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, "N-TRIPLES");
      String triples = writer.toString();

      if (!triples.isEmpty()) {
        StringBuilder insertQuery = new StringBuilder();
        insertQuery.append("INSERT DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");
        insertQuery.append(triples);
        insertQuery.append(" } }");

        storageService.executeSparqlUpdate(insertQuery.toString());
        LOG.debug("Added glossary term relation {} -> {} ({})", fromTermId, toTermId, relationType);
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to add glossary term relation {} -> {} ({})",
          fromTermId,
          toTermId,
          relationType,
          e);
    }
  }

  /**
   * Remove a glossary term relation from RDF store.
   *
   * @param fromTermId The source glossary term ID
   * @param toTermId The target glossary term ID
   * @param relationType The type of relation (e.g., 'synonym', 'broader', 'relatedTo')
   */
  public void removeGlossaryTermRelation(UUID fromTermId, UUID toTermId, String relationType) {
    if (!isEnabled()) {
      return;
    }

    try {
      String fromUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + fromTermId;
      String toUri = config.getBaseUri().toString() + "entity/glossaryTerm/" + toTermId;
      String predicateUri = getGlossaryTermRelationPredicateUri(relationType);

      String sparqlUpdate =
          String.format(
              "DELETE WHERE { GRAPH <%s> { <%s> <%s> <%s> } }",
              KNOWLEDGE_GRAPH, fromUri, predicateUri, toUri);

      storageService.executeSparqlUpdate(sparqlUpdate);
      LOG.debug("Removed glossary term relation {} -> {} ({})", fromTermId, toTermId, relationType);
    } catch (Exception e) {
      LOG.error(
          "Failed to remove glossary term relation {} -> {} ({})",
          fromTermId,
          toTermId,
          relationType,
          e);
    }
  }

  private String getGlossaryTermRelationPredicateUri(String relationType) {
    if (relationType == null) {
      relationType = "relatedTo";
    }

    return switch (relationType.toLowerCase()) {
      case "relatedto" -> "https://open-metadata.org/ontology/relatedTo";
      case "synonym" -> "https://open-metadata.org/ontology/synonym";
      case "typeof", "type" -> "https://open-metadata.org/ontology/typeOf";
      case "hastypes" -> "https://open-metadata.org/ontology/hasTypes";
      case "componentof" -> "https://open-metadata.org/ontology/componentOf";
      case "composedof" -> "https://open-metadata.org/ontology/composedOf";
      case "calculatedfrom" -> "https://open-metadata.org/ontology/calculatedFrom";
      case "usedtocalculate" -> "https://open-metadata.org/ontology/usedToCalculate";
      case "seealso" -> "https://open-metadata.org/ontology/seeAlso";
      case "broader" -> "http://www.w3.org/2004/02/skos/core#broader";
      case "narrower" -> "http://www.w3.org/2004/02/skos/core#narrower";
      case "related" -> "http://www.w3.org/2004/02/skos/core#related";
      default -> "https://open-metadata.org/ontology/" + relationType;
    };
  }

  /**
   * Clear all glossary term relations from RDF store. This should be called before re-indexing to
   * remove stale relations with potentially wrong predicates.
   */
  public void clearAllGlossaryTermRelations() {
    if (!isEnabled()) {
      return;
    }

    try {
      // Delete all triples where a glossaryTerm has any relation to another glossaryTerm
      String deleteQuery =
          String.format(
              "DELETE WHERE { "
                  + "GRAPH <%s> { "
                  + "?term1 ?relationType ?term2 . "
                  + "FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) "
                  + "FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) "
                  + "FILTER(?relationType IN ("
                  + "  <https://open-metadata.org/ontology/relatedTo>, "
                  + "  <https://open-metadata.org/ontology/synonym>, "
                  + "  <https://open-metadata.org/ontology/typeOf>, "
                  + "  <https://open-metadata.org/ontology/hasTypes>, "
                  + "  <https://open-metadata.org/ontology/componentOf>, "
                  + "  <https://open-metadata.org/ontology/composedOf>, "
                  + "  <https://open-metadata.org/ontology/calculatedFrom>, "
                  + "  <https://open-metadata.org/ontology/usedToCalculate>, "
                  + "  <https://open-metadata.org/ontology/seeAlso>, "
                  + "  <http://www.w3.org/2004/02/skos/core#broader>, "
                  + "  <http://www.w3.org/2004/02/skos/core#narrower>, "
                  + "  <http://www.w3.org/2004/02/skos/core#related>"
                  + ")) "
                  + "} "
                  + "}",
              KNOWLEDGE_GRAPH);

      storageService.executeSparqlUpdate(deleteQuery);
      LOG.info("Cleared all glossary term relations from RDF store");
    } catch (Exception e) {
      LOG.error("Failed to clear glossary term relations from RDF", e);
    }
  }

  /**
   * Bulk add glossary term relations to RDF store.
   */
  public void bulkAddGlossaryTermRelations(List<GlossaryTermRelationData> relations) {
    if (!isEnabled() || relations.isEmpty()) {
      return;
    }

    try {
      Model model = ModelFactory.createDefaultModel();
      model.setNsPrefix("om", "https://open-metadata.org/ontology/");
      model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");

      for (GlossaryTermRelationData relation : relations) {
        String fromUri =
            config.getBaseUri().toString() + "entity/glossaryTerm/" + relation.fromTermId();
        String toUri =
            config.getBaseUri().toString() + "entity/glossaryTerm/" + relation.toTermId();

        Resource fromResource = model.createResource(fromUri);
        Resource toResource = model.createResource(toUri);

        Property predicate = getGlossaryTermRelationPredicate(relation.relationType(), model);
        LOG.debug(
            "RDF Indexing: {} -> {} with predicate {} (relationType={})",
            relation.fromTermId(),
            relation.toTermId(),
            predicate.getURI(),
            relation.relationType());
        fromResource.addProperty(predicate, toResource);
      }

      java.io.StringWriter writer = new java.io.StringWriter();
      model.write(writer, "N-TRIPLES");
      String triples = writer.toString();

      LOG.debug("Generated N-Triples:\n{}", triples);

      if (!triples.isEmpty()) {
        StringBuilder insertQuery = new StringBuilder();
        insertQuery.append("INSERT DATA { GRAPH <").append(KNOWLEDGE_GRAPH).append("> { ");
        insertQuery.append(triples);
        insertQuery.append(" } }");

        storageService.executeSparqlUpdate(insertQuery.toString());
        LOG.debug("Bulk added {} glossary term relations to RDF store", relations.size());
      }
    } catch (Exception e) {
      LOG.error("Failed to bulk add glossary term relations to RDF", e);
    }
  }

  private Property getGlossaryTermRelationPredicate(String relationType, Model model) {
    LOG.debug(
        "getGlossaryTermRelationPredicate: Looking up predicate for relationType='{}'",
        relationType);
    if (relationType == null) {
      LOG.debug(
          "getGlossaryTermRelationPredicate: relationType is null, defaulting to 'relatedTo'");
      relationType = "relatedTo";
    }

    // Look up the relation type from settings to get the configured RDF predicate
    try {
      org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
          org.openmetadata.service.resources.settings.SettingsCache.getSetting(
              org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
              org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

      if (settings != null && settings.getRelationTypes() != null) {
        LOG.debug(
            "getGlossaryTermRelationPredicate: Found {} relation types in settings",
            settings.getRelationTypes().size());
        for (var configuredType : settings.getRelationTypes()) {
          if (configuredType.getName().equalsIgnoreCase(relationType)) {
            java.net.URI rdfPredicateUri = configuredType.getRdfPredicate();
            LOG.debug(
                "getGlossaryTermRelationPredicate: Matched '{}' to configured type '{}' with rdfPredicate='{}'",
                relationType,
                configuredType.getName(),
                rdfPredicateUri);
            if (rdfPredicateUri != null) {
              Property prop = createPropertyFromUri(rdfPredicateUri.toString(), model);
              LOG.debug(
                  "getGlossaryTermRelationPredicate: Created property with URI='{}'",
                  prop.getURI());
              return prop;
            }
            break;
          }
        }
        LOG.debug(
            "getGlossaryTermRelationPredicate: No match found for '{}' in configured types",
            relationType);
      } else {
        LOG.debug("getGlossaryTermRelationPredicate: Settings or relationTypes is null");
      }
    } catch (Exception e) {
      LOG.debug(
          "getGlossaryTermRelationPredicate: Could not load settings, error: {}", e.getMessage());
    }

    // Fall back to default: use OpenMetadata ontology namespace with the relation type name
    Property defaultProp =
        model.createProperty("https://open-metadata.org/ontology/", relationType);
    LOG.debug(
        "getGlossaryTermRelationPredicate: Using default predicate URI='{}'", defaultProp.getURI());
    return defaultProp;
  }

  private Property createPropertyFromUri(String uri, Model model) {
    if (uri == null || uri.isEmpty()) {
      return model.createProperty("https://open-metadata.org/ontology/", "relatedTo");
    }

    String trimmedUri = uri.trim();

    // Handle common prefix shortcuts (CURIE format)
    if (trimmedUri.startsWith("skos:") && trimmedUri.length() > 5) {
      return model.createProperty("http://www.w3.org/2004/02/skos/core#", trimmedUri.substring(5));
    } else if (trimmedUri.startsWith("om:") && trimmedUri.length() > 3) {
      return model.createProperty("https://open-metadata.org/ontology/", trimmedUri.substring(3));
    } else if (trimmedUri.startsWith("rdfs:") && trimmedUri.length() > 5) {
      return model.createProperty("http://www.w3.org/2000/01/rdf-schema#", trimmedUri.substring(5));
    } else if (trimmedUri.startsWith("owl:") && trimmedUri.length() > 4) {
      return model.createProperty("http://www.w3.org/2002/07/owl#", trimmedUri.substring(4));
    } else if (trimmedUri.startsWith("prov:") && trimmedUri.length() > 5) {
      return model.createProperty("http://www.w3.org/ns/prov#", trimmedUri.substring(5));
    }

    // Handle full URIs
    if (trimmedUri.contains("#")) {
      int hashIndex = trimmedUri.lastIndexOf('#');
      String localName = trimmedUri.substring(hashIndex + 1);
      if (!localName.isEmpty()) {
        return model.createProperty(trimmedUri.substring(0, hashIndex + 1), localName);
      }
    }

    if (trimmedUri.startsWith("http://") || trimmedUri.startsWith("https://")) {
      // Full HTTP URI - find last path segment as local name
      int lastSlash = trimmedUri.lastIndexOf('/');
      if (lastSlash > 7 && lastSlash < trimmedUri.length() - 1) {
        String localName = trimmedUri.substring(lastSlash + 1);
        return model.createProperty(trimmedUri.substring(0, lastSlash + 1), localName);
      }
      // URI ends with / or has no path - use as-is
      return model.createProperty(trimmedUri);
    }

    // Default: treat as local name in OpenMetadata ontology
    return model.createProperty("https://open-metadata.org/ontology/", trimmedUri);
  }

  public record GlossaryTermRelationData(UUID fromTermId, UUID toTermId, String relationType) {}

  /**
   * Export a glossary with all its terms and relationships as an ontology. Uses SKOS vocabulary for
   * semantic interoperability.
   */
  public String exportGlossaryAsOntology(UUID glossaryId, String format, boolean includeRelations)
      throws IOException {
    Model model = ModelFactory.createDefaultModel();

    model.setNsPrefix("skos", "http://www.w3.org/2004/02/skos/core#");
    model.setNsPrefix("om", "https://open-metadata.org/ontology/");
    model.setNsPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    model.setNsPrefix("rdf", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    model.setNsPrefix("dct", "http://purl.org/dc/terms/");
    model.setNsPrefix("sh", "http://www.w3.org/ns/shacl#");

    Property rdfType = model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type");
    Property skosConceptScheme =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "ConceptScheme");
    Property skosConcept = model.createProperty("http://www.w3.org/2004/02/skos/core#", "Concept");
    Property skosPrefLabel =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "prefLabel");
    Property skosDefinition =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "definition");
    Property skosInScheme =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "inScheme");
    Property skosTopConcept =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "hasTopConcept");
    Property skosBroader = model.createProperty("http://www.w3.org/2004/02/skos/core#", "broader");
    Property skosNarrower =
        model.createProperty("http://www.w3.org/2004/02/skos/core#", "narrower");
    Property skosRelated = model.createProperty("http://www.w3.org/2004/02/skos/core#", "related");
    Property dctCreated = model.createProperty("http://purl.org/dc/terms/", "created");
    Property dctModified = model.createProperty("http://purl.org/dc/terms/", "modified");
    Property rdfsLabel = model.createProperty("http://www.w3.org/2000/01/rdf-schema#", "label");

    try {
      org.openmetadata.schema.entity.data.Glossary glossary =
          (org.openmetadata.schema.entity.data.Glossary)
              Entity.getEntity("glossary", glossaryId, "*", null);

      String glossaryUri = config.getBaseUri().toString() + "glossary/" + glossaryId;
      Resource glossaryResource = model.createResource(glossaryUri);
      glossaryResource.addProperty(rdfType, skosConceptScheme);
      glossaryResource.addProperty(
          rdfsLabel,
          glossary.getDisplayName() != null ? glossary.getDisplayName() : glossary.getName());
      if (glossary.getDescription() != null) {
        glossaryResource.addProperty(skosDefinition, glossary.getDescription());
      }

      var glossaryTermRepository = Entity.getEntityRepository("glossaryTerm");
      var listFilter = new org.openmetadata.service.jdbi3.ListFilter(null);
      listFilter.addQueryParam("glossary", glossaryId.toString());

      var terms =
          glossaryTermRepository.listAll(
              glossaryTermRepository.getFields("relatedTerms,parent,children,synonyms"),
              listFilter);

      Map<UUID, Resource> termResources = new HashMap<>();

      for (var entity : terms) {
        var term = (org.openmetadata.schema.entity.data.GlossaryTerm) entity;
        String termUri = config.getBaseUri().toString() + "glossaryTerm/" + term.getId();
        Resource termResource = model.createResource(termUri);

        termResource.addProperty(rdfType, skosConcept);
        termResource.addProperty(
            skosPrefLabel, term.getDisplayName() != null ? term.getDisplayName() : term.getName());
        termResource.addProperty(skosInScheme, glossaryResource);

        if (term.getDescription() != null) {
          termResource.addProperty(skosDefinition, term.getDescription());
        }

        if (term.getSynonyms() != null) {
          Property skosAltLabel =
              model.createProperty("http://www.w3.org/2004/02/skos/core#", "altLabel");
          for (String synonym : term.getSynonyms()) {
            termResource.addProperty(skosAltLabel, synonym);
          }
        }

        if (term.getParent() == null) {
          glossaryResource.addProperty(skosTopConcept, termResource);
        }

        termResources.put(term.getId(), termResource);
      }

      if (includeRelations) {
        for (var entity : terms) {
          var term = (org.openmetadata.schema.entity.data.GlossaryTerm) entity;
          Resource termResource = termResources.get(term.getId());

          if (term.getParent() != null && term.getParent().getId() != null) {
            Resource parentResource = termResources.get(term.getParent().getId());
            if (parentResource != null) {
              termResource.addProperty(skosBroader, parentResource);
              parentResource.addProperty(skosNarrower, termResource);
            }
          }

          if (term.getRelatedTerms() != null) {
            for (var relation : term.getRelatedTerms()) {
              if (relation.getTerm() != null && relation.getTerm().getId() != null) {
                Resource relatedResource = termResources.get(relation.getTerm().getId());
                if (relatedResource == null) {
                  String relatedUri =
                      config.getBaseUri().toString() + "glossaryTerm/" + relation.getTerm().getId();
                  relatedResource = model.createResource(relatedUri);
                }

                String relationType = relation.getRelationType();
                Property relationProp = getSkosRelationProperty(relationType, model);
                termResource.addProperty(relationProp, relatedResource);
              }
            }
          }
        }
        addRelationCardinalityShapes(model);
      }

      java.io.StringWriter writer = new java.io.StringWriter();
      String rdfFormat =
          switch (format.toLowerCase()) {
            case "rdfxml", "xml" -> "RDF/XML";
            case "ntriples", "nt" -> "N-TRIPLES";
            case "jsonld", "json-ld" -> "JSON-LD";
            default -> "TURTLE";
          };

      model.write(writer, rdfFormat);
      return writer.toString();

    } catch (Exception e) {
      LOG.error("Error exporting glossary {} as ontology", glossaryId, e);
      throw new IOException("Failed to export glossary as ontology: " + e.getMessage(), e);
    }
  }

  private Property getSkosRelationProperty(String relationType, Model model) {
    if (relationType == null) {
      return model.createProperty("http://www.w3.org/2004/02/skos/core#", "related");
    }

    return switch (relationType.toLowerCase()) {
      case "broader" -> model.createProperty("http://www.w3.org/2004/02/skos/core#", "broader");
      case "narrower" -> model.createProperty("http://www.w3.org/2004/02/skos/core#", "narrower");
      case "synonym" -> model.createProperty("http://www.w3.org/2004/02/skos/core#", "exactMatch");
      case "relatedto", "related" -> model.createProperty(
          "http://www.w3.org/2004/02/skos/core#", "related");
      case "seealso" -> model.createProperty("http://www.w3.org/2000/01/rdf-schema#", "seeAlso");
      default -> {
        try {
          org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
              org.openmetadata.service.resources.settings.SettingsCache.getSetting(
                  org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
                  org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

          if (settings != null && settings.getRelationTypes() != null) {
            for (var configuredType : settings.getRelationTypes()) {
              if (configuredType.getName().equalsIgnoreCase(relationType)) {
                java.net.URI rdfPredicateUri = configuredType.getRdfPredicate();
                if (rdfPredicateUri != null) {
                  yield createPropertyFromUri(rdfPredicateUri.toString(), model);
                }
                break;
              }
            }
          }
        } catch (Exception e) {
          LOG.debug("Could not load relation settings for type {}", relationType);
        }
        yield model.createProperty("https://open-metadata.org/ontology/", relationType);
      }
    };
  }

  private void addRelationCardinalityShapes(Model model) {
    try {
      org.openmetadata.schema.configuration.GlossaryTermRelationSettings settings =
          org.openmetadata.service.resources.settings.SettingsCache.getSetting(
              org.openmetadata.schema.settings.SettingsType.GLOSSARY_TERM_RELATION_SETTINGS,
              org.openmetadata.schema.configuration.GlossaryTermRelationSettings.class);

      if (settings == null || settings.getRelationTypes() == null) {
        return;
      }

      String shNs = "http://www.w3.org/ns/shacl#";
      String rdfNs = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
      String skosNs = "http://www.w3.org/2004/02/skos/core#";

      Property rdfType = model.createProperty(rdfNs, "type");
      Property shTargetClass = model.createProperty(shNs, "targetClass");
      Property shProperty = model.createProperty(shNs, "property");
      Property shPath = model.createProperty(shNs, "path");
      Property shMaxCount = model.createProperty(shNs, "maxCount");
      Property shInversePath = model.createProperty(shNs, "inversePath");

      Resource shape = null;

      for (var relationType : settings.getRelationTypes()) {
        Integer sourceMax = relationType.getSourceMax();
        Integer targetMax = relationType.getTargetMax();
        RelationCardinality cardinality = relationType.getCardinality();

        if (cardinality != null && cardinality != RelationCardinality.CUSTOM) {
          switch (cardinality) {
            case ONE_TO_ONE -> {
              sourceMax = 1;
              targetMax = 1;
            }
            case ONE_TO_MANY -> {
              sourceMax = 1;
              targetMax = null;
            }
            case MANY_TO_ONE -> {
              sourceMax = null;
              targetMax = 1;
            }
            case MANY_TO_MANY -> {
              sourceMax = null;
              targetMax = null;
            }
            default -> {
              // No-op for unknown values.
            }
          }
        }

        if (sourceMax == null && targetMax == null) {
          continue;
        }

        if (shape == null) {
          String shapeUri =
              config.getBaseUri().toString() + "shapes/glossaryTermRelationCardinality";
          shape = model.createResource(shapeUri);
          shape.addProperty(rdfType, model.createResource(shNs + "NodeShape"));
          shape.addProperty(shTargetClass, model.createResource(skosNs + "Concept"));
        }

        Property relationProp = getSkosRelationProperty(relationType.getName(), model);

        if (sourceMax != null) {
          Resource propertyShape = model.createResource();
          shape.addProperty(shProperty, propertyShape);
          propertyShape.addProperty(shPath, relationProp);
          propertyShape.addProperty(shMaxCount, model.createTypedLiteral(sourceMax));
        }

        if (targetMax != null) {
          Resource propertyShape = model.createResource();
          shape.addProperty(shProperty, propertyShape);
          Resource inversePath = model.createResource();
          inversePath.addProperty(shInversePath, relationProp);
          propertyShape.addProperty(shPath, inversePath);
          propertyShape.addProperty(shMaxCount, model.createTypedLiteral(targetMax));
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not add glossary term cardinality shapes", e);
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

  /**
   * Diagnostic method to dump all glossary term relations stored in RDF. Returns a map with
   * predicate URIs as keys and counts as values, plus sample triples.
   */
  public String debugGlossaryTermRelations() throws IOException {
    if (!isEnabled()) {
      return "{\"error\": \"RDF not enabled\"}";
    }

    try {
      // Query to get all predicates used between glossary terms
      String predicateQuery =
          "PREFIX om: <https://open-metadata.org/ontology/> "
              + "SELECT ?predicate (COUNT(*) as ?count) WHERE { "
              + "  GRAPH ?g { "
              + "    ?term1 ?predicate ?term2 . "
              + "    FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) "
              + "    FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) "
              + "  } "
              + "} GROUP BY ?predicate ORDER BY DESC(?count)";

      String predicateResults =
          storageService.executeSparqlQuery(predicateQuery, "application/sparql-results+json");

      // Query to get sample triples (first 20)
      String sampleQuery =
          "PREFIX om: <https://open-metadata.org/ontology/> "
              + "SELECT ?term1 ?predicate ?term2 WHERE { "
              + "  GRAPH ?g { "
              + "    ?term1 ?predicate ?term2 . "
              + "    FILTER(CONTAINS(STR(?term1), '/glossaryTerm/')) "
              + "    FILTER(CONTAINS(STR(?term2), '/glossaryTerm/')) "
              + "  } "
              + "} LIMIT 20";

      String sampleResults =
          storageService.executeSparqlQuery(sampleQuery, "application/sparql-results+json");

      // Build response
      com.fasterxml.jackson.databind.node.ObjectNode response =
          JsonUtils.getObjectMapper().createObjectNode();

      // Parse predicate counts
      com.fasterxml.jackson.databind.node.ArrayNode predicates =
          JsonUtils.getObjectMapper().createArrayNode();
      com.fasterxml.jackson.databind.JsonNode predResultsJson =
          JsonUtils.readTree(predicateResults);
      if (predResultsJson.has("results") && predResultsJson.get("results").has("bindings")) {
        for (com.fasterxml.jackson.databind.JsonNode binding :
            predResultsJson.get("results").get("bindings")) {
          com.fasterxml.jackson.databind.node.ObjectNode predInfo =
              JsonUtils.getObjectMapper().createObjectNode();
          predInfo.put(
              "predicate",
              binding.has("predicate") ? binding.get("predicate").get("value").asText() : "null");
          predInfo.put(
              "count", binding.has("count") ? binding.get("count").get("value").asInt() : 0);
          predicates.add(predInfo);
        }
      }
      response.set("predicateCounts", predicates);

      // Parse sample triples
      com.fasterxml.jackson.databind.node.ArrayNode samples =
          JsonUtils.getObjectMapper().createArrayNode();
      com.fasterxml.jackson.databind.JsonNode sampleResultsJson = JsonUtils.readTree(sampleResults);
      if (sampleResultsJson.has("results") && sampleResultsJson.get("results").has("bindings")) {
        for (com.fasterxml.jackson.databind.JsonNode binding :
            sampleResultsJson.get("results").get("bindings")) {
          com.fasterxml.jackson.databind.node.ObjectNode triple =
              JsonUtils.getObjectMapper().createObjectNode();
          triple.put(
              "term1",
              binding.has("term1")
                  ? extractEntityIdFromUri(binding.get("term1").get("value").asText())
                  : "null");
          triple.put(
              "predicate",
              binding.has("predicate") ? binding.get("predicate").get("value").asText() : "null");
          triple.put(
              "term2",
              binding.has("term2")
                  ? extractEntityIdFromUri(binding.get("term2").get("value").asText())
                  : "null");
          samples.add(triple);
        }
      }
      response.set("sampleTriples", samples);

      return JsonUtils.pojoToJson(response);
    } catch (Exception e) {
      LOG.error("Error debugging glossary term relations", e);
      com.fasterxml.jackson.databind.node.ObjectNode errorNode =
          JsonUtils.getObjectMapper().createObjectNode();
      errorNode.put("error", e.getMessage() != null ? e.getMessage() : "Unknown error");
      return JsonUtils.pojoToJson(errorNode);
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
