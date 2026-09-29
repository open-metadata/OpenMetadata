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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.Entity;

/**
 * Hard-deleting an entity must also remove the Task 2.0 artifacts that are about it.
 *
 * <p>In the pre-2.0 thread model a task was a {@code thread_entity} row, so the entity delete path's
 * {@code FeedRepository.deleteByAbout} removed it. Task 2.0 moved tasks into {@code task_entity} but
 * did not port that cleanup, so hard-deleting the target left an Open task behind whose {@code about}
 * no longer resolved — an orphan that could not be resolved, cancelled or cleared.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
public class EntityDeleteTaskCleanupIT {

  private static final Duration TASK_TIMEOUT = Duration.ofMinutes(5);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  @Test
  void hardDelete_removesOpenTasksAboutTheEntity(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTermWithReviewer(glossary, "orphan_task_target");
    String termFqn = term.getFullyQualifiedName();

    Task approvalTask = waitForOpenTaskAbout(termFqn);
    assertNotNull(approvalTask.getId(), "Expected an open approval task about " + termFqn);

    SdkClients.adminClient()
        .glossaryTerms()
        .delete(term.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    Awaitility.await("open tasks about " + termFqn + " are removed after the term is hard-deleted")
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertTrue(
                    listOpenTasksAbout(termFqn).isEmpty(),
                    "Hard-deleting the term must delete the task about it, but it survived as an "
                        + "orphan with a dangling 'about'"));
  }

  @Test
  void softDelete_keepsTasksAboutTheEntity(TestNamespace ns) {
    Glossary glossary = createGlossary(ns);
    GlossaryTerm term = createTermWithReviewer(glossary, "soft_delete_task_target");
    String termFqn = term.getFullyQualifiedName();

    Task approvalTask = waitForOpenTaskAbout(termFqn);
    assertNotNull(approvalTask.getId(), "Expected an open approval task about " + termFqn);

    SdkClients.adminClient()
        .glossaryTerms()
        .delete(term.getId().toString(), Map.of("hardDelete", "false", "recursive", "true"));

    // A soft delete keeps the row and its relationships, so the task stays recoverable.
    Task afterSoftDelete = SdkClients.adminClient().tasks().get(approvalTask.getId().toString());
    assertNotNull(afterSoftDelete, "A soft delete must not remove the task about the entity");
  }

  private Glossary createGlossary(TestNamespace ns) {
    CreateGlossary create =
        new CreateGlossary()
            .withName(ns.shortPrefix("edtc"))
            .withDescription("Glossary for entity-delete task cleanup test");
    return ns.trackRoot(Entity.GLOSSARY, SdkClients.adminClient().glossaries().create(create));
  }

  private GlossaryTerm createTermWithReviewer(Glossary glossary, String name) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withName(name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withDescription("Term whose open task must be cleaned up on delete")
            .withReviewers(List.of(SharedEntities.get().USER1.getEntityReference()));
    return SdkClients.adminClient().glossaryTerms().create(create);
  }

  private Task waitForOpenTaskAbout(String aboutFqn) {
    Awaitility.await("wait for the open approval task about " + aboutFqn)
        .atMost(TASK_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .ignoreExceptions()
        .untilAsserted(
            () ->
                assertFalse(
                    listOpenTasksAbout(aboutFqn).isEmpty(),
                    "No open approval task was created for " + aboutFqn));
    return listOpenTasksAbout(aboutFqn).get(0);
  }

  private List<Task> listOpenTasksAbout(String aboutFqn) {
    Map<String, String> filters =
        Map.of("limit", "100", "status", TaskEntityStatus.Open.value(), "aboutEntity", aboutFqn);
    ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filters);
    return response.getData() == null ? List.of() : response.getData();
  }
}
