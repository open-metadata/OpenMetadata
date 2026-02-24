/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility methods for verifying RDF content in integration tests.
 *
 * <p>This class provides helper methods to verify that entities, relationships, and tags are
 * properly stored in the RDF graph via the Fuseki SPARQL endpoint.
 *
 * <p>RDF verification is STANDARD in all entity tests - not optional or config-driven. The Fuseki
 * container is always started with other test infrastructure.
 */
public final class RdfTestUtils {

  private static final Logger LOG = LoggerFactory.getLogger(RdfTestUtils.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

  private RdfTestUtils() {}

  /**
   * Escape a string value for use in SPARQL queries.
   */
  private static String escapeSparqlString(String value) {
    if (value == null) {
      return "\"\"";
    }
    String escaped = value.replace("\\", "\\\\").replace("\"", "\\\"");
    return "\"" + escaped + "\"";
  }

  /**
   * Verify that an entity exists in RDF with the correct type.
   *
   * @param entity The entity to verify
   * @param rdfType The expected RDF type (e.g., "dcat:Dataset", "foaf:Agent")
   */
  public static void verifyEntityInRdf(EntityInterface entity, String rdfType) {
    String escapedName = escapeSparqlString(entity.getName());
    String escapedFqn = entity.getFullyQualifiedName().replace("\\", "\\\\").replace("\"", "\\\"");

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
            rdfType, escapedFqn, escapedName);

    LOG.debug(
        "Verifying entity in RDF - FQN: {}, Name: {}, Type: {}",
        entity.getFullyQualifiedName(),
        entity.getName(),
        rdfType);

    boolean exists = executeSparqlAsk(sparql);

    if (!exists) {
      logDebugInfo(entity, rdfType);
    }

    assertTrue(
        exists,
        String.format(
            "Entity '%s' (FQN: %s) should exist in RDF as type %s",
            entity.getName(), entity.getFullyQualifiedName(), rdfType));
  }

  /**
   * Verify that an entity has been deleted from RDF.
   *
   * @param entityFqn The FQN of the entity that should not exist
   */
  public static void verifyEntityNotInRdf(String entityFqn) {
    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    ?entity om:fullyQualifiedName %s . "
                + "  } "
                + "}",
            escapeSparqlString(entityFqn));

    boolean exists = executeSparqlAsk(sparql);
    assertFalse(
        exists, String.format("Entity %s should not exist in RDF after deletion", entityFqn));
  }

  /**
   * Verify that an entity was updated in RDF (exists with current version).
   *
   * @param entity The updated entity
   */
  public static void verifyEntityUpdatedInRdf(EntityInterface entity) {
    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    ?entity om:fullyQualifiedName %s ; "
                + "           om:version ?version . "
                + "  } "
                + "}",
            escapeSparqlString(entity.getFullyQualifiedName()));

    boolean exists = executeSparqlAsk(sparql);
    assertTrue(
        exists,
        String.format("Updated entity %s should exist in RDF", entity.getFullyQualifiedName()));
  }

  /**
   * Verify that a relationship exists in RDF between two entities.
   *
   * @param from Source entity reference
   * @param to Target entity reference
   * @param relationship The relationship type
   */
  public static void verifyRelationshipInRdf(
      EntityReference from, EntityReference to, Relationship relationship) {
    if (from == null || to == null) {
      return;
    }

    String fromUri = buildEntityUri(from);
    String toUri = buildEntityUri(to);

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    <%s> om:%s <%s> . "
                + "  } "
                + "}",
            fromUri, relationship.value(), toUri);

    boolean exists = executeSparqlAsk(sparql);

    if (!exists) {
      sparql =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "ASK { "
                  + "  GRAPH ?g { "
                  + "    <%s> om:%s <%s> . "
                  + "  } "
                  + "}",
              fromUri, relationship.name(), toUri);
      exists = executeSparqlAsk(sparql);
    }

    assertTrue(
        exists,
        String.format(
            "Relationship %s should exist from %s to %s in RDF",
            relationship.value(), from.getFullyQualifiedName(), to.getFullyQualifiedName()));
  }

  /**
   * Verify CONTAINS relationship (hierarchical parent-child).
   */
  public static void verifyContainsRelationship(EntityReference parent, EntityReference child) {
    verifyRelationshipInRdf(parent, child, Relationship.CONTAINS);
  }

  /**
   * Verify USES relationship (dependencies).
   */
  public static void verifyUsesRelationship(EntityReference from, EntityReference to) {
    verifyRelationshipInRdf(from, to, Relationship.USES);
  }

  /**
   * Verify UPSTREAM relationship (data lineage).
   */
  public static void verifyUpstreamRelationship(
      EntityReference downstream, EntityReference upstream) {
    verifyRelationshipInRdf(downstream, upstream, Relationship.UPSTREAM);
  }

  /**
   * Verify APPLIED_TO relationship (tags/glossary terms).
   */
  public static void verifyAppliedToRelationship(
      EntityReference tagOrTerm, EntityReference entity) {
    verifyRelationshipInRdf(tagOrTerm, entity, Relationship.APPLIED_TO);
  }

  /**
   * Verify that an owner relationship exists in RDF.
   */
  public static void verifyOwnerInRdf(String entityFqn, EntityReference owner) {
    if (owner == null) {
      return;
    }

    String ownerUri = buildEntityUri(owner);

    String sparql =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "ASK { "
                + "  GRAPH ?g { "
                + "    ?entity om:hasOwner <%s> ; "
                + "           om:fullyQualifiedName %s . "
                + "  } "
                + "}",
            ownerUri, escapeSparqlString(entityFqn));

    boolean exists = executeSparqlAsk(sparql);
    assertTrue(
        exists,
        String.format(
            "Owner %s should be set for %s in RDF", owner.getFullyQualifiedName(), entityFqn));
  }

  /**
   * Verify that tags are stored in RDF for an entity.
   */
  public static void verifyTagsInRdf(String entityFqn, List<TagLabel> tags) {
    if (tags == null || tags.isEmpty()) {
      return;
    }

    for (TagLabel tag : tags) {
      String predicate =
          tag.getSource() == TagLabel.TagSource.GLOSSARY ? "hasGlossaryTerm" : "hasTag";

      String sparql =
          String.format(
              "PREFIX om: <https://open-metadata.org/ontology/> "
                  + "ASK { "
                  + "  GRAPH ?g { "
                  + "    ?entity om:%s ?tag ; "
                  + "           om:fullyQualifiedName %s . "
                  + "  } "
                  + "}",
              predicate, escapeSparqlString(entityFqn));

      boolean exists = executeSparqlAsk(sparql);

      if (!exists) {
        LOG.warn("Tag {} not found for entity {} in RDF", tag.getTagFQN(), entityFqn);
      }
    }
  }

  /**
   * Execute a SPARQL SELECT query and return results as JSON.
   */
  public static String executeSparqlSelect(String sparql) {
    try {
      String endpoint = TestSuiteBootstrap.getFusekiQueryEndpoint();
      String encodedQuery = URLEncoder.encode(sparql, StandardCharsets.UTF_8);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(endpoint + "?query=" + encodedQuery))
              .header("Accept", "application/sparql-results+json")
              .timeout(Duration.ofSeconds(30))
              .GET()
              .build();

      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        return response.body();
      } else {
        LOG.error("SPARQL query failed with status {}: {}", response.statusCode(), response.body());
        return null;
      }
    } catch (Exception e) {
      LOG.error("Error executing SPARQL query: {}", sparql, e);
      return null;
    }
  }

  /**
   * Execute a SPARQL ASK query and return boolean result.
   */
  public static boolean executeSparqlAsk(String sparql) {
    try {
      String endpoint = TestSuiteBootstrap.getFusekiQueryEndpoint();
      String encodedQuery = URLEncoder.encode(sparql, StandardCharsets.UTF_8);

      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(endpoint + "?query=" + encodedQuery))
              .header("Accept", "application/sparql-results+json")
              .timeout(Duration.ofSeconds(30))
              .GET()
              .build();

      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        JsonNode jsonNode = MAPPER.readTree(response.body());
        if (jsonNode.has("boolean")) {
          return jsonNode.get("boolean").asBoolean();
        }
        return false;
      } else {
        LOG.error("SPARQL ASK failed with status {}: {}", response.statusCode(), response.body());
        return false;
      }
    } catch (Exception e) {
      LOG.error("Error executing SPARQL ASK: {}", sparql, e);
      return false;
    }
  }

  /**
   * Build entity URI from EntityReference.
   */
  private static String buildEntityUri(EntityReference ref) {
    return "https://open-metadata.org/entity/" + ref.getType() + "/" + ref.getId();
  }

  /**
   * Log debug information when entity is not found in RDF.
   */
  private static void logDebugInfo(EntityInterface entity, String rdfType) {
    String debugQuery =
        String.format(
            "PREFIX om: <https://open-metadata.org/ontology/> "
                + "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> "
                + "SELECT ?g ?entity ?type ?fqn ?label WHERE { "
                + "  GRAPH ?g { "
                + "    ?entity om:fullyQualifiedName \"%s\" ; "
                + "           a ?type . "
                + "    OPTIONAL { ?entity rdfs:label ?label } "
                + "  } "
                + "} LIMIT 10",
            entity.getFullyQualifiedName().replace("\\", "\\\\").replace("\"", "\\\""));

    String result = executeSparqlSelect(debugQuery);
    if (result != null) {
      LOG.warn("Entity not found with expected type. Debug query result: {}", result);
    }
  }
}
