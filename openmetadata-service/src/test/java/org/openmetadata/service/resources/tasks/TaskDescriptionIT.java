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

package org.openmetadata.service.resources.tasks;

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.CreateTaskComment;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.DescriptionUpdatePayload;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.apis.APIEndpointResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.searchindex.SearchIndexResourceTest;
import org.openmetadata.service.resources.storages.ContainerResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.TestUtils;

/**
 * Integration tests for Task-based description updates.
 *
 * <p>Tests cover:
 * - Entity-level description tasks (suggest, request, edit suggested)
 * - Column-level description tasks (simple and nested structures)
 * - Topic schema field description tasks (simple and nested)
 * - Container dataModel column description tasks
 * - SearchIndex field description tasks
 * - APIEndpoint schema field description tasks
 *
 * <p>Each test creates isolated test data to support concurrent execution.
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@Execution(ExecutionMode.CONCURRENT)
public class TaskDescriptionIT extends OpenMetadataApplicationTest {

  private static TableResourceTest tableResourceTest;
  private static TopicResourceTest topicResourceTest;
  private static ContainerResourceTest containerResourceTest;
  private static SearchIndexResourceTest searchIndexResourceTest;
  private static APIEndpointResourceTest apiEndpointResourceTest;

  private static User taskCreator;
  private static User taskAssignee;
  private static Map<String, String> creatorAuthHeaders;
  private static Map<String, String> assigneeAuthHeaders;

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);

    topicResourceTest = new TopicResourceTest();
    containerResourceTest = new ContainerResourceTest();
    searchIndexResourceTest = new SearchIndexResourceTest();
    apiEndpointResourceTest = new APIEndpointResourceTest();

    taskCreator = TableResourceTest.USER1;
    creatorAuthHeaders = authHeaders(taskCreator.getName());

    taskAssignee = TableResourceTest.USER2;
    assigneeAuthHeaders = authHeaders(taskAssignee.getName());
  }

  // ========== Entity-Level Description Tests ==========

  @Test
  void test_suggestDescription_entityLevel_accepted(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("suggestDescEntity_" + uniqueId);

    String suggestedDescription = "This is a suggested description for the table";
    Task task =
        createDescriptionTask(
            "suggest_entity_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            suggestedDescription);

    assertNotNull(task.getId());
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    Task resolved = resolveTask(task.getId(), resolve, assigneeAuthHeaders);
    assertEquals(TaskEntityStatus.Approved, resolved.getStatus());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), null, ADMIN_AUTH_HEADERS);
    assertEquals(suggestedDescription, updatedTable.getDescription());
  }

  @Test
  void test_suggestDescription_entityLevel_editedBeforeAccept(TestInfo testInfo)
      throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("suggestDescEdit_" + uniqueId);

    String originalSuggestion = "Original suggested description";
    Task task =
        createDescriptionTask(
            "suggest_edit_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            originalSuggestion);

    String editedDescription = "Assignee edited this description before accepting";
    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(editedDescription);

    Task resolved = resolveTask(task.getId(), resolve, assigneeAuthHeaders);
    assertEquals(TaskEntityStatus.Approved, resolved.getStatus());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), null, ADMIN_AUTH_HEADERS);
    assertEquals(editedDescription, updatedTable.getDescription());
  }

  @Test
  void test_requestDescription_entityLevel_assigneeProvides(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("requestDescEntity_" + uniqueId);

    Task task =
        createDescriptionTask(
            "request_entity_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            null);

    String assigneeDescription = "Description provided by the assignee";
    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(assigneeDescription);

    Task resolved = resolveTask(task.getId(), resolve, assigneeAuthHeaders);
    assertEquals(TaskEntityStatus.Approved, resolved.getStatus());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), null, ADMIN_AUTH_HEADERS);
    assertEquals(assigneeDescription, updatedTable.getDescription());
  }

  // ========== Table Column Description Tests ==========

  @Test
  void test_suggestDescription_simpleColumn(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableWithColumnsForTest("suggestDescCol_" + uniqueId);

    String columnName = "customer_id";
    String fieldPath = "columns::" + columnName + "::description";
    String suggestedDescription = "Unique identifier for the customer";

    Task task =
        createDescriptionTask(
            "suggest_col_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column column = EntityUtil.getColumn(updatedTable, columnName);
    assertEquals(suggestedDescription, column.getDescription());
  }

  @Test
  void test_requestDescription_simpleColumn(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableWithColumnsForTest("requestDescCol_" + uniqueId);

    String columnName = "email";
    String fieldPath = "columns::" + columnName + "::description";

    Task task =
        createDescriptionTask(
            "request_col_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            fieldPath,
            null,
            null);

    String assigneeDescription = "Customer email address for communication";
    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(assigneeDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column column = EntityUtil.getColumn(updatedTable, columnName);
    assertEquals(assigneeDescription, column.getDescription());
  }

  @Test
  void test_suggestDescription_nestedColumn(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableWithNestedColumnsForTest("suggestDescNested_" + uniqueId);

    String nestedFieldPath = "columns::address.street::description";
    String suggestedDescription = "Street address line";

    Task task =
        createDescriptionTask(
            "suggest_nested_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            nestedFieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column addressColumn = EntityUtil.getColumn(updatedTable, "address");
    assertNotNull(addressColumn.getChildren());
    Column streetColumn =
        addressColumn.getChildren().stream()
            .filter(c -> "street".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(streetColumn);
    assertEquals(suggestedDescription, streetColumn.getDescription());
  }

  @Test
  void test_suggestDescription_deeplyNestedColumn(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableWithDeeplyNestedColumnsForTest("suggestDescDeep_" + uniqueId);

    String deepNestedPath = "columns::metadata.audit.created_by::description";
    String suggestedDescription = "User who created the record";

    Task task =
        createDescriptionTask(
            "suggest_deep_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            deepNestedPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Table updatedTable = tableResourceTest.getEntity(table.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column metadataCol = EntityUtil.getColumn(updatedTable, "metadata");
    assertNotNull(metadataCol.getChildren());
    Column auditCol =
        metadataCol.getChildren().stream()
            .filter(c -> "audit".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(auditCol);
    assertNotNull(auditCol.getChildren());
    Column createdByCol =
        auditCol.getChildren().stream()
            .filter(c -> "created_by".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(createdByCol);
    assertEquals(suggestedDescription, createdByCol.getDescription());
  }

  // ========== Topic Schema Field Description Tests ==========

  @Test
  void test_suggestDescription_topicSchemaField(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Topic topic = createTopicWithSchemaForTest("suggestDescTopic_" + uniqueId);

    String fieldPath = "messageSchema::customer_id::description";
    String suggestedDescription = "Customer identifier in the message";

    Task task =
        createDescriptionTask(
            "suggest_topic_" + uniqueId,
            topic.getFullyQualifiedName(),
            Entity.TOPIC,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Topic updatedTopic =
        topicResourceTest.getEntity(topic.getId(), "messageSchema", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTopic.getMessageSchema());
    assertNotNull(updatedTopic.getMessageSchema().getSchemaFields());
    Field field =
        updatedTopic.getMessageSchema().getSchemaFields().stream()
            .filter(f -> "customer_id".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(field);
    assertEquals(suggestedDescription, field.getDescription());
  }

  @Test
  void test_suggestDescription_topicNestedSchemaField(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Topic topic = createTopicWithNestedSchemaForTest("suggestDescTopicNested_" + uniqueId);

    String fieldPath = "messageSchema::\"event.details\"::description";
    String suggestedDescription = "Nested event details field";

    Task task =
        createDescriptionTask(
            "suggest_topic_nested_" + uniqueId,
            topic.getFullyQualifiedName(),
            Entity.TOPIC,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Topic updatedTopic =
        topicResourceTest.getEntity(topic.getId(), "messageSchema", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedTopic.getMessageSchema());
    Field eventField =
        updatedTopic.getMessageSchema().getSchemaFields().stream()
            .filter(f -> "event".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(eventField);
    assertNotNull(eventField.getChildren());
    Field detailsField =
        eventField.getChildren().stream()
            .filter(f -> "details".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(detailsField);
    assertEquals(suggestedDescription, detailsField.getDescription());
  }

  // ========== Container DataModel Column Tests ==========

  @Test
  void test_suggestDescription_containerDataModelColumn(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Container container = createContainerWithDataModelForTest("suggestDescContainer_" + uniqueId);

    String fieldPath = "dataModel::product_id::description";
    String suggestedDescription = "Product identifier in the container";

    Task task =
        createDescriptionTask(
            "suggest_container_" + uniqueId,
            container.getFullyQualifiedName(),
            Entity.CONTAINER,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    Container updatedContainer =
        containerResourceTest.getEntity(container.getId(), "dataModel", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedContainer.getDataModel());
    assertNotNull(updatedContainer.getDataModel().getColumns());
    Column column =
        updatedContainer.getDataModel().getColumns().stream()
            .filter(c -> "product_id".equals(c.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(column);
    assertEquals(suggestedDescription, column.getDescription());
  }

  // ========== SearchIndex Field Tests ==========

  @Test
  void test_suggestDescription_searchIndexField(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    SearchIndex searchIndex = createSearchIndexForTest("suggestDescSearchIdx_" + uniqueId);

    String fieldPath = "fields::title::description";
    String suggestedDescription = "Document title for search";

    Task task =
        createDescriptionTask(
            "suggest_searchidx_" + uniqueId,
            searchIndex.getFullyQualifiedName(),
            Entity.SEARCH_INDEX,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    SearchIndex updatedIndex =
        searchIndexResourceTest.getEntity(searchIndex.getId(), "fields", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedIndex.getFields());
    SearchIndexField field =
        updatedIndex.getFields().stream()
            .filter(f -> "title".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(field);
    assertEquals(suggestedDescription, field.getDescription());
  }

  @Test
  void test_suggestDescription_searchIndexNestedField(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    SearchIndex searchIndex =
        createSearchIndexWithNestedFieldsForTest("suggestDescSearchNested_" + uniqueId);

    String fieldPath = "fields::metadata.author::description";
    String suggestedDescription = "Author of the document";

    Task task =
        createDescriptionTask(
            "suggest_searchidx_nested_" + uniqueId,
            searchIndex.getFullyQualifiedName(),
            Entity.SEARCH_INDEX,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    SearchIndex updatedIndex =
        searchIndexResourceTest.getEntity(searchIndex.getId(), "fields", ADMIN_AUTH_HEADERS);
    SearchIndexField metadataField =
        updatedIndex.getFields().stream()
            .filter(f -> "metadata".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(metadataField);
    assertNotNull(metadataField.getChildren());
    SearchIndexField authorField =
        metadataField.getChildren().stream()
            .filter(f -> "author".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(authorField);
    assertEquals(suggestedDescription, authorField.getDescription());
  }

  // ========== APIEndpoint Schema Field Tests ==========

  @Test
  void test_suggestDescription_apiEndpointSchemaField(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    APIEndpoint apiEndpoint = createAPIEndpointWithSchemaForTest("suggestDescAPI_" + uniqueId);

    String fieldPath = "responseSchema::user_id::description";
    String suggestedDescription = "User identifier in the response";

    Task task =
        createDescriptionTask(
            "suggest_api_" + uniqueId,
            apiEndpoint.getFullyQualifiedName(),
            Entity.API_ENDPOINT,
            fieldPath,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    resolveTask(task.getId(), resolve, assigneeAuthHeaders);

    APIEndpoint updatedEndpoint =
        apiEndpointResourceTest.getEntity(
            apiEndpoint.getId(), "responseSchema", ADMIN_AUTH_HEADERS);
    assertNotNull(updatedEndpoint.getResponseSchema());
    assertNotNull(updatedEndpoint.getResponseSchema().getSchemaFields());
    Field field =
        updatedEndpoint.getResponseSchema().getSchemaFields().stream()
            .filter(f -> "user_id".equals(f.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(field);
    assertEquals(suggestedDescription, field.getDescription());
  }

  // ========== Task Rejection Tests ==========

  @Test
  void test_rejectDescriptionTask(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("rejectDescTask_" + uniqueId);
    String originalDescription = table.getDescription();

    String suggestedDescription = "This suggestion will be rejected";
    Task task =
        createDescriptionTask(
            "reject_task_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected because the suggestion is not accurate");

    Task resolved = resolveTask(task.getId(), resolve, assigneeAuthHeaders);
    assertEquals(TaskEntityStatus.Rejected, resolved.getStatus());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), null, ADMIN_AUTH_HEADERS);
    assertEquals(originalDescription, updatedTable.getDescription());
  }

  // ========== Permission Tests ==========

  @Test
  void test_resolveTask_nonAssignee_forbidden(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("permTestNonAssignee_" + uniqueId);

    String suggestedDescription = "This is a suggested description";
    Task task =
        createDescriptionTask(
            "perm_nonassignee_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            suggestedDescription);

    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(suggestedDescription);

    // USER3 is neither assignee nor owner - should be forbidden
    Map<String, String> user3Headers = authHeaders(TableResourceTest.USER3.getName());
    assertResponseContains(
        () -> resolveTask(task.getId(), resolve, user3Headers),
        FORBIDDEN,
        "resolveTask not allowed");
  }

  // Note: test_resolveTask_assigneeWithoutEditPermission_forbidden is not included because
  // the test environment uses NoopAuthorizer which always allows operations.
  // The permission check (EDIT_DESCRIPTION) IS implemented in validateUnderlyingEntityPermission()
  // in TaskRepository, but can only be tested with DefaultAuthorizer configuration.

  @Test
  void test_resolveTask_ownerCanAlwaysResolve(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);

    // Create table owned by USER1
    CreateTable createTable =
        tableResourceTest
            .createRequest("permTestOwner_" + uniqueId)
            .withDescription("Initial description")
            .withOwners(List.of(TableResourceTest.USER1_REF));
    Table table = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);

    // Create task assigned to USER2 (not the owner)
    DescriptionUpdatePayload payload =
        new DescriptionUpdatePayload()
            .withFieldPath(null)
            .withCurrentDescription(null)
            .withNewDescription("Owner updated description");

    CreateTask createTask =
        new CreateTask()
            .withName("perm_owner_" + uniqueId)
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withAssignees(List.of(taskAssignee.getName()))
            .withPayload(payload);

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);

    String ownerDescription = "Owner updated description";
    ResolveTask resolve =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(ownerDescription);

    // USER1 is the owner - should be able to resolve even if not assignee
    Map<String, String> user1Headers = authHeaders(TableResourceTest.USER1.getName());
    Task resolved = resolveTask(task.getId(), resolve, user1Headers);
    assertEquals(TaskEntityStatus.Approved, resolved.getStatus());

    Table updatedTable = tableResourceTest.getEntity(table.getId(), null, ADMIN_AUTH_HEADERS);
    assertEquals(ownerDescription, updatedTable.getDescription());
  }

  // ========== Comment Tests ==========

  @Test
  void test_addComment_success(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("commentTest_" + uniqueId);
    Task task =
        createDescriptionTask(
            "comment_task_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment
    CreateTaskComment comment = new CreateTaskComment().withMessage("This looks good!");
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);

    assertNotNull(taskWithComment.getComments());
    assertEquals(1, taskWithComment.getComments().size());
    assertEquals("This looks good!", taskWithComment.getComments().get(0).getMessage());
    assertEquals(
        taskAssignee.getName(), taskWithComment.getComments().get(0).getAuthor().getName());
  }

  @Test
  void test_addComment_withMention(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("commentMention_" + uniqueId);
    Task task =
        createDescriptionTask(
            "mention_task_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment mentioning USER1
    String mentionMessage =
        String.format(
            "Hey <#E::user::%s>, please review this task!", TableResourceTest.USER1.getName());
    CreateTaskComment comment = new CreateTaskComment().withMessage(mentionMessage);
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);

    assertNotNull(taskWithComment.getComments());
    assertEquals(1, taskWithComment.getComments().size());
    assertEquals(mentionMessage, taskWithComment.getComments().get(0).getMessage());
  }

  @Test
  void test_editComment_byAuthor_success(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("editComment_" + uniqueId);
    Task task =
        createDescriptionTask(
            "edit_comment_task_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment
    CreateTaskComment comment = new CreateTaskComment().withMessage("Original comment");
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);
    UUID commentId = taskWithComment.getComments().get(0).getId();

    // Edit the comment (by the same author)
    CreateTaskComment updatedComment = new CreateTaskComment().withMessage("Updated comment");
    Task taskWithUpdatedComment =
        editComment(task.getId(), commentId, updatedComment, assigneeAuthHeaders);

    assertEquals(1, taskWithUpdatedComment.getComments().size());
    assertEquals("Updated comment", taskWithUpdatedComment.getComments().get(0).getMessage());
  }

  @Test
  void test_editComment_byNonAuthor_forbidden(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("editCommentForbidden_" + uniqueId);
    Task task =
        createDescriptionTask(
            "edit_comment_forbidden_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment as assignee (USER2)
    CreateTaskComment comment = new CreateTaskComment().withMessage("Assignee's comment");
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);
    UUID commentId = taskWithComment.getComments().get(0).getId();

    // Try to edit the comment as creator (USER1) - should fail
    CreateTaskComment updatedComment = new CreateTaskComment().withMessage("Edited by creator");
    Map<String, String> user1Headers = authHeaders(TableResourceTest.USER1.getName());
    assertResponseContains(
        () -> editComment(task.getId(), commentId, updatedComment, user1Headers),
        FORBIDDEN,
        "not authorized to edit this comment");
  }

  @Test
  void test_deleteComment_byAuthor_success(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("deleteComment_" + uniqueId);
    Task task =
        createDescriptionTask(
            "delete_comment_task_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment
    CreateTaskComment comment = new CreateTaskComment().withMessage("Comment to delete");
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);
    UUID commentId = taskWithComment.getComments().get(0).getId();

    // Delete the comment (by the same author)
    Task taskAfterDelete = deleteComment(task.getId(), commentId, assigneeAuthHeaders);

    assertEquals(0, taskAfterDelete.getComments().size());
  }

  @Test
  void test_deleteComment_byAdmin_success(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("deleteCommentAdmin_" + uniqueId);
    Task task =
        createDescriptionTask(
            "delete_comment_admin_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment as assignee
    CreateTaskComment comment = new CreateTaskComment().withMessage("Comment to delete by admin");
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);
    UUID commentId = taskWithComment.getComments().get(0).getId();

    // Admin can delete any comment
    Task taskAfterDelete = deleteComment(task.getId(), commentId, ADMIN_AUTH_HEADERS);

    assertEquals(0, taskAfterDelete.getComments().size());
  }

  @Test
  void test_deleteComment_byNonAuthor_forbidden(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("deleteCommentForbidden_" + uniqueId);
    Task task =
        createDescriptionTask(
            "delete_comment_forbidden_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add a comment as assignee (USER2)
    CreateTaskComment comment = new CreateTaskComment().withMessage("Assignee's comment");
    Task taskWithComment = addComment(task.getId(), comment, assigneeAuthHeaders);
    UUID commentId = taskWithComment.getComments().get(0).getId();

    // Try to delete the comment as creator (USER1) - should fail
    Map<String, String> user1Headers = authHeaders(TableResourceTest.USER1.getName());
    assertResponseContains(
        () -> deleteComment(task.getId(), commentId, user1Headers),
        FORBIDDEN,
        "not authorized to delete this comment");
  }

  @Test
  void test_multipleComments_orderPreserved(TestInfo testInfo) throws IOException {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    Table table = createTableForTest("multiComment_" + uniqueId);
    Task task =
        createDescriptionTask(
            "multi_comment_task_" + uniqueId,
            table.getFullyQualifiedName(),
            Entity.TABLE,
            null,
            null,
            "Suggested description");

    // Add multiple comments
    addComment(
        task.getId(), new CreateTaskComment().withMessage("First comment"), assigneeAuthHeaders);
    addComment(
        task.getId(), new CreateTaskComment().withMessage("Second comment"), creatorAuthHeaders);
    Task taskWithComments =
        addComment(
            task.getId(), new CreateTaskComment().withMessage("Third comment"), ADMIN_AUTH_HEADERS);

    assertEquals(3, taskWithComments.getComments().size());
    assertEquals("First comment", taskWithComments.getComments().get(0).getMessage());
    assertEquals("Second comment", taskWithComments.getComments().get(1).getMessage());
    assertEquals("Third comment", taskWithComments.getComments().get(2).getMessage());
  }

  // ========== Helper Methods ==========

  private Table createTableForTest(String name) throws IOException {
    CreateTable createTable =
        tableResourceTest
            .createRequest(name)
            .withDescription("Initial description")
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  private Table createTableWithColumnsForTest(String name) throws IOException {
    List<Column> columns =
        Arrays.asList(
            new Column()
                .withName("customer_id")
                .withDataType(ColumnDataType.INT)
                .withDescription("Initial customer_id description"),
            new Column()
                .withName("email")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Initial email description"),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP));

    CreateTable createTable =
        tableResourceTest
            .createRequest(name)
            .withColumns(columns)
            .withTableConstraints(List.of())
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  private Table createTableWithNestedColumnsForTest(String name) throws IOException {
    Column streetCol =
        new Column()
            .withName("street")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Initial street description");
    Column cityCol = new Column().withName("city").withDataType(ColumnDataType.STRING);
    Column zipCol = new Column().withName("zip").withDataType(ColumnDataType.STRING);

    Column addressCol =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(Arrays.asList(streetCol, cityCol, zipCol));

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT), addressCol);

    CreateTable createTable =
        tableResourceTest
            .createRequest(name)
            .withColumns(columns)
            .withTableConstraints(List.of())
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  private Table createTableWithDeeplyNestedColumnsForTest(String name) throws IOException {
    Column createdByCol =
        new Column()
            .withName("created_by")
            .withDataType(ColumnDataType.STRING)
            .withDescription("Initial created_by description");
    Column createdAtCol =
        new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP);

    Column auditCol =
        new Column()
            .withName("audit")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(Arrays.asList(createdByCol, createdAtCol));

    Column versionCol = new Column().withName("version").withDataType(ColumnDataType.INT);

    Column metadataCol =
        new Column()
            .withName("metadata")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(Arrays.asList(auditCol, versionCol));

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT), metadataCol);

    CreateTable createTable =
        tableResourceTest
            .createRequest(name)
            .withColumns(columns)
            .withTableConstraints(List.of())
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
  }

  private Topic createTopicWithSchemaForTest(String name) throws IOException {
    List<Field> schemaFields =
        Arrays.asList(
            new Field()
                .withName("customer_id")
                .withDataType(FieldDataType.STRING)
                .withDescription("Initial customer_id description"),
            new Field().withName("event_type").withDataType(FieldDataType.STRING),
            new Field().withName("timestamp").withDataType(FieldDataType.LONG));

    MessageSchema schema =
        new MessageSchema().withSchemaType(SchemaType.Avro).withSchemaFields(schemaFields);

    CreateTopic createTopic =
        topicResourceTest
            .createRequest(name)
            .withMessageSchema(schema)
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return topicResourceTest.createAndCheckEntity(createTopic, ADMIN_AUTH_HEADERS);
  }

  private Topic createTopicWithNestedSchemaForTest(String name) throws IOException {
    Field detailsField =
        new Field()
            .withName("details")
            .withDataType(FieldDataType.STRING)
            .withDescription("Initial details description");
    Field codeField = new Field().withName("code").withDataType(FieldDataType.INT);

    Field eventField =
        new Field()
            .withName("event")
            .withDataType(FieldDataType.RECORD)
            .withChildren(Arrays.asList(detailsField, codeField));

    List<Field> schemaFields =
        Arrays.asList(new Field().withName("id").withDataType(FieldDataType.STRING), eventField);

    MessageSchema schema =
        new MessageSchema().withSchemaType(SchemaType.Avro).withSchemaFields(schemaFields);

    CreateTopic createTopic =
        topicResourceTest
            .createRequest(name)
            .withMessageSchema(schema)
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return topicResourceTest.createAndCheckEntity(createTopic, ADMIN_AUTH_HEADERS);
  }

  private Container createContainerWithDataModelForTest(String name) throws IOException {
    List<Column> columns =
        Arrays.asList(
            new Column()
                .withName("product_id")
                .withDataType(ColumnDataType.STRING)
                .withDescription("Initial product_id description"),
            new Column().withName("quantity").withDataType(ColumnDataType.INT));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer createContainer =
        containerResourceTest
            .createRequest(name)
            .withDataModel(dataModel)
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return containerResourceTest.createAndCheckEntity(createContainer, ADMIN_AUTH_HEADERS);
  }

  private SearchIndex createSearchIndexForTest(String name) throws IOException {
    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField()
                .withName("title")
                .withDataType(SearchIndexDataType.TEXT)
                .withDescription("Initial title description"),
            new SearchIndexField().withName("content").withDataType(SearchIndexDataType.TEXT),
            new SearchIndexField().withName("score").withDataType(SearchIndexDataType.DOUBLE));

    CreateSearchIndex createSearchIndex =
        searchIndexResourceTest
            .createRequest(name)
            .withFields(fields)
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return searchIndexResourceTest.createAndCheckEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
  }

  private SearchIndex createSearchIndexWithNestedFieldsForTest(String name) throws IOException {
    SearchIndexField authorField =
        new SearchIndexField()
            .withName("author")
            .withDataType(SearchIndexDataType.TEXT)
            .withDescription("Initial author description");
    SearchIndexField dateField =
        new SearchIndexField().withName("date").withDataType(SearchIndexDataType.DATE);

    SearchIndexField metadataField =
        new SearchIndexField()
            .withName("metadata")
            .withDataType(SearchIndexDataType.NESTED)
            .withChildren(Arrays.asList(authorField, dateField));

    List<SearchIndexField> fields =
        Arrays.asList(
            new SearchIndexField().withName("id").withDataType(SearchIndexDataType.KEYWORD),
            metadataField);

    CreateSearchIndex createSearchIndex =
        searchIndexResourceTest
            .createRequest(name)
            .withFields(fields)
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return searchIndexResourceTest.createAndCheckEntity(createSearchIndex, ADMIN_AUTH_HEADERS);
  }

  private APIEndpoint createAPIEndpointWithSchemaForTest(String name) throws IOException {
    List<Field> responseFields =
        Arrays.asList(
            new Field()
                .withName("user_id")
                .withDataType(FieldDataType.STRING)
                .withDescription("Initial user_id description"),
            new Field().withName("status").withDataType(FieldDataType.STRING));

    APISchema responseSchema =
        new APISchema().withSchemaType(SchemaType.JSON).withSchemaFields(responseFields);

    CreateAPIEndpoint createAPIEndpoint =
        apiEndpointResourceTest
            .createRequest(name)
            .withResponseSchema(responseSchema)
            .withOwners(List.of(TableResourceTest.USER2_REF));
    return apiEndpointResourceTest.createAndCheckEntity(createAPIEndpoint, ADMIN_AUTH_HEADERS);
  }

  private Task createDescriptionTask(
      String taskName,
      String entityFqn,
      String entityType,
      String fieldPath,
      String currentDescription,
      String newDescription)
      throws HttpResponseException {

    DescriptionUpdatePayload payload =
        new DescriptionUpdatePayload()
            .withFieldPath(fieldPath)
            .withCurrentDescription(currentDescription)
            .withNewDescription(newDescription);

    CreateTask createTask =
        new CreateTask()
            .withName(taskName)
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(entityFqn)
            .withAboutType(entityType)
            .withAssignees(List.of(taskAssignee.getName()))
            .withPayload(payload);

    return createTask(createTask, ADMIN_AUTH_HEADERS);
  }

  private Task createTask(CreateTask createTask, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks");
    return TestUtils.post(
        target, createTask, Task.class, Status.CREATED.getStatusCode(), authHeaders);
  }

  private Task resolveTask(UUID taskId, ResolveTask resolveTask, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/resolve");
    return TestUtils.post(target, resolveTask, Task.class, OK.getStatusCode(), authHeaders);
  }

  private Task addComment(UUID taskId, CreateTaskComment comment, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/comments");
    return TestUtils.post(target, comment, Task.class, OK.getStatusCode(), authHeaders);
  }

  private Task editComment(
      UUID taskId, UUID commentId, CreateTaskComment comment, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/comments/" + commentId);
    Response response =
        org.openmetadata.service.security.SecurityUtil.addHeaders(target, authHeaders)
            .method("PATCH", jakarta.ws.rs.client.Entity.json(comment));
    return TestUtils.readResponse(response, Task.class, OK.getStatusCode());
  }

  private Task deleteComment(UUID taskId, UUID commentId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/comments/" + commentId);
    return TestUtils.delete(target, Task.class, authHeaders);
  }
}
