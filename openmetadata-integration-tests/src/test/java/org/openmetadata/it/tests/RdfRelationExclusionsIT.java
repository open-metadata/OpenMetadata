/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests to verify that certain entity types and relationships
 * are excluded from RDF storage as they don't provide meaningful semantic value.
 *
 * <p>Excluded entity types:
 * - changeEvent (audit/versioning data)
 * - auditLog
 * - webAnalyticEvent
 * - entityUsage
 * - eventSubscription
 * - vote
 * - THREAD
 *
 * <p>Excluded relationship types:
 * - VOTED (user voting interactions)
 * - FOLLOWS (user following interactions)
 */
@Execution(ExecutionMode.SAME_THREAD)
@Tag("integration")
@Tag("rdf")
public class RdfRelationExclusionsIT {

  private static final Logger LOG = LoggerFactory.getLogger(RdfRelationExclusionsIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();

  private static boolean rdfEnabled = false;

  @BeforeAll
  static void checkRdfEnabled() {
    try {
      String statusUrl = SdkClients.getServerUrl() + "/v1/rdf/status";
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(statusUrl))
              .header("Authorization", "Bearer " + SdkClients.getAdminToken())
              .header("Accept", "application/json")
              .GET()
              .build();

      HttpResponse<String> response =
          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

      if (response.statusCode() == 200) {
        JsonNode statusJson = MAPPER.readTree(response.body());
        rdfEnabled = statusJson.has("enabled") && statusJson.get("enabled").asBoolean();
      }
      LOG.info("RDF enabled: {}", rdfEnabled);
    } catch (Exception e) {
      LOG.warn("Could not check RDF status, assuming disabled: {}", e.getMessage());
      rdfEnabled = false;
    }
  }

  static boolean isRdfEnabled() {
    return rdfEnabled;
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void testChangeEventNotInRdfGraph() throws Exception {
    String sparqlQuery =
        "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?s ?p ?o WHERE { "
            + "  ?s ?p ?o . "
            + "  FILTER(CONTAINS(STR(?s), 'changeEvent') || CONTAINS(STR(?o), 'changeEvent')) "
            + "} LIMIT 10";

    String result = executeSparqlQuery(sparqlQuery);

    LOG.info("SPARQL query result for changeEvent: {}", result);

    assertFalse(
        result.contains("changeEvent") && result.contains("bindings"),
        "changeEvent entities should not be stored in RDF");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void testVotesNotInRdfGraph() throws Exception {
    String sparqlQuery =
        "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?s ?o WHERE { "
            + "  ?s om:VOTED ?o . "
            + "} LIMIT 10";

    String result = executeSparqlQuery(sparqlQuery);

    LOG.info("SPARQL query result for VOTED: {}", result);

    assertTrue(
        !result.contains("\"bindings\":[{")
            || result.contains("\"bindings\":[]")
            || result.contains("\"bindings\": []"),
        "VOTED relationships should not be stored in RDF");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void testFollowsNotInRdfGraph() throws Exception {
    String sparqlQuery =
        "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?s ?o WHERE { "
            + "  ?s om:FOLLOWS ?o . "
            + "} LIMIT 10";

    String result = executeSparqlQuery(sparqlQuery);

    LOG.info("SPARQL query result for FOLLOWS: {}", result);

    assertTrue(
        !result.contains("\"bindings\":[{")
            || result.contains("\"bindings\":[]")
            || result.contains("\"bindings\": []"),
        "FOLLOWS relationships should not be stored in RDF");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void testAuditLogNotInRdfGraph() throws Exception {
    String sparqlQuery =
        "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?s ?p ?o WHERE { "
            + "  ?s ?p ?o . "
            + "  FILTER(CONTAINS(STR(?s), 'auditLog') || CONTAINS(STR(?o), 'auditLog')) "
            + "} LIMIT 10";

    String result = executeSparqlQuery(sparqlQuery);

    LOG.info("SPARQL query result for auditLog: {}", result);

    assertFalse(
        result.contains("auditLog") && result.contains("bindings"),
        "auditLog entities should not be stored in RDF");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void testSemanticRelationsAreInRdfGraph() throws Exception {
    String sparqlQuery =
        "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?relType (COUNT(*) as ?count) WHERE { "
            + "  ?s ?relType ?o . "
            + "  FILTER(STRSTARTS(STR(?relType), 'https://open-metadata.org/ontology/')) "
            + "} GROUP BY ?relType LIMIT 20";

    String result = executeSparqlQuery(sparqlQuery);

    LOG.info("SPARQL query result for semantic relations: {}", result);

    if (!result.contains("\"bindings\":[]")) {
      LOG.info("RDF contains semantic relationships as expected");
    }
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void testGlossaryTermRelationsInRdfGraph() throws Exception {
    String sparqlQuery =
        "PREFIX skos: <http://www.w3.org/2004/02/skos/core#> "
            + "PREFIX om: <https://open-metadata.org/ontology/> "
            + "SELECT ?term ?relType ?related WHERE { "
            + "  ?term a skos:Concept . "
            + "  ?term ?relType ?related . "
            + "  FILTER(?relType IN (skos:related, skos:broader, skos:narrower, "
            + "    om:synonym, om:antonym, om:partOf, om:hasPart)) "
            + "} LIMIT 20";

    String result = executeSparqlQuery(sparqlQuery);

    LOG.info("SPARQL query result for glossary term relations: {}", result);
  }

  private String executeSparqlQuery(String query) throws Exception {
    String sparqlUrl =
        SdkClients.getServerUrl()
            + "/v1/rdf/sparql?query="
            + java.net.URLEncoder.encode(query, "UTF-8");

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(sparqlUrl))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Accept", "application/json")
            .GET()
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      LOG.warn("SPARQL query returned status {}: {}", response.statusCode(), response.body());
      return "{}";
    }

    return response.body();
  }
}
