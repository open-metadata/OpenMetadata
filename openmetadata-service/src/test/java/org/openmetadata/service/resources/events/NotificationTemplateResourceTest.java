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

import static jakarta.ws.rs.client.Entity.entity;
import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CONFLICT;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

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

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    // Initial setup - seed data will be refreshed before each test
  }

  private void ensureCleanSystemTemplates() throws IOException {
    // Clean up all system templates to prevent contamination
    NotificationTemplateRepository repository =
        (NotificationTemplateRepository) Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE);

    // List all system templates and delete them directly via DAO
    Map<String, String> params = new HashMap<>();
    params.put("provider", "system");
    params.put("limit", "1000");
    ResultList<NotificationTemplate> systemTemplates = listEntities(params, ADMIN_AUTH_HEADERS);

    LOG.info(
        "Before cleanup - found {} system templates: {}",
        systemTemplates.getData().size(),
        systemTemplates.getData().stream()
            .map(NotificationTemplate::getName)
            .collect(Collectors.toList()));

    // Delete system templates directly through DAO to bypass all restrictions
    for (NotificationTemplate template : systemTemplates.getData()) {
      try {
        // Use DAO directly to bypass all system template deletion restrictions
        repository.getDao().delete(template.getId());
        LOG.debug("Deleted system template via DAO: {}", template.getName());
      } catch (Exception e) {
        LOG.warn("Failed to delete system template: {}", template.getName(), e);
      }
    }

    // Re-seed fresh system templates from scratch
    LOG.info("Starting seed data loading...");
    repository.initOrUpdateSeedDataFromResources();

    // Verify what was loaded
    ResultList<NotificationTemplate> afterSeed = listEntities(params, ADMIN_AUTH_HEADERS);
    LOG.info(
        "After seeding - found {} system templates: {}",
        afterSeed.getData().size(),
        afterSeed.getData().stream()
            .map(NotificationTemplate::getName)
            .collect(Collectors.toList()));

    LOG.info("Cleaned and refreshed NotificationTemplate seed data for test isolation");
  }

  @Override
  public CreateNotificationTemplate createRequest(String name) {
    return new CreateNotificationTemplate()
        .withName(name)
        .withDisplayName(name != null ? "Display " + name : null)
        .withDescription(name != null ? "Template for " + name : null)
        .withTemplateSubject("Test Notification")
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
    assertEquals(createRequest.getTemplateSubject(), template.getTemplateSubject());
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

  public final Response resetTemplate(UUID id, Map<String, String> authHeaders) {
    WebTarget target = getResource(id).path("reset");
    return SecurityUtil.addHeaders(target, authHeaders).put(null);
  }

  public final Response resetTemplateByName(String fqn, Map<String, String> authHeaders) {
    WebTarget target = getResourceByName(fqn).path("reset");
    return SecurityUtil.addHeaders(target, authHeaders).put(null);
  }

  private NotificationTemplate getSystemTemplate() {
    try {
      Map<String, String> params = new HashMap<>();
      params.put("provider", "system");
      params.put("limit", "1");
      ResultList<NotificationTemplate> systemTemplates = listEntities(params, ADMIN_AUTH_HEADERS);

      return systemTemplates.getData().stream().findFirst().orElse(null);
    } catch (HttpResponseException e) {
      return null;
    }
  }

  public final NotificationTemplateValidationResponse validateTemplate(
      NotificationTemplateValidationRequest request, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/validate");
    return TestUtils.post(
        target,
        request,
        NotificationTemplateValidationResponse.class,
        OK.getStatusCode(),
        authHeaders);
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

    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid template: Template body: Template validation failed");
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
    assertResponseContains(
        () -> {
          String json =
              String.format(
                  "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
                  JsonUtils.pojoToJson(invalidTemplateBody));
          patchEntity(template.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);
        },
        BAD_REQUEST,
        "Invalid template: Template body: Template validation failed");
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

  @Test
  void test_resetSystemTemplate_200(TestInfo test) throws IOException {
    // Ensure clean system templates for this reset test
    ensureCleanSystemTemplates();

    // Get a system template
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found. Seed data should have been loaded.");

    String originalBody = systemTemplate.getTemplateBody();
    String originalDescription = systemTemplate.getDescription();
    String originalDisplayName = systemTemplate.getDisplayName();

    String newBody = "<div>Modified template: {{entity.name}}</div>";
    String newDescription = "Modified description";
    String newDisplayName = "Modified Display Name";

    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s},"
                + "{\"op\":\"replace\",\"path\":\"/description\",\"value\":%s},"
                + "{\"op\":\"replace\",\"path\":\"/displayName\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody),
            JsonUtils.pojoToJson(newDescription),
            JsonUtils.pojoToJson(newDisplayName));

    NotificationTemplate modifiedTemplate =
        patchEntity(systemTemplate.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);
    assertEquals(newBody, modifiedTemplate.getTemplateBody());
    assertEquals(newDescription, modifiedTemplate.getDescription());
    assertEquals(newDisplayName, modifiedTemplate.getDisplayName());

    Response response = resetTemplate(systemTemplate.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(OK.getStatusCode(), response.getStatus());

    NotificationTemplate resetTemplate = getEntity(systemTemplate.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(originalBody, resetTemplate.getTemplateBody());
    assertEquals(originalDescription, resetTemplate.getDescription());
    assertEquals(originalDisplayName, resetTemplate.getDisplayName());
    assertEquals(ProviderType.SYSTEM, resetTemplate.getProvider());
    assertNotNull(resetTemplate.getVersion());
  }

  @Test
  void test_resetSystemTemplateByFQN_200(TestInfo test) throws IOException {
    // Ensure clean system templates for this reset test
    ensureCleanSystemTemplates();

    // Get a system template
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found. Seed data should have been loaded.");

    String originalBody = systemTemplate.getTemplateBody();
    String newBody = "<div>FQN Modified template: {{entity.name}}</div>";

    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    NotificationTemplate modifiedTemplate =
        patchEntity(systemTemplate.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);
    assertEquals(newBody, modifiedTemplate.getTemplateBody());

    Response response =
        resetTemplateByName(systemTemplate.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(OK.getStatusCode(), response.getStatus());

    NotificationTemplate resetTemplate = getEntity(systemTemplate.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(originalBody, resetTemplate.getTemplateBody());
    assertEquals(ProviderType.SYSTEM, resetTemplate.getProvider());
  }

  @Test
  void test_resetUserTemplate_400(TestInfo test) throws IOException {
    CreateNotificationTemplate create = createRequest(getEntityName(test));
    NotificationTemplate userTemplate = createEntity(create, ADMIN_AUTH_HEADERS);
    assertEquals(ProviderType.USER, userTemplate.getProvider());

    Response response = resetTemplate(userTemplate.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(BAD_REQUEST.getStatusCode(), response.getStatus());

    String responseBody = response.readEntity(String.class);
    assertTrue(
        responseBody.contains(
            "Cannot reset template: only SYSTEM templates can be reset to default"));
  }

  @Test
  void test_resetNonExistentTemplate_404() {
    UUID randomId = UUID.randomUUID();
    Response response = resetTemplate(randomId, ADMIN_AUTH_HEADERS);
    assertEquals(NOT_FOUND.getStatusCode(), response.getStatus());
  }

  @Test
  void test_resetTemplateWithoutPermission_403() throws IOException {
    // Ensure clean system templates for this reset test
    ensureCleanSystemTemplates();

    // Get a system template
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found. Seed data should have been loaded.");

    Response response = resetTemplate(systemTemplate.getId(), TEST_AUTH_HEADERS);
    assertEquals(FORBIDDEN.getStatusCode(), response.getStatus());
  }

  @Test
  void test_seedDataLoaded() throws HttpResponseException {
    // Verify that seed data templates are loaded (refreshed in @BeforeEach)
    Map<String, String> params = new HashMap<>();
    params.put("provider", "system");
    params.put("limit", "100");
    ResultList<NotificationTemplate> systemTemplates = listEntities(params, ADMIN_AUTH_HEADERS);

    assertFalse(
        systemTemplates.getData().isEmpty(),
        "No SYSTEM templates found. Seed data should have been loaded.");

    // Check for specific expected templates that should exist from seed data
    String[] expectedTemplates = {
      "system-notification-entity-created",
      "system-notification-entity-updated",
      "system-notification-entity-deleted",
      "system-notification-entity-soft-deleted",
      "system-notification-entity-default",
      "system-notification-logical-test-case-added",
      "system-notification-task-closed",
      "system-notification-task-resolved"
    };

    Set<String> foundTemplateNames =
        systemTemplates.getData().stream()
            .map(NotificationTemplate::getName)
            .collect(Collectors.toSet());

    LOG.info(
        "Found {} SYSTEM templates from seed data: {}",
        systemTemplates.getData().size(),
        foundTemplateNames);

    // Verify all expected templates are present
    for (String expectedTemplate : expectedTemplates) {
      assertTrue(
          foundTemplateNames.contains(expectedTemplate),
          String.format(
              "Expected seed template '%s' not found. Available templates: %s",
              expectedTemplate, foundTemplateNames));
    }

    // Verify templates have correct provider type and required fields
    for (NotificationTemplate template : systemTemplates.getData()) {
      assertEquals(
          ProviderType.SYSTEM,
          template.getProvider(),
          String.format("Template %s should have SYSTEM provider", template.getName()));
      assertNotNull(
          template.getTemplateBody(),
          String.format("Template %s should have a templateBody", template.getName()));
      assertNotNull(
          template.getFullyQualifiedName(),
          String.format("Template %s should have a fullyQualifiedName", template.getName()));
      assertNotNull(
          template.getDisplayName(),
          String.format("Template %s should have a displayName", template.getName()));
      assertNotNull(
          template.getDescription(),
          String.format("Template %s should have a description", template.getName()));
    }
  }

  @Test
  void testSystemTemplateVersioningFields() throws IOException {
    // Ensure clean system templates for this test
    ensureCleanSystemTemplates();

    // Get first available system template
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found. Seed data should have been loaded.");

    // Verify it's a system template with versioning fields initialized
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());
    assertFalse(
        systemTemplate.getIsModifiedFromDefault(),
        "Fresh template should not be marked as modified");
  }

  @Test
  void testSystemTemplateModificationTracking() throws IOException {
    // Ensure clean system templates for this test
    ensureCleanSystemTemplates();

    // Get first available system template
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found. Seed data should have been loaded.");
    assertFalse(
        systemTemplate.getIsModifiedFromDefault(),
        "Fresh template should not be marked as modified");

    // User modifies the template using PATCH (following existing test patterns)
    String newBody = "<div>User modified template: {{entity.name}}</div>";
    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    NotificationTemplate modifiedTemplate =
        patchEntity(systemTemplate.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);

    // Verify modification tracking
    assertTrue(
        modifiedTemplate.getIsModifiedFromDefault(),
        "Template should be marked as modified after change");
    assertEquals(newBody, modifiedTemplate.getTemplateBody());
  }

  @Test
  void testResetSystemTemplateToDefault() throws IOException {
    // Ensure clean system templates for this reset test
    ensureCleanSystemTemplates();

    // Get a system template
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found. Seed data should have been loaded.");

    String originalBody = systemTemplate.getTemplateBody();
    String originalSubject = systemTemplate.getTemplateSubject();
    String originalDescription = systemTemplate.getDescription();
    String originalDisplayName = systemTemplate.getDisplayName();

    // Verify template starts unmodified
    assertFalse(
        systemTemplate.getIsModifiedFromDefault(),
        "Fresh template should not be marked as modified");

    // Modify the template using PATCH
    String newBody = "<div>Modified template: {{entity.name}}</div>";
    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    NotificationTemplate modifiedTemplate =
        patchEntity(systemTemplate.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);
    assertEquals(newBody, modifiedTemplate.getTemplateBody());
    assertTrue(
        modifiedTemplate.getIsModifiedFromDefault(),
        "Template should be marked as modified after change");

    // Reset to default using the reset endpoint
    Response resetResponse =
        resetTemplateByName(systemTemplate.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(OK.getStatusCode(), resetResponse.getStatus());

    // Verify reset worked - should match original seed data
    NotificationTemplate resetResult = getEntity(systemTemplate.getId(), ADMIN_AUTH_HEADERS);
    assertFalse(
        resetResult.getIsModifiedFromDefault(),
        "Template should not be marked as modified after reset");
    assertEquals(originalBody, resetResult.getTemplateBody());
    assertEquals(originalSubject, resetResult.getTemplateSubject());
    assertEquals(originalDescription, resetResult.getDescription());
    assertEquals(originalDisplayName, resetResult.getDisplayName());
  }

  @Test
  void test_resetUserTemplateByFQN_400() throws IOException {
    // Create a user template
    CreateNotificationTemplate createTemplate = createRequest("test-user-template-for-reset");
    NotificationTemplate created = createEntity(createTemplate, ADMIN_AUTH_HEADERS);
    assertEquals(ProviderType.USER, created.getProvider());

    // Attempt to reset user template should fail
    Response resetResponse =
        resetTemplateByName(created.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    assertEquals(BAD_REQUEST.getStatusCode(), resetResponse.getStatus());
  }

  @Test
  void test_resetNonExistentTemplateByFQN_404() {
    // Attempt to reset non-existent template
    Response resetResponse = resetTemplateByName("non-existent-template", ADMIN_AUTH_HEADERS);
    assertEquals(NOT_FOUND.getStatusCode(), resetResponse.getStatus());
  }

  @Test
  void test_validateTemplate_200_validTemplateWithCustomHelpers() throws HttpResponseException {
    // Test complex template with custom helpers that should validate successfully
    String complexTemplate =
        "{{#if entity.owner}}"
            + "<p>Owner: {{entity.owner.name}}</p>"
            + "{{else}}"
            + "<p>No owner assigned</p>"
            + "{{/if}}"
            + "{{#each entity.tags as |tag|}}"
            + "<span class='tag'>{{tag.tagFQN}}</span>"
            + "{{/each}}"
            + "{{formatDate entity.updatedAt 'yyyy-MM-dd'}}";

    NotificationTemplateValidationRequest request =
        new NotificationTemplateValidationRequest()
            .withTemplateBody(complexTemplate)
            .withTemplateSubject(
                "Entity {{entity.name}} Update - {{formatDate entity.updatedAt 'yyyy-MM-dd'}}");

    NotificationTemplateValidationResponse validationResponse =
        validateTemplate(request, ADMIN_AUTH_HEADERS);

    assertNotNull(validationResponse.getTemplateBody());
    assertTrue(validationResponse.getTemplateBody().getPassed());
    assertNotNull(validationResponse.getTemplateSubject());
    assertTrue(validationResponse.getTemplateSubject().getPassed());
  }

  @Test
  void test_validateTemplate_200_invalidSyntax() throws HttpResponseException {
    // Test invalid template syntax - should return 200 with validation errors
    NotificationTemplateValidationRequest request =
        new NotificationTemplateValidationRequest()
            .withTemplateBody("{{#if entity.name}} Missing end if tag")
            .withTemplateSubject("{{#each items}} Missing end each");

    NotificationTemplateValidationResponse validationResponse =
        validateTemplate(request, ADMIN_AUTH_HEADERS);

    // Template body should fail validation
    assertNotNull(validationResponse.getTemplateBody());
    assertFalse(validationResponse.getTemplateBody().getPassed());
    assertNotNull(validationResponse.getTemplateBody().getError());
    assertTrue(
        validationResponse.getTemplateBody().getError().contains("Template validation failed"));

    // Template subject should also fail validation
    assertNotNull(validationResponse.getTemplateSubject());
    assertFalse(validationResponse.getTemplateSubject().getPassed());
    assertNotNull(validationResponse.getTemplateSubject().getError());
    assertTrue(
        validationResponse.getTemplateSubject().getError().contains("Template validation failed"));
  }

  @Test
  void test_validateTemplate_401_unauthorized() {
    NotificationTemplateValidationRequest request =
        new NotificationTemplateValidationRequest()
            .withTemplateBody("{{entity.name}} template")
            .withTemplateSubject("Valid Subject");

    // Use empty headers (no authorization) - should fail with 401 Unauthorized
    WebTarget target = getCollection().path("/validate");
    Response response = target.request().post(entity(request, MediaType.APPLICATION_JSON));
    assertEquals(401, response.getStatus());
  }

  @Test
  void test_validateTemplate_403_forbidden() {
    NotificationTemplateValidationRequest request =
        new NotificationTemplateValidationRequest()
            .withTemplateBody("{{entity.name}} template")
            .withTemplateSubject("Valid Subject");

    // Use TEST_AUTH_HEADERS which typically has limited permissions
    WebTarget target = getCollection().path("/validate");
    Response response =
        SecurityUtil.addHeaders(target, TEST_AUTH_HEADERS)
            .post(entity(request, MediaType.APPLICATION_JSON));
    assertEquals(FORBIDDEN.getStatusCode(), response.getStatus());
  }
}
