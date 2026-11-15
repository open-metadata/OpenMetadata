package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
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
  @ResourceLock("ontology-sparql-worker")
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

  @Test
  void changeSetsOfTheWorkingDraftAreReadWithEditAllOnTheirScope(final TestNamespace ns) {
    final User consumer = createConsumer(ns);
    final User editor = createEditor(ns);
    final Ontology ontology = createOntology(ns, "changeSetRead");
    final Ontology other = createOntology(ns, "changeSetOther");
    activate(ns, ontology);
    final OntologyChangeSet nativeDraft = nativeChangeSet(ns, ontology);
    final OntologyChangeSet otherDraft = nativeChangeSet(ns, other);
    final Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix("changeSetGlossary"))
                        .withDescription("Glossary scope")));
    final OntologyChangeSet glossaryDraft =
        ns.trackRoot(
            "ontologyChangeSet",
            SdkClients.adminClient()
                .ontologyChangeSets()
                .create(
                    new CreateOntologyChangeSet()
                        .withName(ns.prefix("glossaryDraft"))
                        .withDisplayName("Glossary draft")
                        .withDescription("Glossary-scope change set")
                        .withGlossaries(Set.of(glossary.getFullyQualifiedName()))));

    final String base = "/v1/ontologyChangeSets";
    final String nativeId = nativeDraft.getId().toString();
    final List<String> gated =
        List.of(
            "GET " + base,
            "GET " + base + "?ontologyId=" + ontology.getId(),
            "GET " + base + "?ontology=" + ontology.getFullyQualifiedName(),
            "GET " + base + "?memorySourced=true",
            "GET " + base + "?memorySourced=true&ontologyId=" + ontology.getId(),
            "GET " + base + "/" + nativeId,
            "GET " + base + "/" + nativeId + "/versions",
            "GET " + base + "/" + nativeId + "/versions/" + nativeDraft.getVersion(),
            "GET " + base + "/" + glossaryDraft.getId(),
            "GET " + base + "/" + glossaryDraft.getId() + "/versions");
    gated.forEach(
        call -> {
          assertEquals(403, statusOf(token(consumer), call), "consumer " + call);
          assertEquals(200, statusOf(SdkClients.getAdminToken(), call), "admin " + call);
        });

    final String scoped = bodyOf(token(editor), "GET " + base + "?ontologyId=" + ontology.getId());
    assertTrue(scoped.contains(nativeId), "the ontology's own change set is listed");
    assertFalse(scoped.contains(otherDraft.getId().toString()), "another ontology's is not");
    assertEquals(200, statusOf(token(editor), "GET " + base + "/" + nativeId));
    assertEquals(200, statusOf(token(editor), "GET " + base + "/" + nativeId + "/versions"));
    assertEquals(
        400,
        statusOf(
            token(editor),
            "GET "
                + base
                + "?ontologyId="
                + other.getId()
                + "&ontology="
                + ontology.getFullyQualifiedName()));
  }

  @Test
  void anUnscopedListChecksTheOntologyOfEveryRowItReturns(final TestNamespace ns) {
    final User conditional = createConditionalEditor(ns);
    final Ontology unowned = createOntology(ns, "unownedRows");
    final Ontology owned =
        ns.trackRoot(
            Entity.ONTOLOGY,
            SdkClients.adminClient()
                .ontologies()
                .create(
                    request(ns)
                        .withName(ns.prefix("ownedRows"))
                        .withIri(URI.create("https://example.org/model/" + ns.shortPrefix("owned")))
                        .withOwners(List.of(SharedEntities.get().USER1.getEntityReference()))));
    final String unownedChangeSet = populate(ns, unowned);
    final String ownedChangeSet = populate(ns, owned);

    final String page = "?limit=1000000";
    final List<String> collections =
        List.of("ontologyConcepts", "ontologyProperties", "ontologyAxioms", "ontologyChangeSets");
    for (final String collection : collections) {
      final String base = "GET /v1/" + collection;
      final String scopedToUnowned =
          collection.equals("ontologyAxioms") || collection.equals("ontologyChangeSets")
              ? "?ontologyId=" + unowned.getId()
              : "?ontology=" + unowned.getFullyQualifiedName();
      assertEquals(
          403, statusOf(token(conditional), base + page), "unscoped " + collection + " as editor");
      assertEquals(
          200,
          statusOf(token(conditional), base + scopedToUnowned),
          "scoped " + collection + " as editor");
      assertEquals(
          200, statusOf(SdkClients.getAdminToken(), base + page), "unscoped " + collection);
    }
    final String scopedChangeSets =
        bodyOf(token(conditional), "GET /v1/ontologyChangeSets?ontologyId=" + unowned.getId());
    assertTrue(scopedChangeSets.contains(unownedChangeSet));
    assertFalse(scopedChangeSets.contains(ownedChangeSet));
    final String scopedConcepts =
        bodyOf(
            token(conditional),
            "GET /v1/ontologyConcepts?ontology=" + unowned.getFullyQualifiedName());
    assertTrue(scopedConcepts.contains("\"name\":\"Customer\""));
  }

  @Test
  void anUnscopedListOfGlossaryChangeSetsNeedsEditAllOnTheirGlossary(final TestNamespace ns) {
    final User editor = createEditor(ns);
    final User consumer = createConsumer(ns);
    final Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix("sharedScope"))
                        .withDescription("Glossary scope")));
    final List<String> ids = new java.util.ArrayList<>();
    for (int index = 0; index < 4; index++) {
      ids.add(
          ns.trackRoot(
                  "ontologyChangeSet",
                  SdkClients.adminClient()
                      .ontologyChangeSets()
                      .create(
                          new CreateOntologyChangeSet()
                              .withName(ns.prefix("sharedDraft" + index))
                              .withDisplayName("Shared draft " + index)
                              .withDescription("Glossary-scope change set")
                              .withGlossaries(Set.of(glossary.getFullyQualifiedName()))))
              .getId()
              .toString());
    }

    final String list = "GET /v1/ontologyChangeSets?limit=1000000";
    final String body = bodyOf(token(editor), list);
    ids.forEach(id -> assertTrue(body.contains(id), "the editor's page holds " + id));
    assertTrue(body.contains("\"glossaries\""), "listed rows carry their glossaries");
    assertTrue(body.contains("\"operations\""), "listed rows carry their operations");
    assertEquals(403, statusOf(token(consumer), list));
    assertEquals(200, statusOf(SdkClients.getAdminToken(), list));
  }

  private static String populate(final TestNamespace ns, final Ontology ontology) {
    final String base = ontology.getNamespace().toString();
    final var admin = SdkClients.adminClient();
    declareClass(ontology, "Customer", URI.create(base + "Customer"));
    declareClass(ontology, "Party", URI.create(base + "Party"));
    admin
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("knows")
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.DATA)
                .withIri(URI.create(base + "knows")));
    admin
        .ontologyAxioms()
        .create(
            new CreateOntologyAxiom()
                .withName("CustomerIsParty")
                .withDisplayName("Customer is a Party")
                .withDescription("Every customer is a party")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(URI.create(base + "Customer"))
                .withProvenance(RelationProvenance.MANUAL)
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(URI.create(base + "Party")))));
    return nativeChangeSet(ns, ontology).getId().toString();
  }

  private static User createConditionalEditor(final TestNamespace ns) {
    final var admin = SdkClients.adminClient();
    final String name = ns.shortPrefix("condEditor");
    final Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(name + "Policy")
                        .withRules(
                            List.of(
                                new Rule()
                                    .withName("EditUnownedOntologies")
                                    .withEffect(Rule.Effect.ALLOW)
                                    .withResources(List.of(Entity.ONTOLOGY))
                                    .withOperations(List.of(MetadataOperation.EDIT_ALL))
                                    .withCondition("noOwner()"),
                                new Rule()
                                    .withName("ViewEverything")
                                    .withEffect(Rule.Effect.ALLOW)
                                    .withResources(List.of("All"))
                                    .withOperations(List.of(MetadataOperation.VIEW_ALL))))));
    final Role role =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(name + "Role")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    return ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new org.openmetadata.schema.api.teams.CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.om.org")
                    .withDescription("v7 user")
                    .withRoles(List.of(role.getId()))));
  }

  private static OntologyChangeSet nativeChangeSet(final TestNamespace ns, final Ontology o) {
    return ns.trackRoot(
        "ontologyChangeSet",
        SdkClients.adminClient()
            .ontologyChangeSets()
            .create(
                new CreateOntologyChangeSet()
                    .withName(ns.prefix("draft") + java.util.UUID.randomUUID())
                    .withDisplayName("Native draft")
                    .withDescription("Native change set")
                    .withOntology(o.getFullyQualifiedName())
                    .withBaseWorkingRevision(
                        SdkClients.adminClient().ontologies().state(o.getId()).getWorkingRevision())
                    .withOperations(List.of())));
  }

  private static User createEditor(final TestNamespace ns) {
    final var admin = SdkClients.adminClient();
    final String name = ns.shortPrefix("draftEditor");
    final Policy policy =
        ns.trackRoot(
            Entity.POLICY,
            admin
                .policies()
                .create(
                    new CreatePolicy()
                        .withName(name + "Policy")
                        .withRules(
                            List.of(
                                new Rule()
                                    .withName("EditEverything")
                                    .withEffect(Rule.Effect.ALLOW)
                                    .withResources(List.of("All"))
                                    .withOperations(
                                        List.of(
                                            MetadataOperation.EDIT_ALL,
                                            MetadataOperation.VIEW_ALL))))));
    final Role role =
        ns.trackRoot(
            Entity.ROLE,
            admin
                .roles()
                .create(
                    new CreateRole()
                        .withName(name + "Role")
                        .withPolicies(List.of(policy.getFullyQualifiedName()))));
    return ns.trackRoot(
        Entity.USER,
        admin
            .users()
            .create(
                new org.openmetadata.schema.api.teams.CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.om.org")
                    .withDescription("v7 user")
                    .withRoles(List.of(role.getId()))));
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
    return send(token, call).statusCode();
  }

  private static String bodyOf(final String token, final String call) {
    return send(token, call).body();
  }

  private static HttpResponse<String> send(final String token, final String call) {
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
      return response;
    } catch (java.io.IOException | InterruptedException e) {
      throw new IllegalStateException(call, e);
    }
  }
}
