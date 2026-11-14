package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateOntology;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyChangeSetCommand;
import org.openmetadata.schema.api.data.OntologyPatternTermInput;
import org.openmetadata.schema.api.data.OntologyPatternType;
import org.openmetadata.schema.api.data.RegulatoryControlPatternInput;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyEditLeaseToken;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Isolated("Counts SQL statements while exercising release authorization over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class IndependentOntologyAuthorizationIT extends BaseOntologyApprovalIT {
  private static final Logger LOG =
      LoggerFactory.getLogger(IndependentOntologyAuthorizationIT.class);

  @Test
  void captureAndReleaseReadsLoadPermissionsPerPageInsteadOfPerDefinition(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final Ontology ontology = createOntology(ns);
    addConcepts(ontology, 0, 4);
    final Reads narrow = reads(ontology, 5);
    addConcepts(ontology, 4, 40);
    final Reads wide = reads(ontology, 41);
    LOG.info("Release SQL reads for 4 versus 40 concepts: {} -> {}", narrow, wide);

    assertTrue(
        narrow.capture() > 0 && narrow.structure() > 0,
        "The SQL probe must observe both requests: " + narrow);
    assertTrue(
        wide.capture() <= narrow.capture() + 12,
        "Definitions on the same page must not add authorization queries: "
            + narrow
            + " -> "
            + wide);
    assertTrue(
        wide.structure() <= narrow.structure() + 12,
        "Reading a sealed page must batch current permissions: " + narrow + " -> " + wide);
  }

  @ParameterizedTest
  @CsvSource({
    "DataConsumer,Approved",
    "DataConsumer,Rejected",
    "OntologyReviewer,Approved",
    "OntologyReviewer,Rejected",
    "NONE,Approved",
    "NONE,Rejected"
  })
  void listedReviewerVotesButCannotCaptureOrActivate(
      final String role, final TaskResolutionType vote, final TestNamespace ns) {
    final User reviewer = createUser(ns, "voter", role);
    final Ontology ontology =
        createOntologyWith(
            ns,
            "vote" + UUID.randomUUID().toString().substring(0, 6),
            List.of(reviewer),
            List.of());
    declareClass(ontology, "Voted", URI.create(ontology.getNamespace() + "Voted"));
    final OntologyRelease release = capture(ontology);
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());

    clientFor(reviewer).tasks().resolve(task.getId().toString(), decision(vote));

    assertEquals(
        vote == TaskResolutionType.Approved ? EntityStatus.APPROVED : EntityStatus.REJECTED,
        current(release).getEntityStatus());
    assertEquals(
        403,
        status(
            reviewer,
            "POST",
            "/v1/ontologies/" + ontology.getId() + "/releases",
            json(new CaptureOntologyRelease().withExpectedWorkingRevision(1L))));
    assertEquals(
        403,
        status(
            reviewer,
            "PUT",
            "/v1/ontologies/" + ontology.getId() + "/activation",
            json(
                new ActivateOntologyRelease()
                    .withReleaseId(release.getId())
                    .withExpectedActivationRevision(0L))));
    assertEquals(
        0L, SdkClients.adminClient().ontologies().state(ontology.getId()).getActivationRevision());
  }

  @ParameterizedTest
  @CsvSource({"DataConsumer", "OntologyReviewer", "NONE"})
  void listedReviewerCannotChangeReviewSettings(final String role, final TestNamespace ns) {
    final User reviewer = createUser(ns, "settings", role);
    final Ontology ontology = createOntologyWith(ns, "settings", List.of(reviewer), List.of());
    final String path = "/v1/ontologies/" + ontology.getId();

    assertEquals(
        403, patch(reviewer, path, "[{\"op\":\"replace\",\"path\":\"/reviewers\",\"value\":[]}]"));
    assertEquals(
        403,
        patch(
            reviewer,
            path,
            "[{\"op\":\"add\",\"path\":\"/approvalRule\",\"value\":{\"minimumApprovals\":1}}]"));
    assertEquals(
        List.of(reviewer.getId()),
        current(ontology).getReviewers().stream().map(r -> r.getId()).toList());
  }

  @Test
  void dataConsumerCannotEditOntologyContent(final TestNamespace ns) {
    final User consumer = createUser(ns, "consumer", "DataConsumer");
    final Ontology ontology = createOntologyWith(ns, "contentEdits", List.of(), List.of());
    final OntologyConcept concept =
        declareClass(ontology, "Guarded", URI.create(ontology.getNamespace() + "Guarded"));
    final String conceptPath = "/v1/ontologyConcepts/" + concept.getId();
    final String ontologyPath = "/v1/ontologies/" + ontology.getId();
    final String describe =
        "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Rewritten text\"}]";
    final String tag =
        "[{\"op\":\"add\",\"path\":\"/tags/0\",\"value\":{\"tagFQN\":\"PII.Sensitive\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}}]";

    assertEquals(403, patch(consumer, conceptPath, describe));
    assertEquals(403, patch(consumer, conceptPath, tag));
    assertEquals(403, patch(consumer, ontologyPath, describe));
    assertEquals(
        concept.getDescription(),
        SdkClients.adminClient()
            .ontologyConcepts()
            .get(concept.getId().toString())
            .getDescription());

    assertEquals(200, patchAsAdmin(conceptPath, describe));
    assertNotEquals(403, patchAsAdmin(conceptPath, tag));
    assertEquals(200, patchAsAdmin(ontologyPath, describe));
  }

  @Test
  void movingContentOutOfAGuardedFieldNeedsTheContentRight(final TestNamespace ns) {
    final User renamer =
        createUserWithOperations(
            ns,
            "renamer",
            List.of(
                MetadataOperation.EDIT_DISPLAY_NAME,
                MetadataOperation.EDIT_DESCRIPTION,
                MetadataOperation.VIEW_ALL));
    final Ontology ontology = createOntologyWith(ns, "moveOut", List.of(), List.of());
    final OntologyConcept concept =
        declareClass(ontology, "Moved", URI.create(ontology.getNamespace() + "Moved"));
    final String path = "/v1/ontologyConcepts/" + concept.getId();

    assertEquals(
        403,
        patch(
            renamer,
            path,
            "[{\"op\":\"move\",\"from\":\"/description\",\"path\":\"/displayName\"}]"));
    assertEquals(
        403,
        patch(
            renamer,
            path,
            "[{\"op\":\"copy\",\"from\":\"/description\",\"path\":\"/displayName\"}]"));
    assertEquals(
        concept.getDescription(),
        SdkClients.adminClient()
            .ontologyConcepts()
            .get(concept.getId().toString())
            .getDescription());
  }

  @Test
  void axiomDescriptionEditsNeedTheContentRight(final TestNamespace ns) {
    final User consumer = createUser(ns, "axiomConsumer", "DataConsumer");
    final User editor = createEditAllUser(ns, "axiomEditor");
    final Ontology ontology = createOntologyWith(ns, "axiomEdits", List.of(), List.of());
    final URI subject = URI.create(ontology.getNamespace() + "Child");
    final URI parent = URI.create(ontology.getNamespace() + "Parent");
    declareClass(ontology, "Child", subject);
    declareClass(ontology, "Parent", parent);
    final OntologyAxiom axiom =
        SdkClients.adminClient()
            .ontologyAxioms()
            .create(
                new CreateOntologyAxiom()
                    .withName(ns.shortPrefix("axiom"))
                    .withDisplayName("Child is a Parent")
                    .withDescription("Original axiom text")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                    .withSubjectIri(subject)
                    .withExpressions(
                        List.of(
                            new OntologyExpression()
                                .withKind(OntologyExpressionKind.NAMED_CLASS)
                                .withClassIri(parent)))
                    .withProvenance(RelationProvenance.MANUAL));
    final String path = "/v1/ontologyAxioms/" + axiom.getId();
    final String describe =
        "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Rewritten axiom text\"}]";

    assertEquals(403, patch(consumer, path, describe));
    assertEquals(
        "Original axiom text",
        SdkClients.adminClient().ontologyAxioms().get(axiom.getId().toString()).getDescription());
    assertEquals(200, patch(editor, path, describe));
    assertEquals(
        "Rewritten axiom text",
        SdkClients.adminClient().ontologyAxioms().get(axiom.getId().toString()).getDescription());
  }

  @Test
  void userDeniedViewCannotReadTheWorkingDraftValidation(final TestNamespace ns) {
    final String prefix = ns.shortPrefix("noView");
    final var admin = SdkClients.adminClient();
    final Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(prefix + "Policy")
                    .withRules(
                        List.of(
                            new Rule()
                                .withName(prefix + "Rule")
                                .withResources(List.of(Entity.ONTOLOGY))
                                .withOperations(List.of(MetadataOperation.VIEW_ALL))
                                .withEffect(Rule.Effect.DENY))));
    ns.trackRoot(Entity.POLICY, policy);
    final Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(prefix + "Role")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    ns.trackRoot(Entity.ROLE, role);
    final User blocked =
        ns.trackRoot(
            Entity.USER,
            admin
                .users()
                .create(
                    new CreateUser()
                        .withName(prefix)
                        .withEmail(prefix + "@test.om.org")
                        .withDescription("v7 user")
                        .withRoles(List.of(role.getId()))));
    final Ontology ontology = createOntologyWith(ns, "validationRead", List.of(), List.of());
    final String path = "/v1/ontologies/" + ontology.getId() + "/working/validation";

    assertEquals(403, status(blocked, "GET", path, null));
    assertEquals(200, statusAsAdmin("GET", path, null));
  }

  @Test
  void dataStewardEditsOntologyContentButNotGlossaryScope(final TestNamespace ns) throws Exception {
    final User steward = createUser(ns, "steward", "DataSteward");
    final Ontology ontology = createOntologyWith(ns, "stewardEdits", List.of(), List.of());
    final OntologyConcept concept =
        declareClass(ontology, "Stewarded", URI.create(ontology.getNamespace() + "Stewarded"));
    final String describe =
        "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Steward rewrite\"}]";

    final HttpResponse<String> patched =
        send(
            token(steward),
            "PATCH",
            "/v1/ontologyConcepts/" + concept.getId(),
            describe,
            "application/json-patch+json");
    assertEquals(200, patched.statusCode());
    assertEquals("Steward rewrite", JsonUtils.readTree(patched.body()).get("description").asText());
    assertEquals(
        "Steward rewrite",
        SdkClients.adminClient()
            .ontologyConcepts()
            .get(concept.getId().toString())
            .getDescription());

    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final String bulkName = ns.prefix("StewardBulk") + UUID.randomUUID();
    final String lock =
        json(
            new AcquireOntologyEditLock()
                .withResourceType(Entity.GLOSSARY)
                .withResourceId(glossary.getId())
                .withSessionId("steward-session")
                .withLeaseSeconds(60));
    assertEquals(
        403, status(steward, "POST", "/v1/ontology/bulk", json(bulkRequest(glossary, bulkName))));
    assertEquals(403, status(steward, "POST", "/v1/ontologyEditLocks/acquire", lock));
    assertFalse(
        body(adminToken(), "GET", "/v1/ontologyChangeSets?limit=1000", null).contains(bulkName),
        "A denied bulk request left a draft behind");
  }

  @Test
  void dataConsumerCannotStartGlossaryDraftsOrLocks(final TestNamespace ns) throws Exception {
    final User consumer = createUser(ns, "drafter", "DataConsumer");
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final String bulkName = ns.prefix("DeniedBulk") + UUID.randomUUID();
    final String patternName = ns.prefix("DeniedPattern") + UUID.randomUUID();
    final String bulk = json(bulkRequest(glossary, bulkName));
    final String pattern = json(patternRequest(glossary, ns, patternName));
    final String lock =
        json(
            new AcquireOntologyEditLock()
                .withResourceType(Entity.GLOSSARY)
                .withResourceId(glossary.getId())
                .withSessionId("consumer-session")
                .withLeaseSeconds(60));

    assertEquals(403, status(consumer, "POST", "/v1/ontology/bulk", bulk));
    assertEquals(403, status(consumer, "POST", "/v1/ontology/patterns/instantiate", pattern));
    assertEquals(403, status(consumer, "POST", "/v1/ontologyEditLocks/acquire", lock));
    final String changeSets = body(adminToken(), "GET", "/v1/ontologyChangeSets?limit=1000", null);
    assertFalse(changeSets.contains(bulkName), "A denied bulk request left a draft behind");
    assertFalse(changeSets.contains(patternName), "A denied pattern request left a draft behind");

    assertEquals(200, statusAsAdmin("POST", "/v1/ontology/bulk", bulk));
    assertEquals(200, statusAsAdmin("POST", "/v1/ontology/patterns/instantiate", pattern));
    final String adminLock = lock.replace("consumer-session", "admin-session");
    assertEquals(200, statusAsAdmin("POST", "/v1/ontologyEditLocks/acquire", adminLock));
    assertEquals(
        204,
        statusAsAdmin(
            "DELETE",
            "/v1/ontologyEditLocks/"
                + Entity.GLOSSARY
                + "/"
                + glossary.getId()
                + "?sessionId=admin-session",
            null));
  }

  @Test
  void glossaryChangeSetCreateAndSubmitRequireEditAllOnTheScope(final TestNamespace ns) {
    final User consumer = createUser(ns, "csConsumer", "DataConsumer");
    final User editor = createEditAllUser(ns, "csEditor");
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final String deniedName = ns.prefix("DeniedDraft") + UUID.randomUUID();
    final String editorName = ns.prefix("EditorDraft") + UUID.randomUUID();
    final String adminName = ns.prefix("AdminDraft") + UUID.randomUUID();

    assertEquals(
        403,
        status(consumer, "POST", "/v1/ontologyChangeSets", changeSetRequest(glossary, deniedName)));
    assertFalse(
        body(adminToken(), "GET", "/v1/ontologyChangeSets?limit=1000", null).contains(deniedName),
        "A denied create left a change set behind");

    final OntologyChangeSet adminDraft = createChangeSetAs(null, ns, glossary, adminName);
    final OntologyEditLeaseToken adminLease = lease(SdkClients.adminClient(), adminDraft, ns);
    assertEquals(
        403,
        status(
            consumer,
            "POST",
            "/v1/ontologyChangeSets/" + adminDraft.getId() + "/submit",
            json(new OntologyChangeSetCommand().withLease(adminLease))));
    assertEquals(OntologyChangeSetState.DRAFT, currentState(adminDraft));
    assertEquals(
        200,
        statusAsAdmin(
            "POST",
            "/v1/ontologyChangeSets/" + adminDraft.getId() + "/submit",
            json(new OntologyChangeSetCommand().withLease(adminLease))));
    assertEquals(OntologyChangeSetState.SUBMITTED, currentState(adminDraft));

    final OntologyChangeSet editorDraft = createChangeSetAs(editor, ns, glossary, editorName);
    final OntologyEditLeaseToken editorLease = lease(clientFor(editor), editorDraft, ns);
    assertEquals(
        200,
        status(
            editor,
            "POST",
            "/v1/ontologyChangeSets/" + editorDraft.getId() + "/submit",
            json(new OntologyChangeSetCommand().withLease(editorLease))));
    assertEquals(OntologyChangeSetState.SUBMITTED, currentState(editorDraft));
  }

  private static User createEditAllUser(final TestNamespace ns, final String base) {
    return createUserWithOperations(
        ns,
        base,
        List.of(MetadataOperation.EDIT_ALL, MetadataOperation.CREATE, MetadataOperation.VIEW_ALL));
  }

  private static User createUserWithOperations(
      final TestNamespace ns, final String base, final List<MetadataOperation> operations) {
    final OpenMetadataClient admin = SdkClients.adminClient();
    final String name = ns.shortPrefix(base);
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
                                    .withOperations(operations)))));
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
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.om.org")
                    .withDescription("v7 user")
                    .withRoles(List.of(role.getId()))));
  }

  private static String changeSetRequest(final Glossary glossary, final String name) {
    return json(
        new CreateOntologyChangeSet()
            .withName(name)
            .withDisplayName("Scoped draft")
            .withDescription("Glossary-scope change set")
            .withGlossaries(Set.of(glossary.getFullyQualifiedName())));
  }

  private static OntologyChangeSet createChangeSetAs(
      final User user, final TestNamespace ns, final Glossary glossary, final String name) {
    final OpenMetadataClient client = user == null ? SdkClients.adminClient() : clientFor(user);
    return ns.trackRoot(
        "ontologyChangeSet",
        client
            .ontologyChangeSets()
            .create(
                new CreateOntologyChangeSet()
                    .withName(name)
                    .withDisplayName("Scoped draft")
                    .withDescription("Glossary-scope change set")
                    .withGlossaries(Set.of(glossary.getFullyQualifiedName()))));
  }

  private static OntologyEditLeaseToken lease(
      final OpenMetadataClient client, final OntologyChangeSet changeSet, final TestNamespace ns) {
    final OntologyEditLock lock =
        client
            .ontologyEditLocks()
            .acquire(
                new AcquireOntologyEditLock()
                    .withResourceType("ontologyChangeSet")
                    .withResourceId(changeSet.getId())
                    .withSessionId(
                        ns.shortPrefix("session") + UUID.randomUUID().toString().substring(0, 6))
                    .withLeaseSeconds(60));
    return new OntologyEditLeaseToken()
        .withSessionId(lock.getSessionId())
        .withVersion(lock.getVersion());
  }

  private static OntologyChangeSetState currentState(final OntologyChangeSet changeSet) {
    return SdkClients.adminClient()
        .ontologyChangeSets()
        .get(changeSet.getId().toString())
        .getState();
  }

  @Test
  void glossaryTermReviewerStillEditsTheTermUnderReview(final TestNamespace ns) {
    final User reviewer = createUser(ns, "termReviewer", "DataConsumer");
    final Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            SdkClients.adminClient()
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix("reviewedGlossary"))
                        .withDescription("Glossary with a reviewer")
                        .withReviewers(List.of(reviewer.getEntityReference()))));
    final GlossaryTerm term = GlossaryTermTestFactory.createSimple(ns, glossary);

    assertEquals(
        200,
        patch(
            reviewer,
            "/v1/glossaryTerms/" + term.getId(),
            "[{\"op\":\"add\",\"path\":\"/description\",\"value\":\"Edited by its reviewer\"}]"));
    assertEquals(
        "Edited by its reviewer",
        SdkClients.adminClient().glossaryTerms().get(term.getId().toString()).getDescription());
  }

  @Test
  void ownerWithoutRoleCapturesAndPublishesAReviewedRelease(final TestNamespace ns) {
    final User owner = createUser(ns, "releaseOwner", "NONE");
    final User reviewer = createUser(ns, "releaseReviewer", "NONE");
    final Ontology ontology =
        createOntologyWith(ns, "ownerPath", List.of(reviewer), List.of(owner));
    declareClass(ontology, "Owned", URI.create(ontology.getNamespace() + "Owned"));
    final OpenMetadataClient ownerClient = clientFor(owner);

    final OntologyRelease release =
        ownerClient
            .ontologies()
            .capture(
                ontology.getId(),
                new CaptureOntologyRelease()
                    .withExpectedWorkingRevision(
                        ownerClient.ontologies().state(ontology.getId()).getWorkingRevision()));
    final Task task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    clientFor(reviewer)
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    ownerClient
        .ontologies()
        .activate(
            ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(release.getId())
                .withExpectedActivationRevision(0L));

    assertEquals(
        release.getId(),
        SdkClients.adminClient().ontologies().state(ontology.getId()).getActiveReleaseId());
  }

  private static final HttpClient HTTP = HttpClient.newHttpClient();

  private static User createUser(final TestNamespace ns, final String base, final String role) {
    final String name = ns.shortPrefix(base);
    final CreateUser request =
        new CreateUser().withName(name).withEmail(name + "@test.om.org").withDescription("v7 user");
    if (!"NONE".equals(role)) {
      request.withRoles(List.of(SdkClients.adminClient().roles().getByName(role).getId()));
    }
    return ns.trackRoot(Entity.USER, SdkClients.adminClient().users().create(request));
  }

  private static Ontology createOntologyWith(
      final TestNamespace ns,
      final String name,
      final List<User> reviewers,
      final List<User> owners) {
    final CreateOntology request =
        request(ns)
            .withName(ns.prefix(name))
            .withIri(URI.create("https://example.org/model/" + ns.shortPrefix(name)))
            .withReviewers(reviewers.stream().map(User::getEntityReference).toList())
            .withOwners(owners.stream().map(User::getEntityReference).toList());
    final Ontology ontology = SdkClients.adminClient().ontologies().create(request);
    ns.trackRoot("ontology", ontology);
    return ontology;
  }

  private static OpenMetadataClient clientFor(final User user) {
    return SdkClients.createClient(user.getEmail(), user.getEmail(), new String[] {});
  }

  private static String token(final User user) {
    return JwtAuthProvider.tokenFor(user.getEmail(), user.getEmail(), new String[] {}, 600);
  }

  private static String adminToken() {
    return SdkClients.getAdminToken();
  }

  private static String json(final Object value) {
    return JsonUtils.pojoToJson(value);
  }

  private static int status(
      final User user, final String method, final String path, final String body) {
    return send(token(user), method, path, body, "application/json").statusCode();
  }

  private static int statusAsAdmin(final String method, final String path, final String body) {
    return send(adminToken(), method, path, body, "application/json").statusCode();
  }

  private static int patch(final User user, final String path, final String body) {
    return send(token(user), "PATCH", path, body, "application/json-patch+json").statusCode();
  }

  private static int patchAsAdmin(final String path, final String body) {
    return send(adminToken(), "PATCH", path, body, "application/json-patch+json").statusCode();
  }

  private static String body(
      final String token, final String method, final String path, final String body) {
    return send(token, method, path, body, "application/json").body();
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

  private static OntologyBulkRequest bulkRequest(final Glossary glossary, final String name) {
    return new OntologyBulkRequest()
        .withGlossaryId(glossary.getId())
        .withOperation(OntologyBulkOperation.CSV_UPSERT)
        .withDryRun(false)
        .withCsv(
            "action,termId,name,displayName,description,parentId,iri\n"
                + "CREATE,"
                + UUID.randomUUID()
                + ",BulkTerm,BulkTerm,Created by bulk,,\n")
        .withChangeSetName(name)
        .withChangeSetDisplayName("Bulk draft")
        .withChangeSetDescription("Typed bulk changes");
  }

  private static InstantiateOntologyPattern patternRequest(
      final Glossary glossary, final TestNamespace ns, final String name) {
    return new InstantiateOntologyPattern()
        .withPatternType(OntologyPatternType.REGULATORY_CONTROL)
        .withGlossaryId(glossary.getId())
        .withChangeSetName(name)
        .withChangeSetDisplayName("Pattern draft")
        .withChangeSetDescription("Generated from a pattern")
        .withRegulatoryControl(
            new RegulatoryControlPatternInput()
                .withControl(patternTerm(ns.prefix("Control")))
                .withRequirement(patternTerm(ns.prefix("Requirement")))
                .withEvidence(patternTerm(ns.prefix("Evidence"))));
  }

  private static OntologyPatternTermInput patternTerm(final String name) {
    return new OntologyPatternTermInput()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Pattern term " + name);
  }

  private static void addConcepts(Ontology ontology, int from, int to) {
    for (int index = from; index < to; index++) {
      declareClass(
          ontology, "Concept" + index, URI.create(ontology.getNamespace() + "Concept" + index));
    }
  }

  private static Reads reads(Ontology ontology, int members) {
    final OntologyRelease release;
    final int captureQueries;
    try (var queries = countReads()) {
      release = capture(ontology);
      captureQueries = queries.count();
    }
    assertEquals(members, release.getMemberCount());
    try (var queries = countReads()) {
      assertTrue(SdkClients.adminClient().ontologyReleases().structure(release.getId()).getValid());
      return new Reads(captureQueries, queries.count());
    }
  }

  private static SqlQueryCounter countReads() {
    // Each sealed member uses INSERT ... SELECT; those writes are not authorization reads.
    return SqlQueryCounter.forRequests(
        Entity.getJdbi(),
        "select",
        statement ->
            !statement
                .getRenderedSql()
                .toLowerCase(Locale.ROOT)
                .contains("insert into ontology_release_member"));
  }

  private record Reads(int capture, int structure) {}
}
