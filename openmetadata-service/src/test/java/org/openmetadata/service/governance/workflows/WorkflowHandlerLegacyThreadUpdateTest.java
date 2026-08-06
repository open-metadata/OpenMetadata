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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Regression guard for the multi-reviewer intermediate-vote UX bug fixed by routing the legacy
 * thread write through {@code FeedRepository.updateLegacyThread(...)}. Before the fix the write
 * used the 2-arg {@code feedDAO().update(UUID id, String json)} overload whose SQL hardcodes
 * {@code UPDATE thread_entity} — a table renamed to {@code thread_entity_legacy} by the 2.0
 * migration. The write throws {@code Table 'thread_entity' doesn't exist} and gets silently
 * swallowed by the surrounding catch, leaving the voter stuck in {@code task.assignees} and
 * emitting an ERROR per vote. A full behavioural repro would require a live Flowable process
 * instance plus a JDBC handle bound to the legacy schema; source-level assertions lock the fix
 * cheaply against future regressions where an autocomplete or refactor slips the broken overload
 * back in.
 */
class WorkflowHandlerLegacyThreadUpdateTest {

  private static final Path WORKFLOW_HANDLER =
      Paths.get("src/main/java/org/openmetadata/service/governance/workflows/WorkflowHandler.java");

  private static final Pattern HARDCODED_UPDATE_CALL =
      Pattern.compile("dao\\.feedDAO\\(\\)\\s*\\.update\\s*\\(\\s*finalTaskThread");

  @Test
  void removeTaskFromVoterFeedForLegacyThreadRoutesThroughFeedRepository() throws IOException {
    String legacyBranch = extractLegacyBranch(Files.readString(WORKFLOW_HANDLER));

    assertTrue(
        legacyBranch.contains("feedRepository.updateLegacyThread(taskThread)"),
        "removeTaskFromVoterFeedForLegacyThread must persist voter cleanup via "
            + "feedRepository.updateLegacyThread(...) so the write hits the resolver-picked "
            + "legacy table (thread_entity_legacy on 2.0, thread_entity_archived on 2.1+).");
  }

  @Test
  void removeTaskFromVoterFeedForLegacyThreadDoesNotCallHardcodedFeedDAOUpdate()
      throws IOException {
    String legacyBranch = extractLegacyBranch(Files.readString(WORKFLOW_HANDLER));

    assertFalse(
        HARDCODED_UPDATE_CALL.matcher(legacyBranch).find(),
        "removeTaskFromVoterFeedForLegacyThread must not call the 2-arg feedDAO().update("
            + "UUID id, String json) overload — its SQL hardcodes 'UPDATE thread_entity' which "
            + "no longer exists after the 2.0 migration renames the table.");
  }

  private static String extractLegacyBranch(String source) {
    int start = source.indexOf("private void removeTaskFromVoterFeedForLegacyThread(");
    assertTrue(start >= 0, "removeTaskFromVoterFeedForLegacyThread must exist in WorkflowHandler");
    int end = source.indexOf("private void removeTaskFromVoterFeedForTaskEntity(", start);
    assertTrue(end > start, "removeTaskFromVoterFeedForTaskEntity must follow the legacy branch");
    return source.substring(start, end);
  }
}
