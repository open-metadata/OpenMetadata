package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

/**
 * Working-draft content is read with EditAll on the ontology. A DataConsumer holds View on
 * everything and still reads the published release, never the draft.
 */
@ExtendWith(TestNamespaceExtension.class)
class IndependentOntologyDraftReadIT extends BaseOntologyApprovalIT {
  private static final HttpClient HTTP = HttpClient.newHttpClient();
  private static final String SPARQL = "{\"query\":\"SELECT * WHERE { ?s ?p ?o } LIMIT 1\"}";

  @Test
  void dataConsumerReadsThePublishedReleaseAndNoWorkingDraft(final TestNamespace ns) {
    final User consumer = createConsumer(ns);
    final Ontology ontology = createOntology(ns, "draftRead");
    declareClass(ontology, "Published", URI.create(ontology.getNamespace() + "Published"));
    final OntologyRelease release = activate(ns, ontology);
    final var unpublished =
        declareClass(ontology, "Unpublished", URI.create(ontology.getNamespace() + "Unpublished"));

    final String id = ontology.getId().toString();
    final String name = ontology.getFullyQualifiedName();
    final Map<String, int[]> draftReads = new TreeMap<>();
    draftReads.put("POST /v1/ontologies/" + id + "/sparql?scope=draft", expected(403, 200));
    draftReads.put("GET /v1/ontologies/" + id + "/working/diff", expected(403, 200));
    draftReads.put("GET /v1/ontologies/" + id + "/working/validation", expected(403, 200));
    draftReads.put("GET /v1/ontologies/" + id + "/export?format=turtle", expected(403, 200));
    draftReads.put(
        "GET /v1/ontologies/" + id + "/references?iri=" + iri(ontology), expected(403, 200));
    draftReads.put("GET /v1/ontologyConcepts?ontology=" + name, expected(403, 200));
    draftReads.put("GET /v1/ontologyProperties?ontology=" + name, expected(403, 200));
    draftReads.put("GET /v1/ontologyAxioms?ontologyId=" + id, expected(403, 200));
    draftReads.put("GET /v1/ontologyConcepts", expected(403, 200));
    draftReads.put("GET /v1/ontologyProperties", expected(403, 200));
    draftReads.put("GET /v1/ontologyAxioms", expected(403, 200));

    final Map<String, Integer> consumerStatus = new TreeMap<>();
    final Map<String, Integer> adminStatus = new TreeMap<>();
    draftReads.forEach(
        (call, codes) -> {
          consumerStatus.put(call, statusOf(token(consumer), call));
          adminStatus.put(call, statusOf(SdkClients.getAdminToken(), call));
        });
    draftReads.forEach(
        (call, codes) -> {
          assertEquals(codes[0], consumerStatus.get(call), "consumer " + call);
          assertEquals(codes[1], adminStatus.get(call), "admin " + call);
        });

    final int malformed = statusOf(token(consumer), "GET /v1/ontologyAxioms?ontologyId=not-a-uuid");
    assertTrue(malformed >= 400 && malformed < 500, "malformed ontologyId gave " + malformed);

    assertEquals(
        200,
        statusOf(token(consumer), "GET /v1/ontologyConcepts/" + unpublished.getId()),
        "a single definition is still read by id");

    final String releaseId = release.getId().toString();
    final List<String> publishedReads =
        List.of(
            "GET /v1/ontologies/" + id,
            "GET /v1/ontologies/" + id + "/state",
            "GET /v1/ontologies/" + id + "/releases",
            "GET /v1/ontologyReleases/" + releaseId,
            "GET /v1/ontologyReleases/" + releaseId + "/export?format=turtle",
            "GET /v1/ontologyReleases/" + releaseId + "/members/concept",
            "GET /v1/ontologyReleases/" + releaseId + "/members/property",
            "GET /v1/ontologyReleases/" + releaseId + "/members/axiom",
            "POST /v1/ontologies/" + id + "/sparql");
    publishedReads.forEach(
        call -> assertEquals(200, statusOf(token(consumer), call), "consumer " + call));
  }

  private static int[] expected(final int consumer, final int admin) {
    return new int[] {consumer, admin};
  }

  private static String iri(final Ontology ontology) {
    return java.net.URLEncoder.encode(
        ontology.getNamespace() + "Published", java.nio.charset.StandardCharsets.UTF_8);
  }

  private static User createConsumer(final TestNamespace ns) {
    final String name = ns.shortPrefix("draftConsumer");
    return ns.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(
                new org.openmetadata.schema.api.teams.CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.om.org")
                    .withDescription("v7 user")
                    .withRoles(
                        List.of(
                            SdkClients.adminClient().roles().getByName("DataConsumer").getId()))));
  }

  private static String token(final User user) {
    return JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 600);
  }

  private static int statusOf(final String token, final String call) {
    final int space = call.indexOf(' ');
    final String method = call.substring(0, space);
    final String path = call.substring(space + 1);
    try {
      final HttpResponse<String> response =
          HTTP.send(
              HttpRequest.newBuilder()
                  .uri(URI.create(SdkClients.getServerUrl() + path))
                  .header("Authorization", "Bearer " + token)
                  .header("Content-Type", "application/json")
                  .timeout(Duration.ofSeconds(60))
                  .method(
                      method,
                      "POST".equals(method)
                          ? HttpRequest.BodyPublishers.ofString(SPARQL)
                          : HttpRequest.BodyPublishers.noBody())
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      return response.statusCode();
    } catch (java.io.IOException | InterruptedException e) {
      throw new IllegalStateException(call, e);
    }
  }
}
