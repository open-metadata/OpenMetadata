package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * The built-in ontology roles (ADR:2026-11-02-ontology-roles-are-seeded): what each role, and
 * ownership of an ontology, lets a person do over HTTP.
 */
@ExtendWith(TestNamespaceExtension.class)
class OntologyRolesIT extends BaseOntologyApprovalIT {
  private static final HttpClient HTTP = HttpClient.newHttpClient();

  @Test
  void builtInRolesAndTheirPoliciesAreSeeded() {
    assertEquals(List.of("OntologyAuthorPolicy"), policyNames("OntologyAuthor"));
    assertEquals(List.of("OntologyReviewerPolicy"), policyNames("OntologyReviewer"));

    final List<String> steward = policyNames("DataSteward");
    assertEquals(1, steward.stream().filter("OntologyAuthorPolicy"::equals).count());
    assertEquals(1, steward.stream().filter("OntologyReviewerPolicy"::equals).count());
    assertTrue(steward.contains("DataStewardPolicy"), steward.toString());
  }

  @Test
  void authorWithNoOtherRoleCreatesCapturesAndRequestsReview(final TestNamespace ns) {
    final User author = createUser(ns, "author", "OntologyAuthor");
    final OpenMetadataClient client = clientFor(author);

    final Ontology ontology =
        ns.trackRoot(
            Entity.ONTOLOGY,
            client.ontologies().create(request(ns).withName(ns.prefix("authored"))));
    final OntologyConcept concept =
        client
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withOntology(ontology.getFullyQualifiedName())
                    .withName("Authored")
                    .withIri(URI.create(ontology.getNamespace() + "Authored"))
                    .withConceptType(OntologyConceptType.OWL_CLASS));
    final OntologyRelease release =
        client
            .ontologies()
            .capture(
                ontology.getId(),
                new CaptureOntologyRelease()
                    .withExpectedWorkingRevision(
                        client.ontologies().state(ontology.getId()).getWorkingRevision()));
    final Task review =
        client
            .tasks()
            .create(reviewRequest(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName()));
    ns.trackRoot(Entity.TASK, review);

    assertEquals("Authored", concept.getName());
    assertTrue(
        release.getMemberCount() >= 1, "The release must hold the concept the author declared");
    assertEquals(release.getId(), review.getAbout().getId());
  }

  @Test
  void reviewerWithNoOtherRoleReadsAndVotesButCannotWrite(final TestNamespace ns) {
    final User reviewer = createUser(ns, "reviewer", "OntologyReviewer");
    final Ontology ontology =
        ns.trackRoot(
            Entity.ONTOLOGY,
            SdkClients.adminClient()
                .ontologies()
                .create(
                    request(ns)
                        .withName(ns.prefix("reviewerRole"))
                        .withReviewers(List.of(reviewer.getEntityReference()))));
    final OntologyConcept concept =
        declareClass(ontology, "Reviewed", URI.create(ontology.getNamespace() + "Reviewed"));
    final OntologyRelease release = capture(ontology);
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    assertEquals(
        200,
        status(reviewer, "GET", "/v1/ontologies/" + ontology.getId(), null, "application/json"));
    assertEquals(
        200,
        status(
            reviewer, "GET", "/v1/ontologyConcepts/" + concept.getId(), null, "application/json"));
    assertEquals(
        403,
        status(
            reviewer,
            "POST",
            "/v1/ontologies",
            JsonUtils.pojoToJson(request(ns).withName(ns.prefix("deniedByReviewer"))),
            "application/json"));
    assertEquals(
        403,
        status(
            reviewer,
            "PATCH",
            "/v1/ontologyConcepts/" + concept.getId(),
            "[{\"op\":\"add\",\"path\":\"/synonyms\",\"value\":[\"Denied\"]}]",
            "application/json-patch+json"));
    assertEquals(
        403,
        status(
            reviewer,
            "POST",
            "/v1/ontologies/" + ontology.getId() + "/releases",
            JsonUtils.pojoToJson(new CaptureOntologyRelease().withExpectedWorkingRevision(1L)),
            "application/json"));

    clientFor(reviewer)
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    assertEquals(
        org.openmetadata.schema.type.EntityStatus.APPROVED, current(release).getEntityStatus());
  }

  @Test
  void dataStewardCreatesAnOntology(final TestNamespace ns) {
    final User steward = createUser(ns, "steward", "DataSteward");

    final Ontology ontology =
        clientFor(steward).ontologies().create(request(ns).withName(ns.prefix("stewarded")));
    ns.trackRoot(Entity.ONTOLOGY, ontology);

    assertEquals(ns.prefix("stewarded"), ontology.getName());
  }

  @Test
  void dataConsumerReadsButCannotCreateAnOntology(final TestNamespace ns) {
    final User consumer = createUser(ns, "consumer", "DataConsumer");
    final Ontology ontology = createOntology(ns, "readable");

    assertEquals(
        200,
        status(consumer, "GET", "/v1/ontologies/" + ontology.getId(), null, "application/json"));
    assertEquals(
        403,
        status(
            consumer,
            "POST",
            "/v1/ontologies",
            JsonUtils.pojoToJson(request(ns).withName(ns.prefix("deniedByConsumer"))),
            "application/json"));
  }

  @Test
  void ownerOfAnOntologyWithNoRoleEditsItsConcepts(final TestNamespace ns) {
    final User owner = createUser(ns, "conceptOwner", "NONE");
    final User newOwner = createUser(ns, "conceptNewOwner", "NONE");
    final Ontology ontology =
        SdkClients.adminClient()
            .ontologies()
            .create(
                request(ns)
                    .withName(ns.prefix("ownedOntology"))
                    .withReviewers(List.of())
                    .withOwners(List.of(owner.getEntityReference())));
    ns.trackRoot(Entity.ONTOLOGY, ontology);
    final OntologyConcept concept =
        declareClass(
            ontology, "OwnedConcept", URI.create(ontology.getNamespace() + "OwnedConcept"));
    final String path = "/v1/ontologyConcepts/" + concept.getId();

    assertEquals(
        200,
        patch(owner, path, "[{\"op\":\"add\",\"path\":\"/synonyms\",\"value\":[\"Possessed\"]}]"));
    assertEquals(
        200,
        patch(owner, path, "[{\"op\":\"add\",\"path\":\"/displayName\",\"value\":\"Owned\"}]"));
    assertEquals(
        200,
        patch(
            owner,
            path,
            "[{\"op\":\"add\",\"path\":\"/owners\",\"value\":[{\"id\":\""
                + newOwner.getId()
                + "\",\"type\":\"user\"}]}]"));

    final JsonNode stored =
        JsonUtils.readTree(
            send(
                    SdkClients.getAdminToken(),
                    "GET",
                    path + "?fields=owners",
                    null,
                    "application/json")
                .body());
    assertEquals("Owned", stored.get("displayName").asText());
    assertEquals("Possessed", stored.get("synonyms").get(0).asText());
    assertEquals(newOwner.getId().toString(), stored.get("owners").get(0).get("id").asText());
  }

  @Test
  void aUserWhoIsNeitherOwnerNorAuthorCannotEditConcepts(final TestNamespace ns) {
    final User stranger = createUser(ns, "stranger", "NONE");
    final Ontology ontology = createOntology(ns, "strangerOntology");
    final OntologyConcept concept =
        declareClass(ontology, "Guarded", URI.create(ontology.getNamespace() + "Guarded"));

    assertEquals(
        403,
        patch(
            stranger,
            "/v1/ontologyConcepts/" + concept.getId(),
            "[{\"op\":\"add\",\"path\":\"/synonyms\",\"value\":[\"Nope\"]}]"));
  }

  private static List<String> policyNames(final String role) {
    final JsonNode json =
        JsonUtils.readTree(
            send(
                    SdkClients.getAdminToken(),
                    "GET",
                    "/v1/roles/name/" + role + "?fields=policies",
                    null,
                    "application/json")
                .body());
    final List<String> names = new ArrayList<>();
    json.get("policies").forEach(policy -> names.add(policy.get("name").asText()));
    return names;
  }

  private static User createUser(final TestNamespace ns, final String base, final String role) {
    final String name = ns.shortPrefix(base);
    final CreateUser request =
        new CreateUser().withName(name).withEmail(name + "@test.om.org").withDescription("v7 user");
    if (!"NONE".equals(role)) {
      request.withRoles(List.of(SdkClients.adminClient().roles().getByName(role).getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static OpenMetadataClient clientFor(final User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static int patch(final User user, final String path, final String body) {
    return status(user, "PATCH", path, body, "application/json-patch+json");
  }

  private static int status(
      final User user,
      final String method,
      final String path,
      final String body,
      final String contentType) {
    final String token =
        JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 600);
    return send(token, method, path, body, contentType).statusCode();
  }

  private static HttpResponse<String> send(
      final String token,
      final String method,
      final String path,
      final String body,
      final String contentType) {
    try {
      return HTTP.send(
          HttpRequest.newBuilder()
              .uri(URI.create(SdkClients.getServerUrl() + path))
              .header("Authorization", "Bearer " + token)
              .header("Content-Type", contentType)
              .timeout(Duration.ofSeconds(60))
              .method(
                  method,
                  body == null
                      ? HttpRequest.BodyPublishers.noBody()
                      : HttpRequest.BodyPublishers.ofString(body))
              .build(),
          HttpResponse.BodyHandlers.ofString());
    } catch (java.io.IOException | InterruptedException e) {
      throw new IllegalStateException(method + " " + path, e);
    }
  }
}
