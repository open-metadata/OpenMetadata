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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.Arrays;
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
import org.openmetadata.service.Entity;

/**
 * Acceptance guard for #31692: changing the reviewers of a glossary term that is <b>in review</b>
 * must leave exactly one open approval {@link Task} for that term, assigned to the current (new)
 * reviewers.
 *
 * <p>The repositories used to force this by patching the open approval task's assignees in place
 * whenever the reviewer list changed ({@code updateTaskWithNewReviewers} →
 * {@code TaskRepository.updateApprovalTaskAssignees}). That coupling was removed: an approval
 * task's assignees are chosen by the workflow's {@code userApprovalTask} rule (owners, reviewers,
 * individual users or teams), so a repository must not blindly overwrite them with the reviewer
 * list. For a glossary term the seeded {@code GlossaryTermApprovalWorkflow} already supersedes the
 * open task with a fresh one assigned to the current reviewers on any reviewer change, so the
 * user-facing guarantee below holds without the removed mechanism.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermReviewerChangeApprovalIT {

  private static final Duration TASK_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration STATUS_TIMEOUT = Duration.ofMinutes(3);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  /** USER1 carries the AllowAll test-admin role, so it is a valid approval-task assignee. */
  protected User firstReviewer() {
    return shared().USER1;
  }

  /** A second valid approval assignee, added to the reviewer list mid-review. */
  protected User secondReviewer() {
    return shared().USER2;
  }

  /**
   * A term goes {@code In Review} with an open task assigned to the initial reviewer. Adding a
   * second reviewer while the task is open must leave exactly one open approval task, now assigned
   * to the new reviewer set — not a stale duplicate and not a task missing the added reviewer.
   */
  @Test
  void test_addReviewer_leavesSingleOpenTaskAssignedToNewReviewers(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTermWithReviewers(glossary, "reviewer_change", firstReviewer());

    Task firstTask = awaitOpenApprovalTask(term.getFullyQualifiedName());
    assertAssigneesContain(firstTask, firstReviewer().getId());
    waitForTermStatus(term.getId(), EntityStatus.IN_REVIEW);

    replaceReviewers(term.getId(), firstReviewer(), secondReviewer());

    Task settledTask =
        awaitSingleOpenApprovalTaskAssignedTo(term.getFullyQualifiedName(), secondReviewer());
    assertAssigneesContain(settledTask, secondReviewer().getId());
    waitForTermStatus(term.getId(), EntityStatus.IN_REVIEW);
  }

  private Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("revchg"))
            .withDescription("Glossary for reviewer-change approval test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTermWithReviewers(Glossary glossary, String name, User... reviewers) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            // A non-empty description is required to pass CheckGlossaryTermIsReadyToBeReviewed.
            .withDescription("Term created by reviewer-change approval test")
            .withReviewers(entityReferences(reviewers));
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private void replaceReviewers(UUID termId, User... reviewers) throws Exception {
    StringBuilder value = new StringBuilder("[");
    for (int i = 0; i < reviewers.length; i++) {
      if (i > 0) {
        value.append(',');
      }
      value.append(String.format("{\"id\":\"%s\",\"type\":\"user\"}", reviewers[i].getId()));
    }
    value.append(']');
    JsonNode patch =
        new ObjectMapper()
            .readTree(
                String.format(
                    "[{\"op\":\"replace\",\"path\":\"/reviewers\",\"value\":%s}]", value));
    SdkClients.adminClient().glossaryTerms().patch(termId.toString(), patch);
  }

  private Task awaitOpenApprovalTask(String termFqn) {
    Awaitility.await("open approval task for " + termFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> !openApprovalTasks(termFqn).isEmpty());
    Task task = openApprovalTasks(termFqn).get(0);
    assertNotNull(task.getId());
    return task;
  }

  /**
   * Waits until exactly one open approval task exists for the term and it is assigned to {@code
   * newReviewer}, then returns it. This is the acceptance criterion: after a reviewer change the
   * workflow must settle on a single open task carrying the new reviewers, not a duplicate or a
   * stale assignee set.
   */
  private Task awaitSingleOpenApprovalTaskAssignedTo(String termFqn, User newReviewer) {
    Awaitility.await("single open approval task assigned to " + newReviewer.getId())
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .until(
            () -> {
              List<Task> tasks = openApprovalTasks(termFqn);
              return tasks.size() == 1
                  && entityReferenceIds(tasks.get(0).getAssignees()).contains(newReviewer.getId());
            });
    List<Task> tasks = openApprovalTasks(termFqn);
    assertEquals(
        1,
        tasks.size(),
        "Expected exactly one open approval task for "
            + termFqn
            + " after the reviewer change, but found "
            + tasks.size());
    return tasks.get(0);
  }

  private List<Task> openApprovalTasks(String termFqn) {
    List<Task> tasks;
    try {
      ListResponse<Task> response =
          SdkClients.adminClient()
              .tasks()
              .listWithFilters(
                  Map.of(
                      "limit",
                      "100",
                      "status",
                      TaskEntityStatus.Open.value(),
                      "aboutEntity",
                      termFqn));
      tasks = response.getData() == null ? List.of() : response.getData();
    } catch (RuntimeException e) {
      tasks = List.of();
    }
    return tasks;
  }

  private void assertAssigneesContain(Task task, UUID userId) {
    Set<UUID> assigneeIds = entityReferenceIds(task.getAssignees());
    assertTrue(
        assigneeIds.contains(userId),
        "Approval task "
            + task.getId()
            + " should be assigned to "
            + userId
            + " but assignees were "
            + assigneeIds);
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

  private List<EntityReference> entityReferences(User... users) {
    return Arrays.stream(users).map(User::getEntityReference).collect(Collectors.toList());
  }

  private Set<UUID> entityReferenceIds(List<EntityReference> references) {
    return references == null
        ? Set.of()
        : references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }
}
