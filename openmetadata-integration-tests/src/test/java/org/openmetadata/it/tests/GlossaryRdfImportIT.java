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
import org.openmetadata.schema.type.EntityStatus;

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
    assertEquals(
        EntityStatus.APPROVED,
        provider.getEntityStatus(),
        "without reviewers, imported terms default to Approved");

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
  void dryRunReportsRelationAndCustomPropertyCounts(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);

    JsonNode result = importRdf(glossary.getName(), true);

    assertTrue(result.get("dryRun").asBoolean());
    assertTrue(
        result.get("relationsAdded").asInt() >= 1,
        "dry-run preview must report relations that would be added: " + result);
    assertTrue(
        result.get("customPropertiesCreated").asInt() >= 1,
        "dry-run preview must report datatype attributes that would be created: " + result);
    assertTrue(result.get("termsCreated").asInt() >= 3, "all concepts previewed: " + result);
    assertEquals(
        404,
        termStatus(glossary.getName() + ".HealthcareProvider"),
        "dry-run still must not persist terms");
  }

  @Test
  void dryRunReImportCountsExistingNestedTermsAsUpdates(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    importRdf(glossary.getName(), false);

    JsonNode result = importRdf(glossary.getName(), true);

    assertTrue(result.get("dryRun").asBoolean());
    assertEquals(
        0,
        result.get("termsCreated").asInt(),
        "a re-import dry-run must not count existing terms as creates: " + result);
    assertTrue(
        result.get("termsUpdated").asInt() >= 3,
        "a re-import dry-run must count existing nested terms (e.g. the child Physician) "
            + "as updates, which requires the correct nested FQN: "
            + result);
    assertEquals(
        0,
        result.get("conceptMappingsAdded").asInt(),
        "a re-import must not re-count concept mappings already present on updated terms: "
            + result);
  }

  @Test
  void dryRunWithConceptSchemeDoesNotCreateGlossary(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String schemeOntology =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix hcp:  <http://example.com/ontology/hcp#> .

        hcp:DryRunSchemeProbe a skos:ConceptScheme ;
            rdfs:label "Dry Run Scheme Probe" .
        hcp:DryRunProvider a skos:Concept ;
            skos:prefLabel "Dry Run Provider" ;
            skos:inScheme hcp:DryRunSchemeProbe .
        """;

    HttpResponse<String> response =
        sendImportRdf(glossary.getName(), SdkClients.getAdminToken(), schemeOntology, true);

    assertEquals(200, response.statusCode(), response.body());
    assertEquals(
        404,
        glossaryStatus("DryRunSchemeProbe"),
        "a dry-run must not persist a glossary for a declared skos:ConceptScheme");
  }

  @Test
  void importRoutesConceptSchemeTermsIntoSelectedTarget(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String schemeOntology =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix hcp:  <http://example.com/ontology/hcp#> .

        hcp:TargetRouteSchemeProbe a skos:ConceptScheme ;
            rdfs:label "Target Route Scheme Probe" .
        hcp:RoutedProvider a skos:Concept ;
            skos:prefLabel "Routed Provider" ;
            skos:inScheme hcp:TargetRouteSchemeProbe .
        """;

    JsonNode result = importRdfBody(glossary.getName(), schemeOntology);

    assertTrue(result.get("termsCreated").asInt() >= 1, result.toString());
    assertEquals(
        200,
        termStatus(glossary.getName() + ".RoutedProvider"),
        "an inScheme term is materialized in the user-selected target glossary");
    assertEquals(
        404,
        glossaryStatus("TargetRouteSchemeProbe"),
        "no separate ConceptScheme glossary is created when a target is selected");
  }

  @Test
  void importSkipsLocalNameCollisionAndCountsOnlyPersistedMappings(TestNamespace ns)
      throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    // Two concepts from different vocabularies share the local name "Drug"; both would collapse to
    // the FQN <glossary>.Drug. The second must be skipped (not silently overwrite the first), and
    // only the persisted term's concept mapping may be counted.
    String collisionOntology =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix sct:  <http://snomed.info/id/> .
        @prefix ex1:  <http://example.com/vocab1#> .
        @prefix ex2:  <http://example.com/vocab2#> .

        ex1:Drug a skos:Concept ;
            skos:prefLabel "Drug One" ;
            skos:closeMatch sct:11111 .
        ex2:Drug a skos:Concept ;
            skos:prefLabel "Drug Two" ;
            skos:closeMatch sct:22222 .
        """;

    JsonNode result = importRdfBody(glossary.getName(), collisionOntology);
    String detail = " | result=" + result;

    assertEquals(
        1,
        result.get("termsCreated").asInt(),
        "two concepts sharing a local name must yield one term, not a silent overwrite" + detail);
    assertEquals(
        0,
        result.get("termsUpdated").asInt(),
        "the collision is skipped, not applied as an overwriting update" + detail);
    assertTrue(
        result.get("messages").toString().contains("collides"),
        "the local-name collision must be surfaced in the import messages" + detail);
    assertEquals(
        1,
        result.get("conceptMappingsAdded").asInt(),
        "only the persisted term's mapping is counted; the skipped term's is not" + detail);

    GlossaryTerm survivor = getTerm(glossary.getName() + ".Drug");
    String iri = survivor.getIri().toString();
    assertTrue(
        "http://example.com/vocab1#Drug".equals(iri)
            || "http://example.com/vocab2#Drug".equals(iri),
        "the surviving term keeps exactly one concept's canonical IRI" + detail);
  }

  @Test
  void importDoesNotOverwriteAConceptPersistedByAnEarlierImport(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    String vocab1 =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix ex1:  <http://example.com/vocab1#> .

        ex1:Drug a skos:Concept ;
            skos:prefLabel "Drug One" .
        """;
    String vocab2 =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix ex2:  <http://example.com/vocab2#> .

        ex2:Drug a skos:Concept ;
            skos:prefLabel "Drug Two" .
        """;

    // First import persists <glossary>.Drug carrying the ex1 canonical IRI.
    importRdfBody(glossary.getName(), vocab1);
    GlossaryTerm first = getTerm(glossary.getName() + ".Drug");
    assertEquals(
        "http://example.com/vocab1#Drug",
        first.getIri().toString(),
        "the first import persists the ex1 concept IRI");

    // A later import of a different-namespace concept with the same local name must be skipped,
    // not applied as a silent overwrite of the already-persisted term (fresh iriByFqn per run).
    JsonNode result = importRdfBody(glossary.getName(), vocab2);
    String detail = " | result=" + result;
    assertEquals(
        0,
        result.get("termsUpdated").asInt(),
        "the persisted term must not be overwritten" + detail);
    assertEquals(
        0,
        result.get("termsCreated").asInt(),
        "the colliding concept is skipped, not created" + detail);
    assertTrue(
        result.get("messages").toString().contains("collides"),
        "the collision with the persisted term must be surfaced" + detail);

    GlossaryTerm afterSecond = getTerm(glossary.getName() + ".Drug");
    assertEquals(
        "http://example.com/vocab1#Drug",
        afterSecond.getIri().toString(),
        "the persisted term keeps its original canonical IRI, not silently replaced" + detail);
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
  void nonAdminOwnerImportsTermsButCannotMutateGlobalSchema(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    User owner = UserTestFactory.createUser(ns, "ontologyOwner");
    setGlossaryOwner(glossary.getId().toString(), owner);
    String ownerToken =
        JwtAuthProvider.tokenFor(owner.getEmail(), owner.getEmail(), new String[] {}, 3600);

    HttpResponse<String> response = sendImportRdf(glossary.getName(), ownerToken, ONTOLOGY, false);

    assertEquals(200, response.statusCode(), response.body());
    JsonNode result = OBJECT_MAPPER.readTree(response.body());
    assertTrue(
        result.get("termsCreated").asInt() >= 3,
        "a non-admin glossary owner may still materialize terms: " + result);
    assertEquals(
        0,
        result.get("relationTypesRegistered").asInt(),
        "a non-admin owner must not register global relation types: " + result);
    assertEquals(
        0,
        result.get("customPropertiesCreated").asInt(),
        "a non-admin owner must not create global custom properties: " + result);
  }

  @Test
  void dryRunForNonAdminDoesNotCountUnregisterableRelations(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    User owner = UserTestFactory.createUser(ns, "ontologyDryRunOwner");
    setGlossaryOwner(glossary.getId().toString(), owner);
    String ownerToken =
        JwtAuthProvider.tokenFor(owner.getEmail(), owner.getEmail(), new String[] {}, 3600);

    // A custom object property that no other test registers, so it is guaranteed to be
    // unregistered when this non-admin import runs (the global relation-type settings are
    // shared across the concurrent suite, and a non-admin never registers it).
    String ontology =
        """
        @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        @prefix owl:  <http://www.w3.org/2002/07/owl#> .
        @prefix hcp:  <http://example.com/ontology/hcp#> .

        hcp:NonAdminProbeA a skos:Concept ;
            skos:prefLabel "Non Admin Probe A" .
        hcp:NonAdminProbeB a skos:Concept ;
            skos:prefLabel "Non Admin Probe B" ;
            hcp:nonAdminProbeLink hcp:NonAdminProbeA .
        hcp:nonAdminProbeLink a owl:ObjectProperty ;
            rdfs:label "non admin probe link" .
        """;

    HttpResponse<String> response = sendImportRdf(glossary.getName(), ownerToken, ontology, true);

    assertEquals(200, response.statusCode(), response.body());
    JsonNode result = OBJECT_MAPPER.readTree(response.body());
    assertTrue(result.get("dryRun").asBoolean());
    assertEquals(
        0,
        result.get("relationTypesRegistered").asInt(),
        "a non-admin cannot register custom relation types: " + result);
    assertEquals(
        0,
        result.get("relationsAdded").asInt(),
        "the dry-run preview must not count a relation using a custom type the non-admin cannot "
            + "register (it would otherwise contradict relationTypesRegistered=0): "
            + result);
  }

  @Test
  void importIntoGlossaryWithReviewersCreatesDraftTerms(TestNamespace ns) throws Exception {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    User reviewer = UserTestFactory.createUser(ns, "ontologyReviewer");
    setGlossaryReviewer(glossary.getId().toString(), reviewer);

    importRdf(glossary.getName(), false);

    GlossaryTerm provider = getTerm(glossary.getName() + ".HealthcareProvider");
    assertEquals(
        EntityStatus.DRAFT,
        provider.getEntityStatus(),
        "terms imported into a glossary with reviewers must be Draft, not auto-published: "
            + provider.getEntityStatus());
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

  private void setGlossaryOwner(String glossaryId, User owner) throws Exception {
    String body =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\"%s\",\"type\":\"user\"}]}]",
            owner.getId());
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    String.format("%s/v1/glossaries/%s", SdkClients.getServerUrl(), glossaryId)))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .timeout(Duration.ofSeconds(30))
            .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "failed to set glossary owner: " + response.body());
  }

  private void setGlossaryReviewer(String glossaryId, User reviewer) throws Exception {
    String body =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/reviewers\",\"value\":[{\"id\":\"%s\",\"type\":\"user\"}]}]",
            reviewer.getId());
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    String.format("%s/v1/glossaries/%s", SdkClients.getServerUrl(), glossaryId)))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .timeout(Duration.ofSeconds(30))
            .method("PATCH", HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "failed to set glossary reviewer: " + response.body());
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

  private int glossaryStatus(String name) throws Exception {
    return get(String.format("%s/v1/glossaries/name/%s", SdkClients.getServerUrl(), name))
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
