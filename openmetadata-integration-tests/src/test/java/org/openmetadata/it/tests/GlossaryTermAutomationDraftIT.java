/*
 *  Copyright 2026 Collate
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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;

/**
 * A term an automation provides, such as one an AI agent derived from a memory, is a proposal: the
 * glossary approval workflow sends it to an approval task for its reviewers, else its owners, else
 * the admins, and only that task decides it. Editing the proposal while its task is open neither
 * approves it nor replaces the task.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermAutomationDraftIT {
  private static final String APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final String WORKFLOW_FINISHED = "FINISHED";
  private static final String ADMIN = "admin";
  private static final Duration WORKFLOW_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);
  private static final String SHARPER_DEFINITION =
      "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"A sharper definition\"}]";

  @Test
  void anAutomationTermGoesToItsReviewersThroughAnApprovalTask(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1_REF;
    Glossary glossary = createGlossary(ns, "reviewed", List.of(reviewer), List.of());
    GlossaryTerm proposal =
        createTermAsBot(glossary, ns.prefix("proposal"), ProviderType.AUTOMATION);

    Task task = awaitOpenApprovalTask(proposal);

    assertEquals(List.of(reviewer.getId()), assigneeIds(task));
    assertEquals(EntityStatus.IN_REVIEW, reload(proposal).getEntityStatus());
    resolve(SdkClients.user1Client(), task, TaskResolutionType.Approved);
    awaitStatus(proposal, EntityStatus.APPROVED);
  }

  @Test
  void anAutomationTermWithoutReviewersGoesToTheGlossaryOwners(TestNamespace ns) {
    EntityReference owner = SharedEntities.get().USER2_REF;
    Glossary glossary = createGlossary(ns, "owned", List.of(), List.of(owner));
    GlossaryTerm proposal =
        createTermAsBot(glossary, ns.prefix("proposal"), ProviderType.AUTOMATION);

    assertEquals(List.of(owner.getId()), assigneeIds(awaitOpenApprovalTask(proposal)));
  }

  @Test
  void anAutomationTermWithoutReviewersOrOwnersGoesToTheAdmins(TestNamespace ns) {
    Glossary glossary = createGlossary(ns, "unowned", List.of(), List.of());
    GlossaryTerm proposal =
        createTermAsBot(glossary, ns.prefix("proposal"), ProviderType.AUTOMATION);

    Task task = awaitOpenApprovalTask(proposal);

    assertTrue(assigneeNames(task).contains(ADMIN), "assignees: " + assigneeNames(task));
    assertEquals(EntityStatus.IN_REVIEW, reload(proposal).getEntityStatus());
    resolve(SdkClients.adminClient(), task, TaskResolutionType.Rejected);
    awaitStatus(proposal, EntityStatus.REJECTED);
  }

  @Test
  void editingAnAutomationTermUnderReviewNeitherApprovesItNorReplacesItsTask(TestNamespace ns) {
    Glossary glossary =
        createGlossary(ns, "edited", List.of(SharedEntities.get().USER1_REF), List.of());
    GlossaryTerm proposal = createTermAsBot(glossary, ns.prefix("edited"), ProviderType.AUTOMATION);
    Task task = awaitOpenApprovalTask(proposal);

    SdkClients.user1Client()
        .glossaryTerms()
        .patch(proposal.getId(), JsonUtils.readTree(SHARPER_DEFINITION));
    awaitFinishedApprovalRun(proposal);

    assertEquals(EntityStatus.IN_REVIEW, reload(proposal).getEntityStatus());
    assertEquals(task.getId(), awaitOpenApprovalTask(proposal).getId());
  }

  @Test
  void aPublishedAutomationTermHasItsChangesReviewedLikeAnyTerm(TestNamespace ns) {
    Glossary glossary =
        createGlossary(ns, "published", List.of(SharedEntities.get().USER1_REF), List.of());
    GlossaryTerm term = createTermAsBot(glossary, ns.prefix("published"), ProviderType.AUTOMATION);
    resolve(SdkClients.user1Client(), awaitOpenApprovalTask(term), TaskResolutionType.Approved);
    awaitStatus(term, EntityStatus.APPROVED);

    editDescription(SdkClients.user2Client(), term, "A first change to the definition");
    Task firstReview = awaitOpenApprovalTask(term);
    editDescription(SdkClients.user2Client(), term, "A second change to the definition");

    // Each change of published content opens a review of the changes, which supersedes the last.
    List<Task> openReviews =
        Awaitility.await("the second change supersedes the first review")
            .atMost(WORKFLOW_TIMEOUT)
            .pollInterval(POLL_INTERVAL)
            .ignoreExceptions()
            .until(
                () -> openApprovalTasks(term),
                tasks ->
                    !tasks.isEmpty()
                        && tasks.stream()
                            .noneMatch(task -> task.getId().equals(firstReview.getId())));
    assertEquals(EntityStatus.IN_REVIEW, reload(term).getEntityStatus());
    assertEquals(
        List.of(SharedEntities.get().USER1_REF.getId()), assigneeIds(openReviews.getFirst()));
  }

  @Test
  void aProposalLeftWithoutARequestIsReviewedOnceSomeoneEditsIt(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1_REF;
    Glossary glossary = createGlossary(ns, "stranded", List.of(reviewer), List.of());
    GlossaryTerm stranded = createTermWithoutEvent(glossary, ns.prefix("stranded"));

    OpenMetadataException direct =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.user1Client(), stranded, EntityStatus.APPROVED));
    editDescription(SdkClients.user1Client(), stranded, "A reviewer's sharper definition");

    assertEquals(403, direct.getStatusCode());
    assertEquals(List.of(reviewer.getId()), assigneeIds(awaitOpenApprovalTask(stranded)));
    assertEquals(EntityStatus.IN_REVIEW, reload(stranded).getEntityStatus());
  }

  @Test
  void nobodyDecidesAnAutomationTermByChangingItsStatus(TestNamespace ns) {
    Glossary glossary =
        createGlossary(ns, "statusOwned", List.of(SharedEntities.get().USER1_REF), List.of());
    GlossaryTerm proposal =
        createTermAsBot(glossary, ns.prefix("proposal"), ProviderType.AUTOMATION);
    awaitOpenApprovalTask(proposal);

    OpenMetadataException byReviewer =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.user1Client(), proposal, EntityStatus.APPROVED));
    OpenMetadataException byBot =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.botClient(), proposal, EntityStatus.APPROVED));

    assertEquals(403, byReviewer.getStatusCode());
    assertEquals(403, byBot.getStatusCode());
    assertEquals(EntityStatus.IN_REVIEW, reload(proposal).getEntityStatus());
  }

  @Test
  void aBotDraftFromAnyOtherProviderStillBelongsToTheApprovalWorkflow(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1_REF;
    Glossary glossary = createGlossary(ns, "workflowOwned", List.of(reviewer), List.of());
    GlossaryTerm draft = createTermAsBot(glossary, ns.prefix("botDraft"), null);

    assertEquals(EntityStatus.DRAFT, draft.getEntityStatus());
    OpenMetadataException ownedByWorkflow =
        assertThrows(
            OpenMetadataException.class,
            () -> setStatus(SdkClients.user1Client(), draft, EntityStatus.APPROVED));
    assertEquals(403, ownedByWorkflow.getStatusCode());
    assertEquals(EntityStatus.DRAFT, reload(draft).getEntityStatus());
  }

  @Test
  void onlyABotCanSayAnAutomationProvidesATerm(TestNamespace ns) {
    Glossary glossary = createGlossary(ns, "spoofed", List.of(), List.of());

    GlossaryTerm requested =
        createTerm(
            SdkClients.adminClient(), glossary, ns.prefix("spoofed"), ProviderType.AUTOMATION);
    String patch = "[{\"op\":\"replace\",\"path\":\"/provider\",\"value\":\"automation\"}]";
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .glossaryTerms()
                    .patch(requested.getId(), JsonUtils.readTree(patch)));

    assertEquals(ProviderType.USER, requested.getProvider());
    assertEquals(EntityStatus.APPROVED, requested.getEntityStatus());
    assertEquals(400, refused.getStatusCode());
    assertEquals(ProviderType.USER, reload(requested).getProvider());
  }

  @Test
  void theReviewQueuePagesOnTheServerAndItsTotalsFollowDecisions(TestNamespace ns) {
    EntityReference reviewer = SharedEntities.get().USER1_REF;
    Glossary glossary = createGlossary(ns, "reviewQueue", List.of(reviewer), List.of());
    GlossaryTerm decided = createTermAsBot(glossary, ns.prefix("aiFirst"), ProviderType.AUTOMATION);
    GlossaryTerm parent = createTermAsBot(glossary, ns.prefix("aiSecond"), ProviderType.AUTOMATION);
    createChildTermAsBot(glossary, parent, ns.prefix("aiNested"));
    createTerm(SdkClients.adminClient(), glossary, ns.prefix("person"), null);
    String glossaryId = glossary.getId().toString();
    List<String> reviewers = List.of(reviewer.getId().toString());

    JsonNode aiPage =
        pendingTerms(Map.of("glossary", glossaryId, "provider", "automation", "limit", "1"));

    assertEquals(3, total(aiPage));
    assertEquals(1, aiPage.path("data").size());
    // A listed term carries the reviewers it inherits, as a single read of it does, also through
    // a parent term that has none of its own.
    assertEquals(reviewers, firstReviewerIds(aiPage));
    assertEquals(
        reviewers, firstReviewerIds(pendingTerms(Map.of("parent", parent.getId().toString()))));
    assertEquals(
        1, total(pendingTerms(Map.of("glossary", glossaryId, "excludeProvider", "automation"))));
    // A text search applies the same provider filters; every term of this test matches the text.
    String everyTerm = ns.prefix("");
    assertEquals(
        3,
        pendingTerms(Map.of("glossary", glossaryId, "q", everyTerm, "provider", "automation"))
            .path("data")
            .size());
    assertEquals(
        1,
        pendingTerms(
                Map.of("glossary", glossaryId, "q", everyTerm, "excludeProvider", "automation"))
            .path("data")
            .size());

    resolve(SdkClients.user1Client(), awaitOpenApprovalTask(decided), TaskResolutionType.Approved);

    Awaitility.await("the decided proposal leaves the review queue")
        .atMost(WORKFLOW_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .until(
            () ->
                total(
                    pendingTerms(
                        Map.of("glossary", glossaryId, "provider", "automation", "limit", "1"))),
            remaining -> remaining == 2);
  }

  @Test
  void anUnknownProviderIsABadRequest(TestNamespace ns) {
    Glossary glossary = createGlossary(ns, "badProvider", List.of(), List.of());

    OpenMetadataException rejected =
        assertThrows(
            OpenMetadataException.class,
            () ->
                pendingTerms(Map.of("glossary", glossary.getId().toString(), "provider", "robot")));

    assertEquals(400, rejected.getStatusCode());
  }

  @Test
  void approvalRequestsMatchExactEntityIdsIncludingCommaNames(TestNamespace ns) {
    Glossary glossary =
        createGlossary(ns, "exactTasks", List.of(SharedEntities.get().USER1_REF), List.of());
    GlossaryTerm parent =
        createTerm(SdkClients.adminClient(), glossary, ns.prefix("Revenue, net"), null);
    Task parentTask = awaitOpenApprovalTask(parent);
    GlossaryTerm child =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(ns.prefix("Child"))
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withParent(parent.getFullyQualifiedName())
                    .withDescription("A narrower definition"));
    awaitOpenApprovalTask(child);

    JsonNode page = approvalTasks(parent.getId().toString(), 1);
    assertEquals(1, total(page));
    assertEquals(parentTask.getId().toString(), page.path("data").get(0).path("id").asText());
    assertEquals(
        parent.getId().toString(), page.path("data").get(0).path("about").path("id").asText());

    JsonNode batch = approvalTasks(parent.getId() + "," + child.getId(), 100);
    assertEquals(2, total(batch));
    assertEquals(
        Set.of(parent.getId().toString(), child.getId().toString()),
        StreamSupport.stream(batch.path("data").spliterator(), false)
            .map(task -> task.path("about").path("id").asText())
            .collect(Collectors.toSet()));
  }

  private static JsonNode approvalTasks(String entityIds, int limit) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("aboutEntityIds", entityIds)
            .queryParam("type", "RequestApproval")
            .queryParam("status", "Open")
            .queryParam("fields", "about")
            .queryParam("limit", Integer.toString(limit))
            .build();
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/tasks", null, options));
  }

  private static JsonNode pendingTerms(Map<String, String> filters) {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityStatus", "Draft,In Review")
            .queryParam("fields", "reviewers")
            .queryParams(filters)
            .build();
    return JsonUtils.readTree(
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/glossaryTerms/search", null, options));
  }

  private static int total(JsonNode page) {
    return page.path("paging").path("total").asInt();
  }

  private static List<String> firstReviewerIds(JsonNode page) {
    return page.path("data").get(0).path("reviewers").findValuesAsText("id");
  }

  private static Glossary createGlossary(
      TestNamespace ns,
      String name,
      List<EntityReference> reviewers,
      List<EntityReference> owners) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.prefix(name))
            .withDescription("Glossary for automation-provided drafts")
            .withReviewers(reviewers)
            .withOwners(owners);
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private static GlossaryTerm createTermAsBot(
      Glossary glossary, String name, ProviderType provider) {
    return createTerm(SdkClients.botClient(), glossary, name, provider);
  }

  private static GlossaryTerm createChildTermAsBot(
      Glossary glossary, GlossaryTerm parent, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("A narrower business concept")
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withProvider(ProviderType.AUTOMATION);
    return SdkClients.botClient().glossaryTerms().create(create);
  }

  private static GlossaryTerm createTerm(
      OpenMetadataClient client, Glossary glossary, String name, ProviderType provider) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("A business concept the term defines")
            .withGlossary(glossary.getFullyQualifiedName())
            .withProvider(provider);
    return client.glossaryTerms().create(create);
  }

  private static GlossaryTerm setStatus(
      OpenMetadataClient client, GlossaryTerm term, EntityStatus status) {
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/entityStatus\",\"value\":\"" + status.value() + "\"}]";
    return client.glossaryTerms().patch(term.getId(), JsonUtils.readTree(patch));
  }

  private static void editDescription(
      OpenMetadataClient client, GlossaryTerm term, String description) {
    String patch =
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"" + description + "\"}]";
    client.glossaryTerms().patch(term.getId(), JsonUtils.readTree(patch));
  }

  // As a writer outside a request did before it recorded its creation event: no workflow ran.
  private static GlossaryTerm createTermWithoutEvent(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("A business concept the term defines")
            .withGlossary(glossary.getFullyQualifiedName())
            .withProvider(ProviderType.AUTOMATION);
    GlossaryTermRepository terms =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    return terms.create(
        null, new GlossaryTermMapper().createToEntity(create, Entity.INGESTION_BOT_NAME));
  }

  private static void resolve(
      OpenMetadataClient client, Task task, TaskResolutionType resolutionType) {
    ResolveTask resolution =
        new ResolveTask()
            .withResolutionType(resolutionType)
            .withComment("Decided on the agent's proposal");
    client.tasks().resolve(task.getId().toString(), resolution);
  }

  private static List<UUID> assigneeIds(Task task) {
    return task.getAssignees().stream().map(EntityReference::getId).toList();
  }

  private static List<String> assigneeNames(Task task) {
    return task.getAssignees().stream().map(EntityReference::getName).toList();
  }

  private static Task awaitOpenApprovalTask(GlossaryTerm term) {
    return Awaitility.await("open approval task for " + term.getFullyQualifiedName())
        .atMost(WORKFLOW_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> openApprovalTasks(term), tasks -> !tasks.isEmpty())
        .getFirst();
  }

  private static List<Task> openApprovalTasks(GlossaryTerm term) {
    Map<String, String> filters =
        Map.of(
            "limit",
            "100",
            "status",
            TaskEntityStatus.Open.value(),
            "aboutEntityIds",
            term.getId().toString(),
            "fields",
            "assignees");
    return SdkClients.adminClient().tasks().listWithFilters(filters).getData();
  }

  private static void awaitStatus(GlossaryTerm term, EntityStatus expected) {
    Awaitility.await(term.getFullyQualifiedName() + " reaches " + expected)
        .atMost(WORKFLOW_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> reload(term).getEntityStatus(), expected::equals);
  }

  /** Waits for a run of the approval workflow on the term to end, such as the one an edit starts. */
  private static void awaitFinishedApprovalRun(GlossaryTerm term) {
    Awaitility.await("a finished approval run for " + term.getFullyQualifiedName())
        .atMost(WORKFLOW_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> approvalRunStatuses(term).contains(WORKFLOW_FINISHED));
  }

  private static List<String> approvalRunStatuses(GlossaryTerm term) {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam(
                "entityLink",
                String.format("<#E::%s::%s>", Entity.GLOSSARY_TERM, term.getFullyQualifiedName()))
            .queryParam("workflowDefinitionName", APPROVAL_WORKFLOW)
            .queryParam("startTs", String.valueOf(now - Duration.ofHours(1).toMillis()))
            .queryParam("endTs", String.valueOf(now + Duration.ofHours(1).toMillis()))
            .queryParam("limit", "50")
            .build();
    JsonNode runs =
        JsonUtils.readTree(
            SdkClients.adminClient()
                .getHttpClient()
                .executeForString(
                    HttpMethod.GET, "/v1/governance/workflowInstances", null, options));
    return StreamSupport.stream(runs.path("data").spliterator(), false)
        .map(run -> run.path("status").asText())
        .toList();
  }

  private static GlossaryTerm reload(GlossaryTerm term) {
    return SdkClients.adminClient().glossaryTerms().get(term.getId().toString());
  }
}
