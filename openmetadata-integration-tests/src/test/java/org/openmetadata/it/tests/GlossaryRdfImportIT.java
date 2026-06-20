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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.User;

/**
 * End-to-end test for the native OWL/RDF ontology import endpoint
 * ({@code PUT /v1/glossaries/name/{name}/importRdf}). Verifies that an ontology is materialized as
 * real, editable glossary terms with hierarchy, synonyms, canonical IRIs, SKOS concept mappings,
 * typed relations (auto-registered) and datatype-property custom properties.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryRdfImportIT {

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private static final String ONTOLOGY =
      """
      @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix owl:  <http://www.w3.org/2002/07/owl#> .
      @prefix hcp:  <http://example.com/ontology/hcp#> .
      @prefix sct:  <http://snomed.info/id/> .
      @prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

      hcp:HealthcareProvider a skos:Concept ;
          skos:prefLabel "Healthcare Provider" ;
          skos:definition "A person who delivers care." ;
          skos:altLabel "HCP" , "Provider" ;
          skos:closeMatch sct:158965000 .

      hcp:Physician a owl:Class ;
          skos:prefLabel "Physician" ;
          rdfs:subClassOf hcp:HealthcareProvider ;
          hcp:prescribes hcp:Drug .

      hcp:Drug a skos:Concept ;
          skos:prefLabel "Drug" .

      hcp:prescribes a owl:ObjectProperty ;
          rdfs:label "prescribes" .

      hcp:hasNpiNumber a owl:DatatypeProperty ;
          rdfs:domain hcp:HealthcareProvider ;
          rdfs:range xsd:string .
      """;

  @Test
  void importsOwlOntologyIntoGlossary(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String glossaryName = glossary.getName();

    JsonNode result = importRdf(glossaryName, false);
    String detail = " | result=" + result;
    assertFalse(result.get("dryRun").asBoolean(), detail);
    assertTrue(result.get("termsCreated").asInt() >= 3, "all three concepts become terms" + detail);
    assertTrue(
        result.get("relationsAdded").asInt() >= 1, "custom prescribes relation wired" + detail);
    assertTrue(result.get("conceptMappingsAdded").asInt() >= 1, "external closeMatch" + detail);
    assertTrue(
        result.get("customPropertiesCreated").asInt() >= 1, "datatype property -> CP" + detail);

    GlossaryTerm provider = getTerm(glossaryName + ".HealthcareProvider");
    assertNotNull(provider.getIri(), "canonical ontology IRI is persisted");
    assertTrue(provider.getSynonyms().contains("HCP"), "altLabel -> synonym");
    assertFalse(provider.getConceptMappings().isEmpty(), "SKOS closeMatch -> conceptMapping");

    GlossaryTerm physician = getTerm(glossaryName + ".HealthcareProvider.Physician");
    assertNotNull(physician.getParent(), "rdfs:subClassOf -> parent");
    assertEquals("HealthcareProvider", physician.getParent().getName());
    assertTrue(
        physician.getRelatedTerms().stream()
            .anyMatch(relation -> "prescribes".equals(relation.getRelationType())),
        "object property -> typed relatedTerm");
  }

  @Test
  void dryRunReportsCountsWithoutPersistingTerms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    JsonNode result = importRdf(glossary.getName(), true);
    assertTrue(result.get("dryRun").asBoolean());
    assertEquals(
        404,
        termStatus(glossary.getName() + ".HealthcareProvider"),
        "dry run must not create terms");
  }

  @Test
  void rejectsMalformedRdfWithBadRequest(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    HttpResponse<String> response =
        sendImportRdf(
            glossary.getName(),
            SdkClients.getAdminToken(),
            "this is not @@@ valid <<< turtle ;;;",
            true);

    assertEquals(400, response.statusCode(), "malformed RDF must be rejected: " + response.body());
  }

  @Test
  void importRequiresGlossaryEditPermission(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    User nonAdmin = UserTestFactory.createUser(ns, "ontologyNoEdit");
    String nonAdminToken =
        JwtAuthProvider.tokenFor(nonAdmin.getEmail(), nonAdmin.getEmail(), new String[] {}, 3600);

    HttpResponse<String> response =
        sendImportRdf(glossary.getName(), nonAdminToken, ONTOLOGY, true);

    assertEquals(
        403,
        response.statusCode(),
        "import must require glossary EDIT permission: " + response.body());
  }

  @Test
  void importsValidConceptsAndGracefullySkipsDanglingReferences(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String partialOntology =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix hcp:  <http://example.com/ontology/hcp#> .
        @prefix ext:  <http://external.example.com/notimported#> .

        hcp:Root a skos:Concept ;
            skos:prefLabel "Root" .

        hcp:Child a skos:Concept ;
            skos:prefLabel "Child" ;
            rdfs:subClassOf hcp:Root .

        hcp:Orphan a skos:Concept ;
            skos:prefLabel "Orphan" ;
            rdfs:subClassOf ext:NotImported ;
            hcp:relatesTo ext:AlsoNotImported .
        """;

    JsonNode result = importRdfBody(glossary.getName(), partialOntology);

    assertTrue(
        result.get("termsCreated").asInt() >= 3,
        "every well-formed concept is materialized despite dangling references: " + result);
    assertEquals(
        200,
        termStatus(glossary.getName() + ".Root.Child"),
        "a concept with an internal parent keeps its hierarchy");
    GlossaryTerm child = getTerm(glossary.getName() + ".Root.Child");
    assertEquals("Root", child.getParent().getName(), "internal subClassOf wires the parent");
    assertEquals(
        200,
        termStatus(glossary.getName() + ".Orphan"),
        "a concept whose only parent is an unimported external IRI is still created as a root");
  }

  @Test
  void reimportIsIdempotent(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String glossaryName = glossary.getName();

    JsonNode first = importRdf(glossaryName, false);
    assertTrue(first.get("termsCreated").asInt() >= 3, "first import creates the terms");

    JsonNode second = importRdf(glossaryName, false);
    assertEquals(
        0, second.get("termsCreated").asInt(), "re-import creates no new terms: " + second);
    assertTrue(second.get("termsUpdated").asInt() >= 3, "re-import updates the existing terms");
    assertEquals(200, termStatus(glossaryName + ".HealthcareProvider"), "term still resolves once");
  }

  @Test
  @EnabledIf("isRdfEnabled")
  void roundTripsThroughRdfExport(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    importRdf(glossary.getName(), false);

    String turtle = exportGlossaryAsTurtle(glossary.getId().toString());
    assertTrue(
        turtle.contains("http://example.com/ontology/hcp#HealthcareProvider"),
        "export preserves the canonical ontology IRI as the subject: " + turtle);
    assertTrue(turtle.contains("broader"), "subClassOf hierarchy is exported as skos:broader");
  }

  static boolean isRdfEnabled() {
    return RdfTestUtils.isRdfEnabled();
  }

  private JsonNode importRdf(String glossaryName, boolean dryRun) throws Exception {
    String url =
        String.format(
            "%s/v1/glossaries/name/%s/importRdf?dryRun=%s&format=turtle",
            SdkClients.getServerUrl(), glossaryName, dryRun);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "text/turtle")
            .timeout(Duration.ofSeconds(60))
            .PUT(HttpRequest.BodyPublishers.ofString(ONTOLOGY))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "importRdf failed: " + response.body());
    return OBJECT_MAPPER.readTree(response.body());
  }

  private HttpResponse<String> sendImportRdf(
      String glossaryName, String token, String body, boolean dryRun) throws Exception {
    String url =
        String.format(
            "%s/v1/glossaries/name/%s/importRdf?dryRun=%s&format=turtle",
            SdkClients.getServerUrl(), glossaryName, dryRun);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "text/turtle")
            .timeout(Duration.ofSeconds(60))
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .build();

    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private JsonNode importRdfBody(String glossaryName, String body) throws Exception {
    HttpResponse<String> response =
        sendImportRdf(glossaryName, SdkClients.getAdminToken(), body, false);
    assertEquals(200, response.statusCode(), "import failed: " + response.body());

    return OBJECT_MAPPER.readTree(response.body());
  }

  private GlossaryTerm getTerm(String fqn) throws Exception {
    String url =
        String.format(
            "%s/v1/glossaryTerms/name/%s?fields=relatedTerms,parent",
            SdkClients.getServerUrl(), fqn);
    HttpResponse<String> response = get(url);
    assertEquals(200, response.statusCode(), "getTerm failed: " + response.body());
    return OBJECT_MAPPER.readValue(response.body(), GlossaryTerm.class);
  }

  private int termStatus(String fqn) throws Exception {
    return get(String.format("%s/v1/glossaryTerms/name/%s", SdkClients.getServerUrl(), fqn))
        .statusCode();
  }

  private HttpResponse<String> get(String url) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build();
    return HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
  }

  private String exportGlossaryAsTurtle(String glossaryId) throws Exception {
    String url =
        String.format(
            "%s/v1/rdf/glossary/%s/export?format=turtle", SdkClients.getServerUrl(), glossaryId);
    HttpResponse<String> response = get(url);
    assertEquals(200, response.statusCode(), "export failed: " + response.body());
    return response.body();
  }
}
