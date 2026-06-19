/*
 *  Copyright 2024 Collate
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
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Reproduces the glossary-approval regression where moving a term (or one of its ancestors) while a
 * descendant term still has an OPEN approval task breaks the approval workflow.
 *
 * <p>Scenario (from the bug report):
 *
 * <ol>
 *   <li>Glossary approval is enabled and {@code Securities Lending.Eligible Securities} is created.
 *       The leaf term {@code Eligible Securities} gets an open approval task.
 *   <li>A new parent {@code Product and Service} is created and {@code Securities Lending} is moved
 *       under it, rewriting the leaf term's FQN via a prefix cascade.
 *   <li>The still-open approval task for {@code Eligible Securities} is approved.
 * </ol>
 *
 * <p>The Glossary Approval Workflow captures the term as a {@code relatedEntity} EntityLink built
 * from the FQN at trigger time. The move rewrites the term's FQN (and tag usages, field
 * relationships and legacy feed-thread {@code about}) but NOT the running workflow instance's
 * {@code relatedEntity} variable. When the task is approved, the workflow's {@code
 * SetEntityAttributeImpl} resolves {@code relatedEntity} via {@code Entity.getEntity(entityLink)}
 * using the stale pre-move FQN and throws {@code "glossaryTerm instance for <oldFqn> not found"},
 * so the Glossary Approval Workflow instance never reaches {@code FINISHED}.
 *
 * <p>The fix records the entity's immutable id ({@code relatedEntityId}) at trigger time and has the
 * workflow nodes resolve the term by id (with an FQN fallback), so a moved/renamed FQN no longer
 * breaks resolution.
 *
 * <p>These tests assert the post-fix invariant: after approving the moved term's task, the term is
 * {@code Approved} AND the approval workflow instance completes successfully. Without the fix the
 * workflow instance fails to advance past the failing {@code SetEntityAttribute} node.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermMoveApprovalIT {

  private static final String APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final String WORKFLOW_STATUS_FINISHED = "FINISHED";
  private static final Set<String> TERMINAL_WORKFLOW_STATUSES =
      Set.of("FINISHED", "EXCEPTION", "FAILURE");
  private static final Duration TASK_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration MOVE_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration STATUS_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  protected User reviewer() {
    return shared().USER1;
  }

  /**
   * Documented repro: a leaf term has an open approval task, then its parent is moved under a new
   * term. Approving the leaf's task must still drive the leaf to Approved and complete the workflow.
   */
  // Deterministic regardless of the move's async timing: the workflow resolves the leaf by its
  // immutable id (relatedEntityId), so approving after the move no longer depends on the FQN being
  // repointed first.
  @Test
  void test_approveApprovalTaskAfterMovingParentTerm_drivesMovedTermToApproved(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns);

    GlossaryTerm securitiesLending = createTerm(glossary, null, "securities_lending", false);
    GlossaryTerm eligibleSecurities =
        createTerm(glossary, securitiesLending, "eligible_securities", true);

    String preMoveLeafFqn = eligibleSecurities.getFullyQualifiedName();
    Thread approvalTask = waitForOpenApprovalTask(preMoveLeafFqn);

    GlossaryTerm productAndService = createTerm(glossary, null, "product_and_service", false);

    moveGlossaryTerm(securitiesLending.getId(), reference(productAndService, Entity.GLOSSARY_TERM));

    String movedLeafFqn = waitForTermFqnChange(eligibleSecurities.getId(), preMoveLeafFqn);
    assertTrue(
        movedLeafFqn.startsWith(productAndService.getFullyQualifiedName() + "."),
        "Leaf term should now live under the new parent. fqn=" + movedLeafFqn);

    approveTask(approvalTask);

    waitForTermStatus(eligibleSecurities.getId(), EntityStatus.APPROVED);
    assertApprovalWorkflowFinished(movedLeafFqn);
  }

  /**
   * Variant exercising the move-to-glossary-root path: a deeply nested leaf term has an open
   * approval task, then an ancestor is moved to the glossary root.
   */
  // Deterministic via by-id resolution (see the parent-move test).
  @Test
  void test_approveApprovalTaskAfterMovingAncestorToGlossaryRoot_drivesMovedTermToApproved(
      TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns);

    GlossaryTerm top = createTerm(glossary, null, "asset_class", false);
    GlossaryTerm middle = createTerm(glossary, top, "securities_lending", false);
    GlossaryTerm leaf = createTerm(glossary, middle, "eligible_securities", true);

    String preMoveLeafFqn = leaf.getFullyQualifiedName();
    Thread approvalTask = waitForOpenApprovalTask(preMoveLeafFqn);

    moveGlossaryTerm(middle.getId(), reference(glossary, Entity.GLOSSARY));

    String movedLeafFqn = waitForTermFqnChange(leaf.getId(), preMoveLeafFqn);
    assertFalse(
        movedLeafFqn.startsWith(top.getFullyQualifiedName() + "."),
        "Leaf term should no longer live under the original ancestor. fqn=" + movedLeafFqn);
    assertTrue(
        movedLeafFqn.startsWith(glossary.getFullyQualifiedName() + "." + middle.getName() + "."),
        "Leaf term should now live under the glossary root parent. fqn=" + movedLeafFqn);

    approveTask(approvalTask);

    waitForTermStatus(leaf.getId(), EntityStatus.APPROVED);
    assertApprovalWorkflowFinished(movedLeafFqn);
  }

  /**
   * Rename path: a leaf term has an open approval task, then its parent is RENAMED (PATCH name),
   * which cascades the leaf's FQN exactly like a move. Approving the leaf's task must still complete
   * the workflow — by-id resolution makes this work regardless of the renamed FQN.
   */
  @Test
  void test_approveApprovalTaskAfterRenamingParentTerm_drivesRenamedTermToApproved(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns);

    GlossaryTerm parent = createTerm(glossary, null, "securities_lending", false);
    GlossaryTerm leaf = createTerm(glossary, parent, "eligible_securities", true);

    String preRenameLeafFqn = leaf.getFullyQualifiedName();
    Thread approvalTask = waitForOpenApprovalTask(preRenameLeafFqn);

    renameTerm(parent.getId(), "securities_lending_renamed");

    String renamedLeafFqn = waitForTermFqnChange(leaf.getId(), preRenameLeafFqn);
    assertTrue(
        renamedLeafFqn.contains("securities_lending_renamed"),
        "Leaf FQN should reflect the renamed parent. fqn=" + renamedLeafFqn);

    approveTask(approvalTask);

    waitForTermStatus(leaf.getId(), EntityStatus.APPROVED);
    assertApprovalWorkflowFinished(renamedLeafFqn);
  }

  /**
   * Atomicity: moving a term under a long-named parent produces an FQN beyond {@code
   * tag_usage.tagFQN}'s VARCHAR(512), so the move's tag rename fails mid-operation. The move must
   * roll back fully — the term's FQN must NOT change — rather than leaving the FQN rewritten while
   * relationships/tag usages are not. (Two 256-char names are needed so the moved FQN exceeds the
   * widened 512-char column.)
   */
  @Test
  void test_moveOfLongFqnTermIsAtomic_noPartialStateOnFailure(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary = createGlossary(ns);

    String parentName = ("par_" + "y".repeat(256)).substring(0, 256);
    String termName = ("lng_" + "x".repeat(256)).substring(0, 256);
    GlossaryTerm longParent = createTerm(glossary, null, parentName, false);
    GlossaryTerm longTerm = createTerm(glossary, null, termName, false);
    String originalFqn = longTerm.getFullyQualifiedName();

    String wouldBeFqn = longParent.getFullyQualifiedName() + "." + longTerm.getName();
    assertTrue(
        wouldBeFqn.length() > 512,
        "Moved FQN must exceed the 512-char tag_usage limit to trigger the mid-move failure: "
            + wouldBeFqn.length());

    // Tag the term onto a table so the move's tag rename has a row to update. The pre-move FQN fits
    // in tag_usage.tagFQN(512), but the post-move FQN does not, so the rename overflows on BOTH
    // engines. (On MySQL a 0-row UPDATE would not overflow, unlike Postgres which coerces the bind
    // param regardless of matching rows.)
    tagTermOntoNewTable(ns, longTerm);

    moveGlossaryTerm(longTerm.getId(), reference(longParent, Entity.GLOSSARY_TERM));

    // The async move fails on the oversized tag rename. With the atomicity fix it rolls back, so
    // the
    // term's FQN never changes; a partial move would flip it to the new parent's path. Assert the
    // FQN stays put across a window that comfortably contains the (fast) async move execution.
    Awaitility.await("long-FQN move must not partially apply")
        .during(Duration.ofSeconds(6))
        .atMost(Duration.ofSeconds(25))
        .pollInterval(Duration.ofMillis(500))
        .untilAsserted(
            () ->
                assertEquals(
                    originalFqn,
                    admin.glossaryTerms().get(longTerm.getId().toString()).getFullyQualifiedName(),
                    "Term FQN changed — the failed move left partial state"));
  }

  private Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("tisa"))
            .withDescription("Glossary for move + approval regression test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  /**
   * Reviewers are attached only to the term that needs an open task. Parent terms have no reviewers
   * and are auto-approved, so the move does not re-trigger sibling approval workflows and exactly
   * one open task exists for the leaf term.
   */
  private GlossaryTerm createTerm(
      Glossary glossary, GlossaryTerm parent, String name, boolean withReviewer) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term created by move + approval regression test");
    if (parent != null) {
      create.withParent(parent.getFullyQualifiedName());
    }
    if (withReviewer) {
      create.withReviewers(List.of(reviewer().getEntityReference()));
    }
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private EntityReference reference(GlossaryTerm term, String type) {
    return new EntityReference().withId(term.getId()).withType(type);
  }

  private EntityReference reference(Glossary glossary, String type) {
    return new EntityReference().withId(glossary.getId()).withType(type);
  }

  private void moveGlossaryTerm(UUID termId, EntityReference newParent) {
    MoveGlossaryTermRequest request = new MoveGlossaryTermRequest().withParent(newParent);
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .executeForString(HttpMethod.PUT, "/v1/glossaryTerms/" + termId + "/moveAsync", request);
    } catch (Exception e) {
      throw new RuntimeException("Failed to submit move for glossary term " + termId, e);
    }
  }

  private void renameTerm(UUID termId, String newName) throws Exception {
    JsonNode patch =
        new ObjectMapper()
            .readTree(
                String.format(
                    "[{\"op\":\"replace\",\"path\":\"/name\",\"value\":\"%s\"}]", newName));
    SdkClients.adminClient().glossaryTerms().patch(termId.toString(), patch);
  }

  private void tagTermOntoNewTable(TestNamespace ns, GlossaryTerm term) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    CreateTable tableRequest = new CreateTable();
    tableRequest.setName(ns.shortPrefix("atomic_tbl"));
    tableRequest.setDatabaseSchema(schema.getFullyQualifiedName());
    tableRequest.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));
    tableRequest.setTags(
        List.of(
            new TagLabel()
                .withTagFQN(term.getFullyQualifiedName())
                .withSource(TagLabel.TagSource.GLOSSARY)
                .withLabelType(TagLabel.LabelType.MANUAL)));
    SdkClients.adminClient().tables().create(tableRequest);
  }

  private Thread waitForOpenApprovalTask(String aboutFqn) {
    String entityLink = glossaryTermEntityLink(aboutFqn);
    Awaitility.await("wait for open glossary approval task for " + aboutFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> !listTasks(entityLink).isEmpty());
    List<Thread> tasks = listTasks(entityLink);
    assertFalse(tasks.isEmpty(), "Expected an open approval task for " + aboutFqn);
    Thread task = tasks.get(0);
    assertNotNull(task.getTask());
    assertNotNull(task.getTask().getId());
    return task;
  }

  private List<Thread> listTasks(String entityLink) {
    return SdkClients.adminClient().feed().listTasks(entityLink, TaskStatus.Open, null).getData()
        .stream()
        .filter(thread -> thread.getTask() != null)
        .filter(thread -> TaskType.RequestApproval.equals(thread.getTask().getType()))
        .toList();
  }

  private String waitForTermFqnChange(UUID termId, String previousFqn) {
    Awaitility.await("glossary term " + termId + " FQN should change after move")
        .atMost(MOVE_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(() -> !previousFqn.equals(currentFqn(termId)));
    return currentFqn(termId);
  }

  private String currentFqn(UUID termId) {
    return SdkClients.adminClient().glossaryTerms().get(termId.toString()).getFullyQualifiedName();
  }

  private void approveTask(Thread task) throws Exception {
    SdkClients.user1Client()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/feed/tasks/" + task.getTask().getId() + "/resolve",
            new ResolveTask().withNewValue(EntityStatus.APPROVED.value()),
            RequestOptions.builder().build());
  }

  private void waitForTermStatus(UUID termId, EntityStatus expected) {
    Awaitility.await("glossary term " + termId + " should reach status " + expected)
        .atMost(STATUS_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertEquals(
                    expected,
                    SdkClients.adminClient()
                        .glossaryTerms()
                        .get(termId.toString())
                        .getEntityStatus()));
  }

  /**
   * The Glossary Approval Workflow instance follows the term across a move/rename: the move repoints
   * the instance's {@code relatedEntity} to the new FQN (so the history card resolves at the term's
   * current location), so it is queried by the POST-move FQN. After approval it must complete; the
   * stale-relatedEntity bug stops it from advancing past the failing SetEntityAttribute node so it
   * never reaches FINISHED.
   */
  private void assertApprovalWorkflowFinished(String currentTermFqn) throws Exception {
    // Poll until the workflow reaches a TERMINAL status, then assert it is FINISHED. Polling for
    // any
    // terminal status (not FINISHED only) surfaces a stale-FQN failure within seconds — EXCEPTION
    // is
    // terminal, so a regression fails fast instead of waiting the full timeout for FINISHED.
    Awaitility.await(
            "glossary approval workflow for " + currentTermFqn + " should reach a terminal state")
        .atMost(STATUS_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .until(
            () ->
                approvalWorkflowStatuses(currentTermFqn).stream()
                    .anyMatch(TERMINAL_WORKFLOW_STATUSES::contains));
    List<String> statuses = approvalWorkflowStatuses(currentTermFqn);
    assertTrue(
        statuses.contains(WORKFLOW_STATUS_FINISHED),
        "Approval workflow for "
            + currentTermFqn
            + " should reach FINISHED but statuses were "
            + statuses);
  }

  private List<String> approvalWorkflowStatuses(String termFqn) throws Exception {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", glossaryTermEntityLink(termFqn))
            .queryParam("workflowDefinitionName", APPROVAL_WORKFLOW)
            .queryParam("startTs", String.valueOf(now - Duration.ofHours(1).toMillis()))
            .queryParam("endTs", String.valueOf(now + Duration.ofHours(1).toMillis()))
            .queryParam("limit", "50")
            .build();
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/governance/workflowInstances", null, options);
    JsonNode data = new ObjectMapper().readTree(response).path("data");
    List<String> statuses = new ArrayList<>();
    if (data.isArray()) {
      for (JsonNode instance : data) {
        statuses.add(instance.path("status").asText());
      }
    }
    return statuses;
  }

  private String glossaryTermEntityLink(String termFqn) {
    return String.format("<#E::%s::%s>", Entity.GLOSSARY_TERM, termFqn);
  }
}
