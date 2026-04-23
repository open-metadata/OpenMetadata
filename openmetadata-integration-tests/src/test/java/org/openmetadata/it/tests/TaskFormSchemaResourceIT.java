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

import static org.junit.jupiter.api.Assertions.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.entity.feed.FormSchema;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.feed.UiSchema;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class TaskFormSchemaResourceIT extends BaseEntityIT<TaskFormSchema, TaskFormSchema> {

  public TaskFormSchemaResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = false;
    supportsSearchIndex = false;
    supportsVersionHistory = true;
  }

  private FormSchema buildFormSchema() {
    Map<String, Object> descProp = new LinkedHashMap<>();
    descProp.put("type", "string");
    descProp.put("title", "Description");

    Map<String, Object> properties = new LinkedHashMap<>();
    properties.put("description", descProp);

    return new FormSchema()
        .withAdditionalProperty("type", "object")
        .withAdditionalProperty("properties", properties);
  }

  private String uniqueTaskType(String seed) {
    return "TestType_" + Integer.toUnsignedString(seed.hashCode(), 16);
  }

  @Override
  protected TaskFormSchema createMinimalRequest(TestNamespace ns) {
    String name = ns.prefix("form-schema");
    return new TaskFormSchema()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDescription("Test form schema")
        .withTaskType(uniqueTaskType(name))
        .withTaskCategory("MetadataUpdate")
        .withFormSchema(buildFormSchema());
  }

  @Override
  protected TaskFormSchema createRequest(String name, TestNamespace ns) {
    return new TaskFormSchema()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDescription("Test form schema")
        .withTaskType(uniqueTaskType(name))
        .withTaskCategory("MetadataUpdate")
        .withFormSchema(buildFormSchema());
  }

  @Override
  protected TaskFormSchema createEntity(TaskFormSchema createRequest) {
    return SdkClients.adminClient().taskFormSchemas().create(createRequest);
  }

  @Override
  protected TaskFormSchema getEntity(String id) {
    return SdkClients.adminClient().taskFormSchemas().get(id);
  }

  @Override
  protected TaskFormSchema getEntityByName(String fqn) {
    return SdkClients.adminClient().taskFormSchemas().getByName(fqn);
  }

  @Override
  protected TaskFormSchema patchEntity(String id, TaskFormSchema entity) {
    return SdkClients.adminClient().taskFormSchemas().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().taskFormSchemas().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().taskFormSchemas().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .taskFormSchemas()
        .delete(id, Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "taskFormSchema";
  }

  @Override
  protected ListResponse<TaskFormSchema> listEntities(ListParams params) {
    return SdkClients.adminClient().taskFormSchemas().list(params);
  }

  @Override
  protected TaskFormSchema getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().taskFormSchemas().get(id, fields);
  }

  @Override
  protected TaskFormSchema getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().taskFormSchemas().getByName(fqn, fields);
  }

  @Override
  protected TaskFormSchema getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().taskFormSchemas().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().taskFormSchemas().getVersionList(id);
  }

  @Override
  protected TaskFormSchema getVersion(UUID id, Double version) {
    return SdkClients.adminClient().taskFormSchemas().getVersion(id.toString(), version);
  }

  @Override
  protected void validateCreatedEntity(TaskFormSchema created, TaskFormSchema request) {
    assertEquals(request.getName(), created.getName());
    assertEquals(request.getTaskType(), created.getTaskType());
    assertEquals(request.getTaskCategory(), created.getTaskCategory());
    assertNotNull(created.getFormSchema());
  }

  @Test
  void testCreateFormSchemaWithUiSchema(TestNamespace ns) {
    UiSchema uiSchema =
        new UiSchema().withAdditionalProperty("description", Map.of("ui:widget", "textarea"));

    TaskFormSchema request =
        new TaskFormSchema()
            .withId(UUID.randomUUID())
            .withName(ns.prefix("ui-schema"))
            .withDescription("Schema with UI config")
            .withTaskType(uniqueTaskType(ns.prefix("ui-schema-type")))
            .withTaskCategory("MetadataUpdate")
            .withFormSchema(buildFormSchema())
            .withUiSchema(uiSchema);

    TaskFormSchema created = createEntity(request);
    assertNotNull(created.getUiSchema());
    assertEquals(request.getTaskType(), created.getTaskType());
  }

  @Test
  void testUpdateFormSchema(TestNamespace ns) {
    TaskFormSchema request = createMinimalRequest(ns);
    TaskFormSchema created = createEntity(request);

    FormSchema updatedFormSchema =
        new FormSchema()
            .withAdditionalProperty("type", "object")
            .withAdditionalProperty(
                "properties", Map.of("description", Map.of("type", "string", "maxLength", 500)));

    created.setFormSchema(updatedFormSchema);
    TaskFormSchema updated = patchEntity(created.getId().toString(), created);
    assertNotNull(updated.getFormSchema());
  }

  @Test
  void testGetFormSchemaById(TestNamespace ns) {
    TaskFormSchema request = createMinimalRequest(ns);
    TaskFormSchema created = createEntity(request);

    TaskFormSchema fetched = getEntity(created.getId().toString());
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getTaskType(), fetched.getTaskType());
  }

  @Test
  void testGetFormSchemaByName(TestNamespace ns) {
    TaskFormSchema request = createMinimalRequest(ns);
    TaskFormSchema created = createEntity(request);

    TaskFormSchema fetched = getEntityByName(created.getFullyQualifiedName());
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void testListFormSchemas(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      TaskFormSchema schemaReq =
          new TaskFormSchema()
              .withId(UUID.randomUUID())
              .withName(ns.prefix("list-schema-" + i))
              .withDescription("Schema " + i)
              .withTaskType("Type" + i)
              .withTaskCategory("MetadataUpdate")
              .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"));
      createEntity(schemaReq);
    }

    ListResponse<TaskFormSchema> list = listEntities(new ListParams().setLimit(100));
    assertNotNull(list);
    assertNotNull(list.getData());
    assertTrue(list.getData().size() >= 3);
  }

  @Test
  void testSoftDeleteAndRestore(TestNamespace ns) {
    TaskFormSchema request = createMinimalRequest(ns);
    TaskFormSchema created = createEntity(request);

    deleteEntity(created.getId().toString());

    TaskFormSchema deleted = getEntityIncludeDeleted(created.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(created.getId().toString());
    TaskFormSchema restored = getEntity(created.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void testVersionHistory(TestNamespace ns) {
    TaskFormSchema request = createMinimalRequest(ns);
    TaskFormSchema created = createEntity(request);

    created.setDescription("Updated for version test");
    patchEntity(created.getId().toString(), created);

    EntityHistory history = getVersionHistory(created.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void testListFormSchemasByTaskCategory(TestNamespace ns) {
    createEntity(
        new TaskFormSchema()
            .withId(UUID.randomUUID())
            .withName(ns.prefix("approval-schema"))
            .withTaskType(uniqueTaskType(ns.prefix("approval-schema-type")))
            .withTaskCategory("Approval")
            .withFormSchema(buildFormSchema()));
    createEntity(
        new TaskFormSchema()
            .withId(UUID.randomUUID())
            .withName(ns.prefix("metadata-schema"))
            .withTaskType(uniqueTaskType(ns.prefix("metadata-schema-type")))
            .withTaskCategory("MetadataUpdate")
            .withFormSchema(buildFormSchema()));

    ListResponse<TaskFormSchema> approvalSchemas =
        listEntities(new ListParams().setLimit(100).addQueryParam("taskCategory", "Approval"));

    assertTrue(
        approvalSchemas.getData().stream()
            .allMatch(schema -> "Approval".equals(schema.getTaskCategory())));
  }

  @Test
  void testRejectsInvalidFormSchema(TestNamespace ns) {
    TaskFormSchema request =
        new TaskFormSchema()
            .withId(UUID.randomUUID())
            .withName(ns.prefix("invalid-form-schema"))
            .withTaskType("CustomTask")
            .withTaskCategory("Custom")
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "array"));

    assertThrows(InvalidRequestException.class, () -> createEntity(request));
  }
}
