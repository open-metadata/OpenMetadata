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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.junit.jupiter.api.Test;

/**
 * Regression guard for the spurious 409 on the second user-task transition of a workflow that has an
 * async {@code automatedTask} between two user tasks (Collate's DataAccessRequest workflow:
 * {@code TaskReview --approve--> PolicyAgent(async) --> ApprovedAccess --markAsGranted-->}).
 *
 * <p>{@code CreateTask.notify()} runs as a TaskListener inside the Flowable command that creates the
 * next runtime user task, but on the update path it persisted the entity's {@code workflowStageId} /
 * {@code availableTransitions} via {@code taskRepository.update(...)} — which commits on JDBI's own
 * connection <b>mid-command</b>, milliseconds before Flowable commits the {@code ACT_RU_TASK} row and
 * the {@code customTaskId} variable. A client polling {@code availableTransitions} could therefore
 * see (e.g.) {@code markAsGranted} advertised and resolve into a not-yet-committed runtime task —
 * the resolve found no task, completed with no variables, and the outgoing gateway condition
 * {@code ${<node>_result == '<transition>'}} evaluated an unbound variable → FlowableException → 409.
 *
 * <p>The fix defers the update-path persist to a Flowable post-commit transaction listener
 * ({@code TransactionState.COMMITTED}) so the entity state is only advanced once the runtime task it
 * advertises is durable. This is non-blocking — the write is reordered, never waited on; the request
 * thread never sleeps or polls. Behavioural acceptance lives in the Collate DAR integration tests
 * (DarStatusGroupIT / DataAccessRequestValidationIT / DataAccessRequestIT).
 */
class CreateTaskPostCommitPersistTest {

  private static final Path CREATE_TASK =
      Paths.get(
          "src/main/java/org/openmetadata/service/governance/workflows/elements/nodes/userTask/CreateTask.java");

  private static final Path TASK_WORKFLOW_HANDLER =
      Paths.get("src/main/java/org/openmetadata/service/tasks/TaskWorkflowHandler.java");

  @Test
  void updatePathPersistsAfterFlowableCommit() throws IOException {
    String source = Files.readString(CREATE_TASK);

    assertTrue(
        source.contains("registerPostCommitPersist("),
        "CreateTask update path must defer the entity persist via registerPostCommitPersist so "
            + "stage/availableTransitions never lead the committed Flowable runtime task.");
    assertFalse(
        source.contains("return taskRepository.update(null, currentTask, updatedTask, updatedBy)"),
        "CreateTask update path must not persist inline with taskRepository.update(...) — the JDBI "
            + "commit lands mid-command, advertising the next transition before the runtime task "
            + "exists (the spurious-409 race).");
  }

  @Test
  void postCommitPersistUsesCommittedTransactionState() throws IOException {
    String body = methodBody(Files.readString(CREATE_TASK), "void registerPostCommitPersist(");

    assertTrue(
        body.contains("addTransactionListener(") && body.contains("TransactionState.COMMITTED"),
        "registerPostCommitPersist must register a TransactionState.COMMITTED listener so the "
            + "persist runs only after the Flowable transaction commits (and is skipped on "
            + "rollback), never blocking the request thread.");
    assertFalse(
        body.contains("Thread.sleep"),
        "the post-commit persist must not block or wait — it reorders the write, it does not sleep "
            + "or poll for the async executor.");
  }

  @Test
  void resolveWorkflowTaskTreatsNullNamespaceMapAsFailure() throws IOException {
    String source = Files.readString(TASK_WORKFLOW_HANDLER);

    assertTrue(
        source.contains("namespacedVariables != null && workflowHandler.resolveTask("),
        "resolveWorkflowTask must treat a null namespace map as a failed resolve — completing with "
            + "no variables would drop the transition result and mis-evaluate the outgoing gateway.");
  }

  private static String methodBody(String source, String declaration) {
    int start = source.indexOf(declaration);
    assertTrue(start >= 0, declaration + " must exist in CreateTask");
    int brace = source.indexOf('{', start);
    assertTrue(brace > start, declaration + " must have a body");
    int depth = 0;
    int end = brace;
    for (int i = brace; i < source.length(); i++) {
      char c = source.charAt(i);
      if (c == '{') {
        depth++;
      } else if (c == '}') {
        depth--;
        if (depth == 0) {
          end = i;
          break;
        }
      }
    }
    return source.substring(brace, end + 1);
  }
}
