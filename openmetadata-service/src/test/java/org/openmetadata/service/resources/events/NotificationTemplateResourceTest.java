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

package org.openmetadata.service.resources.events;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CONFLICT;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;

@Slf4j
public class NotificationTemplateResourceTest
    extends EntityResourceTest<NotificationTemplate, CreateNotificationTemplate> {

  public NotificationTemplateResourceTest() {
    super(
        Entity.NOTIFICATION_TEMPLATE,
        NotificationTemplate.class,
        NotificationTemplateResource.NotificationTemplateList.class,
        "notificationTemplates",
        NotificationTemplateResource.FIELDS);
    supportsFieldsQueryParam = false;
  }

  @Override
  public CreateNotificationTemplate createRequest(String name) {
    return new CreateNotificationTemplate()
        .withName(name)
        .withDisplayName(name != null ? "Display " + name : null)
        .withDescription(name != null ? "Template for " + name : null)
        .withTemplateBody("<div>{{entity.name}} has been updated by {{updatedBy}}</div>");
  }

  @Override
  public void validateCreatedEntity(
      NotificationTemplate template,
      CreateNotificationTemplate createRequest,
      Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), template.getName());
    assertEquals(createRequest.getDisplayName(), template.getDisplayName());
    assertEquals(createRequest.getDescription(), template.getDescription());
    assertEquals(createRequest.getTemplateBody(), template.getTemplateBody());
    assertNotNull(template.getVersion());
    assertNotNull(template.getUpdatedAt());
    assertNotNull(template.getUpdatedBy());
    assertNotNull(template.getHref());
    assertNotNull(template.getFullyQualifiedName());
    // FQN may be quoted if name contains special characters
    String expectedFqn = createRequest.getName();
    String actualFqn = template.getFullyQualifiedName();
    // Check if FQN matches, handling potential quoting
    assertTrue(
        actualFqn.equals(expectedFqn) || actualFqn.equals("\"" + expectedFqn + "\""),
        "FQN mismatch: expected " + expectedFqn + " or quoted version, got " + actualFqn);
  }

  @Override
  public void compareEntities(
      NotificationTemplate expected,
      NotificationTemplate updated,
      Map<String, String> authHeaders) {
    assertEquals(expected.getName(), updated.getName());
    assertEquals(expected.getFullyQualifiedName(), updated.getFullyQualifiedName());
    assertEquals(expected.getDescription(), updated.getDescription());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getProvider(), updated.getProvider());
    assertEquals(expected.getTemplateBody(), updated.getTemplateBody());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    switch (fieldName) {
      case "templateBody":
      case "description":
      case "displayName":
        assertEquals(expected, actual);
        break;
      default:
        assertCommonFieldChange(fieldName, expected, actual);
        break;
    }
  }

  @Override
  public NotificationTemplate validateGetWithDifferentFields(
      NotificationTemplate template, boolean byName) throws HttpResponseException {
    String fields = "";
    template =
        byName
            ? getEntityByName(template.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(template.getId(), fields, ADMIN_AUTH_HEADERS);
    assertNotNull(template.getName());
    assertNotNull(template.getFullyQualifiedName());
    assertNotNull(template.getDescription());
    assertNotNull(template.getProvider());
    assertNotNull(template.getTemplateBody());
    return template;
  }

  @Test
  void post_validNotificationTemplate_200(TestInfo test) throws IOException {
    CreateNotificationTemplate create =
        createRequest(getEntityName(test))
            .withTemplateBody(
                "<h3>Pipeline {{entity.name}} Status Update</h3>"
                    + "<p>Status: {{entity.pipelineStatus}}</p>");
    NotificationTemplate template = createEntity(create, ADMIN_AUTH_HEADERS);

    assertEquals(getEntityName(test), template.getFullyQualifiedName().replaceAll("^\"|\"$", ""));
    assertEquals(ProviderType.USER, template.getProvider());
  }

  @Test
  void post_invalidHandlebarsTemplate_400(TestInfo test) {
    CreateNotificationTemplate create =
        createRequest(getEntityName(test)).withTemplateBody("{{#if entity.name}} Missing end if");

    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "Invalid template syntax");
  }

  @Test
  void post_duplicateNotificationTemplate_409(TestInfo test) throws IOException {
    CreateNotificationTemplate create = createRequest(getEntityName(test));
    createEntity(create, ADMIN_AUTH_HEADERS);

    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), CONFLICT, "Entity already exists");
  }

  @Test
  void patch_notificationTemplateAttributes_200(TestInfo test) throws IOException {
    NotificationTemplate template =
        createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    String origTemplateBody = template.getTemplateBody();
    String origDescription = template.getDescription();
    String origDisplayName = template.getDisplayName();

    String newTemplateBody = "<div class='notification'>{{entity.name}} - Updated Template</div>";
    String newDescription = "Updated description";
    String newDisplayName = "Updated Display Name";

    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newTemplateBody));
    template = patchEntity(template.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);
    assertEquals(newTemplateBody, template.getTemplateBody());

    String json2 =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/description\",\"value\":%s}]",
            JsonUtils.pojoToJson(newDescription));
    template = patchEntity(template.getId(), JsonUtils.readTree(json2), ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, template.getDescription());

    String json3 =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":%s}]",
            JsonUtils.pojoToJson(newDisplayName));
    template = patchEntity(template.getId(), JsonUtils.readTree(json3), ADMIN_AUTH_HEADERS);
    assertEquals(newDisplayName, template.getDisplayName());

    ChangeDescription change = getChangeDescription(template, MINOR_UPDATE);
    fieldUpdated(change, "templateBody", origTemplateBody, newTemplateBody);
    fieldUpdated(change, "description", origDescription, newDescription);
    fieldUpdated(change, "displayName", origDisplayName, newDisplayName);
  }

  @Test
  void patch_invalidTemplateBody_400(TestInfo test) throws IOException {
    NotificationTemplate template =
        createEntity(createRequest(getEntityName(test)), ADMIN_AUTH_HEADERS);

    String invalidTemplateBody = "{{#each items}} Missing end each";
    assertResponse(
        () -> {
          String json =
              String.format(
                  "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
                  JsonUtils.pojoToJson(invalidTemplateBody));
          patchEntity(template.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);
        },
        BAD_REQUEST,
        "Invalid template syntax");
  }

  @Test
  void put_updateNotificationTemplate_200(TestInfo test) throws IOException {
    CreateNotificationTemplate request = createRequest(getEntityName(test));
    NotificationTemplate template = createEntity(request, ADMIN_AUTH_HEADERS);

    String newTemplateBody = "<h1>Updated: {{entity.name}}</h1>";
    String newDescription = "Updated via PUT";

    CreateNotificationTemplate updateRequest =
        createRequest(template.getName())
            .withDisplayName(template.getDisplayName())
            .withDescription(newDescription)
            .withTemplateBody(newTemplateBody);

    NotificationTemplate updatedTemplate = updateEntity(updateRequest, OK, ADMIN_AUTH_HEADERS);
    assertEquals(newTemplateBody, updatedTemplate.getTemplateBody());
    assertEquals(newDescription, updatedTemplate.getDescription());
    assertEquals(template.getId(), updatedTemplate.getId());

    ChangeDescription change = getChangeDescription(updatedTemplate, MINOR_UPDATE);
    fieldUpdated(change, "templateBody", template.getTemplateBody(), newTemplateBody);
    fieldUpdated(change, "description", template.getDescription(), newDescription);
  }

  @Test
  void get_notificationTemplateByFQN_200(TestInfo test) throws IOException {
    CreateNotificationTemplate create = createRequest(getEntityName(test));
    NotificationTemplate template = createEntity(create, ADMIN_AUTH_HEADERS);

    // Use the actual FQN from the created template for fetching
    NotificationTemplate fetched =
        getEntityByName(template.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(template.getId(), fetched.getId());
    assertEquals(template.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_multipleTemplates(TestInfo test) throws IOException {
    // Test creating multiple templates
    String[] templateNames = {"entity_change", "test_change", "custom_alert"};

    for (String templateName : templateNames) {
      String name = getEntityName(test) + "_" + templateName;
      CreateNotificationTemplate create =
          createRequest(name).withTemplateBody("<p>Template for {{entity.name}}</p>");

      NotificationTemplate template = createEntity(create, ADMIN_AUTH_HEADERS);
      assertEquals(name, template.getFullyQualifiedName().replaceAll("^\"|\"$", ""));
      assertEquals(ProviderType.USER, template.getProvider());
    }
  }

  @Test
  void test_templateValidationWithComplexHandlebars(TestInfo test) throws IOException {
    String complexTemplate =
        "{{#if entity.owner}}"
            + "<p>Owner: {{entity.owner.name}}</p>"
            + "{{else}}"
            + "<p>No owner assigned</p>"
            + "{{/if}}"
            + "{{#each entity.tags as |tag|}}"
            + "<span class='tag'>{{tag.tagFQN}}</span>"
            + "{{/each}}";

    CreateNotificationTemplate create =
        createRequest(getEntityName(test)).withTemplateBody(complexTemplate);

    NotificationTemplate template = createEntity(create, ADMIN_AUTH_HEADERS);
    assertEquals(complexTemplate, template.getTemplateBody());
  }

  @Test
  void test_listFilterByProvider(TestInfo test) throws IOException {
    // Create multiple templates with USER provider
    String userTemplate1 = getEntityName(test) + "_user1";
    String userTemplate2 = getEntityName(test) + "_user2";

    CreateNotificationTemplate create1 =
        createRequest(userTemplate1).withTemplateBody("<p>User template 1</p>");
    CreateNotificationTemplate create2 =
        createRequest(userTemplate2).withTemplateBody("<p>User template 2</p>");

    NotificationTemplate template1 = createEntity(create1, ADMIN_AUTH_HEADERS);
    NotificationTemplate template2 = createEntity(create2, ADMIN_AUTH_HEADERS);

    // Verify both templates have USER provider
    assertEquals(ProviderType.USER, template1.getProvider());
    assertEquals(ProviderType.USER, template2.getProvider());

    // List all templates (no filter)
    Map<String, String> params = new HashMap<>();
    ResultList<NotificationTemplate> allTemplates = listEntities(params, ADMIN_AUTH_HEADERS);
    assertTrue(allTemplates.getData().size() >= 2);

    // List only USER templates (use lowercase value as stored in JSON)
    params.put("provider", ProviderType.USER.value());
    params.put("limit", "1000"); // Increase limit to ensure we get all templates
    ResultList<NotificationTemplate> userTemplates = listEntities(params, ADMIN_AUTH_HEADERS);

    // Verify all returned templates are USER provider
    for (NotificationTemplate template : userTemplates.getData()) {
      assertEquals(ProviderType.USER, template.getProvider());
    }

    // Verify our created templates are in the results
    boolean found1 =
        userTemplates.getData().stream().anyMatch(t -> t.getId().equals(template1.getId()));
    boolean found2 =
        userTemplates.getData().stream().anyMatch(t -> t.getId().equals(template2.getId()));

    assertTrue(found1, "Template1 should be in USER filtered results");
    assertTrue(found2, "Template2 should be in USER filtered results");

    // List only SYSTEM templates (use lowercase value as stored in JSON)
    params.put("provider", "system");
    ResultList<NotificationTemplate> systemTemplates = listEntities(params, ADMIN_AUTH_HEADERS);

    // Verify all returned templates are SYSTEM provider
    for (NotificationTemplate template : systemTemplates.getData()) {
      assertEquals(ProviderType.SYSTEM, template.getProvider());
    }

    // Verify our USER templates are NOT in SYSTEM results
    assertFalse(
        systemTemplates.getData().stream().anyMatch(t -> t.getId().equals(template1.getId())));
    assertFalse(
        systemTemplates.getData().stream().anyMatch(t -> t.getId().equals(template2.getId())));
  }
}
