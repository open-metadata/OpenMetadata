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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.USER_WITH_CREATE_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateRenderResponse;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.policies.PolicyResourceTest;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.services.events.NotificationTemplateService;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class NotificationTemplateResourceTest
    extends EntityResourceTest<NotificationTemplate, CreateNotificationTemplate> {
  private User userWithBasicUserPermission;

  public NotificationTemplateResourceTest() {
    super(
        Entity.NOTIFICATION_TEMPLATE,
        NotificationTemplate.class,
        NotificationTemplateService.NotificationTemplateList.class,
        "notificationTemplates",
        NotificationTemplateService.FIELDS);
    supportsFieldsQueryParam = false;
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    userWithBasicUserPermission = createUserWithEditUserNotificationTemplatePermission();
  }

  private void ensureCleanSystemTemplates() throws IOException {
    // Clean up all system templates to prevent contamination
    NotificationTemplateRepository repository =
        (NotificationTemplateRepository) Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE);

    // List all system templates and delete them
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

    // Hard delete system templates directly using DAO to bypass repository validation
    for (NotificationTemplate template : systemTemplates.getData()) {
      try {
        // Use DAO directly to bypass checkSystemEntityDeletion validation
        repository.getDao().delete(template.getId());
        LOG.debug("Hard deleted system template: {}", template.getName());
      } catch (Exception e) {
        LOG.warn("Failed to hard delete system template: {}", template.getName(), e);
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

  public final NotificationTemplateRenderResponse renderTemplate(
      NotificationTemplateRenderRequest request, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/render");
    return TestUtils.post(
        target, request, NotificationTemplateRenderResponse.class, OK.getStatusCode(), authHeaders);
  }

  public final NotificationTemplateValidationResponse sendTemplate(
      NotificationTemplateSendRequest request, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/send");
    return TestUtils.post(
        target,
        request,
        NotificationTemplateValidationResponse.class,
        OK.getStatusCode(),
        authHeaders);
  }

  public final Response sendTemplateRaw(
      NotificationTemplateSendRequest request, Map<String, String> authHeaders) {
    WebTarget target = getCollection().path("/send");
    return SecurityUtil.addHeaders(target, authHeaders)
        .post(entity(request, MediaType.APPLICATION_JSON));
  }

  private SubscriptionDestination createEmailDestination(String... receivers) {
    EmailAlertConfig config = new EmailAlertConfig().withReceivers(Set.of(receivers));
    return new SubscriptionDestination()
        .withType(SubscriptionDestination.SubscriptionType.EMAIL)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(JsonUtils.valueToTree(config));
  }

  private SubscriptionDestination createWebhookDestination(
      SubscriptionDestination.SubscriptionType type, String endpoint) {
    Webhook config = new Webhook().withEndpoint(URI.create(endpoint));
    return new SubscriptionDestination()
        .withType(type)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(JsonUtils.valueToTree(config))
        .withTimeout(5000)
        .withReadTimeout(5000);
  }

  private SubscriptionDestination createInternalDestination(
      SubscriptionDestination.SubscriptionType type) {
    return new SubscriptionDestination()
        .withType(type)
        .withCategory(SubscriptionDestination.SubscriptionCategory.TEAMS);
  }

  private NotificationTemplateSendRequest createSendRequest(
      String templateSubject,
      String templateBody,
      String resource,
      SubscriptionDestination... destinations) {
    NotificationTemplateRenderRequest renderRequest =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject(templateSubject)
            .withTemplateBody(templateBody)
            .withResource(resource);

    return new NotificationTemplateSendRequest()
        .withRenderRequest(renderRequest)
        .withDestinations(List.of(destinations));
  }

  /**
   * Helper method to build the expected email with the full envelope structure.
   * This wraps the provided content in the complete OpenMetadata email envelope.
   *
   * @param content The notification content (without envelope)
   * @return Complete HTML email with envelope
   */
  private String createExpectedEmailWithEnvelope(String content) {
    // Build the complete HTML envelope that matches the
    // system-email-change-event-notification-envelope.json
    String envelopeHtml =
        "<!DOCTYPE html PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\" \"http://www.w3.org/TR/html4/loose.dtd\">"
            + "<html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">"
            + "<head>"
            + "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">"
            + "<meta name=\"x-apple-disable-message-reformatting\">"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            + "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">"
            + "<title>OpenMetadata · Change Event</title>"
            + "<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->"
            + "<style type=\"text/css\">"
            + "html, body { margin:0!important; padding:0!important; height:100%!important; width:100%!important; } "
            + "* { -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%; } "
            + "table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; } "
            + "table { border-collapse:collapse!important; } "
            + "img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; } "
            + ".hero-img { display:block; } "
            + "a { text-decoration:none; } "
            + ".ExternalClass { width:100%; } "
            + ".ExternalClass, .ExternalClass * { line-height:100%; } "
            + "a[x-apple-data-detectors] { color:inherit!important; text-decoration:none!important; } "
            + "u + #body .full-wrap { width:100%!important; } "
            + ".preheader { display:none!important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all; } "
            + ".container { max-width:600px!important; table-layout:fixed!important; } "
            + ".content-card { word-break:break-word; overflow-wrap:anywhere; -ms-word-break:break-all; white-space:normal; max-width:100%!important; } "
            + "pre, code { white-space:pre-wrap!important; word-break:break-all!important; word-wrap:break-word!important; overflow-wrap:anywhere!important; max-width:100%!important; display:block!important; } "
            + "blockquote { margin:10px 0!important; padding:12px 16px!important; background-color:#f8f9fa!important; border-left:3px solid #6b7280!important; border-radius:3px!important; font-style:italic!important; color:#1f2937!important; } "
            + ".om-data-table-container { display:block!important; width:100%!important; max-width:480px!important; overflow-x:auto!important; overflow-y:hidden!important; -webkit-overflow-scrolling:touch!important; -ms-overflow-style:scrollbar!important; box-sizing:border-box!important; } "
            + ".om-data-table { border-collapse:separate!important; border-spacing:0!important; margin:0!important; width:max-content!important; min-width:100%!important; font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif!important; font-size:13px!important; line-height:18px!important; background-color:#ffffff!important; border:1px solid #e2e8f0!important; border-radius:8px!important; table-layout:auto!important; } "
            + ".om-data-table thead { background-color:#f8fafc!important; } "
            + ".om-data-table th { padding:12px 14px!important; text-align:left!important; font-weight:600!important; color:#475569!important; font-size:11px!important; text-transform:uppercase!important; letter-spacing:0.5px!important; background-color:#f8fafc!important; border-bottom:2px solid #e2e8f0!important; white-space:nowrap!important; min-width:80px!important; } "
            + ".om-data-table td { padding:12px 14px!important; color:#334155!important; vertical-align:middle!important; border-bottom:1px solid #f1f5f9!important; white-space:nowrap!important; min-width:80px!important; } "
            + ".om-data-table tbody tr:last-child td { border-bottom:none!important; } "
            + ".om-data-table .om-data-table-more { text-align:center!important; font-style:italic!important; color:#64748b!important; background-color:#f8fafc!important; font-size:12px!important; padding:10px 14px!important; white-space:normal!important; } "
            + ".om-data-table td, .om-data-table th { mso-white-space:normal!important; } "
            + ".content-cell { width:100%!important; max-width:480px!important; table-layout:fixed!important; } "
            + "@media (max-width:600px){ .container { width:100%!important; } .p-sm { padding-left:16px!important; padding-right:16px!important; } .om-data-table-container { max-width:calc(100vw - 80px)!important; } .content-cell { max-width:calc(100vw - 80px)!important; } }"
            + "</style>"
            + "</head>"
            + "<body id=\"body\" style=\"margin:0; padding:0; background-color:#f6f7fb;\">"
            + "<div class=\"preheader\">Fresh activity spotted in your OpenMetadata environment.</div>"
            + "<center role=\"presentation\" style=\"width:100%; background-color:#f6f7fb;\">"
            + "<!--[if (gte mso 9)|(IE)]><table role=\"presentation\" width=\"100%\" bgcolor=\"#f6f7fb\"><tr><td align=\"center\"><![endif]-->"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" class=\"full-wrap\" style=\"width:100%; background-color:#f6f7fb;\">"
            + "<tr><td align=\"center\" style=\"padding:24px 12px;\">"
            + "<!--[if (gte mso 9)|(IE)]><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td><![endif]-->"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" class=\"container\" bgcolor=\"#ffffff\" style=\"max-width:600px; border-radius:14px; background-color:#ffffff; table-layout:fixed;\">"
            + "<tr><td style=\"padding:0; border-top-left-radius:14px; border-top-right-radius:14px;\">"
            + "<!--[if mso]><v:rect xmlns:v=\"urn:schemas-microsoft-com:vml\" fill=\"true\" stroke=\"false\" style=\"width:600px;height:96px;\"><v:fill type=\"frame\" src=\"https://i.imgur.com/7fn1VBe.png\" /><v:textbox inset=\"0,0,0,0\"></v:textbox></v:rect><![endif]-->"
            + "<!--[if !mso]><!-- -->"
            + "<img class=\"hero-img\" src=\"https://i.imgur.com/7fn1VBe.png\" width=\"600\" alt=\"OpenMetadata · Change Event\" style=\"width:100%; height:auto; border-top-left-radius:14px; border-top-right-radius:14px;\">"
            + "<!--<![endif]-->"
            + "</td></tr>"
            + "<tr><td class=\"p-sm\" style=\"padding:20px 24px 8px 24px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
            + "<tr><td align=\"left\" style=\"font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#1f2937;\">"
            + "<strong>Heads up!</strong> Some fresh updates just landed in your OpenMetadata environment. Take a quick look at what's new below:"
            + "</td></tr></table></td></tr>"
            + "<tr><td class=\"p-sm\" style=\"padding:8px 24px 24px 24px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-radius:12px; table-layout:fixed;\">"
            + "<tr><td width=\"6\" style=\"background-color:#7247e8; border-top-left-radius:12px; border-bottom-left-radius:12px;\">&nbsp;</td>"
            + "<td class=\"content-cell\" bgcolor=\"#ffffff\" style=\"background-color:#ffffff; padding:16px; border-top-right-radius:12px; border-bottom-right-radius:12px; overflow:hidden;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"table-layout:fixed;\">"
            + "<tr><td align=\"left\" style=\"font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#1f2937; overflow:hidden;\">"
            + "<div class=\"content-card\" style=\"overflow:hidden; max-width:100%;\">"
            + content
            + "</div>"
            + "</td></tr></table></td></tr></table></td></tr>"
            + "<tr><td class=\"p-sm\" style=\"padding:0 24px 24px 24px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
            + "<tr><td align=\"left\" style=\"font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#1f2937;\">"
            + "<span style=\"font-weight:550;\">Happy exploring!</span><br>Thanks,<br><span style=\"color:#9ca3af; font-style:italic;\">OpenMetadata Team</span>"
            + "</td></tr></table></td></tr></table>"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" class=\"container\" style=\"max-width:600px;\">"
            + "<tr><td class=\"p-sm\" align=\"left\" style=\"padding:16px 24px 6px 24px; font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#6b7280;\">"
            + "You're receiving this message as part of your OpenMetadata change notification subscription."
            + "</td></tr>"
            + "<tr><td class=\"p-sm\" align=\"left\" style=\"padding:0 24px 32px 24px; font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:12px; line-height:18px; color:#6b7280;\">"
            + "Need a hand? The <a href=\"https://docs.open-metadata.org\" target=\"_blank\" style=\"color:#6b4cf6; text-decoration:underline;\">OpenMetadata docs</a> and <a href=\"https://open-metadata.org/community\" target=\"_blank\" style=\"color:#6b4cf6; text-decoration:underline;\">community</a> are ready to help."
            + "</td></tr></table>"
            + "<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->"
            + "</td></tr></table>"
            + "<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->"
            + "</center></body></html>";
    return envelopeHtml;
  }

  private void assertRenderEquals(
      String expectedSubject,
      String expectedHtmlBody,
      NotificationTemplateRenderResponse response) {
    assertNotNull(response);
    assertNotNull(response.getValidation());
    assertTrue(response.getValidation().getIsValid(), "Validation should pass");
    assertNotNull(response.getRender());

    assertEquals(expectedSubject, response.getRender().getSubject(), "Subject should match");
    assertEquals(expectedHtmlBody, response.getRender().getBody(), "HTML body should match");
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

    assertTrue(validationResponse.getIsValid(), "Validation should pass");
    assertNotNull(validationResponse);
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

    assertFalse(validationResponse.getIsValid(), "Validation should fail");
    assertNotNull(validationResponse.getBodyError());
    assertTrue(
        validationResponse.getBodyError().contains("Template validation failed"),
        "Body error should contain validation message");
    assertNotNull(validationResponse.getSubjectError());
    assertTrue(
        validationResponse.getSubjectError().contains("Template validation failed"),
        "Subject error should contain validation message");
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

  @Test
  void test_renderTemplate_table_200() throws HttpResponseException {
    NotificationTemplateRenderRequest request =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject("Table Update: {{entity.name}}")
            .withTemplateBody(
                "<h3>Table {{entity.name}} has been updated</h3>"
                    + "<p>FQN: {{entity.fullyQualifiedName}}</p>"
                    + "<p>Description: {{entity.description}}</p>"
                    + "<ul>"
                    + "{{#each entity.columns as |column|}}"
                    + "<li>{{column.name}} - {{column.dataType}}</li>"
                    + "{{/each}}"
                    + "</ul>")
            .withResource("table");

    NotificationTemplateRenderResponse response = renderTemplate(request, ADMIN_AUTH_HEADERS);

    String expectedSubject = "Table Update: sample_table";
    String expectedContent =
        "<h3>Table sample_table has been updated</h3>"
            + "<p>FQN: sample-service.sample-db.public.sample_table</p>"
            + "<p>Description: Mock table for notification template testing</p>"
            + "<ul>"
            + "<li>id - BIGINT</li>"
            + "<li>name - VARCHAR</li>"
            + "<li>email - VARCHAR</li>"
            + "</ul>";

    String expectedBody = createExpectedEmailWithEnvelope(expectedContent);

    assertRenderEquals(expectedSubject, expectedBody, response);
  }

  @Test
  void test_renderTemplate_dashboard_200() throws HttpResponseException {
    NotificationTemplateRenderRequest request =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject("Dashboard Update: {{entity.displayName}}")
            .withTemplateBody(
                "<h3>Dashboard {{entity.displayName}}</h3>"
                    + "<p>Name: {{entity.name}}</p>"
                    + "<p>FQN: {{entity.fullyQualifiedName}}</p>"
                    + "{{#if entity.description}}"
                    + "<p>Description: {{entity.description}}</p>"
                    + "{{/if}}")
            .withResource("dashboard");

    NotificationTemplateRenderResponse response = renderTemplate(request, ADMIN_AUTH_HEADERS);

    String expectedSubject = "Dashboard Update: Sample Dashboard";
    String expectedContent =
        "<h3>Dashboard Sample Dashboard</h3>"
            + "<p>Name: sample_dashboard</p>"
            + "<p>FQN: sample-dashboard-service.sample_dashboard</p>"
            + "<p>Description: Mock dashboard for notification template testing</p>";

    String expectedBody = createExpectedEmailWithEnvelope(expectedContent);

    assertRenderEquals(expectedSubject, expectedBody, response);
  }

  @Test
  void test_renderTemplate_unknownResource_usesGenericFixture() throws HttpResponseException {
    // Unknown resources now use generic EntityInterface fixture instead of throwing errors
    NotificationTemplateRenderRequest request =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject("Unknown Entity: {{entity.name}}")
            .withTemplateBody(
                "<h3>Entity {{entity.name}}</h3>"
                    + "<p>FQN: {{entity.fullyQualifiedName}}</p>"
                    + "<p>Description: {{entity.description}}</p>")
            .withResource("unknown-resource-type");

    NotificationTemplateRenderResponse response = renderTemplate(request, ADMIN_AUTH_HEADERS);

    // Should succeed with generic fixture values
    assertNotNull(response);
    assertNotNull(response.getValidation());
    assertTrue(response.getValidation().getIsValid(), "Validation should pass");
    assertNotNull(response.getRender());

    String expectedSubject = "Unknown Entity: generic_entity";
    assertEquals(expectedSubject, response.getRender().getSubject());

    // Body should contain the generic fixture values
    assertTrue(response.getRender().getBody().contains("generic_entity"));
    assertTrue(response.getRender().getBody().contains("generic.entity"));
    assertTrue(
        response
            .getRender()
            .getBody()
            .contains("Generic entity for notification template testing"));
  }

  @Test
  void test_renderTemplate_allResource_usesGenericFixture() throws HttpResponseException {
    // "all" resource now uses generic EntityInterface fixture instead of throwing errors
    NotificationTemplateRenderRequest request =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject("All Entities: {{entity.name}}")
            .withTemplateBody(
                "<h3>Entity {{entity.name}}</h3>" + "<p>Display Name: {{entity.displayName}}</p>")
            .withResource("all");

    NotificationTemplateRenderResponse response = renderTemplate(request, ADMIN_AUTH_HEADERS);

    // Should succeed with generic fixture values
    assertNotNull(response);
    assertNotNull(response.getValidation());
    assertTrue(response.getValidation().getIsValid(), "Validation should pass");
    assertNotNull(response.getRender());

    String expectedSubject = "All Entities: generic_entity";
    assertEquals(expectedSubject, response.getRender().getSubject());

    // Body should contain the generic fixture values
    assertTrue(response.getRender().getBody().contains("Generic Entity"));
  }

  @Test
  void test_renderTemplate_invalidSyntax_validationFailure() throws HttpResponseException {
    NotificationTemplateRenderRequest request =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject("Valid Subject")
            .withTemplateBody("{{#if entity.name}} Missing end if tag")
            .withResource("table");

    NotificationTemplateRenderResponse response = renderTemplate(request, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertNotNull(response.getValidation());
    assertFalse(response.getValidation().getIsValid(), "Validation should fail");
    assertNotNull(response.getValidation().getBodyError());
    assertTrue(
        response.getValidation().getBodyError().contains("Template validation failed"),
        "Body error should contain validation message");
  }

  @Test
  void test_renderTemplate_403_forbidden() {
    NotificationTemplateRenderRequest request =
        new NotificationTemplateRenderRequest()
            .withTemplateSubject("Table Update: {{entity.name}}")
            .withTemplateBody("<p>{{entity.name}}</p>")
            .withResource("table");

    WebTarget target = getCollection().path("/render");
    Response response =
        SecurityUtil.addHeaders(target, TEST_AUTH_HEADERS)
            .post(entity(request, MediaType.APPLICATION_JSON));
    assertEquals(FORBIDDEN.getStatusCode(), response.getStatus());
  }

  @Test
  void test_sendTemplate_emailDestination_200() throws HttpResponseException {
    SubscriptionDestination emailDest = createEmailDestination("test@example.com");

    NotificationTemplateSendRequest request =
        createSendRequest(
            "Test Email: {{entity.name}}",
            "<p>Entity {{entity.name}} was updated</p>",
            "table",
            emailDest);

    NotificationTemplateValidationResponse response = sendTemplate(request, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertTrue(response.getIsValid(), "Validation should pass");
  }

  @Test
  void test_sendTemplate_webhookDestination_200() throws HttpResponseException {
    SubscriptionDestination webhookDest =
        createWebhookDestination(
            SubscriptionDestination.SubscriptionType.SLACK, "http://localhost:9999/webhook");

    NotificationTemplateSendRequest request =
        createSendRequest(
            "Test Webhook: {{entity.name}}",
            "<p>Entity {{entity.name}} was updated</p>",
            "table",
            webhookDest);

    NotificationTemplateValidationResponse response = sendTemplate(request, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertTrue(response.getIsValid(), "Validation should pass");
  }

  @Test
  void test_sendTemplate_multipleDestinations_200() throws HttpResponseException {
    SubscriptionDestination emailDest = createEmailDestination("test@example.com");
    SubscriptionDestination webhookDest =
        createWebhookDestination(
            SubscriptionDestination.SubscriptionType.SLACK, "http://localhost:9999/webhook");

    NotificationTemplateSendRequest request =
        createSendRequest(
            "Test Multiple: {{entity.name}}",
            "<p>Entity {{entity.name}} was updated</p>",
            "table",
            emailDest,
            webhookDest);

    NotificationTemplateValidationResponse response = sendTemplate(request, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertTrue(response.getIsValid(), "Validation should pass");
  }

  @Test
  void test_sendTemplate_internalDestination_400() {
    SubscriptionDestination internalDest =
        createInternalDestination(SubscriptionDestination.SubscriptionType.EMAIL);

    NotificationTemplateSendRequest request =
        createSendRequest(
            "Test Internal: {{entity.name}}",
            "<p>Entity {{entity.name}} was updated</p>",
            "table",
            internalDest);

    Response response = sendTemplateRaw(request, ADMIN_AUTH_HEADERS);
    assertEquals(BAD_REQUEST.getStatusCode(), response.getStatus());

    String responseBody = response.readEntity(String.class);
    assertTrue(
        responseBody.contains("Only external destinations"),
        "Error message should indicate only external destinations are supported");
  }

  @Test
  void test_sendTemplate_invalidTemplate_validationFailure() throws HttpResponseException {
    SubscriptionDestination emailDest = createEmailDestination("test@example.com");

    NotificationTemplateSendRequest request =
        createSendRequest(
            "Valid Subject", "{{#if entity.name}} Missing end if tag", "table", emailDest);

    NotificationTemplateValidationResponse response = sendTemplate(request, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertFalse(response.getIsValid(), "Validation should fail");
    assertNotNull(response.getBodyError());
    assertTrue(
        response.getBodyError().contains("Template validation failed"),
        "Body error should contain validation message");
  }

  @Test
  void test_sendTemplate_403_forbidden() {
    SubscriptionDestination emailDest = createEmailDestination("test@example.com");

    NotificationTemplateSendRequest request =
        createSendRequest(
            "Test Email: {{entity.name}}",
            "<p>Entity {{entity.name}} was updated</p>",
            "table",
            emailDest);

    Response response = sendTemplateRaw(request, TEST_AUTH_HEADERS);
    assertEquals(FORBIDDEN.getStatusCode(), response.getStatus());
  }

  @Test
  void test_deleteTemplatePreservesSubscription(TestInfo test) throws IOException {
    EventSubscriptionResourceTest subscriptionTest = new EventSubscriptionResourceTest();

    CreateNotificationTemplate createTemplate =
        createRequest("template-to-delete-" + test.getDisplayName())
            .withTemplateBody("<div>Will be deleted</div>");
    NotificationTemplate template = createEntity(createTemplate, ADMIN_AUTH_HEADERS);

    EntityReference templateRef =
        new EntityReference().withId(template.getId()).withType(Entity.NOTIFICATION_TEMPLATE);

    CreateEventSubscription createSub =
        subscriptionTest
            .createRequest("sub-survives-" + test.getDisplayName())
            .withNotificationTemplate(templateRef);
    EventSubscription subscription = subscriptionTest.createEntity(createSub, ADMIN_AUTH_HEADERS);

    deleteEntity(template.getId(), ADMIN_AUTH_HEADERS);

    EventSubscription afterDelete =
        subscriptionTest.getEntity(subscription.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(afterDelete, "Subscription should exist after template deletion");
    assertNull(afterDelete.getNotificationTemplate(), "Template reference should be null");

    subscriptionTest.deleteEntity(subscription.getId(), ADMIN_AUTH_HEADERS);
  }

  @Test
  void test_patchSystemTemplate_requiresSpecialPermission_403() throws IOException {
    ensureCleanSystemTemplates();
    Map<String, String> userAuthHeaders =
        SecurityUtil.authHeaders(userWithBasicUserPermission.getEmail());

    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found");
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());

    String newBody = "<div>Modified by test user: {{entity.name}}</div>";
    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    assertResponse(
        () -> patchEntity(systemTemplate.getId(), JsonUtils.readTree(json), userAuthHeaders),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='userwitheditusernotificationtemplate'} operations [EditAll] not allowed");
  }

  @Test
  void test_patchSystemTemplateByFQN_requiresSpecialPermission_403() throws IOException {
    ensureCleanSystemTemplates();

    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found");
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());

    String newBody = "<div>Modified by test user: {{entity.name}}</div>";
    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    assertResponse(
        () ->
            patchEntityUsingFqn(
                systemTemplate.getFullyQualifiedName(),
                JsonUtils.readTree(json),
                TEST_AUTH_HEADERS),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='test'} operations [EditAll] not allowed");
  }

  @Test
  void test_putSystemTemplate_requiresSpecialPermission_403() throws IOException {
    ensureCleanSystemTemplates();

    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found");
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());

    CreateNotificationTemplate updateRequest =
        new CreateNotificationTemplate()
            .withName(systemTemplate.getName())
            .withDisplayName(systemTemplate.getDisplayName())
            .withDescription("Updated description")
            .withTemplateSubject(systemTemplate.getTemplateSubject())
            .withTemplateBody("<div>Updated by test user: {{entity.name}}</div>");

    // TEST_AUTH_HEADERS has DataConsumer role which lacks EditAll and
    // EditSystemNotificationTemplate
    assertResponse(
        () -> updateEntity(updateRequest, OK, USER_WITH_CREATE_HEADERS),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='testwithcreateuserpermission'} operations [EditAll] not allowed");
  }

  @Test
  void test_patchSystemTemplate_adminCanEdit_200() throws IOException {
    ensureCleanSystemTemplates();

    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found");
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());

    String newBody = "<div>Modified by admin: {{entity.name}}</div>";
    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    NotificationTemplate updated =
        patchEntity(systemTemplate.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);

    assertEquals(newBody, updated.getTemplateBody());
    assertEquals(ProviderType.SYSTEM, updated.getProvider());
    assertTrue(
        updated.getIsModifiedFromDefault(), "Template should be marked as modified after edit");
  }

  @Test
  void test_putSystemTemplate_adminCanEdit_200() throws IOException {
    ensureCleanSystemTemplates();

    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found");
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());

    String newBody = "<div>Updated by admin via PUT: {{entity.name}}</div>";
    String newDescription = "Updated description via PUT";

    CreateNotificationTemplate updateRequest =
        new CreateNotificationTemplate()
            .withName(systemTemplate.getName())
            .withDisplayName(systemTemplate.getDisplayName())
            .withDescription(newDescription)
            .withTemplateSubject(systemTemplate.getTemplateSubject())
            .withTemplateBody(newBody);

    NotificationTemplate updated = updateEntity(updateRequest, OK, ADMIN_AUTH_HEADERS);

    assertEquals(newBody, updated.getTemplateBody());
    assertEquals(newDescription, updated.getDescription());
    assertEquals(ProviderType.SYSTEM, updated.getProvider());
    assertTrue(
        updated.getIsModifiedFromDefault(), "Template should be marked as modified after edit");
  }

  @Test
  void test_patchUserTemplate_noSpecialPermissionRequired_200(TestInfo test) throws IOException {
    CreateNotificationTemplate create = createRequest(getEntityName(test));
    NotificationTemplate userTemplate = createEntity(create, ADMIN_AUTH_HEADERS);
    assertEquals(ProviderType.USER, userTemplate.getProvider());

    String newBody = "<div>Test user can edit USER templates: {{entity.name}}</div>";
    String json =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newBody));

    NotificationTemplate updated =
        patchEntity(userTemplate.getId(), JsonUtils.readTree(json), ADMIN_AUTH_HEADERS);

    assertEquals(newBody, updated.getTemplateBody());
    assertEquals(ProviderType.USER, updated.getProvider());
  }

  @Test
  void test_userWithEditUserNotificationTemplatePermission_canEditUserTemplates()
      throws IOException {
    // Create a policy with ONLY EDIT_USER_NOTIFICATION_TEMPLATE permission
    ensureCleanSystemTemplates();

    Map<String, String> userAuthHeaders =
        SecurityUtil.authHeaders(userWithBasicUserPermission.getEmail());

    // Test 1: User CAN edit USER templates
    CreateNotificationTemplate createUserTemplate = createRequest("user-template-test");
    NotificationTemplate userTemplate = createEntity(createUserTemplate, ADMIN_AUTH_HEADERS);
    assertEquals(ProviderType.USER, userTemplate.getProvider());

    String newUserBody = "<div>Edited by user with EDIT_USER_NOTIFICATION_TEMPLATE</div>";
    String userJson =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newUserBody));

    NotificationTemplate updatedUserTemplate =
        patchEntity(userTemplate.getId(), JsonUtils.readTree(userJson), userAuthHeaders);
    assertEquals(newUserBody, updatedUserTemplate.getTemplateBody());

    // Test 2: User CANNOT edit SYSTEM templates
    ensureCleanSystemTemplates();
    NotificationTemplate systemTemplate = getSystemTemplate();
    assertNotNull(systemTemplate, "No SYSTEM templates found");
    assertEquals(ProviderType.SYSTEM, systemTemplate.getProvider());

    String newSystemBody = "<div>Attempting to edit SYSTEM template</div>";
    String systemJson =
        String.format(
            "[{\"op\":\"replace\",\"path\":\"/templateBody\",\"value\":%s}]",
            JsonUtils.pojoToJson(newSystemBody));

    assertResponse(
        () -> patchEntity(systemTemplate.getId(), JsonUtils.readTree(systemJson), userAuthHeaders),
        FORBIDDEN,
        "Principal: CatalogPrincipal{name='userwitheditusernotificationtemplate'} operations [EditAll] not allowed");
  }

  private static User createUserWithEditUserNotificationTemplatePermission()
      throws HttpResponseException {
    CreatePolicy createPolicy =
        new CreatePolicy()
            .withName("EditUserNotificationTemplateOnlyPolicy")
            .withDisplayName("Edit User Notification Template Only Policy")
            .withDescription("Policy with only EditUserNotificationTemplate permission")
            .withRules(
                List.of(
                    new Rule()
                        .withName("EditUserNotificationTemplateRule")
                        .withResources(List.of("notificationTemplate"))
                        .withOperations(List.of(MetadataOperation.EDIT_USER_NOTIFICATION_TEMPLATE))
                        .withEffect(Rule.Effect.ALLOW)));

    Policy policy = new PolicyResourceTest().createEntity(createPolicy, ADMIN_AUTH_HEADERS);

    // Create a role with this policy (no inherited permissions)
    CreateRole createRole =
        new CreateRole()
            .withName("EditUserNotificationTemplateRole")
            .withDisplayName("Edit User Notification Template Role")
            .withDescription("Role with only EditUserNotificationTemplate permission")
            .withPolicies(List.of(policy.getFullyQualifiedName()));

    Role role = new RoleResourceTest().createEntity(createRole, ADMIN_AUTH_HEADERS);

    // Create a user with this role (no inherited permissions)
    CreateUser createUser =
        new CreateUser()
            .withName("userWithEditUserNotificationTemplate")
            .withEmail("userWithEditUserNotificationTemplate@open-metadata.org")
            .withRoles(List.of(role.getId()))
            .withIsBot(false);

    return new UserResourceTest().createEntity(createUser, ADMIN_AUTH_HEADERS);
  }
}
