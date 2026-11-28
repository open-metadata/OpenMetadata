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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.util.EntityUtil;

/**
 * The Proposed Changes card of an approval task lists what the entity changed since its approval
 * cycle began, through the edit under review. Rejection undoes the same governed changes.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class ApprovalTaskPreviewIT {

  private static final String GLOSSARY_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final String DESCRIPTION = "description";
  private static final String DISPLAY_NAME = "displayName";
  private static final String SYNONYMS = "synonyms";
  private static final String FINISHED = "FINISHED";
  private static final Duration TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final TypeReference<Map<String, Map<String, List<String>>>> PREVIEW_TYPE =
      new TypeReference<>() {};

  // The issue's first report: each new cycle shows only its own edit, never the earlier cycle's.
  @Test
  void aSecondApprovalCycleOnAGlossaryTermPreviewsOnlyItsOwnEdit(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = approvedTerm(ns, "second_cycle", "Original definition");
    String first = "Edited definition";
    String second = first + " This is a test";
    String third = second + " This is a test";

    editDescription(SdkClients.adminClient(), term, first);
    approve(awaitPreview(term, Map.of(DESCRIPTION, replaced(first, "Original definition"))), term);
    editDescription(SdkClients.adminClient(), term, second);
    approve(awaitPreview(term, Map.of(DESCRIPTION, replaced(second, first))), term);
    editDescription(SdkClients.adminClient(), term, third);

    awaitPreview(term, Map.of(DESCRIPTION, replaced(third, second)));
  }

  // The issue's second report: the workflow's own move to In Review is not the edit under review.
  @Test
  void anApprovedMetricEditedByANonReviewerPreviewsTheEditedDescription(TestNamespace ns)
      throws Exception {
    Metric metric = approvedMetric(ns, "Revenue booked in the month");
    String edited = "Revenue recognized in the month";

    SdkClients.adminClient().metrics().patch(metric.getId().toString(), descriptionPatch(edited));

    awaitPreview(
        metric.getFullyQualifiedName(),
        Map.of(DESCRIPTION, replaced(edited, "Revenue booked in the month")));
  }

  @Test
  void anEditWhileTheTaskIsOpenSupersedesItWithTheWholeCycle(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "superseded", "Original definition");

    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    addSynonym(SdkClients.adminClient(), term, "Alias");
    Task superseding =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Edited definition", "Original definition"),
                SYNONYMS,
                added("Alias")));
    editDescription(stewardClient(ns), term, "Stewarded definition");

    Task last =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Stewarded definition", "Original definition"),
                SYNONYMS,
                added("Alias")));
    assertNotEquals(opened.getId(), superseding.getId());
    assertNotEquals(superseding.getId(), last.getId());
  }

  // Task payloads can carry stale display data, including a start from an earlier approval cycle.
  @Test
  void aStalePreviewOnTheOpenTaskIsNotCarriedIntoTheNextTask(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "stale_preview", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Accepted definition");
    Task previous =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Accepted definition", "Original definition")));
    approve(previous, term);
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Accepted definition")));
    SdkClients.adminClient()
        .tasks()
        .patch(
            opened.getId().toString(),
            MAPPER.readTree(
                """
                [{"op":"replace","path":"/payload/%s",
                  "value":{"entityStatus":{"added":["In Review"],"removed":["Approved"]}}},
                 {"op":"replace","path":"/payload/%s","value":%s}]
                """
                    .formatted(
                        ChangePreviewUtils.PROPOSED_CHANGES_KEY,
                        ChangePreviewUtils.PROPOSED_CHANGES_BASE_VERSION_KEY,
                        baseOf(previous))));

    addSynonym(SdkClients.adminClient(), term, "Alias");

    Task next =
        awaitPreview(
            term,
            Map.of(
                DESCRIPTION,
                replaced("Edited definition", "Accepted definition"),
                SYNONYMS,
                added("Alias")));
    assertNotEquals(opened.getId(), next.getId());

    reject(next);

    awaitRestoredTerm(term, EntityStatus.APPROVED, "Accepted definition", List.of());
  }

  @Test
  void aBotEditDuringTheCycleIsExcludedFromTheNextPreviewAndRollback(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = approvedTerm(ns, "bot_edit", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    awaitPreview(term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    addSynonym(SdkClients.ingestionBotClient(), term, "Ingested alias");
    editDescription(SdkClients.adminClient(), term, "Revised definition");

    Task task =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Revised definition", "Original definition")));
    reject(task);

    awaitRestoredTerm(
        term, EntityStatus.APPROVED, "Original definition", List.of("Ingested alias"));
  }

  @Test
  void aBotEditBeforeTheCycleSurvivesRejection(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "bot_edit_before_cycle", "Original definition");
    editDescription(SdkClients.ingestionBotClient(), term, "Ingested definition");
    addSynonym(SdkClients.adminClient(), term, "Alias");

    Task task = awaitPreview(term, Map.of(SYNONYMS, added("Alias")));
    assertFalse(isMarkedIncomplete(task));
    reject(task);

    awaitRestoredTerm(term, EntityStatus.APPROVED, "Ingested definition", List.of());
  }

  @Test
  void rejectingAnEditRestoresTheEarlierBotValueOfTheSameField(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "earlier_bot_value", "Original definition");
    editDescription(SdkClients.ingestionBotClient(), term, "Ingested definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");

    reject(
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Ingested definition"))));

    awaitRestoredTerm(term, EntityStatus.APPROVED, "Ingested definition", List.of());
  }

  @Test
  void rejectionPreservesABotWriteThatSupersedesAnEditToTheSameField(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = approvedTerm(ns, "later_bot_value", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    awaitPreview(term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    editDescription(SdkClients.ingestionBotClient(), term, "Ingested definition");
    addSynonym(SdkClients.adminClient(), term, "Alias");

    reject(awaitPreview(term, Map.of(SYNONYMS, added("Alias"))));

    awaitRestoredTerm(term, EntityStatus.APPROVED, "Ingested definition", List.of());
  }

  @Test
  void rejectingAnEditToARejectedTermRestoresItsLastRejectedContent(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = createTerm(ns, "rejected_twice", "Original definition");
    reject(awaitPreview(term, Map.of()));
    awaitRestoredTerm(term, EntityStatus.REJECTED, "Original definition", List.of());
    editDescription(SdkClients.adminClient(), term, "Edited definition");

    reject(
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition"))));

    awaitRestoredTerm(term, EntityStatus.REJECTED, "Original definition", List.of());
  }

  @Test
  void aWorkflowThatKeepsRejectedContentPreviewsOnlyTheNextEdit(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            admin
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.shortPrefix("keep_rejected"))
                        .withDescription("Original definition")
                        .withDisplayName("Original label")));
    String fqn = glossary.getFullyQualifiedName();
    String id = glossary.getId().toString();
    WorkflowDefinition workflow =
        createApprovalWorkflow(ns, Entity.GLOSSARY, fqn, statusNode("undo", "Rejected", "review"));
    try {
      awaitWorkflowDeployment(workflow);
      admin.glossaries().patch(id, descriptionPatch("Approved definition"));
      approve(
          awaitPreview(
              fqn, Map.of(DESCRIPTION, replaced("Approved definition", "Original definition"))),
          fqn,
          () -> admin.glossaries().get(id).getEntityStatus());
      admin.glossaries().patch(id, descriptionPatch("Rejected definition"));
      reject(
          awaitPreview(
              fqn, Map.of(DESCRIPTION, replaced("Rejected definition", "Approved definition"))));
      await("reject sets status and keeps the proposed content")
          .atMost(TIMEOUT)
          .untilAsserted(
              () -> {
                Glossary rejected = admin.glossaries().get(id);
                assertEquals(EntityStatus.REJECTED, rejected.getEntityStatus());
                assertEquals("Rejected definition", rejected.getDescription());
              });

      admin.glossaries().patch(id, replaceTextPatch(DISPLAY_NAME, "New label"));

      awaitPreview(fqn, Map.of(DISPLAY_NAME, replaced("New label", "Original label")));
    } finally {
      deleteWorkflow(workflow);
    }
  }

  @Test
  void rejectionRevertsATableEditEvenWithoutEntityReviewers(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    var service = DatabaseServiceTestFactory.createPostgres(ns);
    var schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table =
        TableTestFactory.createWithDescription(
            ns, schema.getFullyQualifiedName(), "Original definition");
    String fqn = table.getFullyQualifiedName();
    String id = table.getId().toString();
    WorkflowDefinition workflow =
        createApprovalWorkflow(
            ns,
            Entity.TABLE,
            fqn,
            """
        {"type":"automatedTask","subType":"rollbackEntityTask","name":"undo",
          "displayName":"Undo","config":{},
          "inputNamespaceMap":{"relatedEntity":"global","updatedBy":"review"}}
        """);
    try {
      awaitWorkflowDeployment(workflow);
      admin.tables().patch(id, descriptionPatch("Approved definition"));
      approve(
          awaitPreview(
              fqn, Map.of(DESCRIPTION, replaced("Approved definition", "Original definition"))),
          fqn,
          () -> admin.tables().get(id).getEntityStatus());
      admin.tables().patch(id, descriptionPatch("Unreviewed definition"));
      reject(
          awaitPreview(
              fqn, Map.of(DESCRIPTION, replaced("Unreviewed definition", "Approved definition"))));

      await("table rejection restores its approved description")
          .atMost(TIMEOUT)
          .untilAsserted(
              () -> {
                Table restored = admin.tables().get(id);
                assertEquals(EntityStatus.APPROVED, restored.getEntityStatus());
                assertEquals("Approved definition", restored.getDescription());
                assertTrue(openApprovals(fqn).isEmpty());
              });
    } finally {
      deleteWorkflow(workflow);
    }
  }

  // A reviewer's own edit is approved as it is made, so the next cycle starts from it.
  @Test
  void aReviewerEditBetweenCyclesBecomesTheNextBase(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "reviewer_base", "Original definition");
    editDescription(SdkClients.user1Client(), term, "Reviewed definition");
    awaitFinishedRuns(term, 2);
    assertEquals(EntityStatus.APPROVED, termStatus(term));

    editDescription(SdkClients.adminClient(), term, "Edited definition");

    awaitPreview(term, Map.of(DESCRIPTION, replaced("Edited definition", "Reviewed definition")));
  }

  // A missing version has no author, so its changes cannot safely be attributed to the review.
  @Test
  void aMissingVersionKeepsTheKnownChangesAndMarksThePreviewIncomplete(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = approvedTerm(ns, "missing_version", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    dropVersion(term, firstEditOf(term, baseOf(opened)));

    addSynonym(SdkClients.adminClient(), term, "Alias");

    Task next = awaitPreview(term, Map.of(SYNONYMS, added("Alias")));
    assertTrue(isMarkedIncomplete(next));

    reject(next);

    awaitRestoredTerm(term, EntityStatus.APPROVED, "Edited definition", List.of());
  }

  // A predecessor pointer alone cannot supply the missing values of the cycle's base version.
  @Test
  void aCycleWhoseBaseIsMissingFromTheHistoryIsMarkedIncomplete(TestNamespace ns) throws Exception {
    GlossaryTerm term = approvedTerm(ns, "missing_base", "Original definition");
    editDescription(SdkClients.adminClient(), term, "Edited definition");
    Task opened =
        awaitPreview(
            term, Map.of(DESCRIPTION, replaced("Edited definition", "Original definition")));
    dropVersion(term, baseOf(opened));

    addSynonym(SdkClients.adminClient(), term, "Alias");

    Task next = awaitPreview(term, Map.of(SYNONYMS, added("Alias")));
    assertTrue(isMarkedIncomplete(next));

    reject(next);

    awaitRestoredTerm(term, EntityStatus.REJECTED, "Edited definition", List.of());
  }

  private static GlossaryTerm approvedTerm(TestNamespace ns, String name, String description)
      throws Exception {
    GlossaryTerm term = createTerm(ns, name, description);
    approve(awaitPreview(term, Map.of()), term);
    return term;
  }

  private static GlossaryTerm createTerm(TestNamespace ns, String name, String description) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            admin
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.shortPrefix("preview_" + name))
                        .withDescription("Glossary for the approval preview tests")));
    return admin
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription(description)
                .withReviewers(List.of(SharedEntities.get().USER1_REF)));
  }

  private static Metric approvedMetric(TestNamespace ns, String description) throws Exception {
    Metric metric =
        SdkClients.adminClient()
            .metrics()
            .create(
                new CreateMetric()
                    .withName(ns.prefix("preview_metric"))
                    .withDescription(description)
                    .withReviewers(List.of(SharedEntities.get().USER1_REF)));
    Task created = awaitPreview(metric.getFullyQualifiedName(), Map.of());
    approve(
        created,
        metric.getFullyQualifiedName(),
        () -> SdkClients.adminClient().metrics().get(metric.getId().toString()).getEntityStatus());
    return metric;
  }

  private static void approve(Task task, GlossaryTerm term) {
    approve(task, term.getFullyQualifiedName(), () -> termStatus(term));
  }

  private static void approve(Task task, String aboutFqn, Supplier<EntityStatus> status) {
    SdkClients.user1Client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withResolutionType(TaskResolutionType.Approved));
    await("approval of " + aboutFqn)
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              assertEquals(EntityStatus.APPROVED, status.get());
              assertTrue(openApprovals(aboutFqn).isEmpty());
            });
  }

  private static EntityStatus termStatus(GlossaryTerm term) {
    return SdkClients.adminClient().glossaryTerms().get(term.getId().toString()).getEntityStatus();
  }

  private static void reject(Task task) {
    SdkClients.user1Client()
        .tasks()
        .resolve(
            task.getId().toString(),
            new ResolveTask().withResolutionType(TaskResolutionType.Rejected));
  }

  private static void awaitRestoredTerm(
      GlossaryTerm term, EntityStatus status, String description, List<String> synonyms) {
    await("rejection of " + term.getFullyQualifiedName())
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .untilAsserted(
            () -> {
              GlossaryTerm restored =
                  SdkClients.adminClient().glossaryTerms().get(term.getId().toString(), SYNONYMS);
              assertEquals(status, restored.getEntityStatus());
              assertEquals(
                  synonyms,
                  nullOrEmpty(restored.getSynonyms()) ? List.of() : restored.getSynonyms());
              assertEquals(description, restored.getDescription());
              assertTrue(openApprovals(term.getFullyQualifiedName()).isEmpty());
            });
  }

  private static Task awaitPreview(
      GlossaryTerm term, Map<String, Map<String, List<String>>> expected) {
    return awaitPreview(term.getFullyQualifiedName(), expected);
  }

  // Each edit is awaited before the next, as a user editing in the UI waits for the page.
  private static Task awaitPreview(
      String aboutFqn, Map<String, Map<String, List<String>>> expected) {
    AtomicReference<Task> shown = new AtomicReference<>();
    await("approval preview of " + aboutFqn + " to be " + expected)
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              List<Task> open = openApprovals(aboutFqn);
              assertEquals(1, open.size());
              assertEquals(expected, proposedChanges(open.getFirst()));
              shown.set(open.getFirst());
            });
    return shown.get();
  }

  private static List<Task> openApprovals(String aboutFqn) {
    List<Task> tasks =
        SdkClients.adminClient()
            .tasks()
            .listWithFilters(
                Map.of(
                    "limit",
                    "100",
                    "status",
                    TaskEntityStatus.Open.value(),
                    "category",
                    TaskCategory.Approval.value(),
                    "aboutEntity",
                    aboutFqn))
            .getData();
    return tasks == null ? List.of() : tasks;
  }

  private static Map<String, Map<String, List<String>>> proposedChanges(Task task) {
    Object preview =
        task.getPayload() == null
            ? null
            : JsonUtils.getMap(task.getPayload()).get(ChangePreviewUtils.PROPOSED_CHANGES_KEY);
    return preview == null ? Map.of() : JsonUtils.convertValue(preview, PREVIEW_TYPE);
  }

  private static double baseOf(Task task) {
    return ChangePreviewUtils.cycleBaseOf(task.getPayload()).orElseThrow();
  }

  // The cycle's first edit is the oldest version after the one the cycle began from.
  private static double firstEditOf(GlossaryTerm term, double base) throws Exception {
    return SdkClients.adminClient()
        .glossaryTerms()
        .getVersionList(term.getId())
        .getVersions()
        .stream()
        .map(
            stored ->
                JsonUtils.readTree(
                    stored instanceof String json ? json : JsonUtils.pojoToJson(stored)))
        .mapToDouble(stored -> stored.path("version").asDouble())
        .filter(version -> version > base)
        .min()
        .orElseThrow();
  }

  // The row must be there to drop, or the test would pass without a gap in the history.
  private static void dropVersion(GlossaryTerm term, double version) {
    String extension = EntityUtil.getVersionExtension(Entity.GLOSSARY_TERM, version);
    EntityExtensionDAO versions = Entity.getCollectionDAO().entityExtensionDAO();
    assertNotNull(versions.getExtension(term.getId(), extension));
    versions.delete(term.getId(), extension);
  }

  private static boolean isMarkedIncomplete(Task task) {
    return Boolean.TRUE.equals(
        JsonUtils.getMap(task.getPayload())
            .get(ChangePreviewUtils.PROPOSED_CHANGES_INCOMPLETE_KEY));
  }

  private static Map<String, List<String>> replaced(String newValue, String oldValue) {
    return Map.of("added", List.of(newValue), "removed", List.of(oldValue));
  }

  private static Map<String, List<String>> added(String value) {
    return Map.of("added", List.of(value), "removed", List.of());
  }

  private static void editDescription(OpenMetadataClient client, GlossaryTerm term, String value)
      throws Exception {
    client.glossaryTerms().patch(term.getId().toString(), descriptionPatch(value));
  }

  private static JsonNode descriptionPatch(String value) {
    return replaceTextPatch(DESCRIPTION, value);
  }

  private static JsonNode replaceTextPatch(String field, String value) {
    return MAPPER
        .createArrayNode()
        .add(
            MAPPER
                .createObjectNode()
                .put("op", "replace")
                .put("path", "/" + field)
                .put("value", value));
  }

  private static WorkflowDefinition createApprovalWorkflow(
      TestNamespace ns, String entityType, String fqn, String rejectNode) {
    String scope =
        JsonUtils.pojoToJson(Map.of("!=", List.of(Map.of("var", "fullyQualifiedName"), fqn)));
    String definition =
        """
        {"name":"%s","displayName":"Test Approval", "description":"Approval preview regression",
          "trigger":{"type":"eventBasedEntity","config":{"entityTypes":["%s"],
            "events":["Updated"],"include":["description","displayName"],"filter":%s},
            "output":["relatedEntity","updatedBy"]},
          "nodes":[
            {"type":"startEvent","subType":"startEvent","name":"start","displayName":"Start"},
            %s,
            {"type":"userTask","subType":"userApprovalTask","name":"review","displayName":"Review",
              "config":{"assignees":{"candidates":[%s]},"approvalThreshold":1,"rejectionThreshold":1},
              "inputNamespaceMap":{"relatedEntity":"global"},"output":["updatedBy"]},
            %s,
            %s,
            {"type":"endEvent","subType":"endEvent","name":"end","displayName":"End"}],
          "edges":[{"from":"start","to":"inReview"},{"from":"inReview","to":"review"},
            {"from":"review","to":"accept","condition":"approve"},
            {"from":"review","to":"undo","condition":"reject"},
            {"from":"accept","to":"end"},{"from":"undo","to":"end"}],
          "config":{"storeStageStatus":false}}
        """
            .formatted(
                "preview_workflow_" + ns.shortPrefix(),
                entityType,
                JsonUtils.pojoToJson(Map.of(entityType, scope)),
                statusNode("inReview", "In Review", "global"),
                JsonUtils.pojoToJson(SharedEntities.get().USER1_REF),
                statusNode("accept", "Approved", "review"),
                rejectNode);
    return SdkClients.adminClient()
        .workflowDefinitions()
        .create(JsonUtils.readValue(definition, CreateWorkflowDefinition.class));
  }

  private static String statusNode(String name, String status, String actorNamespace) {
    return """
        {"type":"automatedTask","subType":"setEntityAttributeTask","name":"%s","displayName":"%s",
          "config":{"fieldName":"status","fieldValue":"%s"},
          "inputNamespaceMap":{"relatedEntity":"global","updatedBy":"%s"}}
        """
        .formatted(name, status, status, actorNamespace);
  }

  private static void awaitWorkflowDeployment(WorkflowDefinition workflow) {
    await("deployment of " + workflow.getName())
        .atMost(TIMEOUT)
        .until(
            () ->
                Boolean.TRUE.equals(
                    SdkClients.adminClient()
                        .workflowDefinitions()
                        .get(workflow.getId().toString(), "deployed")
                        .getDeployed()));
  }

  private static void deleteWorkflow(WorkflowDefinition workflow) {
    SdkClients.adminClient()
        .workflowDefinitions()
        .delete(workflow.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
  }

  private static void addSynonym(OpenMetadataClient client, GlossaryTerm term, String synonym)
      throws Exception {
    client
        .glossaryTerms()
        .patch(
            term.getId().toString(),
            MAPPER.readTree(
                "[{\"op\":\"add\",\"path\":\"/%s\",\"value\":[\"%s\"]}]"
                    .formatted(SYNONYMS, synonym)));
  }

  // The shared steward client only mints a token, so the account is created here.
  private static OpenMetadataClient stewardClient(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String name = "preview_steward_" + UUID.randomUUID().toString().substring(0, 8);
    CreateUser createUser =
        new CreateUser()
            .withName(name)
            .withEmail(name + "@test.om.org")
            .withRoles(List.of(admin.roles().getByName("DataSteward").getId()));
    User steward = ns.trackRoot(Entity.USER, admin.users().create(createUser));
    return SdkClients.createClient(
        steward.getName(), steward.getEmail(), new String[] {"DataSteward"});
  }

  private static void awaitFinishedRuns(GlossaryTerm term, int runs) {
    await(runs + " finished approval runs on " + term.getFullyQualifiedName())
        .atMost(TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(() -> assertEquals(Collections.nCopies(runs, FINISHED), runStatuses(term)));
  }

  private static List<String> runStatuses(GlossaryTerm term) throws Exception {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam(
                "entityLink",
                "<#E::%s::%s>".formatted(Entity.GLOSSARY_TERM, term.getFullyQualifiedName()))
            .queryParam("workflowDefinitionName", GLOSSARY_WORKFLOW)
            .queryParam("startTs", String.valueOf(now - Duration.ofHours(1).toMillis()))
            .queryParam("endTs", String.valueOf(now + Duration.ofHours(1).toMillis()))
            .queryParam("limit", "50")
            .build();
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/governance/workflowInstances", null, options);
    List<String> statuses = new ArrayList<>();
    for (JsonNode instance : MAPPER.readTree(response).path("data")) {
      statuses.add(instance.path("status").asText());
    }
    return statuses;
  }
}
