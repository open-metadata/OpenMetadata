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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.PASSWORD;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrateRepositoryTables;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.net.URI;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import org.flowable.engine.ProcessEngineConfiguration;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.governance.workflows.OntologyReviewReconciler;
import org.openmetadata.service.governance.workflows.OntologyWorkflowDecision;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowHandler.TaskResolutionOutcome;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReview;

class OntologyEntityDAOTest {
  private static final URI NAMESPACE = URI.create("https://example.org/sales/");

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void migrationResetsOnlyUnreleasedGlossaryAxioms(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrateRepositoryTables(handle, dialect);
          final var axiomId = UUID.randomUUID();
          final var glossaryId = UUID.randomUUID();
          String legacy =
              """
              {"id":"%s","name":"legacy","glossary":{"id":"%s"},
               "axiomType":"SubClassOf","entityStatus":"Draft","updatedAt":1,
               "updatedBy":"admin","deleted":false}
              """
                  .formatted(axiomId, glossaryId);
          handle
              .createUpdate(
                  "INSERT INTO ontology_axiom_entity (fqnHash, json) VALUES (:hash, "
                      + (dialect == ConnectionType.POSTGRES ? "CAST(:json AS JSONB)" : ":json")
                      + ")")
              .bind("hash", "legacy-axiom")
              .bind("json", legacy)
              .execute();
          handle
              .createUpdate(
                  "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (:parent, :child, 'glossary', 'ontologyAxiom', 0)")
              .bind("parent", glossaryId.toString())
              .bind("child", axiomId.toString())
              .execute();
          handle
              .createUpdate(
                  "INSERT INTO entity_extension (id, extension, jsonSchema, json) VALUES (:id, 'ontologyAxiom.version.0.1', 'ontologyAxiom', "
                      + (dialect == ConnectionType.POSTGRES ? "CAST(:json AS JSONB)" : ":json")
                      + ")")
              .bind("id", axiomId.toString())
              .bind("json", legacy)
              .execute();
          migrate(handle, dialect);
          assertEquals(
              0,
              handle
                  .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE fromId = :id")
                  .bind("id", glossaryId.toString())
                  .mapTo(Integer.class)
                  .one());
          assertEquals(
              0,
              handle
                  .createQuery("SELECT COUNT(*) FROM entity_extension WHERE id = :id")
                  .bind("id", axiomId.toString())
                  .mapTo(Integer.class)
                  .one());
          assertEquals(
              0,
              handle
                  .createQuery("SELECT COUNT(*) FROM ontology_axiom_entity")
                  .mapTo(Integer.class)
                  .one());
          Ontology ontology = ontology();
          handle
              .attach(CollectionDAO.class)
              .ontologyEntityDAO()
              .insert(ontology, ontology.getFullyQualifiedName());
          handle
              .createUpdate(
                  "INSERT INTO ontology_axiom_entity (fqnHash, json) VALUES (:hash, "
                      + (dialect == ConnectionType.POSTGRES ? "CAST(:json AS JSONB)" : ":json")
                      + ")")
              .bind("hash", "native-axiom")
              .bind("json", legacy.replace("glossary", "ontology"))
              .execute();
          migrate(handle, dialect);
          assertEquals(
              ontology,
              handle
                  .attach(CollectionDAO.class)
                  .ontologyEntityDAO()
                  .findEntityById(ontology.getId()));
          assertEquals(
              1,
              handle
                  .createQuery("SELECT COUNT(*) FROM ontology_axiom_entity")
                  .mapTo(Integer.class)
                  .one());
          String listingIndexes =
              "('ontology_concept_listing_index', 'ontology_property_listing_index', 'ontology_axiom_listing_index')";
          String indexQuery =
              dialect == ConnectionType.MYSQL
                  ? "SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name IN "
                  : "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = current_schema() AND indexname IN ";
          assertEquals(
              3, handle.createQuery(indexQuery + listingIndexes).mapTo(Integer.class).one());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void migrationPreservesTermChangeSetsWhileResettingLegacyAxiomOperations(ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          migrateRepositoryTables(handle, dialect);
          final String jsonValue =
              dialect == ConnectionType.POSTGRES ? "CAST(:json AS JSONB)" : ":json";
          final var glossaryId = UUID.randomUUID().toString();
          for (String operation :
              List.of("UPSERT_AXIOM", "DELETE_AXIOM", "UPSERT_TERM", "NATIVE_UPSERT_AXIOM")) {
            final String id = UUID.randomUUID().toString();
            final boolean nativeDraft = operation.startsWith("NATIVE_");
            final String json =
                """
                {"id":"%s","name":"%s",%s"state":"DRAFT","updatedAt":1,
                 "updatedBy":"admin","deleted":false,"operations":[{"operationType":"%s"}]}
                """
                    .formatted(
                        id,
                        operation,
                        nativeDraft ? "\"ontology\":{\"id\":\"" + glossaryId + "\"}," : "",
                        operation.replace("NATIVE_", ""));
            handle
                .createUpdate(
                    "INSERT INTO ontology_change_set_entity (fqnHash, json) VALUES (:hash, "
                        + jsonValue
                        + ")")
                .bind("hash", operation)
                .bind("json", json)
                .execute();
            handle
                .createUpdate(
                    "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (:parent, :child, :parentType, 'ontologyChangeSet', 0)")
                .bind("parent", glossaryId)
                .bind("child", id)
                .bind("parentType", nativeDraft ? "ontology" : "glossary")
                .execute();
            handle
                .createUpdate(
                    "INSERT INTO entity_extension (id, extension, jsonSchema, json) VALUES (:id, 'ontologyChangeSet.version.0.1', 'ontologyChangeSet', "
                        + jsonValue
                        + ")")
                .bind("id", id)
                .bind("json", json)
                .execute();
          }
          migrate(handle, dialect);
          migrate(handle, dialect);
          assertEquals(
              List.of("NATIVE_UPSERT_AXIOM", "UPSERT_TERM"),
              handle
                  .createQuery("SELECT name FROM ontology_change_set_entity ORDER BY name")
                  .mapTo(String.class)
                  .list());
          assertEquals(
              2,
              handle
                  .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE fromId = :id")
                  .bind("id", glossaryId)
                  .mapTo(Integer.class)
                  .one());
          assertEquals(
              2,
              handle
                  .createQuery(
                      "SELECT COUNT(*) FROM entity_extension WHERE jsonSchema = 'ontologyChangeSet'")
                  .mapTo(Integer.class)
                  .one());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void storesIndependentEntitiesThroughStandardDaos(ConnectionType dialect) {
    withDatabase(dialect, handle -> assertStorageContract(handle, dialect));
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void existingWorkflowEngineCountsDistinctVotesAndFailsClosed(ConnectionType dialect) {
    withDatabase(dialect, handle -> assertWorkflowVoting(handle, dialect));
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void cancellingTheCurrentReviewReturnsTheDefinitionToDraft(ConnectionType dialect) {
    withReviewRepositories(
        dialect,
        fixture -> {
          Task cancelled = fixture.cancel();
          OntologyRelease definition = fixture.definition();
          assertEquals(TaskEntityStatus.Cancelled, cancelled.getStatus());
          assertEquals(EntityStatus.DRAFT, definition.getEntityStatus());
          assertNull(definition.getReviewTask());
          assertEquals(1L, definition.getReleaseRevision());
          assertEquals("admin", definition.getReviewAuthor());
          Task closedAgain =
              fixture
                  .tasks()
                  .resolveTask(
                      cancelled,
                      new TaskResolution()
                          .withType(TaskResolutionType.Cancelled)
                          .withComment("A repeated cancellation must preserve the first decision"),
                      "admin");
          assertEquals(cancelled.getResolution(), closedAgain.getResolution());
          assertEquals(cancelled.getVersion(), closedAgain.getVersion());
          assertThrows(
              BadRequestException.class,
              () -> fixture.tasks().reopenTaskWithWorkflow(cancelled, "admin"));
          assertEquals(TaskEntityStatus.Cancelled, fixture.storedTask().getStatus());
          assertEquals(EntityStatus.DRAFT, fixture.definition().getEntityStatus());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void cancellingASupersededReviewDoesNotChangeTheNewReview(ConnectionType dialect) {
    withReviewRepositories(
        dialect,
        fixture -> {
          OntologyRelease newer = fixture.definition().withReviewTask(UUID.randomUUID());
          Entity.getCollectionDAO().ontologyReleaseDAO().update(newer);
          fixture.cancel();
          assertEquals(newer, fixture.definition());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void cancellationRollsBackWithItsTaskAndRejectsStaleTaskWrites(ConnectionType dialect) {
    withReviewRepositories(
        dialect,
        fixture -> {
          assertThrows(
              IllegalStateException.class,
              () ->
                  fixture
                      .tasks()
                      .executeInTransaction(
                          () -> {
                            fixture.cancel();
                            throw new IllegalStateException("Roll back task cancellation");
                          }));
          assertEquals(TaskEntityStatus.Open, fixture.storedTask().getStatus());
          assertEquals(EntityStatus.IN_REVIEW, fixture.definition().getEntityStatus());
          assertNull(
              Entity.getCollectionDAO()
                  .entityExtensionDAO()
                  .getExtension(fixture.task().getId(), OntologyReviewReconciler.EXTENSION));
          fixture.cancel();
          assertNotNull(
              Entity.getCollectionDAO()
                  .entityExtensionDAO()
                  .getExtension(fixture.task().getId(), OntologyReviewReconciler.EXTENSION));
          assertThrows(
              PreconditionFailedException.class,
              () ->
                  fixture
                      .tasks()
                      .update(
                          null,
                          fixture.task(),
                          JsonUtils.deepCopy(fixture.task(), Task.class)
                              .withDescription("Late task edit"),
                          "admin"));
          assertEquals(TaskEntityStatus.Cancelled, fixture.storedTask().getStatus());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void cancellationCannotHoldADefinitionWhileWaitingForItsModule(ConnectionType dialect) {
    withReviewRepositories(
        dialect,
        (handle, fixture) -> {
          CollectionDAO dao = Entity.getCollectionDAO();
          dao.ontologyStateDAO().initialize(fixture.ontologyId());
          try (var executor = Executors.newSingleThreadExecutor()) {
            handle.begin();
            handle.attach(CollectionDAO.class).ontologyStateDAO().lock(fixture.ontologyId());
            final CountDownLatch waitingForModule = signalModuleLock(handle);
            var cancellation = executor.submit(fixture::cancel);
            try {
              assertTrue(assertDoesNotThrow(() -> waitingForModule.await(10, TimeUnit.SECONDS)));
              assertDoesNotThrow(
                  () ->
                      handle
                          .createQuery(
                              "SELECT json FROM ontology_entity WHERE id = :id FOR UPDATE NOWAIT")
                          .bind("id", fixture.ontologyId().toString())
                          .mapTo(String.class)
                          .one());
            } finally {
              handle.rollback();
            }
            assertEquals(
                TaskEntityStatus.Cancelled,
                assertDoesNotThrow(() -> cancellation.get(10, TimeUnit.SECONDS)).getStatus());
            assertEquals(EntityStatus.DRAFT, fixture.definition().getEntityStatus());
          }
        });
  }

  @ParameterizedTest
  @CsvSource({"MYSQL,false", "MYSQL,true", "POSTGRES,false", "POSTGRES,true"})
  void reviewLocksSeeEditsAndArchivalCommittedWhileWaiting(
      ConnectionType dialect, boolean archived) {
    withReviewRepositories(
        dialect,
        (handle, fixture) -> {
          final var dao = Entity.getCollectionDAO();
          final var repository =
              (OntologyReleaseRepository) Entity.getEntityRepository(Entity.ONTOLOGY_RELEASE);
          dao.workflowDefinitionDAO()
              .insert(
                  new WorkflowDefinition()
                      .withId(fixture.task().getWorkflowDefinitionId())
                      .withName("review")
                      .withVersion(0.1)
                      .withUpdatedAt(1L)
                      .withUpdatedBy("admin"),
                  "review");
          final OntologyRelease changed =
              fixture.definition().withVersion(0.2).withDeleted(archived);
          dao.ontologyStateDAO().initialize(fixture.ontologyId());
          try (var executor = Executors.newSingleThreadExecutor()) {
            handle.begin();
            handle.attach(CollectionDAO.class).ontologyStateDAO().lock(fixture.ontologyId());
            final CountDownLatch waitingForModule = signalModuleLock(handle);
            final var review =
                executor.submit(
                    () ->
                        repository.executeInTransaction(
                            () -> {
                              repository.lockReviewTarget(fixture.task());
                              return repository.get(
                                  null,
                                  fixture.task().getAbout().getId(),
                                  repository.getFields(""),
                                  Include.NON_DELETED,
                                  false);
                            }));
            try {
              assertTrue(assertDoesNotThrow(() -> waitingForModule.await(10, TimeUnit.SECONDS)));
              handle.attach(CollectionDAO.class).ontologyReleaseDAO().update(changed);
              handle.commit();
            } finally {
              if (handle.isInTransaction()) {
                handle.rollback();
              }
            }
            if (archived) {
              assertTrue(
                  assertThrows(ExecutionException.class, () -> review.get(10, TimeUnit.SECONDS))
                          .getCause()
                      instanceof EntityNotFoundException);
            } else {
              assertEquals(
                  changed.getVersion(),
                  assertDoesNotThrow(() -> review.get(10, TimeUnit.SECONDS)).getVersion());
            }
          }
        });
  }

  private static CountDownLatch signalModuleLock(final Handle handle) {
    final var waiting = new CountDownLatch(1);
    handle
        .getJdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(StatementContext context) {
                if (context.getRenderedSql().contains("ontology_state")) {
                  waiting.countDown();
                }
              }
            });
    return waiting;
  }

  private record ReviewFixture(TaskRepository tasks, Task task, UUID ontologyId) {
    Task cancel() {
      return tasks
          .update(
              null,
              task,
              JsonUtils.deepCopy(task, Task.class)
                  .withStatus(TaskEntityStatus.Cancelled)
                  .withResolution(new TaskResolution().withType(TaskResolutionType.Cancelled)),
              "admin")
          .getEntity();
    }

    OntologyRelease definition() {
      return Entity.getCollectionDAO().ontologyReleaseDAO().findEntityById(task.getAbout().getId());
    }

    Task storedTask() {
      return Entity.getCollectionDAO().taskDAO().findEntityById(task.getId());
    }
  }

  private static void withReviewRepositories(
      ConnectionType dialect, Consumer<ReviewFixture> assertion) {
    withReviewRepositories(dialect, (handle, fixture) -> assertion.accept(fixture));
  }

  private static void withReviewRepositories(
      ConnectionType dialect, BiConsumer<Handle, ReviewFixture> assertion) {
    withDatabase(
        dialect,
        handle -> {
          migrate(handle, dialect);
          migrateRepositoryTables(handle, dialect);
          CollectionDAO previous = Entity.getCollectionDAO();
          SystemRepository previousSettings = Entity.getSystemRepository();
          EntityRelationshipRepository previousRelationships =
              Entity.getEntityRelationshipRepository();
          Entity.setCollectionDAO(handle.getJdbi().onDemand(CollectionDAO.class));
          Entity.setEntityRelationshipRepository(
              new EntityRelationshipRepository(Entity.getCollectionDAO()));
          try {
            new SystemRepository();
            new WorkflowDefinitionRepository();
            new OntologyRepository();
            new OntologyReleaseRepository();
            assertion.accept(handle, reviewFixture(new TaskRepository()));
          } finally {
            Entity.setCollectionDAO(previous);
            Entity.setSystemRepository(previousSettings);
            Entity.setEntityRelationshipRepository(previousRelationships);
          }
        });
  }

  private static ReviewFixture reviewFixture(TaskRepository tasks) {
    UUID taskId = UUID.randomUUID();
    String name = "Review" + taskId;
    Ontology root = ontology();
    Entity.getCollectionDAO().ontologyEntityDAO().insert(root, root.getFullyQualifiedName());
    OntologyRelease definition =
        new OntologyRelease()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withOntology(root.getEntityReference())
            .withReleaseRevision(1L)
            .withSourceWorkingRevision(0L)
            .withVersion(0.1)
            .withUpdatedBy("admin")
            .withUpdatedAt(1L)
            .withEntityStatus(EntityStatus.IN_REVIEW)
            .withReviewAuthor("admin")
            .withReviewTask(taskId);
    Entity.getCollectionDAO().ontologyReleaseDAO().insert(definition, name);
    Task task =
        new Task()
            .withId(taskId)
            .withName(name)
            .withTaskId("TASK-" + taskId.toString().substring(0, 8))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.RequestApproval)
            .withStatus(TaskEntityStatus.Open)
            .withAbout(definition.getEntityReference())
            .withOntologyReview(OntologyReview.target(definition))
            .withWorkflowDefinitionId(UUID.randomUUID())
            .withVersion(0.1)
            .withCreatedAt(1L)
            .withUpdatedAt(1L)
            .withUpdatedBy("admin");
    tasks.setFullyQualifiedName(task);
    Entity.getCollectionDAO()
        .taskDAO()
        .insertTask(
            task.getId().toString(),
            JsonUtils.pojoToJson(JsonUtils.deepCopy(task, Task.class).withAbout(null)),
            task.getFullyQualifiedName());
    tasks.addRelationship(
        definition.getId(),
        taskId,
        Entity.ONTOLOGY_RELEASE,
        Entity.TASK,
        Relationship.MENTIONED_IN);
    return new ReviewFixture(tasks, task, root.getId());
  }

  private static void assertWorkflowVoting(Handle handle, ConnectionType dialect) {
    migrateRepositoryTables(handle, dialect);
    CollectionDAO previousDao = Entity.getCollectionDAO();
    SystemRepository previousSettings = Entity.getSystemRepository();
    Entity.setCollectionDAO(handle.attach(CollectionDAO.class));
    new SystemRepository();
    try {
      WorkflowHandler.initialize(workflowConfig(handle, dialect), true);
      WorkflowHandler workflow = WorkflowHandler.getInstance();
      ProcessEngineConfiguration engine = workflow.getProcessEngineConfiguration();
      engine
          .getRepositoryService()
          .createDeployment()
          .addString("ontology-vote-test.bpmn20.xml", votingProcess())
          .deploy();
      UUID taskId = UUID.randomUUID();
      engine
          .getRuntimeService()
          .startProcessInstanceByKey(
              "ontologyVoteTest",
              Map.of(
                  "customTaskId",
                  taskId.toString(),
                  "approvalThreshold",
                  2,
                  "rejectionThreshold",
                  1));

      assertEquals(
          TaskResolutionOutcome.WAITING_FOR_VOTES,
          workflow.resolveTaskOutcome(taskId, vote("alice")));
      assertEquals(List.of("alice"), workflow.approvalTaskContext(taskId).voters());
      assertEquals("Review", workflow.approvalTaskContext(taskId).nodeName());
      assertEquals(
          TaskResolutionOutcome.WAITING_FOR_VOTES,
          workflow.resolveTaskOutcome(taskId, vote("alice")));
      assertEquals(List.of("alice"), workflow.approvalTaskContext(taskId).voters());
      assertEquals(
          TaskResolutionOutcome.COMPLETED, workflow.resolveTaskOutcome(taskId, vote("bob")));
      assertEquals(
          0,
          engine
              .getTaskService()
              .createTaskQuery()
              .processVariableValueEquals("customTaskId", taskId.toString())
              .count());
      assertEquals(
          TaskResolutionOutcome.RESOLUTION_FAILED,
          workflow.resolveTaskOutcome(taskId, vote("bob")));
      assertContinuingWorkflowIsNotComplete(workflow, engine);
      assertFailedWorkflowIsNotComplete(workflow, engine);
      assertLegacyApprovalCompletesWhenTheProcessFails(workflow, engine);
      assertDecisionSurvivesAsyncCompletion(workflow, engine);
    } finally {
      WorkflowHandler.shutDown();
      Entity.setCollectionDAO(previousDao);
      Entity.setSystemRepository(previousSettings);
    }
  }

  private static void assertDecisionSurvivesAsyncCompletion(
      WorkflowHandler workflow, ProcessEngineConfiguration engine) {
    String process =
        votingProcess()
            .replace("ontologyVoteTest", "ontologyAsyncReview")
            .replace("targetRef=\"end\"", "targetRef=\"afterReview\"")
            .replace(
                "<endEvent id=\"end\"/>",
                "<receiveTask id=\"afterReview\"/><sequenceFlow id=\"finish\" sourceRef=\"afterReview\" targetRef=\"end\"/><endEvent id=\"end\"/>");
    engine
        .getRepositoryService()
        .createDeployment()
        .addString("ontology-async-review.bpmn20.xml", process)
        .deploy();
    UUID taskId = UUID.randomUUID();
    OntologyWorkflowDecision decision =
        new OntologyWorkflowDecision(
            taskId,
            OntologyReview.target(
                new OntologyRelease()
                    .withId(UUID.randomUUID())
                    .withOntology(reference(ontology()))
                    .withVersion(0.1)
                    .withReviewAuthor("author")),
            TaskResolutionType.Approved,
            "bob",
            List.of("bob"),
            null,
            "Approved before async work");
    String processId =
        engine
            .getRuntimeService()
            .startProcessInstanceByKey(
                "ontologyAsyncReview",
                Map.of("customTaskId", taskId.toString(), "approvalThreshold", 2))
            .getId();
    assertEquals(
        TaskResolutionOutcome.WAITING_FOR_VOTES,
        workflow.resolveTaskOutcome(taskId, vote("alice")));
    Map<String, Object> variables = vote("bob");
    variables.put(OntologyWorkflowDecision.VARIABLE, JsonUtils.pojoToJson(decision));
    assertEquals(
        TaskResolutionOutcome.STAGE_ADVANCED, workflow.resolveTaskOutcome(taskId, variables));
    assertTrue(workflow.completedOntologyDecision(processId).isEmpty());

    String executionId =
        engine
            .getRuntimeService()
            .createExecutionQuery()
            .processInstanceId(processId)
            .activityId("afterReview")
            .singleResult()
            .getId();
    engine.getRuntimeService().trigger(executionId);
    OntologyWorkflowDecision committed =
        workflow.completedOntologyDecision(processId).orElseThrow();
    assertEquals(taskId, committed.taskId());
    assertEquals(decision.target(), committed.target());
    assertEquals(Set.of("alice", "bob"), Set.copyOf(committed.voters()));

    workflow.initializeNewProcessEngine(engine);
    assertEquals(committed, workflow.completedOntologyDecision(processId).orElseThrow());
    assertEquals(committed, workflow.completedOntologyDecision(processId).orElseThrow());
  }

  private static void assertContinuingWorkflowIsNotComplete(
      WorkflowHandler workflow, ProcessEngineConfiguration engine) {
    String process =
        votingProcess()
            .replace("ontologyVoteTest", "ontologyContinuedReview")
            .replace("targetRef=\"end\"", "targetRef=\"additionalReview\"")
            .replace(
                "<endEvent id=\"end\"/>",
                "<userTask id=\"additionalReview\"/><sequenceFlow id=\"finish\" sourceRef=\"additionalReview\" targetRef=\"end\"/><endEvent id=\"end\"/>");
    engine
        .getRepositoryService()
        .createDeployment()
        .addString("ontology-continued-review.bpmn20.xml", process)
        .deploy();
    UUID taskId = UUID.randomUUID();
    engine
        .getRuntimeService()
        .startProcessInstanceByKey(
            "ontologyContinuedReview", Map.of("customTaskId", taskId.toString()));

    assertEquals(
        TaskResolutionOutcome.STAGE_ADVANCED, workflow.resolveTaskOutcome(taskId, vote("alice")));
    assertEquals(
        1,
        engine
            .getTaskService()
            .createTaskQuery()
            .processVariableValueEquals("customTaskId", taskId.toString())
            .count());
  }

  private static Map<String, Object> vote(String user) {
    return new HashMap<>(Map.of("Review_updatedBy", user, "Review_result", "approve"));
  }

  private static void assertFailedWorkflowIsNotComplete(
      WorkflowHandler workflow, ProcessEngineConfiguration engine) {
    for (String failureVariable :
        List.of("failure", "global_failure", "exception", "global_exception")) {
      UUID taskId = UUID.randomUUID();
      engine
          .getRuntimeService()
          .startProcessInstanceByKey(
              "ontologyVoteTest", Map.of("customTaskId", taskId.toString(), failureVariable, true));
      assertEquals(
          TaskResolutionOutcome.PROCESS_FAILED,
          workflow.resolveTaskOutcome(taskId, vote("alice")),
          failureVariable);
    }
    engine
        .getRepositoryService()
        .createDeployment()
        .addString(
            "ontology-error-review.bpmn20.xml",
            votingProcess()
                .replace("ontologyVoteTest", "ontologyErrorReview")
                .replace("\"end\"", "\"Error\""))
        .deploy();
    UUID taskId = UUID.randomUUID();
    engine
        .getRuntimeService()
        .startProcessInstanceByKey(
            "ontologyErrorReview", Map.of("customTaskId", taskId.toString()));
    assertEquals(
        TaskResolutionOutcome.PROCESS_FAILED, workflow.resolveTaskOutcome(taskId, vote("alice")));
  }

  private static void assertLegacyApprovalCompletesWhenTheProcessFails(
      WorkflowHandler workflow, ProcessEngineConfiguration engine) {
    for (int threshold : List.of(1, 2)) {
      UUID taskId = UUID.randomUUID();
      String processId =
          engine
              .getRuntimeService()
              .startProcessInstanceByKey(
                  "ontologyErrorReview",
                  Map.of("customTaskId", taskId.toString(), "approvalThreshold", threshold))
              .getId();
      assertTrue(workflow.resolveTask(taskId, vote("alice")));
      if (threshold == 2) {
        assertTrue(workflow.resolveTask(taskId, vote("bob")));
      }
      assertEquals(
          0, engine.getTaskService().createTaskQuery().processInstanceId(processId).count());
      assertTrue(workflow.completedOntologyDecision(processId).isEmpty());
    }
  }

  private static OpenMetadataApplicationConfig workflowConfig(
      Handle handle, ConnectionType dialect) {
    String externalUrl =
        System.getProperty("ontology.test." + dialect.name().toLowerCase(Locale.ROOT) + ".url");
    HikariCPDataSourceFactory dataSource = new HikariCPDataSourceFactory();
    dataSource.setDriverClass(dialect.label);
    try {
      dataSource.setUrl(
          externalUrl == null ? handle.getConnection().getMetaData().getURL() : externalUrl);
    } catch (SQLException exception) {
      throw new IllegalStateException("Cannot configure workflow test database", exception);
    }
    if (externalUrl == null) {
      dataSource.setUser(dialect == ConnectionType.MYSQL ? "root" : "postgres");
      dataSource.setPassword(PASSWORD);
    }
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setDataSourceFactory(dataSource);
    return config;
  }

  private static String votingProcess() {
    return """
        <?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="ontology-tests">
          <process id="ontologyVoteTest" isExecutable="true">
            <startEvent id="start"/>
            <sequenceFlow id="enterReview" sourceRef="start" targetRef="Review"/>
            <subProcess id="Review">
              <startEvent id="reviewStart"/>
              <sequenceFlow id="enterVote" sourceRef="reviewStart" targetRef="vote"/>
              <userTask id="vote" name="Review ontology"/>
              <sequenceFlow id="leaveVote" sourceRef="vote" targetRef="reviewEnd"/>
              <endEvent id="reviewEnd"/>
            </subProcess>
            <sequenceFlow id="leaveReview" sourceRef="Review" targetRef="end"/>
            <endEvent id="end"/>
          </process>
        </definitions>
        """;
  }

  private static void assertStorageContract(Handle handle, ConnectionType dialect) {
    migrate(handle, dialect);
    migrate(handle, dialect);
    CollectionDAO dao = handle.attach(CollectionDAO.class);
    Ontology ontology = ontology();
    OntologyConcept concept = concept(ontology);
    OntologyProperty property = property(ontology);
    handle.useTransaction(
        transaction -> {
          dao.ontologyEntityDAO().insert(ontology, ontology.getFullyQualifiedName());
          dao.ontologyConceptDAO().insert(concept, concept.getFullyQualifiedName());
          dao.ontologyPropertyDAO().insert(property, property.getFullyQualifiedName());
        });
    assertEquals(ontology, dao.ontologyEntityDAO().findEntityById(ontology.getId()));
    assertEquals(
        concept, dao.ontologyConceptDAO().findEntityByName(concept.getFullyQualifiedName()));
    assertEquals(property, dao.ontologyPropertyDAO().findEntityById(property.getId()));
    assertRenameAndDelete(dao, concept);
    assertSemanticIdentity(dao, ontology);
    assertUniquenessAndRollback(handle, dao, ontology);
    assertRepositoryContract(handle, dialect, dao);
  }

  private static void assertSemanticIdentity(CollectionDAO dao, Ontology ontology) {
    OntologyConcept duplicateConcept =
        concept(ontology).withName("OtherCustomer").withFullyQualifiedName("Sales.OtherCustomer");
    assertThrows(
        UnableToExecuteStatementException.class,
        () ->
            dao.ontologyConceptDAO()
                .insert(duplicateConcept, duplicateConcept.getFullyQualifiedName()));
    OntologyProperty duplicateProperty =
        property(ontology).withName("otherId").withFullyQualifiedName("Sales.otherId");
    assertThrows(
        UnableToExecuteStatementException.class,
        () ->
            dao.ontologyPropertyDAO()
                .insert(duplicateProperty, duplicateProperty.getFullyQualifiedName()));

    Ontology other = ontology().withName("Partners").withFullyQualifiedName("Partners");
    dao.ontologyEntityDAO().insert(other, other.getFullyQualifiedName());
    OntologyConcept imported = concept(other).withFullyQualifiedName("Partners.Customer");
    dao.ontologyConceptDAO().insert(imported, imported.getFullyQualifiedName());
    for (String localName : List.of("customer", "客户")) {
      OntologyConcept distinct =
          concept(ontology)
              .withName(localName)
              .withFullyQualifiedName("Sales." + localName)
              .withIri(NAMESPACE.resolve(localName));
      dao.ontologyConceptDAO().insert(distinct, distinct.getFullyQualifiedName());
      assertEquals(
          distinct.getIri(), dao.ontologyConceptDAO().findEntityById(distinct.getId()).getIri());
    }
  }

  private static void assertRepositoryContract(
      Handle handle, ConnectionType dialect, CollectionDAO dao) {
    migrateRepositoryTables(handle, dialect);
    CollectionDAO previous = Entity.getCollectionDAO();
    EntityRelationshipRepository previousRelationships = Entity.getEntityRelationshipRepository();
    Entity.setCollectionDAO(handle.getJdbi().onDemand(CollectionDAO.class));
    Entity.setEntityRelationshipRepository(
        new EntityRelationshipRepository(Entity.getCollectionDAO()));
    try {
      OntologyRepository repository = new OntologyRepository();
      Ontology created =
          repository.create(null, ontology().withName("GovernedSales").withVersion(0.1));
      assertNull(created.getEntityStatus());
      assertEquals(1L, dao.ontologyStateDAO().get(created.getId()).getWorkingRevision());
      Ontology original =
          repository.get(null, created.getId(), repository.getFields("owners,reviewers"));
      Ontology edited =
          JsonUtils.deepCopy(original, Ontology.class).withDescription("Reviewed definition");
      repository.update(null, original, edited, "admin");
      assertEquals(2L, dao.ontologyStateDAO().get(created.getId()).getWorkingRevision());
      assertThrows(
          PreconditionFailedException.class,
          () ->
              repository.update(
                  null,
                  original,
                  JsonUtils.deepCopy(original, Ontology.class).withDescription("Stale overwrite"),
                  "admin"));
      Ontology current =
          repository.get(null, created.getId(), repository.getFields("owners,reviewers"));
      assertEquals(
          "Reviewed definition",
          dao.ontologyEntityDAO().findEntityById(created.getId()).getDescription());
      assertThrows(
          IllegalStateException.class,
          () ->
              repository.executeInTransaction(
                  () -> {
                    Ontology updated =
                        JsonUtils.deepCopy(current, Ontology.class).withDescription("Rolled back");
                    repository.update(null, current, updated, "admin");
                    throw new IllegalStateException("Roll back the approval transaction");
                  }));
      assertEquals(
          "Reviewed definition",
          dao.ontologyEntityDAO().findEntityById(created.getId()).getDescription());
      assertPropertyValidation(created);
      assertEquals(2L, dao.ontologyStateDAO().get(created.getId()).getWorkingRevision());
      OntologyConceptRepository concepts = new OntologyConceptRepository();
      assertThrows(
          BadRequestException.class,
          () -> concepts.validateDefinition(concept(created).withConceptType(null)));
    } finally {
      Entity.setCollectionDAO(previous);
      Entity.setEntityRelationshipRepository(previousRelationships);
    }
  }

  private static void assertPropertyValidation(Ontology ontology) {
    OntologyPropertyRepository repository = new OntologyPropertyRepository();
    OntologyProperty property =
        property(ontology)
            .withDomain(null)
            .withRange(null)
            .withDisjointWith(null)
            .withPropertyChain(null);
    assertDoesNotThrow(() -> repository.validateDefinition(property));
    property.withKind(null);
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
    property.withKind(OntologyPropertyKind.DATA).withInverse(NAMESPACE.resolve("inverse"));
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
    property
        .withKind(OntologyPropertyKind.OBJECT)
        .withInverse(null)
        .withDomain(List.of(URI.create("relative")));
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
    property.withDomain(null).withKind(OntologyPropertyKind.ANNOTATION);
    property.withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL));
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
    property.withKind(OntologyPropertyKind.DATA);
    assertDoesNotThrow(() -> repository.validateDefinition(property));
    property.withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
    property.withKind(OntologyPropertyKind.OBJECT);
    assertDoesNotThrow(() -> repository.validateDefinition(property));
    property.withPropertyChain(List.of(NAMESPACE.resolve("oneLink")));
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
    property.withPropertyChain(List.of(NAMESPACE.resolve("first"), NAMESPACE.resolve("second")));
    assertDoesNotThrow(() -> repository.validateDefinition(property));
    property
        .withKind(OntologyPropertyKind.ANNOTATION)
        .withPropertyChain(null)
        .withCharacteristics(null)
        .withDisjointWith(List.of(NAMESPACE.resolve("annotation")));
    assertThrows(BadRequestException.class, () -> repository.validateDefinition(property));
  }

  private static void assertRenameAndDelete(CollectionDAO dao, OntologyConcept concept) {
    String previousName = concept.getFullyQualifiedName();
    URI iri = concept.getIri();
    concept.withName("AccountHolder").withFullyQualifiedName("Sales.AccountHolder");
    dao.ontologyConceptDAO().update(concept);
    assertThrows(
        EntityNotFoundException.class,
        () -> dao.ontologyConceptDAO().findEntityByName(previousName));
    assertEquals(
        iri, dao.ontologyConceptDAO().findEntityByName(concept.getFullyQualifiedName()).getIri());
    concept.setDeleted(true);
    dao.ontologyConceptDAO().update(concept);
    assertThrows(
        EntityNotFoundException.class,
        () -> dao.ontologyConceptDAO().findEntityById(concept.getId()));
    assertEquals(
        concept, dao.ontologyConceptDAO().findEntityById(concept.getId(), Include.DELETED));
  }

  private static void assertUniquenessAndRollback(
      Handle handle, CollectionDAO dao, Ontology ontology) {
    Ontology duplicate = ontology();
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> dao.ontologyEntityDAO().insert(duplicate, duplicate.getFullyQualifiedName()));
    OntologyConcept rolledBack =
        concept(ontology)
            .withName("RolledBack")
            .withFullyQualifiedName("Sales.RolledBack")
            .withIri(NAMESPACE.resolve("RolledBack"));
    assertThrows(
        IllegalStateException.class,
        () ->
            handle.useTransaction(
                transaction -> {
                  dao.ontologyConceptDAO().insert(rolledBack, rolledBack.getFullyQualifiedName());
                  throw new IllegalStateException("Rollback ontology write");
                }));
    assertThrows(
        EntityNotFoundException.class,
        () -> dao.ontologyConceptDAO().findEntityById(rolledBack.getId()));
    OntologyConcept missingContainer = concept(ontology).withOntology(null);
    assertThrows(
        UnableToExecuteStatementException.class,
        () ->
            dao.ontologyConceptDAO()
                .insert(missingContainer, missingContainer.getFullyQualifiedName()));
  }

  private static Ontology ontology() {
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName("Sales")
        .withFullyQualifiedName("Sales")
        .withIri(URI.create("https://example.org/sales"))
        .withNamespace(NAMESPACE)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }

  private static EntityReference reference(Ontology ontology) {
    return new EntityReference()
        .withId(ontology.getId())
        .withType("ontology")
        .withName(ontology.getName());
  }

  private static OntologyConcept concept(Ontology ontology) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withFullyQualifiedName("Sales.Customer")
        .withOntology(reference(ontology))
        .withIri(NAMESPACE.resolve("Customer"))
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }

  private static OntologyProperty property(Ontology ontology) {
    return new OntologyProperty()
        .withId(UUID.randomUUID())
        .withName("customerId")
        .withFullyQualifiedName("Sales.customerId")
        .withOntology(reference(ontology))
        .withIri(NAMESPACE.resolve("customerId"))
        .withKind(OntologyPropertyKind.DATA)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }
}
