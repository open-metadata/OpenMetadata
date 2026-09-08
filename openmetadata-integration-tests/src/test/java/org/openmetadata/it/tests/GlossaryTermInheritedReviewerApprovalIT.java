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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Reproduces the Glossary Approval regression where a term whose reviewers are <b>inherited</b> (from
 * the parent Glossary) does NOT get an approval task, while a term with reviewers attached
 * <b>directly</b> does.
 *
 * <p>Reported scenario (see the attached workflow-history screenshot on the issue):
 *
 * <ol>
 *   <li>A reviewer is attached to the term itself → the {@code GlossaryTermApprovalWorkflow}
 *       triggers, the term moves to {@code In Review} and an open approval task is created for the
 *       reviewer. (Works.)
 *   <li>The reviewer is removed from the term so the term <em>inherits</em> the reviewer from its
 *       Glossary → no approval task is created and the term settles in {@code Draft}. (Bug.)
 * </ol>
 *
 * <p>The workflow's {@code CheckGlossaryTermHasReviewers} node (JsonLogic {@code some reviewers ...})
 * is expected to see inherited reviewers because the node re-fetches the term with {@code
 * getEntity(entityLink, "*", Include.ALL)} — which applies {@code setInheritedFields}. If inheritance
 * is not honored on that read path, the term is routed to a terminal status (Draft/Approved) and no
 * task is ever assigned to the inherited reviewer.
 *
 * <p>{@link #test_directReviewerOnTerm_createsOpenApprovalTask} is the control (direct reviewers) and
 * must pass on every build. {@link #test_inheritedReviewerFromGlossary_createsOpenApprovalTask} and
 * {@link #test_inheritedReviewerFromParentTerm_createsOpenApprovalTask} assert the post-fix invariant
 * — inherited reviewers must produce the same {@code In Review} + open-task outcome as direct
 * reviewers. On an affected build they fail fast: the approval workflow reaches a terminal status
 * without ever creating a task.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermInheritedReviewerApprovalIT {

  private static final String APPROVAL_WORKFLOW = "GlossaryTermApprovalWorkflow";
  private static final Set<String> TERMINAL_WORKFLOW_STATUSES =
      Set.of("FINISHED", "EXCEPTION", "FAILURE");
  // The approval outcome is driven by the async Flowable job executor (BPMN trigger → reviewer
  // check
  // → status transition → approval task), which contends with the rest of the concurrent suite, so
  // the budgets mirror the generous ones in GlossaryTermMoveApprovalIT.
  private static final Duration TASK_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration STATUS_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  /** Terms created after the reviewer is added, to land on a poisoned executor thread. */
  private static final int POISONED_THREAD_PROBE_COUNT = 6;

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  /** USER1 carries the AllowAll test-admin role, so it is a valid approval-task assignee. */
  protected User reviewer() {
    return shared().USER1;
  }

  /** A distinct user used as a term owner (and as a removable direct reviewer). */
  protected User otherUser() {
    return shared().USER2;
  }

  /**
   * Control: a reviewer attached directly to the term drives it to {@code In Review} with an open
   * approval task assigned to that reviewer. This path is known to work and must always pass.
   */
  @Test
  void test_directReviewerOnTerm_createsOpenApprovalTask(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ false);
    GlossaryTerm term =
        createTerm(glossary, "direct_reviewer_term", /* attachReviewerDirectly */ true);

    Task task = awaitOpenApprovalTask(term.getId(), term.getFullyQualifiedName());
    assertAssigneeIsReviewer(task);
    waitForTermStatus(term.getId(), EntityStatus.IN_REVIEW);
  }

  /**
   * Bug: the glossary carries the reviewer and the term attaches none, so the term inherits the
   * reviewer. The approval workflow must produce the SAME outcome as the direct case — {@code In
   * Review} plus an open approval task assigned to the inherited reviewer. On an affected build the
   * workflow instead finishes in {@code Draft} without creating a task, and this fails fast.
   */
  @Test
  void test_inheritedReviewerFromGlossary_createsOpenApprovalTask(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ true);
    GlossaryTerm term =
        createTerm(glossary, "inherited_reviewer_term", /* attachReviewerDirectly */ false);

    // Sanity: the term reports the reviewer via inheritance on a normal GET (Include.ALL), which is
    // exactly the read the workflow node performs. If this holds but no task is created, the bug is
    // isolated to the workflow's reviewer-check read path.
    assertTermInheritsReviewer(term.getId());

    Task task = awaitOpenApprovalTask(term.getId(), term.getFullyQualifiedName());
    assertAssigneeIsReviewer(task);
    waitForTermStatus(term.getId(), EntityStatus.IN_REVIEW);
  }

  /**
   * Bug variant: the reviewer is attached to a parent term and the child attaches none, so the child
   * inherits the reviewer from the parent term (a different inheritance source than the Glossary,
   * resolved by a distinct branch of {@code resolveEffectiveReviewers}). The parent is created BY the
   * reviewer so it auto-approves (updatedBy == reviewer) and leaves no lingering task under it. The
   * child must reach {@code In Review} with an open task assigned to the inherited reviewer.
   */
  @Test
  void test_inheritedReviewerFromParentTerm_createsOpenApprovalTask(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ false);
    GlossaryTerm parent = createReviewerOwnedTerm(glossary, "parent_with_reviewer");
    GlossaryTerm child = createChildTerm(glossary, parent, "child_inherits_reviewer");

    assertTermInheritsReviewer(child.getId());

    Task task = awaitOpenApprovalTask(child.getId(), child.getFullyQualifiedName());
    assertAssigneeIsReviewer(task);
    waitForTermStatus(child.getId(), EntityStatus.IN_REVIEW);
  }

  /**
   * Stale inheritance-parent cache. {@code EntityRepository.inheritanceParentCache} is a static
   * ThreadLocal cleared only by {@code ImpersonationCleanupFilter}, a JAX-RS response filter — so on
   * Flowable's async job-executor threads it is never cleared for the life of the process.
   *
   * <p>This drives the reported ordering: the glossary starts with NO reviewers, a first term is
   * created so the workflow caches that reviewer-less glossary snapshot on a job thread, and only then
   * is the reviewer added. Every term created afterwards must still be gated as "has reviewers"; a
   * term that lands in a terminal status instead means a job thread served the stale parent.
   *
   * <p>Several terms are created because the executor has a pool of threads and only the poisoned ones
   * exhibit the bug — one term could be routed to a clean thread and pass by luck.
   */
  @Test
  void test_reviewerAddedToGlossaryAfterFirstTerm_stillGatesLaterTerms(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ false);

    // Poison: this term's workflow caches the glossary parent while it has no reviewers.
    GlossaryTerm seed = createTerm(glossary, "seed_before_reviewer", false);
    waitForTermStatus(seed.getId(), EntityStatus.APPROVED);

    addReviewerToGlossary(glossary.getId());

    for (int i = 0; i < POISONED_THREAD_PROBE_COUNT; i++) {
      GlossaryTerm term = createTerm(glossary, "after_reviewer_" + i, false);
      assertTermInheritsReviewer(term.getId());
      awaitOpenApprovalTask(term.getId(), term.getFullyQualifiedName());
    }
  }

  private void addReviewerToGlossary(UUID glossaryId) throws Exception {
    String patch =
        String.format(
            "[{\"op\":\"add\",\"path\":\"/reviewers\",\"value\":"
                + "[{\"id\":\"%s\",\"type\":\"user\"}]}]",
            reviewer().getId());
    SdkClients.adminClient()
        .glossaries()
        .patch(glossaryId.toString(), new ObjectMapper().readTree(patch));
  }

  /**
   * Grandparent inheritance: the GLOSSARY holds the reviewer, an intermediate term holds none, and
   * the leaf holds none. Effective-reviewer resolution takes a single hop to the parent term, so this
   * only succeeds if reading that parent applies its own inheritance and surfaces the glossary's
   * reviewer — the assumption the generic resolution rests on.
   */
  @Test
  void test_inheritedReviewerFromGrandparentGlossary_createsOpenApprovalTask(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ true);
    GlossaryTerm middle = createTerm(glossary, "middle_no_reviewer", false);
    GlossaryTerm leaf = createChildTerm(glossary, middle, "leaf_inherits_from_glossary");

    assertTermInheritsReviewer(leaf.getId());

    Task task = awaitOpenApprovalTask(leaf.getId(), leaf.getFullyQualifiedName());
    assertAssigneeIsReviewer(task);
    waitForTermStatus(leaf.getId(), EntityStatus.IN_REVIEW);
  }

  /**
   * Faithful shape of the reported "hello world" term: an OWNER and a description are set, and the
   * reviewer is inherited from the glossary (none on the term). This isolates whether an owner on the
   * term suppresses inherited-reviewer resolution at the approval gate (it must not).
   */
  @Test
  void test_inheritedReviewerWithOwnerSet_createsOpenApprovalTask(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ true);
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(ns.shortPrefix("owned_inherited"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("hello world")
            .withOwners(List.of(otherUser().getEntityReference()));
    GlossaryTerm term = SdkClients.adminClient().glossaryTerms().create(create);

    assertTermInheritsReviewer(term.getId());
    Task task = awaitOpenApprovalTask(term.getId(), term.getFullyQualifiedName());
    assertAssigneeIsReviewer(task);
    waitForTermStatus(term.getId(), EntityStatus.IN_REVIEW);
  }

  /**
   * The reported Run-2 sequence: the glossary carries the reviewer; the term starts with a DIFFERENT
   * direct reviewer, then that direct reviewer is removed so the term must fall back to the
   * glossary-inherited reviewer and STILL be gated as "has reviewers" (task kept, not dropped to a
   * terminal status).
   */
  @Test
  void test_removeDirectReviewer_fallsBackToGlossaryInheritedReviewer(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns, /* withReviewer */ true); // glossary reviewer = USER1
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(ns.shortPrefix("removed_direct"))
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("hello world")
            .withReviewers(List.of(otherUser().getEntityReference())); // direct reviewer = USER2
    GlossaryTerm term = SdkClients.adminClient().glossaryTerms().create(create);
    awaitOpenApprovalTask(term.getId(), term.getFullyQualifiedName());

    removeDirectReviewers(term.getId()); // now the term inherits USER1 from the glossary
    assertTermInheritsReviewer(term.getId());

    // Decisive signal: the workflow must NOT drop the term to a terminal status without a task once
    // the only remaining reviewer is inherited. (Task re-assignment timing is asserted elsewhere.)
    awaitOpenApprovalTask(term.getId(), term.getFullyQualifiedName());
  }

  private void removeDirectReviewers(UUID termId) throws Exception {
    JsonNode patch =
        new ObjectMapper().readTree("[{\"op\":\"replace\",\"path\":\"/reviewers\",\"value\":[]}]");
    SdkClients.adminClient().glossaryTerms().patch(termId.toString(), patch);
  }

  private Glossary createGlossary(TestNamespace ns, boolean withReviewer) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("inh"))
            .withDescription("Glossary for inherited-reviewer approval test");
    if (withReviewer) {
      create.withReviewers(List.of(reviewer().getEntityReference()));
    }
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTerm(Glossary glossary, String name, boolean attachReviewerDirectly) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            // A non-empty description is required to pass CheckGlossaryTermIsReadyToBeReviewed.
            .withDescription("Term created by inherited-reviewer approval test");
    if (attachReviewerDirectly) {
      create.withReviewers(List.of(reviewer().getEntityReference()));
    }
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private GlossaryTerm createChildTerm(Glossary glossary, GlossaryTerm parent, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withParent(parent.getFullyQualifiedName())
            .withDescription("Child term created by inherited-reviewer approval test");
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  /**
   * Creates a term with the reviewer attached directly, AS that reviewer, so the approval workflow
   * auto-approves it (the updatedBy-is-reviewer branch) and it holds no open task of its own.
   */
  private GlossaryTerm createReviewerOwnedTerm(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Parent term created by inherited-reviewer approval test")
            .withReviewers(List.of(reviewer().getEntityReference()));
    return SdkClients.user1Client().glossaryTerms().create(create);
  }

  private void assertTermInheritsReviewer(UUID termId) {
    GlossaryTerm term =
        SdkClients.adminClient().glossaryTerms().get(termId.toString(), "reviewers");
    Set<UUID> reviewerIds = entityReferenceIds(term.getReviewers());
    assertTrue(
        reviewerIds.contains(reviewer().getId()),
        "Term "
            + termId
            + " should inherit reviewer "
            + reviewer().getId()
            + " but resolved reviewers were "
            + reviewerIds);
  }

  /**
   * Waits until the term has an OPEN approval task, or fails fast the moment the approval workflow
   * settles in a terminal state without one (the inherited-reviewers bug). Failing on a terminal,
   * task-less workflow surfaces the regression in seconds instead of hanging for the full timeout.
   */
  private Task awaitOpenApprovalTask(UUID termId, String termFqn) {
    Map<String, String> filters =
        Map.of("limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", termFqn);
    Awaitility.await("open approval task for " + termFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .until(
            () ->
                !safeListTasks(filters).isEmpty()
                    || approvalWorkflowSettledWithoutTask(termFqn, filters));
    List<Task> tasks = safeListTasks(filters);
    if (tasks.isEmpty()) {
      fail(
          "Expected the Glossary Approval Workflow to create an OPEN approval task for "
              + termFqn
              + " (reviewer resolved via inheritance), but the workflow settled without one. "
              + "term status="
              + safeCurrentStatus(termId)
              + ", workflow instance statuses="
              + safeWorkflowStatuses(termFqn)
              + ". Inherited reviewers were not honored — the term went straight to a terminal "
              + "status instead of 'In Review' with an approval task.");
    }
    Task task = tasks.get(0);
    assertNotNull(task.getId());
    return task;
  }

  private boolean approvalWorkflowSettledWithoutTask(String termFqn, Map<String, String> filters) {
    boolean settledWithoutTask = false;
    if (safeListTasks(filters).isEmpty()) {
      List<String> statuses = safeWorkflowStatuses(termFqn);
      settledWithoutTask =
          !statuses.isEmpty() && statuses.stream().allMatch(TERMINAL_WORKFLOW_STATUSES::contains);
    }
    return settledWithoutTask;
  }

  private void assertAssigneeIsReviewer(Task task) {
    Set<UUID> assigneeIds = entityReferenceIds(task.getAssignees());
    assertTrue(
        assigneeIds.contains(reviewer().getId()),
        "Approval task "
            + task.getId()
            + " should be assigned to the (inherited) reviewer "
            + reviewer().getId()
            + " but assignees were "
            + assigneeIds);
  }

  private void waitForTermStatus(UUID termId, EntityStatus expected) {
    Awaitility.await("glossary term " + termId + " should reach status " + expected)
        .atMost(STATUS_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(() -> assertEquals(expected, safeCurrentStatus(termId)));
  }

  private List<Task> safeListTasks(Map<String, String> filters) {
    List<Task> tasks;
    try {
      ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
      tasks = response.getData() == null ? List.of() : response.getData();
    } catch (RuntimeException e) {
      tasks = List.of();
    }
    return tasks;
  }

  private EntityStatus safeCurrentStatus(UUID termId) {
    EntityStatus status;
    try {
      status = SdkClients.adminClient().glossaryTerms().get(termId.toString()).getEntityStatus();
    } catch (RuntimeException e) {
      status = null;
    }
    return status;
  }

  private List<String> safeWorkflowStatuses(String termFqn) {
    List<String> statuses;
    try {
      statuses = approvalWorkflowStatuses(termFqn);
    } catch (Exception e) {
      statuses = List.of();
    }
    return statuses;
  }

  private List<String> approvalWorkflowStatuses(String termFqn) throws Exception {
    long now = System.currentTimeMillis();
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("entityLink", String.format("<#E::%s::%s>", Entity.GLOSSARY_TERM, termFqn))
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

  private Set<UUID> entityReferenceIds(List<EntityReference> references) {
    return references == null
        ? Set.of()
        : references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }
}
