/*
 *  Copyright 2021 Collate
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

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for NotificationTemplate entity operations.
 *
 * <p>Extends BaseEntityIT to inherit all common entity tests. Adds notification
 * template-specific tests for template subject, template body, and handlebars processing.
 *
 * <p>Migrated from: org.openmetadata.service.resources.events.NotificationTemplateResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class NotificationTemplateResourceIT
    extends BaseEntityIT<NotificationTemplate, CreateNotificationTemplate> {

  public NotificationTemplateResourceIT() {
    supportsFollowers = false;
    supportsTags = false;
    supportsDomains = false; // NotificationTemplate doesn't support domains
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = false; // NotificationTemplate doesn't support owners
    supportsSearchIndex = false; // NotificationTemplate doesn't have a search index
  }

  @Override
  protected CreateNotificationTemplate createMinimalRequest(TestNamespace ns) {
    return new CreateNotificationTemplate()
        .withName(ns.prefix("template"))
        .withTemplateSubject("Test Subject")
        .withTemplateBody("Test Body: {{eventType}}")
        .withDescription("Test notification template created by integration test");
  }

  @Override
  protected CreateNotificationTemplate createRequest(String name, TestNamespace ns) {
    return new CreateNotificationTemplate()
        .withName(name)
        .withTemplateSubject("Test Subject")
        .withTemplateBody("Test Body: {{eventType}}")
        .withDescription("Test notification template");
  }

  @Override
  protected NotificationTemplate createEntity(CreateNotificationTemplate createRequest) {
    return SdkClients.adminClient().notificationTemplates().create(createRequest);
  }

  @Override
  protected NotificationTemplate getEntity(String id) {
    return SdkClients.adminClient().notificationTemplates().get(id);
  }

  @Override
  protected NotificationTemplate getEntityByName(String fqn) {
    return SdkClients.adminClient().notificationTemplates().getByName(fqn);
  }

  @Override
  protected NotificationTemplate patchEntity(String id, NotificationTemplate entity) {
    return SdkClients.adminClient().notificationTemplates().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().notificationTemplates().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().notificationTemplates().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .notificationTemplates()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "notificationTemplate";
  }

  @Override
  protected void validateCreatedEntity(
      NotificationTemplate entity, CreateNotificationTemplate createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
    assertEquals(createRequest.getTemplateSubject(), entity.getTemplateSubject());
    assertEquals(createRequest.getTemplateBody(), entity.getTemplateBody());
  }

  @Override
  protected NotificationTemplate getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().notificationTemplates().get(id, fields);
  }

  @Override
  protected NotificationTemplate getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().notificationTemplates().getByName(fqn, fields);
  }

  @Override
  protected NotificationTemplate getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().notificationTemplates().get(id, null, "deleted");
  }

  @Override
  protected ListResponse<NotificationTemplate> listEntities(ListParams params) {
    return SdkClients.adminClient().notificationTemplates().list(params);
  }

  @Test
  void test_createTemplateWithDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create =
        new CreateNotificationTemplate()
            .withName(ns.prefix("templateWithDisplay"))
            .withDisplayName("My Template Display Name")
            .withTemplateSubject("Subject Line")
            .withTemplateBody("Body: {{entityType}}")
            .withDescription("Template with display name");

    NotificationTemplate template = createEntity(create);
    assertEquals("My Template Display Name", template.getDisplayName());
  }

  @Test
  void test_createTemplateWithHandlebarsVariables(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create =
        new CreateNotificationTemplate()
            .withName(ns.prefix("handlebarsTemplate"))
            .withTemplateSubject("{{eventType}} - {{entityType}}")
            .withTemplateBody("Entity: {{entity.name}}, Changed by: {{updatedBy}}")
            .withDescription("Template with handlebars variables");

    NotificationTemplate template = createEntity(create);
    assertNotNull(template.getTemplateSubject());
    assertTrue(template.getTemplateSubject().contains("{{eventType}}"));
    assertTrue(template.getTemplateBody().contains("{{entity.name}}"));
  }

  @Test
  void test_updateTemplateSubject(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);

    template.setTemplateSubject("Updated Subject: {{entityType}}");
    NotificationTemplate updated = patchEntity(template.getId().toString(), template);

    assertEquals("Updated Subject: {{entityType}}", updated.getTemplateSubject());
  }

  @Test
  void test_updateTemplateBody(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);

    String newBody = "Updated Body: Entity {{entity.fullyQualifiedName}} was modified";
    template.setTemplateBody(newBody);
    NotificationTemplate updated = patchEntity(template.getId().toString(), template);

    assertEquals(newBody, updated.getTemplateBody());
  }

  @Test
  void test_updateTemplateDescription(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);

    template.setDescription("Updated template description");
    NotificationTemplate updated = patchEntity(template.getId().toString(), template);

    assertEquals("Updated template description", updated.getDescription());
  }

  @Test
  void test_listNotificationTemplates(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    for (int i = 0; i < 3; i++) {
      CreateNotificationTemplate create =
          new CreateNotificationTemplate()
              .withName(ns.prefix("listTemplate" + i))
              .withTemplateSubject("Subject " + i)
              .withTemplateBody("Body " + i)
              .withDescription("Template for list test");
      createEntity(create);
    }

    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<NotificationTemplate> response = listEntities(params);

    assertNotNull(response);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 3);
  }

  @Test
  void test_getTemplateById(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate created = createEntity(create);

    NotificationTemplate fetched = getEntity(created.getId().toString());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getTemplateSubject(), fetched.getTemplateSubject());
    assertEquals(created.getTemplateBody(), fetched.getTemplateBody());
  }

  @Test
  void test_getTemplateByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String templateName = ns.prefix("templateByName");
    CreateNotificationTemplate create =
        new CreateNotificationTemplate()
            .withName(templateName)
            .withTemplateSubject("Subject")
            .withTemplateBody("Body")
            .withDescription("Template for name lookup test");

    NotificationTemplate created = createEntity(create);

    NotificationTemplate fetched = getEntityByName(templateName);

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(templateName, fetched.getName());
  }

  @Test
  void test_softDeleteAndRestoreTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);
    String templateId = template.getId().toString();

    deleteEntity(templateId);

    assertThrows(
        Exception.class, () -> getEntity(templateId), "Deleted template should not be retrievable");

    NotificationTemplate deleted = getEntityIncludeDeleted(templateId);
    assertTrue(deleted.getDeleted());

    restoreEntity(templateId);

    NotificationTemplate restored = getEntity(templateId);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_templateVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);
    assertEquals(0.1, template.getVersion(), 0.001);

    template.setDescription("Updated description v1");
    NotificationTemplate v2 = patchEntity(template.getId().toString(), template);
    assertEquals(0.2, v2.getVersion(), 0.001);

    var history = client.notificationTemplates().getVersionList(template.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_hardDeleteTemplate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);
    String templateId = template.getId().toString();

    hardDeleteEntity(templateId);

    assertThrows(
        Exception.class,
        () -> getEntityIncludeDeleted(templateId),
        "Hard deleted template should not be retrievable");
  }

  @Test
  void test_updateTemplateDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateNotificationTemplate create = createMinimalRequest(ns);
    NotificationTemplate template = createEntity(create);

    template.setDisplayName("Updated Display Name");
    NotificationTemplate updated = patchEntity(template.getId().toString(), template);

    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_templateWithLongBody(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    StringBuilder longBody = new StringBuilder();
    for (int i = 0; i < 100; i++) {
      longBody.append("Line ").append(i).append(": {{entity.name}} was updated. ");
    }

    CreateNotificationTemplate create =
        new CreateNotificationTemplate()
            .withName(ns.prefix("longBodyTemplate"))
            .withTemplateSubject("Long Body Template")
            .withTemplateBody(longBody.toString())
            .withDescription("Template with long body");

    NotificationTemplate template = createEntity(create);
    assertNotNull(template.getTemplateBody());
    assertTrue(template.getTemplateBody().length() > 1000);
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().notificationTemplates().getVersionList(id);
  }

  @Override
  protected NotificationTemplate getVersion(UUID id, Double version) {
    return SdkClients.adminClient().notificationTemplates().getVersion(id.toString(), version);
  }
}
