/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.classification.ClassificationService;
import org.openmetadata.sdk.services.classification.TagService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeRequestService;

/** Shared fixtures for the change request integration tests. */
final class ChangeRequestITSupport {
  private ChangeRequestITSupport() {}

  // shortPrefix is deterministic per test; the sequence keeps several fixtures in one test
  // distinct.
  private static final AtomicInteger SEQUENCE = new AtomicInteger();

  static final String PUBLISHED = "approved baseline description";
  static final String ORIGINAL_DN = "original display name";
  static final String INCLUDE_DESCRIPTION = "\"description\"";
  static final String EXCLUDE_STATUS = "\"entityStatus\"";
  static final String COMMIT = "commit";
  // Object-form filter whose JsonLogic is always TRUE -> the entity is excluded, nothing is held.
  static final String FILTER_EXCLUDES_ALL =
      JsonUtils.pojoToJson(Map.of("glossary", "{\"==\":[1,1]}"));

  // Object-form filter that excludes every glossary except the one with this FQN, so a workflow
  // only
  // gates its own test's glossary even when other tests run concurrently.
  static String filterScopedTo(String fqn) {
    String logic = "{\"!=\":[{\"var\":\"fullyQualifiedName\"},\"%s\"]}".formatted(fqn);
    return JsonUtils.pojoToJson(Map.of("glossary", logic));
  }

  /** Deploys a hook workflow: Start -> Approve -> (approve) commit hook, (reject) discard hook. */
  static void deployHookWorkflow(TestNamespace ns, String include, String exclude, String filter) {
    deployWorkflow(ns, include, exclude, filter, COMMIT, true);
  }

  /**
   * @param approveAction action of the hook on the approve path (commit/hold)
   * @param withHook when false, no resolvePendingChange hook is present (the change is never held)
   */
  static void deployWorkflow(
      TestNamespace ns,
      String include,
      String exclude,
      String filter,
      String approveAction,
      boolean withHook) {
    deployWorkflow(ns, Entity.GLOSSARY, include, exclude, filter, approveAction, withHook);
  }

  static void deployHookWorkflowFor(
      TestNamespace ns, String entityType, String include, String exclude, String filter) {
    deployWorkflow(ns, entityType, include, exclude, filter, "commit", true);
  }

  static String filterScopedTo(String entityType, String fqn) {
    String logic = "{\"!=\":[{\"var\":\"fullyQualifiedName\"},\"%s\"]}".formatted(fqn);
    return JsonUtils.pojoToJson(Map.of(entityType, logic));
  }

  static void deployWorkflow(
      TestNamespace ns,
      String entityType,
      String include,
      String exclude,
      String filter,
      String approveAction,
      boolean withHook) {
    // Workflow name becomes the BPMN process id, which must be a valid XML NCName (no leading
    // digit).
    String name = "Wf" + ns.shortPrefix("pendinghook" + SEQUENCE.incrementAndGet());
    String approveTarget = withHook ? "CommitChange" : "ApprovedEnd";
    String rejectTarget = withHook ? "DiscardChange" : "RejectedEnd";
    String hookNodes =
        withHook
            ? """
              ,{"type": "automatedTask", "subType": "resolvePendingChangeTask", "name": "CommitChange",
               "config": {"action": "%s"}, "inputNamespaceMap": {"relatedEntity": "global"}},
              {"type": "automatedTask", "subType": "resolvePendingChangeTask", "name": "DiscardChange",
               "config": {"action": "discard"}, "inputNamespaceMap": {"relatedEntity": "global"}}
              """
                .formatted(approveAction)
            : "";
    String hookEdges =
        withHook
            ? ",{\"from\": \"CommitChange\", \"to\": \"ApprovedEnd\"},"
                + "{\"from\": \"DiscardChange\", \"to\": \"RejectedEnd\"}"
            : "";
    String json =
        """
        {
          "name": "%s",
          "displayName": "Pending Change Hook Test Workflow",
          "description": "Holds edits on glossaries and resolves them on approval.",
          "config": {"storeStageStatus": true},
          "trigger": {
            "type": "eventBasedEntity",
            "config": {
              "entityTypes": ["%s"],
              "events": ["Updated"],
              "exclude": [%s],
              "include": [%s],
              "filter": %s
            },
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": [
            {"type": "startEvent", "subType": "startEvent", "name": "Start"},
            {"type": "userTask", "subType": "userApprovalTask", "name": "Approve",
             "config": {"assignees": {"addReviewers": true, "addOwners": false, "candidates": []},
                        "approvalThreshold": 1, "rejectionThreshold": 1, "stageId": "review",
                        "stageDisplayName": "Review", "taskStatus": "Open",
                        "assigneeStrategy": "reviewers-and-assignees",
                        "transitionMetadata": [
                          {"id": "approve", "label": "Approve", "targetStageId": "approved",
                           "targetTaskStatus": "Approved", "resolutionType": "Approved",
                           "formRef": "approve", "requiresComment": false},
                          {"id": "reject", "label": "Reject", "targetStageId": "rejected",
                           "targetTaskStatus": "Rejected", "resolutionType": "Rejected",
                           "formRef": "reject", "requiresComment": true}]},
             "inputNamespaceMap": {"relatedEntity": "global"}},
            {"type": "endEvent", "subType": "endEvent", "name": "ApprovedEnd"},
            {"type": "endEvent", "subType": "endEvent", "name": "RejectedEnd"}%s
          ],
          "edges": [
            {"from": "Start", "to": "Approve"},
            {"from": "Approve", "to": "%s", "condition": "approve"},
            {"from": "Approve", "to": "%s", "condition": "reject"}%s
          ]
        }
        """
            .formatted(
                name,
                entityType,
                exclude,
                include,
                filter,
                hookNodes,
                approveTarget,
                rejectTarget,
                hookEdges);
    CreateWorkflowDefinition request = JsonUtils.readValue(json, CreateWorkflowDefinition.class);
    ns.trackRoot(
        Entity.WORKFLOW_DEFINITION, SdkClients.adminClient().workflowDefinitions().create(request));
  }

  static Glossary gatedGlossary(TestNamespace ns) {
    return gatedGlossary(ns, null);
  }

  static Glossary gatedGlossary(TestNamespace ns, String displayName) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("pgl" + SEQUENCE.incrementAndGet()))
            .withDisplayName(displayName)
            .withDescription(PUBLISHED)
            .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  // Reviewers = USER1 (the approver). Owners let a non-admin editor (USER2) patch the glossary, so
  // the per-requester tests can drive two distinct editors, neither of whom is the reviewer.
  static Glossary gatedGlossaryOwnedBy(
      TestNamespace ns, String displayName, EntityReference owner) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("pgl" + SEQUENCE.incrementAndGet()))
            .withDisplayName(displayName)
            .withDescription(PUBLISHED)
            .withOwners(List.of(owner))
            .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  static void patchAs(OpenMetadataClient client, UUID glossaryId, String opsJson) {
    client.glossaries().patch(glossaryId.toString(), JsonUtils.readTree(opsJson));
  }

  static List<Task> awaitApprovalTaskCount(String glossaryFqn, int expected) {
    Map<String, String> filters = openTaskFilters(glossaryFqn);
    Awaitility.await("%d approval task(s) for %s".formatted(expected, glossaryFqn))
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> listTasks(filters).size() == expected);
    return listTasks(filters);
  }

  // Create a mutually-exclusive classification with two tags; returns their FQNs. Tracking the
  // classification cleans up its tags with it.
  static List<String> createMutuallyExclusiveTags(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    ClassificationService classifications = new ClassificationService(admin.getHttpClient());
    TagService tags = new TagService(admin.getHttpClient());
    String classificationName = ns.shortPrefix("mecls");
    Classification classification =
        classifications.create(
            new CreateClassification()
                .withName(classificationName)
                .withDescription("Mutually exclusive tags for pending-change IT")
                .withMutuallyExclusive(true));
    ns.trackRoot(Entity.CLASSIFICATION, classification);
    Tag alpha =
        tags.create(
            new CreateTag()
                .withName("Alpha")
                .withClassification(classificationName)
                .withDescription("a"));
    Tag beta =
        tags.create(
            new CreateTag()
                .withName("Beta")
                .withClassification(classificationName)
                .withDescription("b"));
    return List.of(alpha.getFullyQualifiedName(), beta.getFullyQualifiedName());
  }

  static String tagLabelJson(String tagFqn) {
    return "{\"tagFQN\":\"%s\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}"
        .formatted(tagFqn);
  }

  static Glossary fetch(UUID glossaryId) {
    return SdkClients.adminClient().glossaries().get(glossaryId.toString(), "reviewers");
  }

  static String descriptionOf(UUID glossaryId) {
    return fetch(glossaryId).getDescription();
  }

  static String displayNameOf(UUID glossaryId) {
    return fetch(glossaryId).getDisplayName();
  }

  static void patch(UUID glossaryId, String opsJson) {
    SdkClients.adminClient().glossaries().patch(glossaryId.toString(), JsonUtils.readTree(opsJson));
  }

  static void patchDescription(UUID glossaryId, String value) {
    patch(
        glossaryId,
        "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":\"%s\"}]".formatted(value));
  }

  static void putDescription(UUID glossaryId, String value) {
    Glossary current = fetch(glossaryId);
    current.setDescription(value);
    SdkClients.adminClient().glossaries().update(glossaryId.toString(), current);
  }

  static Map<String, String> openTaskFilters(String glossaryFqn) {
    return Map.of(
        "limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", glossaryFqn);
  }

  static Task awaitOpenApprovalTask(String glossaryFqn) {
    Map<String, String> filters = openTaskFilters(glossaryFqn);
    Awaitility.await("open approval task for " + glossaryFqn)
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> !listTasks(filters).isEmpty());
    return listTasks(filters).get(0);
  }

  static void assertNoOpenApprovalTask(String glossaryFqn) {
    Map<String, String> filters = openTaskFilters(glossaryFqn);
    Awaitility.await("no approval task for " + glossaryFqn)
        .during(Duration.ofSeconds(10))
        .atMost(Duration.ofSeconds(12))
        .until(() -> listTasks(filters).isEmpty());
  }

  static List<Task> listTasks(Map<String, String> filters) {
    List<Task> tasks;
    try {
      ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
      tasks = response.getData() == null ? List.of() : response.getData();
    } catch (RuntimeException e) {
      tasks = List.of();
    }
    return tasks;
  }

  static String taskPayloadJson(UUID taskId) {
    Task task = SdkClients.adminClient().tasks().get(taskId.toString());
    return task.getPayload() == null ? "" : JsonUtils.pojoToJson(task.getPayload());
  }

  static void resolve(UUID taskId, String transitionId, TaskResolutionType resolution) {
    ResolveTask resolve =
        new ResolveTask()
            .withTransitionId(transitionId)
            .withResolutionType(resolution)
            .withComment("pending-change IT");
    SdkClients.user1Client().tasks().resolve(taskId.toString(), resolve);
  }

  static void awaitDescription(UUID glossaryId, String expected, String reason) {
    Awaitility.await(reason)
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> expected.equals(descriptionOf(glossaryId)));
  }

  static void awaitStaysAt(UUID glossaryId, String expected, String reason) {
    Awaitility.await(reason)
        .during(Duration.ofSeconds(3))
        .atMost(Duration.ofSeconds(30))
        .until(() -> expected.equals(descriptionOf(glossaryId)));
  }

  static User createBotUser(TestNamespace ns, String suffix) {
    // The bot authenticates with its own JWT, and JwtFilter resolves the bot's username from the
    // email local-part. The stored name must equal that local-part so impersonation lookups (by the
    // resolved bot name) resolve. Keep it short and alphanumeric for a valid email.
    String localPart = "impbot" + suffix + ns.shortPrefix();

    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser request =
        new CreateUser()
            .withName(localPart)
            .withEmail(localPart + "@test.com")
            .withDescription("Bot user for impersonation tests")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism);

    return SdkClients.adminClient().users().create(request);
  }

  static Bot createBot(String botName, User botUser, Boolean allowImpersonation) {
    CreateBot request =
        new CreateBot()
            .withName(botName)
            .withDescription("Bot for impersonation tests")
            .withBotUser(botUser.getName())
            .withAllowImpersonation(allowImpersonation);
    return SdkClients.adminClient().bots().create(request);
  }

  static String generateBotToken(User botUser) {
    JWTAuthMechanism auth =
        SdkClients.adminClient().users().generateToken(botUser.getId(), JWTTokenExpiry.Seven);
    assertNotNull(auth.getJWTToken(), "Bot token generation must return a token");
    return auth.getJWTToken();
  }

  static OpenMetadataClient impersonationClient(String botToken, String targetUserName) {
    OpenMetadataConfig config =
        OpenMetadataConfig.builder()
            .serverUrl(SdkClients.baseUrl())
            .accessToken(botToken)
            .header(IMPERSONATE_HEADER, targetUserName)
            .readTimeout(300000)
            .writeTimeout(300000)
            .build();
    return new OpenMetadataClient(config);
  }

  static final String IMPERSONATE_HEADER = "X-Impersonate-User";

  static List<ChangeRequest> requestsFor(UUID entityId) {
    return Entity.getCollectionDAO().changeRequestDAO().listByEntity(entityId, 50);
  }

  static ChangeRequest onlyPendingRequest(UUID entityId) {
    List<ChangeRequest> pending =
        Entity.getCollectionDAO()
            .changeRequestDAO()
            .listByEntityAndStatus(entityId, ChangeRequestStatus.PENDING.value());
    assertEquals(1, pending.size(), "exactly one pending change request");
    return ChangeRequestService.get(pending.get(0).getId());
  }

  static void resolveAs(
      OpenMetadataClient client,
      Task task,
      String transition,
      TaskResolutionType type,
      Integer revision) {
    ResolveTask resolve =
        new ResolveTask()
            .withTransitionId(transition)
            .withResolutionType(type)
            .withComment("change-request IT")
            .withChangeRequestRevision(revision);
    client.tasks().resolve(task.getId().toString(), resolve);
  }

  static Task awaitNewOpenApprovalTask(String fqn, UUID notThisTask) {
    Map<String, String> filters = openTaskFilters(fqn);
    Awaitility.await("a new open approval task for " + fqn)
        .atMost(Duration.ofSeconds(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(() -> listTasks(filters).stream().anyMatch(t -> !t.getId().equals(notThisTask)));
    return listTasks(filters).stream()
        .filter(t -> !t.getId().equals(notThisTask))
        .findFirst()
        .orElseThrow();
  }

  static void assertNoSecondTaskFor(String fqn) {
    Awaitility.await("still exactly one approval task for " + fqn)
        .during(Duration.ofSeconds(10))
        .atMost(Duration.ofSeconds(12))
        .until(() -> listTasks(openTaskFilters(fqn)).size() == 1);
  }
}
