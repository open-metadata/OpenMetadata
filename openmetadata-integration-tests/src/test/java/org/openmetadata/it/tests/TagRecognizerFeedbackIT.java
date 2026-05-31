package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junitpioneer.jupiter.RetryingTest;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.ClassificationLanguage;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.schema.type.TagLabelRecognizerMetadata;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class TagRecognizerFeedbackIT {
  private static final long TIMEOUT_MINUTES = 5;
  private static final long POLL_INTERVAL_SECONDS = 3;

  @BeforeAll
  protected static void setupWorkflow() {
    org.openmetadata.service.governance.workflows.WorkflowHandler workflowHandler =
        org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance();
    WorkflowDefinitionRepository workflowDefinitionRepository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    org.openmetadata.schema.governance.workflows.WorkflowDefinition workflowDefinition =
        workflowDefinitionRepository.findByName("RecognizerFeedbackReviewWorkflow", Include.ALL);

    // Force redeploy to ensure latest approval listener wiring (Task entity cutover) is active,
    // even when the database already has an older deployed process definition.
    workflowDefinitionRepository.createOrUpdate(null, workflowDefinition, "admin");
    workflowHandler.resumeWorkflow("RecognizerFeedbackReviewWorkflow");

    Awaitility.await("Wait for workflow to be ready")
        .pollDelay(Duration.ofMillis(500))
        .atMost(Duration.ofSeconds(5))
        .untilAsserted(
            () -> {
              org.openmetadata.schema.governance.workflows.WorkflowDefinition wfDef =
                  new org.openmetadata.schema.governance.workflows.WorkflowDefinition()
                      .withName("RecognizerFeedbackReviewWorkflow");
              assertTrue(workflowHandler.isDeployed(wfDef), "Workflow should be deployed");
            });
  }

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  protected org.openmetadata.schema.entity.teams.User testUser1() {
    return shared().USER1;
  }

  protected org.openmetadata.schema.entity.teams.User testUser2() {
    return shared().USER2;
  }

  protected OpenMetadataClient testUser2Client() {
    org.openmetadata.schema.entity.teams.User user = testUser2();
    return SdkClients.createClient(
        user.getName(),
        user.getEmail(),
        user.getRoles().stream()
            .map(EntityReference::getFullyQualifiedName)
            .toArray(String[]::new));
  }

  protected CreateTag createMinimalRequest(TestNamespace ns) {
    Classification classification = createClassification(ns);

    CreateTag request = new CreateTag();
    request.setName(ns.prefix("tag"));
    request.setClassification(classification.getFullyQualifiedName());
    request.setDescription("Test tag created by integration test");
    return request;
  }

  protected void validateCreatedEntity(Tag entity, CreateTag request) {
    assertNotNull(entity.getId());
    assertNotNull(entity.getFullyQualifiedName());
    assertEquals(request.getName(), entity.getName());
    assertEquals(request.getDescription(), entity.getDescription());
  }

  protected Tag getEntity(String id) {
    return SdkClients.adminClient().tags().get(id);
  }

  protected Tag createEntity(CreateTag request) {
    return SdkClients.adminClient().tags().create(request);
  }

  private Classification createClassification(TestNamespace ns) {
    CreateClassification request = new CreateClassification();
    request.setName(ns.prefix("classification"));
    request.setDescription("Test classification");
    return SdkClients.adminClient().classifications().create(request);
  }

  private org.openmetadata.schema.entity.data.Table createTableWithGeneratedTag(
      TestNamespace ns, String tagFQN) {
    return createTableWithGeneratedTag(ns, tagFQN, null);
  }

  private org.openmetadata.schema.entity.data.Table createTableWithGeneratedTag(
      TestNamespace ns, String tagFQN, TagLabelRecognizerMetadata recognizerMetadata) {
    PostgresConnection conn =
        DatabaseServices.postgresConnection().hostPort("localhost:5432").username("test").build();
    org.openmetadata.schema.entity.services.DatabaseService service =
        DatabaseServices.builder()
            .name("test_service_" + ns.uniqueShortId())
            .connection(conn)
            .description("Test Postgres service")
            .create();

    org.openmetadata.schema.entity.data.DatabaseSchema schema =
        DatabaseSchemas.create()
            .name("schema_" + ns.uniqueShortId())
            .in(
                Databases.create()
                    .name("db_" + ns.uniqueShortId())
                    .in(service.getFullyQualifiedName())
                    .execute()
                    .getFullyQualifiedName())
            .execute();

    Column column =
        org.openmetadata.sdk.fluent.builders.ColumnBuilder.of("test_column", "VARCHAR")
            .dataLength(255)
            .build();

    TagLabel tagLabel =
        new TagLabel().withTagFQN(tagFQN).withLabelType(TagLabel.LabelType.GENERATED);

    if (recognizerMetadata != null) {
      TagLabelMetadata metadata = new TagLabelMetadata().withRecognizer(recognizerMetadata);
      tagLabel.setMetadata(metadata);
    }

    column.setTags(java.util.List.of(tagLabel));

    org.openmetadata.schema.api.data.CreateTable createTable =
        new org.openmetadata.schema.api.data.CreateTable()
            .withName("test_table_" + ns.shortPrefix())
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(java.util.List.of(column));

    return SdkClients.adminClient().tables().create(createTable);
  }

  private org.openmetadata.schema.type.RecognizerFeedback submitRecognizerFeedback(
      String entityLink, String tagFQN, HttpClient client) {
    org.openmetadata.schema.type.RecognizerFeedback feedback =
        new org.openmetadata.schema.type.RecognizerFeedback()
            .withEntityLink(entityLink)
            .withTagFQN(tagFQN)
            .withFeedbackType(
                org.openmetadata.schema.type.RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
            .withUserReason(
                org.openmetadata.schema.type.RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA)
            .withUserComments("This is not actually sensitive data");

    try {
      return client.execute(
          HttpMethod.POST,
          "/v1/tags/name/" + tagFQN + "/feedback",
          feedback,
          RecognizerFeedback.class);
    } catch (Exception e) {
      throw new RuntimeException("Failed to submit recognizer feedback", e);
    }
  }

  private org.openmetadata.schema.type.RecognizerFeedback submitRecognizerFeedback(
      String entityLink, String tagFQN) {
    HttpClient client = SdkClients.adminClient().getHttpClient();
    return submitRecognizerFeedback(entityLink, tagFQN, client);
  }

  private Task waitForRecognizerFeedbackTask(String tagFQN) {
    return waitForRecognizerFeedbackTask(tagFQN, TIMEOUT_MINUTES);
  }

  public Task waitForRecognizerFeedbackTask(String tagFQN, long timeoutMinutes) {
    Map<String, String> filterParams =
        Map.of(
            "limit", "100",
            "status", TaskEntityStatus.Open.value(),
            "type", TaskEntityType.DataQualityReview.value());

    try {
      Awaitility.await(String.format("Wait for Task entity to be created for Tag: '%s'", tagFQN))
          .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
          .atMost(Duration.ofMinutes(timeoutMinutes))
          .ignoreExceptions()
          .until(
              () -> {
                try {
                  ListResponse<Task> response =
                      SdkClients.adminClient().tasks().listWithFilters(filterParams);
                  return response.getData() != null
                      && response.getData().stream()
                          .anyMatch(task -> isRecognizerFeedbackTaskForTag(task, tagFQN));
                } catch (Exception e) {
                  return false;
                }
              });

      ListResponse<Task> response = SdkClients.adminClient().tasks().listWithFilters(filterParams);

      if (response.getData() != null) {
        return response.getData().stream()
            .filter(task -> isRecognizerFeedbackTaskForTag(task, tagFQN))
            .findFirst()
            .orElseThrow(
                () ->
                    new RuntimeException(
                        String.format(
                            "No recognizer feedback task found in task list for tag '%s'",
                            tagFQN)));
      }
    } catch (org.awaitility.core.ConditionTimeoutException e) {
      throw new RuntimeException(
          String.format(
              "Timeout waiting for recognizer feedback task entity for tag '%s' after %d minutes",
              tagFQN, timeoutMinutes),
          e);
    } catch (Exception e) {
      throw new RuntimeException(
          String.format("Failed to get recognizer feedback task entity for tag '%s'", tagFQN), e);
    }

    throw new RuntimeException(
        String.format("No recognizer feedback task found for tag '%s'", tagFQN));
  }

  private boolean isRecognizerFeedbackTaskForTag(Task task, String tagFQN) {
    if (task == null || task.getType() != TaskEntityType.DataQualityReview) {
      return false;
    }
    RecognizerFeedback feedback = getTaskPayloadFeedback(task);
    return feedback != null && tagFQN.equals(feedback.getTagFQN());
  }

  private RecognizerFeedback getTaskPayloadFeedback(Task task) {
    if (task == null || task.getPayload() == null) {
      return null;
    }
    try {
      Map<String, Object> payload =
          JsonUtils.convertValue(task.getPayload(), new TypeReference<Map<String, Object>>() {});
      if (payload == null || payload.get("feedback") == null) {
        return null;
      }
      return JsonUtils.convertValue(payload.get("feedback"), RecognizerFeedback.class);
    } catch (Exception e) {
      return null;
    }
  }

  private TagLabelRecognizerMetadata getTaskPayloadRecognizer(Task task) {
    if (task == null || task.getPayload() == null) {
      return null;
    }
    try {
      Map<String, Object> payload =
          JsonUtils.convertValue(task.getPayload(), new TypeReference<Map<String, Object>>() {});
      if (payload == null || payload.get("recognizer") == null) {
        return null;
      }
      return JsonUtils.convertValue(payload.get("recognizer"), TagLabelRecognizerMetadata.class);
    } catch (Exception e) {
      return null;
    }
  }

  private void resolveRecognizerFeedbackTask(Task task) {
    ResolveTask resolveTask =
        new ResolveTask().withResolutionType(TaskResolutionType.Approved).withNewValue("approved");
    try {
      SdkClients.user2Client().tasks().resolve(task.getId().toString(), resolveTask);
    } catch (Exception e) {
      throw new RuntimeException("Failed to resolve recognizer feedback task", e);
    }
  }

  private void rejectRecognizerFeedbackTask(Task task) {
    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected by reviewer");
    try {
      SdkClients.user2Client().tasks().resolve(task.getId().toString(), resolveTask);
    } catch (Exception e) {
      throw new RuntimeException("Failed to reject recognizer feedback task", e);
    }
  }

  private Recognizer getNameRecognizer() {
    return new Recognizer()
        .withName("test_recognizer")
        .withRecognizerConfig(
            new PredefinedRecognizer()
                .withSupportedLanguage(ClassificationLanguage.EN)
                .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER));
  }

  @RetryingTest(3)
  void test_recognizerFeedback_withDirectReviewer_createsTask(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_with_reviewer_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag with direct reviewer");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    org.openmetadata.schema.type.RecognizerFeedback feedback =
        submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName());

    Task task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    assertNotNull(task, "Task should be created for tag with reviewer");
    assertEquals(TaskEntityType.DataQualityReview, task.getType());
    RecognizerFeedback payloadFeedback = getTaskPayloadFeedback(task);
    assertNotNull(payloadFeedback, "Task payload should contain feedback details");
    assertEquals(feedback.getEntityLink(), payloadFeedback.getEntityLink());
  }

  @RetryingTest(3)
  void test_recognizerFeedback_withInheritedReviewer_createsTask(TestNamespace ns)
      throws Exception {

    CreateClassification classificationRequest = new CreateClassification();
    classificationRequest.setName("class_reviewer" + "_" + ns.uniqueShortId());
    classificationRequest.setDescription("Classification with reviewer");
    classificationRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    Classification classification =
        SdkClients.adminClient().classifications().create(classificationRequest);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_inherited_reviewer" + "_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag inheriting reviewer");
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName());

    assertDoesNotThrow(() -> waitForRecognizerFeedbackTask(tag.getFullyQualifiedName()));
  }

  @RetryingTest(3)
  void test_recognizerFeedback_noReviewer_autoApplied(TestNamespace ns) throws Exception {

    Classification classification = createClassification(ns);

    CreateTag tagRequest =
        new CreateTag()
            .withRecognizers(java.util.List.of(getNameRecognizer()))
            .withName("tag_no_reviewer" + "_" + ns.uniqueShortId())
            .withClassification(classification.getFullyQualifiedName())
            .withDescription("Tag without reviewer");

    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName());

    Awaitility.await("Wait for recognizer exception to be added after auto-approval")
        .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
        .atMost(Duration.ofMinutes(TIMEOUT_MINUTES))
        .untilAsserted(
            () -> {
              Tag polledTag = getEntity(tag.getId().toString());
              assertNotNull(polledTag.getRecognizers());
              assertFalse(polledTag.getRecognizers().isEmpty());
              assertTrue(
                  polledTag.getRecognizers().getFirst().getExceptionList() != null
                      && !polledTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
                  "Recognizer should have exception added");
            });

    Awaitility.await("Wait for tag to be removed from column after auto-approval")
        .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
        .atMost(Duration.ofMinutes(TIMEOUT_MINUTES))
        .untilAsserted(
            () -> {
              org.openmetadata.schema.entity.data.Table updatedTable =
                  SdkClients.adminClient()
                      .tables()
                      .getByName(table.getFullyQualifiedName(), "columns,tags");
              boolean tagRemoved =
                  updatedTable.getColumns().getFirst().getTags().stream()
                      .noneMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
              assertTrue(tagRemoved, "Tag should be removed from column");
            });
  }

  @RetryingTest(3)
  void test_recognizerFeedback_submitterIsReviewer_autoApplied(TestNamespace ns) throws Exception {

    Classification classification = createClassification(ns);

    CreateTag tagRequest =
        new CreateTag()
            .withRecognizers(java.util.List.of(getNameRecognizer()))
            .withName("tag_no_reviewer" + "_" + ns.uniqueShortId())
            .withClassification(classification.getFullyQualifiedName())
            .withReviewers(java.util.List.of(testUser2().getEntityReference()))
            .withDescription("Tag without reviewer");

    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(
        entityLink, tag.getFullyQualifiedName(), testUser2Client().getHttpClient());

    Awaitility.await("Wait for recognizer exception to be added after auto-approval")
        .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
        .atMost(Duration.ofMinutes(TIMEOUT_MINUTES))
        .untilAsserted(
            () -> {
              Tag polledTag = getEntity(tag.getId().toString());
              assertNotNull(polledTag.getRecognizers());
              assertFalse(polledTag.getRecognizers().isEmpty());
              assertTrue(
                  polledTag.getRecognizers().getFirst().getExceptionList() != null
                      && !polledTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
                  "Recognizer should have exception added");
            });

    Awaitility.await("Wait for tag to be removed from column after reviewer auto-approval")
        .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
        .atMost(Duration.ofMinutes(TIMEOUT_MINUTES))
        .untilAsserted(
            () -> {
              org.openmetadata.schema.entity.data.Table updatedTable =
                  SdkClients.adminClient()
                      .tables()
                      .getByName(table.getFullyQualifiedName(), "columns,tags");
              boolean tagRemoved =
                  updatedTable.getColumns().getFirst().getTags().stream()
                      .noneMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
              assertTrue(tagRemoved, "Tag should be removed from column");
            });
  }

  @RetryingTest(3)
  void test_recognizerFeedback_approveTask_removesTagAndAddsException(TestNamespace ns)
      throws Exception {

    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_approve_test" + "_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag for approval test");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    tagRequest.setRecognizers(java.util.List.of(getNameRecognizer()));
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";
    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName());

    Task task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());
    assertNotNull(task);

    resolveRecognizerFeedbackTask(task);

    Awaitility.await("Wait for recognizer exception to be added after approval")
        .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
        .atMost(Duration.ofMinutes(TIMEOUT_MINUTES))
        .untilAsserted(
            () -> {
              Tag updatedTag = getEntity(tag.getId().toString());
              assertNotNull(updatedTag.getRecognizers());
              assertFalse(updatedTag.getRecognizers().isEmpty());
              assertTrue(
                  updatedTag.getRecognizers().getFirst().getExceptionList() != null
                      && !updatedTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
                  "Recognizer should have exception added after approval");
            });

    Tag updatedTag = getEntity(tag.getId().toString());

    org.openmetadata.schema.type.RecognizerException exception =
        updatedTag.getRecognizers().getFirst().getExceptionList().getFirst();
    assertTrue(
        exception.getReason().contains("NOT_SENSITIVE_DATA"),
        "Exception reason should contain user reason");
    assertTrue(
        exception.getReason().contains("This is not actually sensitive data"),
        "Exception reason should contain user comments");

    org.openmetadata.schema.entity.data.Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    boolean tagRemoved =
        updatedTable.getColumns().getFirst().getTags().stream()
            .noneMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
    assertTrue(tagRemoved, "Tag should be removed from column after approval");
  }

  @RetryingTest(3)
  void test_recognizerFeedback_rejectTask_keepsTag(TestNamespace ns) throws Exception {

    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName(ns.prefix("tag_reject_test"));
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag for rejection test");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    tagRequest.setRecognizers(java.util.List.of(getNameRecognizer()));
    Tag tag = createEntity(tagRequest);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName());

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName());

    Task task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    rejectRecognizerFeedbackTask(task);

    Awaitility.await("Wait for task rejection to be processed")
        .pollInterval(Duration.ofSeconds(POLL_INTERVAL_SECONDS))
        .atMost(Duration.ofMinutes(TIMEOUT_MINUTES))
        .untilAsserted(
            () -> {
              Tag polledTag = getEntity(tag.getId().toString());
              assertNotNull(polledTag.getRecognizers());
            });

    Tag updatedTag = getEntity(tag.getId().toString());
    assertNotNull(updatedTag.getRecognizers());
    assertTrue(
        updatedTag.getRecognizers().getFirst().getExceptionList() == null
            || updatedTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
        "Recognizer should NOT have exception added after rejection");

    org.openmetadata.schema.entity.data.Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    boolean tagStillPresent =
        updatedTable.getColumns().getFirst().getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
    assertTrue(tagStillPresent, "Tag should remain on column after rejection");
  }

  @RetryingTest(3)
  void test_recognizerFeedback_taskIncludesRecognizerMetadata(TestNamespace ns) throws Exception {
    Classification classification = createClassification(ns);

    CreateTag tagRequest = new CreateTag();
    tagRequest.setName("tag_with_recognizer_metadata_" + ns.uniqueShortId());
    tagRequest.setClassification(classification.getFullyQualifiedName());
    tagRequest.setDescription("Tag with recognizer metadata");
    tagRequest.setReviewers(java.util.List.of(testUser2().getEntityReference()));
    tagRequest.setRecognizers(java.util.List.of(getNameRecognizer()));
    Tag tag = createEntity(tagRequest);

    TagLabelRecognizerMetadata recognizerMetadata =
        new TagLabelRecognizerMetadata()
            .withRecognizerId(java.util.UUID.randomUUID())
            .withRecognizerName("test_email_recognizer")
            .withScore(0.95);

    org.openmetadata.schema.entity.data.Table table =
        createTableWithGeneratedTag(ns, tag.getFullyQualifiedName(), recognizerMetadata);

    String entityLink = "<#E::table::" + table.getFullyQualifiedName() + "::columns::test_column>";

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName());

    Task task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    assertNotNull(task, "Task should be created");
    TagLabelRecognizerMetadata taskRecognizer = getTaskPayloadRecognizer(task);
    assertNotNull(taskRecognizer, "Task should include recognizer metadata in payload");
    assertEquals(
        recognizerMetadata.getRecognizerId(),
        taskRecognizer.getRecognizerId(),
        "Recognizer ID should match");
    assertEquals(
        recognizerMetadata.getRecognizerName(),
        taskRecognizer.getRecognizerName(),
        "Recognizer name should match");
    assertEquals(
        recognizerMetadata.getScore(),
        taskRecognizer.getScore(),
        0.001,
        "Recognizer score should match");
  }
}
