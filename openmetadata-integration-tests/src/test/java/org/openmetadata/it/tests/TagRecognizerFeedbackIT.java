package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import org.awaitility.Awaitility;
import org.awaitility.core.ConditionTimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.type.ClassificationLanguage;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.DatabaseServices;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
public class TagRecognizerFeedbackIT {

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  protected org.openmetadata.schema.entity.teams.User testUser1() {
    return shared().USER1;
  }

  protected org.openmetadata.schema.entity.teams.User testUser2() {
    return shared().USER2;
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
    column.setTags(
        java.util.List.of(
            new TagLabel().withTagFQN(tagFQN).withLabelType(TagLabel.LabelType.GENERATED)));

    org.openmetadata.schema.api.data.CreateTable createTable =
        new org.openmetadata.schema.api.data.CreateTable()
            .withName("test_table_" + ns.shortPrefix())
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(java.util.List.of(column));

    return SdkClients.adminClient().tables().create(createTable);
  }

  private org.openmetadata.schema.type.RecognizerFeedback submitRecognizerFeedback(
      String entityLink, String tagFQN, String userName) {
    HttpClient client = SdkClients.adminClient().getHttpClient();

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

  private Thread waitForRecognizerFeedbackTask(String tagFQN) throws Exception {
    return waitForRecognizerFeedbackTask(tagFQN, 90000L * 2);
  }

  public Thread waitForRecognizerFeedbackTask(String tagFQN, long timeout)
      throws RuntimeException, ConditionTimeoutException {
    String entityLink = new MessageParser.EntityLink(Entity.TAG, tagFQN).getLinkString();
    Awaitility.await(String.format("Wait for Task to be Created for Tag: '%s'", tagFQN))
        .ignoreExceptions()
        .pollInterval(Duration.ofMillis(2000L))
        .atMost(Duration.ofMillis(timeout))
        .until(
            () ->
                WorkflowHandler.getInstance()
                    .isActivityWithVariableExecuting(
                        "ReviewFeedback.approvalTask",
                        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE),
                        entityLink));

    String url =
        "/v1/feed?limit=100&type=Task&taskStatus=Open&entityLink="
            + URLEncoder.encode(entityLink, StandardCharsets.UTF_8);
    FeedResourceIT.ThreadList response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.GET, url, null, FeedResourceIT.ThreadList.class);

    for (Thread thread : response.getData()) {
      return thread;
    }

    throw new RuntimeException("Failed to submit recognizer feedback task");
  }

  private void resolveRecognizerFeedbackTask(Thread thread) {
    String url =
        "/v1/feed/tasks/"
            + thread.getTask().getId().toString()
            + "/resolve?description="
            + thread.getId().toString();
    SdkClients.user2Client()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, url, Map.of("newValue", "approved"));
  }

  private void rejectRecognizerFeedbackTask(Thread thread) {
    String url =
        "/v1/feed/tasks/"
            + thread.getTask().getId().toString()
            + "/close?description="
            + thread.getId().toString();
    SdkClients.user2Client()
        .getHttpClient()
        .executeForString(HttpMethod.PUT, url, Map.of("comment", "closed"));
  }

  private Recognizer getNameRecognizer() {
    return new Recognizer()
        .withName("test_recognizer")
        .withRecognizerConfig(
            new PredefinedRecognizer()
                .withSupportedLanguage(ClassificationLanguage.EN)
                .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER));
  }

  @Test
  void test_recognizerFeedback_withDirectReviewer_createsTask(TestNamespace ns) throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

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
        submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    Thread task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    assertNotNull(task, "Task should be created for tag with reviewer");
    assertEquals(
        org.openmetadata.schema.type.TaskType.RecognizerFeedbackApproval, task.getTask().getType());
    assertNotNull(task.getTask().getFeedback(), "Task should contain feedback details");
    assertEquals(feedback.getEntityLink(), task.getTask().getFeedback().getEntityLink());
  }

  @Test
  void test_recognizerFeedback_withInheritedReviewer_createsTask(TestNamespace ns)
      throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

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

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    assertDoesNotThrow(() -> waitForRecognizerFeedbackTask(tag.getFullyQualifiedName()));
  }

  @Test
  void test_recognizerFeedback_noReviewer_autoApplied(TestNamespace ns) throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

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

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    Thread task;
    try {
      task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());
    } catch (ConditionTimeoutException ignored) {
      task = null;
    }
    assertNull(task, "No task should be created for tag without reviewer - should be auto-applied");

    Tag updatedTag = getEntity(tag.getId().toString());
    assertNotNull(updatedTag.getRecognizers());
    assertFalse(updatedTag.getRecognizers().isEmpty());
    assertTrue(
        updatedTag.getRecognizers().getFirst().getExceptionList() != null
            && !updatedTag.getRecognizers().getFirst().getExceptionList().isEmpty(),
        "Recognizer should have exception added");

    org.openmetadata.schema.entity.data.Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns,tags");
    boolean tagRemoved =
        updatedTable.getColumns().getFirst().getTags().stream()
            .noneMatch(t -> t.getTagFQN().equals(tag.getFullyQualifiedName()));
    assertTrue(tagRemoved, "Tag should be removed from column");
  }

  @Test
  void test_recognizerFeedback_approveTask_removesTagAndAddsException(TestNamespace ns)
      throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

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
    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    org.openmetadata.schema.entity.feed.Thread task =
        waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());
    assertNotNull(task);

    resolveRecognizerFeedbackTask(task);

    Awaitility.await("Wait for recognizer exception to be added after approval")
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(200))
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

  @Test
  void test_recognizerFeedback_rejectTask_keepsTag(TestNamespace ns) throws Exception {
    org.openmetadata.service.governance.workflows.WorkflowHandler.getInstance()
        .resumeWorkflow("RecognizerFeedbackReviewWorkflow");

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

    submitRecognizerFeedback(entityLink, tag.getFullyQualifiedName(), "admin");

    Thread task = waitForRecognizerFeedbackTask(tag.getFullyQualifiedName());

    rejectRecognizerFeedbackTask(task);

    Awaitility.await("Wait for task rejection to be processed")
        .atMost(Duration.ofSeconds(10))
        .pollInterval(Duration.ofMillis(200))
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
}
