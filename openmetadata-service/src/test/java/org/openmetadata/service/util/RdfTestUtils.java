package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.query.*;
import org.apache.jena.rdf.model.*;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;

/**
 * Utility methods for verifying RDF content in tests
 */
@Slf4j
public class RdfTestUtils {

  private RdfTestUtils() {
    // Private constructor for utility class
  }

  /**
   * Check if RDF is enabled for the current test run
   */
  public static boolean isRdfEnabled() {
    return "true".equals(System.getProperty("enableRdf"));
  }

  /**
   * Escape a string value for use in SPARQL queries
   */
  private static String escapeSparqlString(String value) {
    if (value == null) {
      return "\"\"";
    }
    // Escape backslashes first, then quotes
    String escaped = value.replace("\\", "\\\\").replace("\"", "\\\"");
    return "\"" + escaped + "\"";
  }

  /**
   * Verify that an entity exists in RDF with the correct type
   */
  public static void verifyEntityInRdf(EntityInterface entity, String entityType) {
    if (!isRdfEnabled()) {
      return;
    }

    RdfRepository repository = RdfRepository.getInstance();
    if (repository == null || !repository.isEnabled()) {
      LOG.info("RDF repository not available or not enabled");
      return;
    }

    // Only escape the name, not the FQN (which already has proper quoting)
    String escapedName = escapeSparqlString(entity.getName());

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                + "PREFIX dcat: <http://www.w3.org/ns/dcat#> "
                + "PREFIX foaf: <http://xmlns.com/foaf/0.1/> "
                + "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
                + "PREFIX prov: <http://www.w3.org/ns/prov#> "
                + "PREFIX dprod: <https://ekgf.github.io/dprod/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    ?entity a %s ; "
                + "           om:fullyQualifiedName \"%s\" ; "
                + "           rdfs:label %s . "
                + "  } "
                + "}",
            entityType,
            entity.getFullyQualifiedName().replace("\\", "\\\\").replace("\"", "\\\""),
            escapedName);

    LOG.info(
        "Verifying entity in RDF - FQN: {}, Name: {}, Type: {}",
        entity.getFullyQualifiedName(),
        entity.getName(),
        entityType);
    LOG.info("SPARQL query: {}", sparql);

    boolean exists = executeSparqlAsk(repository, sparql);
    LOG.info("Query result: {}", exists);

    // If not found, run a debug query to see what's actually there
    if (!exists) {
      // First try a more specific query
      String debugQuery =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                  + "SELECT ?g ?entity ?type ?fqn ?label WHERE { "
                  + "  GRAPH ?g { "
                  + "    ?entity om:fullyQualifiedName \"%s\" ; "
                  + "           a ?type . "
                  + "    OPTIONAL { ?entity om:fullyQualifiedName ?fqn } "
                  + "    OPTIONAL { ?entity rdfs:label ?label } "
                  + "  } "
                  + "} LIMIT 10",
              entity.getFullyQualifiedName().replace("\\", "\\\\").replace("\"", "\\\""));

      try {
        String debugResult =
            repository.executeSparqlQuery(debugQuery, "application/sparql-results+json");
        LOG.error("Entity not found with FQN. Debug query result: {}", debugResult);
      } catch (Exception e) {
        LOG.error("Failed to run debug query", e);
      }

      // Also try a very simple query to find by name only
      String simpleQuery =
          String.format(
              "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                  + "SELECT ?g ?entity ?label WHERE { "
                  + "  GRAPH ?g { "
                  + "    ?entity rdfs:label \"%s\" . "
                  + "  } "
                  + "} LIMIT 10",
              entity.getName().replace("\\", "\\\\").replace("\"", "\\\""));

      try {
        String simpleResult =
            repository.executeSparqlQuery(simpleQuery, "application/sparql-results+json");
        LOG.error("Simple query by name result: {}", simpleResult);
      } catch (Exception e) {
        LOG.error("Failed to run simple query", e);
      }

      // Try a broader query to see all entities of this type
      // Expand prefixed type to full URI for broader query
      String expandedType = entityType;
      if (entityType.startsWith("skos:")) {
        expandedType = "<http://www.w3.org/2004/02/skos/core#" + entityType.substring(5) + ">";
      } else if (entityType.startsWith("dcat:")) {
        expandedType = "<http://www.w3.org/ns/dcat#" + entityType.substring(5) + ">";
      } else if (entityType.startsWith("foaf:")) {
        expandedType = "<http://xmlns.com/foaf/0.1/" + entityType.substring(5) + ">";
      } else if (entityType.startsWith("prov:")) {
        expandedType = "<http://www.w3.org/ns/prov#" + entityType.substring(5) + ">";
      } else if (entityType.startsWith("dprod:")) {
        expandedType = "<https://ekgf.github.io/dprod/" + entityType.substring(6) + ">";
      }

      String broadQuery =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                  + "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
                  + "SELECT ?g ?entity ?fqn ?label WHERE { "
                  + "  GRAPH ?g { "
                  + "    ?entity a %s . "
                  + "    OPTIONAL { ?entity om:fullyQualifiedName ?fqn } "
                  + "    OPTIONAL { ?entity rdfs:label ?label } "
                  + "  } "
                  + "} LIMIT 10",
              expandedType);

      try {
        String broadResult =
            repository.executeSparqlQuery(broadQuery, "application/sparql-results+json");
        LOG.error("Entities of type {} found: {}", entityType, broadResult);
      } catch (Exception e) {
        LOG.error("Failed to run debug query", e);
      }
    }

    assertTrue(
        exists,
        String.format(
            "Entity of type '%s' with FQN '%s' should exist in RDF as type %s",
            entity.getEntityReference().getType(), entity.getFullyQualifiedName(), entityType));
  }

  /**
   * Verify that a relationship exists in RDF by FQN
   */
  public static void verifyRelationshipInRdf(
      String fromFQN, String toFQN, String relationshipType) {
    if (!isRdfEnabled()) {
      return;
    }

    RdfRepository repository = RdfRepository.getInstance();
    if (repository == null || !repository.isEnabled()) {
      return;
    }

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  ?from om:%s ?to . "
                + "  ?from om:fullyQualifiedName %s . "
                + "  ?to om:fullyQualifiedName %s . "
                + "}",
            relationshipType, escapeSparqlString(fromFQN), escapeSparqlString(toFQN));

    boolean exists = executeSparqlAsk(repository, sparql);
    assertTrue(
        exists,
        String.format(
            "Relationship %s should exist from %s to %s in RDF", relationshipType, fromFQN, toFQN));
  }

  /**
   * Verify that a relationship exists in RDF by entity references
   */
  public static void verifyRelationshipInRdf(
      EntityReference from,
      EntityReference to,
      org.openmetadata.schema.type.Relationship relationship) {
    if (!isRdfEnabled() || from == null || to == null) {
      return;
    }

    RdfRepository repository = RdfRepository.getInstance();
    if (repository == null || !repository.isEnabled()) {
      return;
    }

    // Build entity URIs
    String fromUri = "https://open-metadata.org/entity/" + from.getType() + "/" + from.getId();
    String toUri = "https://open-metadata.org/entity/" + to.getType() + "/" + to.getId();

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  <%s> om:%s <%s> . "
                + "}",
            fromUri, relationship.value(), toUri);

    boolean exists = executeSparqlAsk(repository, sparql);

    // If not found with relationship value, try with uppercase name
    if (!exists) {
      sparql =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "ASK { "
                  + "    <%s> om:%s <%s> . "
                  + "}",
              fromUri, relationship.name(), toUri);
      exists = executeSparqlAsk(repository, sparql);
    }

    assertTrue(
        exists,
        String.format(
            "Relationship %s should exist from %s (%s) to %s (%s) in RDF",
            relationship.value(),
            from.getFullyQualifiedName(),
            from.getType(),
            to.getFullyQualifiedName(),
            to.getType()));
  }

  /**
   * Verify CONTAINS relationship (hierarchical)
   */
  public static void verifyContainsRelationshipInRdf(
      EntityReference parent, EntityReference child) {
    verifyRelationshipInRdf(parent, child, org.openmetadata.schema.type.Relationship.CONTAINS);
  }

  /**
   * Verify USES relationship (dependencies)
   */
  public static void verifyUsesRelationshipInRdf(EntityReference from, EntityReference to) {
    verifyRelationshipInRdf(from, to, org.openmetadata.schema.type.Relationship.USES);
  }

  /**
   * Verify UPSTREAM relationship (data lineage)
   */
  public static void verifyUpstreamRelationshipInRdf(
      EntityReference downstream, EntityReference upstream) {
    verifyRelationshipInRdf(
        downstream, upstream, org.openmetadata.schema.type.Relationship.UPSTREAM);
  }

  /**
   * Verify APPLIED_TO relationship (tags/glossary terms)
   */
  public static void verifyAppliedToRelationshipInRdf(
      EntityReference tagOrTerm, EntityReference entity) {
    verifyRelationshipInRdf(
        tagOrTerm, entity, org.openmetadata.schema.type.Relationship.APPLIED_TO);
  }

  /**
   * Verify JOINED_WITH relationship (table joins)
   */
  public static void verifyJoinedWithRelationshipInRdf(
      EntityReference table1, EntityReference table2) {
    verifyRelationshipInRdf(table1, table2, org.openmetadata.schema.type.Relationship.JOINED_WITH);
  }

  /**
   * Verify that tags are properly stored in RDF
   */
  public static void verifyTagsInRdf(String entityFQN, List<TagLabel> tags) {
    if (!isRdfEnabled() || tags == null || tags.isEmpty()) {
      return;
    }

    RdfRepository repository = RdfRepository.getInstance();
    if (repository == null || !repository.isEnabled()) {
      return;
    }

    for (TagLabel tag : tags) {
      String predicate =
          tag.getSource() == TagLabel.TagSource.GLOSSARY ? "hasGlossaryTerm" : "hasTag";

      // Tags are stored as URIs, not entities with FQNs
      String tagUri =
          "https://open-metadata.org/entity/tag/"
              + java.net.URLEncoder.encode(
                  tag.getTagFQN(), java.nio.charset.StandardCharsets.UTF_8);

      String sparql =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "ASK { "
                  + "  GRAPH ?g { "
                  + "    ?entity om:%s <%s> ; "
                  + "           om:fullyQualifiedName %s . "
                  + "  } "
                  + "}",
              predicate, tagUri, escapeSparqlString(entityFQN));

      boolean exists = executeSparqlAsk(repository, sparql);
      assertTrue(
          exists,
          String.format(
              "%s %s should be applied to %s in RDF",
              tag.getSource() == TagLabel.TagSource.GLOSSARY ? "Glossary term" : "Tag",
              tag.getTagFQN(),
              entityFQN));
    }
  }

  /**
   * Verify that an owner relationship exists in RDF
   */
  public static void verifyOwnerInRdf(String entityFQN, EntityReference owner) {
    if (!isRdfEnabled() || owner == null) {
      return;
    }

    RdfRepository repository = RdfRepository.getInstance();
    if (repository == null || !repository.isEnabled()) {
      return;
    }

    // Build owner URI
    String ownerUri = "https://open-metadata.org/entity/" + owner.getType() + "/" + owner.getId();

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    ?entity om:hasOwner <%s> ; "
                + "           om:fullyQualifiedName %s . "
                + "  } "
                + "}",
            ownerUri, escapeSparqlString(entityFQN));

    boolean exists = executeSparqlAsk(repository, sparql);
    assertTrue(
        exists,
        String.format(
            "Owner %s should be set for %s in RDF", owner.getFullyQualifiedName(), entityFQN));
  }

  /**
   * Verify entity deletion is reflected in RDF
   */
  public static void verifyEntityNotInRdf(String entityFQN) {
    if (!isRdfEnabled()) {
      return;
    }

    RdfRepository repository = RdfRepository.getInstance();
    if (repository == null || !repository.isEnabled()) {
      return;
    }

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "SELECT ?entity WHERE { "
                + "  GRAPH ?g { "
                + "    ?entity om:fullyQualifiedName %s . "
                + "  } "
                + "} LIMIT 1",
            escapeSparqlString(entityFQN));

    boolean exists = executeSparqlAsk(repository, sparql);
    assertTrue(
        !exists, String.format("Entity %s should not exist in RDF after deletion", entityFQN));
  }

  /**
   * Execute a SPARQL ASK query
   */
  private static boolean executeSparqlAsk(RdfRepository repository, String sparql) {
    try {
      // Execute SPARQL query
      String jsonResult = repository.executeSparqlQuery(sparql, "application/sparql-results+json");
      LOG.info("SPARQL raw result: {}", jsonResult);

      // Check if it's an ASK query result
      boolean isAskQuery = sparql.trim().toUpperCase().contains("ASK");
      LOG.info(
          "Is ASK query: {} for query starting with: {}",
          isAskQuery,
          sparql.trim().substring(0, Math.min(50, sparql.trim().length())));
      if (isAskQuery) {
        // For ASK queries, parse the JSON properly
        try {
          com.fasterxml.jackson.databind.JsonNode jsonNode = JsonUtils.readTree(jsonResult);
          boolean hasResults = false;
          if (jsonNode.has("boolean")) {
            hasResults = jsonNode.get("boolean").asBoolean();
          } else if (jsonNode.has("result")) {
            hasResults = jsonNode.get("result").asBoolean();
          }
          LOG.info("ASK query parsed result: {}", hasResults);
          return hasResults;
        } catch (Exception parseEx) {
          LOG.error("Failed to parse ASK query result: {}", jsonResult, parseEx);
          return false;
        }
      } else {
        // For SELECT queries, check if bindings exist (non-empty array)
        boolean hasResults =
            jsonResult != null
                && jsonResult.contains("\"bindings\"")
                && !jsonResult.contains("\"bindings\":[]");
        LOG.debug("SELECT query has results: {}", hasResults);
        return hasResults;
      }
    } catch (Exception e) {
      LOG.error("Error executing SPARQL query: {}", sparql, e);
      return false;
    }
  }
}
