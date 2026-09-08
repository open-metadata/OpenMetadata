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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
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
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;

/**
 * Guards {@code GlossaryTermRepository.updateTaskWithNewReviewers} wiring: when a glossary term's
 * reviewers change, the repository must patch the term's OPEN approval task assignees in place
 * (preserving the task id and its comment history), matching the {@code TagRepository} pattern.
 *
 * <p>The decisive signal is that the ORIGINAL approval task — fetched by its id — carries the newly
 * added reviewer as an assignee. The seeded Glossary Approval Workflow is a separate safety net that
 * re-triggers on a reviewers change and SUPERSEDES the task with a NEW one (a new task id), so it can
 * never patch the original task's assignees. If {@code GlossaryTermUpdater.updateReviewers} did not
 * call {@code updateTaskWithNewReviewers}, the original task would keep its stale single-reviewer
 * assignee set even though the workflow opened a fresh task elsewhere. This test therefore isolates
 * the repository mechanism from the workflow safety net without disabling the seeded workflow.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermReviewerTaskSyncIT {

  private static final Duration TASK_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration SYNC_TIMEOUT = Duration.ofMinutes(2);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  /** Initial reviewer that receives the first open approval task. */
  protected User firstReviewer() {
    return shared().USER1;
  }

  /** Reviewer added later; the open task's assignees must be patched to include it. */
  protected User addedReviewer() {
    return shared().USER2;
  }

  @Test
  void test_addingReviewer_patchesOpenApprovalTaskAssigneesInPlace(TestNamespace ns)
      throws Exception {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTermWithReviewer(glossary, ns.shortPrefix("sync_term"));

    Task openTask = waitForOpenApprovalTask(term.getFullyQualifiedName());
    UUID openTaskId = openTask.getId();
    assertTrue(
        assigneeIds(openTask).contains(firstReviewer().getId()),
        "Initial approval task should be assigned to the first reviewer, but assignees were "
            + assigneeIds(openTask));

    addReviewerToTerm(term.getId());

    Awaitility.await(
            "original approval task "
                + openTaskId
                + " should be patched in place to include the added reviewer")
        .atMost(SYNC_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              Task patched = getTask(openTaskId);
              assertTrue(
                  assigneeIds(patched).contains(addedReviewer().getId()),
                  "The repository must patch the ORIGINAL approval task's assignees to include the "
                      + "added reviewer "
                      + addedReviewer().getId()
                      + " (task id "
                      + openTaskId
                      + " preserved), but assignees were "
                      + assigneeIds(patched));
            });
  }

  private Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("rvsync"))
            .withDescription("Glossary for reviewer/approval-task sync test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTermWithReviewer(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term created by reviewer/approval-task sync test")
            .withReviewers(List.of(firstReviewer().getEntityReference()));
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private void addReviewerToTerm(UUID termId) throws Exception {
    String patch =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/reviewers\",\"value\":"
                + "[{\"id\":\"%s\",\"type\":\"user\"},{\"id\":\"%s\",\"type\":\"user\"}]}]",
            firstReviewer().getId(), addedReviewer().getId());
    SdkClients.adminClient()
        .glossaryTerms()
        .patch(termId.toString(), new ObjectMapper().readTree(patch));
  }

  private Task getTask(UUID taskId) {
    return SdkClients.adminClient().tasks().get(taskId.toString(), "*");
  }

  private Task waitForOpenApprovalTask(String aboutFqn) {
    Map<String, String> filters =
        Map.of("limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", aboutFqn);
    Awaitility.await("wait for open glossary approval task for " + aboutFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertFalse(
                    listTasks(filters).isEmpty(),
                    "No open approval task was created for " + aboutFqn));
    List<Task> tasks = listTasks(filters);
    assertFalse(tasks.isEmpty(), "Expected an open approval task for " + aboutFqn);
    Task task = tasks.get(0);
    assertNotNull(task.getId());
    return task;
  }

  private List<Task> listTasks(Map<String, String> filters) {
    ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
    return response.getData() == null ? List.of() : response.getData();
  }

  private Set<UUID> assigneeIds(Task task) {
    List<EntityReference> assignees = task.getAssignees();
    return assignees == null
        ? Set.of()
        : assignees.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }
}
