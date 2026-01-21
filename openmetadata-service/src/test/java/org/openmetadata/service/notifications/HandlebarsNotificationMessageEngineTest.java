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

package org.openmetadata.service.notifications;

import static org.junit.jupiter.api.Assertions.*;

import com.slack.api.model.block.HeaderBlock;
import com.slack.api.model.block.SectionBlock;
import com.slack.api.model.block.composition.MarkdownTextObject;
import com.slack.api.model.block.composition.PlainTextObject;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.apps.bundles.changeEvent.msteams.TeamsMessage;
import org.openmetadata.service.apps.bundles.changeEvent.slack.SlackMessage;
import org.openmetadata.service.jdbi3.NotificationTemplateRepository;
import org.openmetadata.service.notifications.channels.NotificationMessage;
import org.openmetadata.service.notifications.channels.email.EmailMessage;
import org.openmetadata.service.notifications.channels.gchat.GChatMessageV2;

@Slf4j
@DisplayName("HandlebarsNotificationMessageEngine Integration Test")
class HandlebarsNotificationMessageEngineTest extends OpenMetadataApplicationTest {

  private static HandlebarsNotificationMessageEngine messageEngine;

  @BeforeAll
  static void setupClass() {
    var templateRepository =
        (NotificationTemplateRepository) Entity.getEntityRepository(Entity.NOTIFICATION_TEMPLATE);
    messageEngine = new HandlebarsNotificationMessageEngine(templateRepository);
  }

  private void assertEmailMessagesEqual(EmailMessage expected, EmailMessage actual) {
    assertEquals(expected.getSubject(), actual.getSubject(), "Email subjects should match");
    assertEquals(
        normalizeHtml(expected.getHtmlContent()),
        normalizeHtml(actual.getHtmlContent()),
        "Email HTML content should match");
  }

  private void assertSlackMessagesEqual(SlackMessage expected, SlackMessage actual) {
    assertNotNull(expected.getBlocks(), "Expected Slack message should have blocks");
    assertNotNull(actual.getBlocks(), "Actual Slack message should have blocks");
    assertEquals(
        expected.getBlocks().size(),
        actual.getBlocks().size(),
        "Slack message should have same number of blocks");

    String expectedJson = JsonUtils.pojoToJson(expected);
    String actualJson = JsonUtils.pojoToJson(actual);
    assertEquals(expectedJson, actualJson, "Slack messages should be structurally identical");
  }

  private void assertTeamsMessagesEqual(TeamsMessage expected, TeamsMessage actual) {
    assertNotNull(expected.getAttachments(), "Expected Teams message should have attachments");
    assertNotNull(actual.getAttachments(), "Actual Teams message should have attachments");
    assertEquals(
        expected.getAttachments().size(),
        actual.getAttachments().size(),
        "Teams message should have same number of attachments");

    String expectedJson = JsonUtils.pojoToJson(expected);
    String actualJson = JsonUtils.pojoToJson(actual);
    assertEquals(expectedJson, actualJson, "Teams messages should be structurally identical");
  }

  private void assertGChatMessagesEqual(GChatMessageV2 expected, GChatMessageV2 actual) {
    String expectedJson = JsonUtils.pojoToJson(expected);
    String actualJson = JsonUtils.pojoToJson(actual);
    assertEquals(expectedJson, actualJson, "GChat messages should be structurally identical");
  }

  private String normalizeHtml(String html) {
    if (html == null) return null;
    return html.trim().replaceAll("[ \\t]+", " ");
  }

  /**
   * Helper method to build the expected email with the full envelope structure.
   * This wraps the provided content in the complete OpenMetadata email envelope.
   *
   * @param subject The email subject
   * @param content The notification content (without envelope)
   * @return EmailMessage with the complete envelope
   */
  private EmailMessage createExpectedEmailWithEnvelope(String subject, String content) {
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
            + "@media (max-width:600px){ .container { width:100%!important; } .p-sm { padding-left:16px!important; padding-right:16px!important; } }"
            + "</style>"
            + "</head>"
            + "<body id=\"body\" style=\"margin:0; padding:0; background-color:#f6f7fb;\">"
            + "<div class=\"preheader\">Fresh activity spotted in your OpenMetadata environment.</div>"
            + "<center role=\"presentation\" style=\"width:100%; background-color:#f6f7fb;\">"
            + "<!--[if (gte mso 9)|(IE)]><table role=\"presentation\" width=\"100%\" bgcolor=\"#f6f7fb\"><tr><td align=\"center\"><![endif]-->"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" class=\"full-wrap\" style=\"width:100%; background-color:#f6f7fb;\">"
            + "<tr><td align=\"center\" style=\"padding:24px 12px;\">"
            + "<!--[if (gte mso 9)|(IE)]><table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td><![endif]-->"
            + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" class=\"container\" bgcolor=\"#ffffff\" style=\"max-width:600px; border-radius:14px; background-color:#ffffff;\">"
            + "<tr><td style=\"padding:0; border-top-left-radius:14px; border-top-right-radius:14px;\">"
            + "<!--[if mso]><v:rect xmlns:v=\"urn:schemas-microsoft-com:vml\" fill=\"true\" stroke=\"false\" style=\"width:600px;height:96px;\"><v:fill type=\"frame\" src=\"https://cdn.getcollate.io/om-change-event-header.png\" /><v:textbox inset=\"0,0,0,0\"></v:textbox></v:rect><![endif]-->"
            + "<!--[if !mso]><!-- -->"
            + "<img class=\"hero-img\" src=\"https://cdn.getcollate.io/om-change-event-header.png\" width=\"600\" alt=\"OpenMetadata · Change Event\" style=\"width:100%; height:auto; border-top-left-radius:14px; border-top-right-radius:14px;\">"
            + "<!--<![endif]-->"
            + "</td></tr>"
            + "<tr><td class=\"p-sm\" style=\"padding:20px 24px 8px 24px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
            + "<tr><td align=\"left\" style=\"font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#1f2937;\">"
            + "<strong>Heads up!</strong> Some fresh updates just landed in your OpenMetadata environment. Take a quick look at what's new below:"
            + "</td></tr></table></td></tr>"
            + "<tr><td class=\"p-sm\" style=\"padding:8px 24px 24px 24px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"border-radius:12px;\">"
            + "<tr><td width=\"6\" style=\"background-color:#7247e8; border-top-left-radius:12px; border-bottom-left-radius:12px;\">&nbsp;</td>"
            + "<td bgcolor=\"#ffffff\" style=\"background-color:#ffffff; padding:16px; border-top-right-radius:12px; border-bottom-right-radius:12px;\">"
            + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">"
            + "<tr><td align=\"left\" style=\"font-family:-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#1f2937;\">"
            + "<div class=\"content-card\">"
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

    return EmailMessage.builder().subject(subject).htmlContent(envelopeHtml).build();
  }

  private static final UUID FIXED_ENTITY_ID =
      UUID.fromString("12345678-1234-1234-1234-123456789012");
  private static final UUID FIXED_SUBSCRIPTION_ID =
      UUID.fromString("87654321-4321-4321-4321-210987654321");
  private static final long FIXED_TIMESTAMP = 1640995200000L;

  private FieldChange createFieldChange(String name, Object oldValue, Object newValue) {
    var fieldChange = new FieldChange();
    fieldChange.setName(name);
    fieldChange.setOldValue(oldValue);
    fieldChange.setNewValue(newValue);
    return fieldChange;
  }

  @Test
  @DisplayName("Template: entity-default - Channel: Email")
  void testEntityDefault_Email() {
    ChangeEvent inputEvent = createEntityDefaultEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-default-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for entity-default-email] - Change Event Update from OpenMetadata",
            "<strong>admin.user</strong> performed <strong>Entity Fields Changed</strong> operation on <strong>Dashboard</strong>: <a href=\"http://localhost:8585/dashboard/analytics.sales_dashboard\" rel=\"nofollow\">analytics.sales_dashboard</a>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: entity-default - Channel: Slack")
  void testEntityDefault_Slack() {
    ChangeEvent inputEvent = createEntityDefaultEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-default-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for entity-default-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*admin.user* performed *Entity Fields Changed* operation on *Dashboard*: <http://localhost:8585/dashboard/analytics.sales_dashboard|analytics.sales_dashboard>")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: entity-default - Channel: Teams")
  void testEntityDefault_Teams() {
    ChangeEvent inputEvent = createEntityDefaultEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-default-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for entity-default-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**admin.user** performed **Entity Fields Changed** operation on **Dashboard**: [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard)")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: entity-default - Channel: GChat")
  void testEntityDefault_GChat() {
    ChangeEvent inputEvent = createEntityDefaultEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-default-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for entity-default-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**admin.user** performed **Entity Fields Changed** operation on **Dashboard**: [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard)")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: entity-soft-deleted - Channel: Email")
  void testEntitySoftDeleted_Email() {
    ChangeEvent inputEvent = createEntitySoftDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-soft-deleted-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for entity-soft-deleted-email] - Change Event Update from OpenMetadata",
            "<strong>alice.admin</strong> soft deleted Table <a href=\"http://localhost:8585/table/staging_db.warehouse.inventory\" rel=\"nofollow\">staging_db.warehouse.inventory</a>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: entity-soft-deleted - Channel: Slack")
  void testEntitySoftDeleted_Slack() {
    ChangeEvent inputEvent = createEntitySoftDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-soft-deleted-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for entity-soft-deleted-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*alice.admin* soft deleted Table <http://localhost:8585/table/staging_db.warehouse.inventory|staging_db.warehouse.inventory>")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: entity-soft-deleted - Channel: Teams")
  void testEntitySoftDeleted_Teams() {
    ChangeEvent inputEvent = createEntitySoftDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-soft-deleted-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for entity-soft-deleted-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**alice.admin** soft deleted Table [staging_db.warehouse.inventory](http://localhost:8585/table/staging_db.warehouse.inventory)")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: entity-soft-deleted - Channel: GChat")
  void testEntitySoftDeleted_GChat() {
    ChangeEvent inputEvent = createEntitySoftDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-soft-deleted-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for entity-soft-deleted-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**alice.admin** soft deleted Table [staging_db.warehouse.inventory](http://localhost:8585/table/staging_db.warehouse.inventory)")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: post-created - Channel: Email")
  void testPostCreated_Email() {
    ChangeEvent inputEvent = createPostCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("post-created-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for post-created-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;alice.user</strong> replied to a conversation for <strong>Dashboard</strong> <a href=\"http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all\" rel=\"nofollow\">analytics.sales_dashboard</a><br /><br /><strong>&#x1f4ac; Reply:</strong><br /><blockquote>Thanks! Happy to discuss the metrics in detail.</blockquote>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: post-created - Channel: Slack")
  void testPostCreated_Slack() {
    ChangeEvent inputEvent = createPostCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("post-created-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for post-created-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@alice.user* replied to a conversation for *Dashboard* <http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all|analytics.sales_dashboard>")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(MarkdownTextObject.builder().text("*💬 Reply:*").build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("> Thanks! Happy to discuss the metrics in detail.")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: post-created - Channel: Teams")
  void testPostCreated_Teams() {
    ChangeEvent inputEvent = createPostCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("post-created-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for post-created-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@alice.user** replied to a conversation for **Dashboard** [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**💬 Reply:**")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.Container.builder()
                                            .type("Container")
                                            .style("emphasis")
                                            .items(
                                                List.of(
                                                    TeamsMessage.TextBlock.builder()
                                                        .type("TextBlock")
                                                        .text(
                                                            "> Thanks! Happy to discuss the metrics in detail.")
                                                        .wrap(true)
                                                        .build()))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: post-created - Channel: GChat")
  void testPostCreated_GChat() {
    ChangeEvent inputEvent = createPostCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("post-created-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for post-created-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@alice.user** replied to a conversation for **Dashboard** [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all)"),
                                                    GChatMessageV2.Widget.text("**💬 Reply:**"),
                                                    GChatMessageV2.Widget.text(
                                                        "> Thanks! Happy to discuss the metrics in detail.")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: task-closed - Channel: Email")
  void testTaskClosed_Email() {
    ChangeEvent inputEvent = createTaskClosedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-closed-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for task-closed-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;task.closer</strong> closed a <strong>Request Description</strong> task for <strong>Table</strong> <a href=\"http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks\" rel=\"nofollow\">prod_db.analytics.users_table</a><br /><br /><strong>❌ Closed task details:</strong><ul><li><strong>Assignees:</strong> </li></ul>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: task-closed - Channel: Slack")
  void testTaskClosed_Slack() {
    ChangeEvent inputEvent = createTaskClosedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-closed-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for task-closed-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@task.closer* closed a *Request Description* task for *Table* <http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks|prod_db.analytics.users_table>")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(MarkdownTextObject.builder().text("*❌ Closed task details:*").build())
                        .build(),
                    SectionBlock.builder()
                        .text(MarkdownTextObject.builder().text("• *Assignees:*").build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: task-closed - Channel: Teams")
  void testTaskClosed_Teams() {
    ChangeEvent inputEvent = createTaskClosedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-closed-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for task-closed-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@task.closer** closed a **Request Description** task for **Table** [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**❌ Closed task details:**")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("- **Assignees:**")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: task-closed - Channel: GChat")
  void testTaskClosed_GChat() {
    ChangeEvent inputEvent = createTaskClosedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-closed-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for task-closed-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@task.closer** closed a **Request Description** task for **Table** [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)"),
                                                    GChatMessageV2.Widget.text(
                                                        "**❌ Closed task details:**"),
                                                    GChatMessageV2.Widget.text("- **Assignees:**")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: task-resolved - Channel: Email")
  void testTaskResolved_Email() {
    ChangeEvent inputEvent = createTaskResolvedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-resolved-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for task-resolved-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;</strong> resolved a <strong></strong> task for <strong>Table</strong> <a href=\"http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks\" rel=\"nofollow\">prod_db.analytics.users_table</a><br /><br /><strong>✅ Resolved task details:</strong><ul><li><strong>Assignees:</strong> </li></ul>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: task-resolved - Channel: Slack")
  void testTaskResolved_Slack() {
    ChangeEvent inputEvent = createTaskResolvedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-resolved-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for task-resolved-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@* resolved a **** task for *Table* <http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks|prod_db.analytics.users_table>")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder().text("*✅ Resolved task details:*").build())
                        .build(),
                    SectionBlock.builder()
                        .text(MarkdownTextObject.builder().text("• *Assignees:*").build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: task-resolved - Channel: Teams")
  void testTaskResolved_Teams() {
    ChangeEvent inputEvent = createTaskResolvedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-resolved-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for task-resolved-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@** resolved a **** task for **Table** [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**✅ Resolved task details:**")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("- **Assignees:**")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: task-resolved - Channel: GChat")
  void testTaskResolved_GChat() {
    ChangeEvent inputEvent = createTaskResolvedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("task-resolved-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for task-resolved-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@** resolved a **** task for **Table** [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)"),
                                                    GChatMessageV2.Widget.text(
                                                        "**✅ Resolved task details:**"),
                                                    GChatMessageV2.Widget.text("- **Assignees:**")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: logical-test-case-added - Channel: Email")
  void testLogicalTestCaseAdded_Email() {
    ChangeEvent inputEvent = createLogicalTestCaseAddedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("logical-test-case-added-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for logical-test-case-added-email] - Change Event Update from OpenMetadata",
            "<strong>test.engineer</strong> added <strong>logical test case(s)</strong> to <strong>Test Suite</strong>: <a href=\"http://localhost:8585/table/prod_db.analytics.users_table\" rel=\"nofollow\">prod_db.analytics.users_table</a>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: logical-test-case-added - Channel: Slack")
  void testLogicalTestCaseAdded_Slack() {
    ChangeEvent inputEvent = createLogicalTestCaseAddedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("logical-test-case-added-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for logical-test-case-added-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*test.engineer* added *logical test case(s)* to *Test Suite*: <http://localhost:8585/table/prod_db.analytics.users_table|prod_db.analytics.users_table>")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: logical-test-case-added - Channel: Teams")
  void testLogicalTestCaseAdded_Teams() {
    ChangeEvent inputEvent = createLogicalTestCaseAddedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("logical-test-case-added-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for logical-test-case-added-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**test.engineer** added **logical test case(s)** to **Test Suite**: [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table)")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: logical-test-case-added - Channel: GChat")
  void testLogicalTestCaseAdded_GChat() {
    ChangeEvent inputEvent = createLogicalTestCaseAddedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("logical-test-case-added-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for logical-test-case-added-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**test.engineer** added **logical test case(s)** to **Test Suite**: [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table)")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-created Task - Channel: Email")
  void testThreadCreatedTask_Email() {
    ChangeEvent inputEvent = createThreadCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-created-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-created-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;john.doe</strong> created a Task for <strong>Table</strong> <a href=\"http://localhost:8585/table/prod_db.sales.customer_orders\" rel=\"nofollow\">prod_db.sales.customer_orders</a><br /><br /><ul><li><strong>Task Type:</strong> Request Description</li><li><strong>Assignees:</strong> &#64;alice.smith, &#64;bob.jones</li><li><strong>Status:</strong> Open</li></ul>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-created Task - Channel: Slack")
  void testThreadCreatedTask_Slack() {
    ChangeEvent inputEvent = createThreadCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-created-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-created-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@john.doe* created a Task for *Table* <http://localhost:8585/table/prod_db.sales.customer_orders|prod_db.sales.customer_orders>")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "• *Task Type:* Request Description\n• *Assignees:* @alice.smith, @bob.jones\n• *Status:* Open")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-created Task - Channel: Teams")
  void testThreadCreatedTask_Teams() {
    ChangeEvent inputEvent = createThreadCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-created-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-created-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@john.doe** created a Task for **Table** [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "- **Task Type:** Request Description\n- **Assignees:** @alice.smith, @bob.jones\n- **Status:** Open")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-created Task - Channel: GChat")
  void testThreadCreatedTask_GChat() {
    ChangeEvent inputEvent = createThreadCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-created-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-created-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@john.doe** created a Task for **Table** [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)"),
                                                    GChatMessageV2.Widget.text(
                                                        "- **Task Type:** Request Description\n- **Assignees:** @alice.smith, @bob.jones\n- **Status:** Open")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-updated Task - Channel: Email")
  void testThreadUpdatedTask_Email() {
    ChangeEvent inputEvent = createThreadUpdatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-updated-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-updated-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;alice.smith</strong> posted update on the Task with Id: 123 for Asset <a href=\"http://localhost:8585/table/prod_db.sales.customer_orders\" rel=\"nofollow\">prod_db.sales.customer_orders</a><br /><strong>Task Type:</strong> RequestDescription<br /><strong>Assignees:</strong> &#64;alice.smith, &#64;bob.jones<br /><strong>Current Status:</strong> In Progress");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-updated Task - Channel: Slack")
  void testThreadUpdatedTask_Slack() {
    ChangeEvent inputEvent = createThreadUpdatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-updated-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-updated-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@alice.smith* posted update on the Task with Id: 123 for Asset <http://localhost:8585/table/prod_db.sales.customer_orders|prod_db.sales.customer_orders>\n*Task Type:* RequestDescription\n*Assignees:* @alice.smith, @bob.jones\n*Current Status:* In Progress")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-updated Task - Channel: Teams")
  void testThreadUpdatedTask_Teams() {
    ChangeEvent inputEvent = createThreadUpdatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-updated-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-updated-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@alice.smith** posted update on the Task with Id: 123 for Asset [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**Task Type:** RequestDescription")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**Assignees:** @alice.smith, @bob.jones")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**Current Status:** In Progress")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-updated Task - Channel: GChat")
  void testThreadUpdatedTask_GChat() {
    ChangeEvent inputEvent = createThreadUpdatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("thread-updated-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-updated-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@alice.smith** posted update on the Task with Id: 123 for Asset [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)"),
                                                    GChatMessageV2.Widget.text(
                                                        "**Task Type:** RequestDescription"),
                                                    GChatMessageV2.Widget.text(
                                                        "**Assignees:** @alice.smith, @bob.jones"),
                                                    GChatMessageV2.Widget.text(
                                                        "**Current Status:** In Progress")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-created Conversation - Channel: Email")
  void testThreadCreatedConversation_Email() {
    ChangeEvent inputEvent = createThreadCreatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-conversation-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-created-conversation-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;jane.doe</strong> started a conversation for <strong>Table</strong> <a href=\"http://localhost:8585/table/prod_db.users.user_profiles\" rel=\"nofollow\">prod_db.users.user_profiles</a><br /><br /><strong>&#x1f4ac; Message:</strong><br /><blockquote>What is the schema for this table?</blockquote>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-created Conversation - Channel: Slack")
  void testThreadCreatedConversation_Slack() {
    ChangeEvent inputEvent = createThreadCreatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-conversation-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-created-conversation-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@jane.doe* started a conversation for *Table* <http://localhost:8585/table/prod_db.users.user_profiles|prod_db.users.user_profiles>")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(MarkdownTextObject.builder().text("*💬 Message:*").build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("> What is the schema for this table?")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-created Conversation - Channel: Teams")
  void testThreadCreatedConversation_Teams() {
    ChangeEvent inputEvent = createThreadCreatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-conversation-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-created-conversation-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@jane.doe** started a conversation for **Table** [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**💬 Message:**")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.Container.builder()
                                            .type("Container")
                                            .style("emphasis")
                                            .items(
                                                List.of(
                                                    TeamsMessage.TextBlock.builder()
                                                        .type("TextBlock")
                                                        .text(
                                                            "> What is the schema for this table?")
                                                        .wrap(true)
                                                        .build()))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-created Conversation - Channel: GChat")
  void testThreadCreatedConversation_GChat() {
    ChangeEvent inputEvent = createThreadCreatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-conversation-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-created-conversation-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@jane.doe** started a conversation for **Table** [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)"),
                                                    GChatMessageV2.Widget.text("**💬 Message:**"),
                                                    GChatMessageV2.Widget.text(
                                                        "> What is the schema for this table?")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-created Announcement - Channel: Email")
  void testThreadCreatedAnnouncement_Email() {
    ChangeEvent inputEvent = createThreadCreatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-announcement-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-created-announcement-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;admin.user</strong> posted an <strong>Announcement</strong><br /><br /><strong>&#x1f552; Duration:</strong> 2022-01-01 01:00:00 → 2022-01-01 02:00:00<br /><blockquote>Scheduled maintenance on production database</blockquote>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-created Announcement - Channel: Slack")
  void testThreadCreatedAnnouncement_Slack() {
    ChangeEvent inputEvent = createThreadCreatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-announcement-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-created-announcement-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("*@admin.user* posted an *Announcement*")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("*🕒 Duration:* 2022-01-01 01:00:00 → 2022-01-01 02:00:00")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("> Scheduled maintenance on production database")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-created Announcement - Channel: Teams")
  void testThreadCreatedAnnouncement_Teams() {
    ChangeEvent inputEvent = createThreadCreatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-announcement-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-created-announcement-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**@admin.user** posted an **Announcement**")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**🕒 Duration:** 2022-01-01 01:00:00 → 2022-01-01 02:00:00")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.Container.builder()
                                            .type("Container")
                                            .style("emphasis")
                                            .items(
                                                List.of(
                                                    TeamsMessage.TextBlock.builder()
                                                        .type("TextBlock")
                                                        .text(
                                                            "> Scheduled maintenance on production database")
                                                        .wrap(true)
                                                        .build()))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-created Announcement - Channel: GChat")
  void testThreadCreatedAnnouncement_GChat() {
    ChangeEvent inputEvent = createThreadCreatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-created-announcement-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-created-announcement-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@admin.user** posted an **Announcement**"),
                                                    GChatMessageV2.Widget.text(
                                                        "**🕒 Duration:** 2022-01-01 01:00:00 &rarr; 2022-01-01 02:00:00"),
                                                    GChatMessageV2.Widget.text(
                                                        "> Scheduled maintenance on production database")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-updated Conversation - Channel: Email")
  void testThreadUpdatedConversation_Email() {
    ChangeEvent inputEvent = createThreadUpdatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-conversation-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-updated-conversation-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;bob.smith</strong> updated <strong>Conversation</strong> for <strong>Table</strong> <a href=\"http://localhost:8585/table/prod_db.users.user_profiles\" rel=\"nofollow\">prod_db.users.user_profiles</a><br /><br /><blockquote>The schema has been updated in the documentation</blockquote>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-updated Conversation - Channel: Slack")
  void testThreadUpdatedConversation_Slack() {
    ChangeEvent inputEvent = createThreadUpdatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-conversation-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-updated-conversation-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*@bob.smith* updated *Conversation* for *Table* <http://localhost:8585/table/prod_db.users.user_profiles|prod_db.users.user_profiles>")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("> The schema has been updated in the documentation")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-updated Conversation - Channel: Teams")
  void testThreadUpdatedConversation_Teams() {
    ChangeEvent inputEvent = createThreadUpdatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-conversation-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-updated-conversation-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**@bob.smith** updated **Conversation** for **Table** [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.Container.builder()
                                            .type("Container")
                                            .style("emphasis")
                                            .items(
                                                List.of(
                                                    TeamsMessage.TextBlock.builder()
                                                        .type("TextBlock")
                                                        .text(
                                                            "> The schema has been updated in the documentation")
                                                        .wrap(true)
                                                        .build()))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-updated Conversation - Channel: GChat")
  void testThreadUpdatedConversation_GChat() {
    ChangeEvent inputEvent = createThreadUpdatedConversationEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-conversation-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-updated-conversation-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@bob.smith** updated **Conversation** for **Table** [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)"),
                                                    GChatMessageV2.Widget.text(
                                                        "> The schema has been updated in the documentation")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (active) - Channel: Email")
  void testThreadUpdatedAnnouncementActive_Email() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-active-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-updated-announcement-active-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;admin.user</strong> updated <strong>Announcement</strong><br /><br />");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (active) - Channel: Slack")
  void testThreadUpdatedAnnouncementActive_Slack() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-active-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-updated-announcement-active-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("*@admin.user* updated *Announcement*")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (active) - Channel: Teams")
  void testThreadUpdatedAnnouncementActive_Teams() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-active-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-updated-announcement-active-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**@admin.user** updated **Announcement**")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (active) - Channel: GChat")
  void testThreadUpdatedAnnouncementActive_GChat() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-active-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-updated-announcement-active-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@admin.user** updated **Announcement**")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (deleted) - Channel: Email")
  void testThreadUpdatedAnnouncementDeleted_Email() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementDeletedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-deleted-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for thread-updated-announcement-deleted-email] - Change Event Update from OpenMetadata",
            "<strong>&#64;admin.user</strong> deleted an announcement<br /><br /><strong>&#x1f5d1;️ Deleted announcement:</strong><br /><blockquote>Maintenance has been cancelled</blockquote>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (deleted) - Channel: Slack")
  void testThreadUpdatedAnnouncementDeleted_Slack() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementDeletedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-deleted-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for thread-updated-announcement-deleted-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("*@admin.user* deleted an announcement")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("*🗑️ Deleted announcement:*")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("> Maintenance has been cancelled")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (deleted) - Channel: Teams")
  void testThreadUpdatedAnnouncementDeleted_Teams() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementDeletedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-deleted-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for thread-updated-announcement-deleted-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**@admin.user** deleted an announcement")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text("**🗑️ Deleted announcement:**")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.Container.builder()
                                            .type("Container")
                                            .style("emphasis")
                                            .items(
                                                List.of(
                                                    TeamsMessage.TextBlock.builder()
                                                        .type("TextBlock")
                                                        .text("> Maintenance has been cancelled")
                                                        .wrap(true)
                                                        .build()))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: thread-updated Announcement (deleted) - Channel: GChat")
  void testThreadUpdatedAnnouncementDeleted_GChat() {
    ChangeEvent inputEvent = createThreadUpdatedAnnouncementDeletedEvent();
    EventSubscription inputSubscription =
        createTestSubscriptionFixed("thread-updated-announcement-deleted-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for thread-updated-announcement-deleted-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**@admin.user** deleted an announcement"),
                                                    GChatMessageV2.Widget.text(
                                                        "**🗑️ Deleted announcement:**"),
                                                    GChatMessageV2.Widget.text(
                                                        "> Maintenance has been cancelled")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  private EventSubscription createTestSubscriptionFixed(String name) {
    var subscription = new EventSubscription();
    subscription.setId(FIXED_SUBSCRIPTION_ID);
    subscription.setName("test-subscription-" + name);
    subscription.setDisplayName("Test Subscription for " + name);
    subscription.setFullyQualifiedName("test-subscription-" + name);
    return subscription;
  }

  private ChangeEvent createEntityDeletedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.ENTITY_DELETED);
    event.setEntityType("table");
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("prod_db.analytics.users_table");
    event.setUserName("john.doe");
    event.setTimestamp(FIXED_TIMESTAMP);

    var entity = new java.util.HashMap<String, Object>();
    entity.put("entityType", "table");
    entity.put("name", "users_table");
    entity.put("fullyQualifiedName", "prod_db.analytics.users_table");
    event.setEntity(entity);

    return event;
  }

  private ChangeEvent createEntityDefaultEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.ENTITY_FIELDS_CHANGED);
    event.setEntityType("dashboard");
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("analytics.sales_dashboard");
    event.setUserName("admin.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    var entity = new java.util.HashMap<String, Object>();
    entity.put("entityType", "dashboard");
    entity.put("name", "sales_dashboard");
    entity.put("fullyQualifiedName", "analytics.sales_dashboard");
    entity.put("href", "http://localhost:8585/dashboard/analytics.sales_dashboard");
    event.setEntity(entity);

    var descriptionChange =
        createFieldChange(
            "description",
            "Old dashboard description",
            "Updated dashboard description with metrics");
    var ownerChange = createFieldChange("owner", "data.team", "analytics.team");

    var changeDesc = new ChangeDescription();
    changeDesc.setFieldsUpdated(List.of(descriptionChange, ownerChange));
    event.setChangeDescription(changeDesc);

    return event;
  }

  private ChangeEvent createEntityCreatedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.ENTITY_CREATED);
    event.setEntityType("table");
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("prod_db.sales.customer_orders");
    event.setUserName("jane.smith");
    event.setTimestamp(FIXED_TIMESTAMP);

    var entity = new java.util.HashMap<String, Object>();
    entity.put("entityType", "table");
    entity.put("name", "customer_orders");
    entity.put("fullyQualifiedName", "prod_db.sales.customer_orders");
    entity.put("href", "http://localhost:8585/table/prod_db.sales.customer_orders");
    entity.put("description", "Customer order transaction data with payment details");
    event.setEntity(entity);

    return event;
  }

  private ChangeEvent createEntitySoftDeletedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.ENTITY_SOFT_DELETED);
    event.setEntityType("table");
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("staging_db.warehouse.inventory");
    event.setUserName("alice.admin");
    event.setTimestamp(FIXED_TIMESTAMP);

    var entity = new java.util.HashMap<String, Object>();
    entity.put("entityType", "table");
    entity.put("name", "inventory");
    entity.put("fullyQualifiedName", "staging_db.warehouse.inventory");
    entity.put("href", "http://localhost:8585/table/staging_db.warehouse.inventory");
    event.setEntity(entity);

    return event;
  }

  @Test
  @DisplayName("Template: entity-deleted - Channel: Email")
  void testEntityDeleted_Email() {
    ChangeEvent inputEvent = createEntityDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-deleted-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for entity-deleted-email] - Change Event Update from OpenMetadata",
            "<strong>john.doe</strong> deleted <strong>Table</strong> prod_db.analytics.users_table");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: entity-deleted - Channel: Slack")
  void testEntityDeleted_Slack() {
    ChangeEvent inputEvent = createEntityDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-deleted-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for entity-deleted-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text("*john.doe* deleted *Table* prod_db.analytics.users_table")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: entity-deleted - Channel: Teams")
  void testEntityDeleted_Teams() {
    ChangeEvent inputEvent = createEntityDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-deleted-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for entity-deleted-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**john.doe** deleted **Table** prod_db.analytics.users_table")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: entity-deleted - Channel: GChat")
  void testEntityDeleted_GChat() {
    ChangeEvent inputEvent = createEntityDeletedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-deleted-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for entity-deleted-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**john.doe** deleted **Table** prod_db.analytics.users_table")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  @Test
  @DisplayName("Template: entity-created - Channel: Email")
  void testEntityCreated_Email() {
    ChangeEvent inputEvent = createEntityCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-created-email");
    SubscriptionDestination inputDestination = createEmailDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    EmailMessage actualEmail = assertInstanceOf(EmailMessage.class, actualOutput);
    EmailMessage expectedEmail =
        createExpectedEmailWithEnvelope(
            "[Test Subscription for entity-created-email] - Change Event Update from OpenMetadata",
            "<strong>jane.smith</strong> created <strong>Table</strong> <a href=\"http://localhost:8585/table/prod_db.sales.customer_orders\" rel=\"nofollow\">prod_db.sales.customer_orders</a>");

    assertEmailMessagesEqual(expectedEmail, actualEmail);
  }

  @Test
  @DisplayName("Template: entity-created - Channel: Slack")
  void testEntityCreated_Slack() {
    ChangeEvent inputEvent = createEntityCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-created-slack");
    SubscriptionDestination inputDestination = createSlackDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    SlackMessage actualSlack = assertInstanceOf(SlackMessage.class, actualOutput);
    SlackMessage expectedSlack =
        SlackMessage.builder()
            .blocks(
                List.of(
                    HeaderBlock.builder()
                        .text(
                            PlainTextObject.builder()
                                .text(
                                    "[Test Subscription for entity-created-slack] - Change Event Update from OpenMetadata")
                                .build())
                        .build(),
                    SectionBlock.builder()
                        .text(
                            MarkdownTextObject.builder()
                                .text(
                                    "*jane.smith* created *Table* <http://localhost:8585/table/prod_db.sales.customer_orders|prod_db.sales.customer_orders>")
                                .build())
                        .build()))
            .build();

    assertSlackMessagesEqual(expectedSlack, actualSlack);
  }

  @Test
  @DisplayName("Template: entity-created - Channel: Teams")
  void testEntityCreated_Teams() {
    ChangeEvent inputEvent = createEntityCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-created-teams");
    SubscriptionDestination inputDestination = createTeamsDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    TeamsMessage actualTeams = assertInstanceOf(TeamsMessage.class, actualOutput);
    TeamsMessage expectedTeams =
        TeamsMessage.builder()
            .type("message")
            .attachments(
                List.of(
                    TeamsMessage.Attachment.builder()
                        .contentType("application/vnd.microsoft.card.adaptive")
                        .content(
                            TeamsMessage.AdaptiveCardContent.builder()
                                .type("AdaptiveCard")
                                .version("1.4")
                                .body(
                                    List.of(
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "[Test Subscription for entity-created-teams] - Change Event Update from OpenMetadata")
                                            .size("Large")
                                            .weight("Bolder")
                                            .wrap(true)
                                            .build(),
                                        TeamsMessage.TextBlock.builder()
                                            .type("TextBlock")
                                            .text(
                                                "**jane.smith** created **Table** [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)")
                                            .wrap(true)
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertTeamsMessagesEqual(expectedTeams, actualTeams);
  }

  @Test
  @DisplayName("Template: entity-created - Channel: GChat")
  void testEntityCreated_GChat() {
    ChangeEvent inputEvent = createEntityCreatedEvent();
    EventSubscription inputSubscription = createTestSubscriptionFixed("entity-created-gchat");
    SubscriptionDestination inputDestination = createGChatDestination();

    NotificationMessage actualOutput =
        messageEngine.generateMessage(inputEvent, inputSubscription, inputDestination);

    GChatMessageV2 actualGChat = assertInstanceOf(GChatMessageV2.class, actualOutput);
    GChatMessageV2 expectedGChat =
        GChatMessageV2.builder()
            .cardsV2(
                List.of(
                    GChatMessageV2.CardV2.builder()
                        .card(
                            GChatMessageV2.Card.builder()
                                .header(
                                    GChatMessageV2.Header.builder()
                                        .title(
                                            "[Test Subscription for entity-created-gchat] - Change Event Update from OpenMetadata")
                                        .build())
                                .sections(
                                    List.of(
                                        GChatMessageV2.Section.builder()
                                            .widgets(
                                                List.of(
                                                    GChatMessageV2.Widget.text(
                                                        "**jane.smith** created **Table** [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)")))
                                            .build()))
                                .build())
                        .build()))
            .build();

    assertGChatMessagesEqual(expectedGChat, actualGChat);
  }

  private ChangeEvent createPostCreatedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.POST_CREATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("alice.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    // For POST_CREATED, the entity is a Thread object
    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Conversation");
    thread.put("createdBy", "alice.user");
    thread.put("updatedBy", "alice.user");
    thread.put("about", "<#E::dashboard::analytics.sales_dashboard>");

    // EntityRef for the actual entity the thread is about
    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "dashboard");
    entityRef.put("name", "sales_dashboard");
    entityRef.put("fullyQualifiedName", "analytics.sales_dashboard");
    thread.put("entityRef", entityRef);

    // EntityRef for buildEntityUrl helper

    // Create posts array
    var post1 = new java.util.HashMap<String, Object>();
    post1.put("from", "bob.analyst");
    post1.put("message", "This looks great! I have a question about the metrics.");

    var post2 = new java.util.HashMap<String, Object>();
    post2.put("from", "alice.user");
    post2.put("message", "Thanks! Happy to discuss the metrics in detail.");

    thread.put("posts", List.of(post1, post2));

    // The entity IS the thread for POST_CREATED
    event.setEntity(thread);

    return event;
  }

  private ChangeEvent createTaskClosedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.TASK_CLOSED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("task-thread-" + FIXED_ENTITY_ID);
    event.setUserName("admin.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    // For TASK_CLOSED, the entity is a Thread object with type "Task"
    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Task");
    thread.put("createdBy", "task.creator");
    thread.put("updatedBy", "task.closer");

    // EntityRef for the actual entity the task is about
    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "table");
    entityRef.put("name", "users_table");
    entityRef.put("fullyQualifiedName", "prod_db.analytics.users_table");
    thread.put("entityRef", entityRef);

    // Task details
    var task = new java.util.HashMap<String, Object>();
    task.put("id", 123);
    task.put("type", "RequestDescription");
    task.put("status", "Closed");
    task.put("assignees", java.util.List.of());
    thread.put("task", task);

    // The entity IS the thread for TASK_CLOSED
    event.setEntity(thread);

    return event;
  }

  private ChangeEvent createTaskResolvedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.TASK_RESOLVED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("task-thread-" + FIXED_ENTITY_ID);
    event.setUserName("admin.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    // For TASK_RESOLVED, the entity is a Thread object with type "Task"
    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Task");
    thread.put("createdBy", "task.creator");

    // EntityRef for the actual entity the task is about
    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "table");
    entityRef.put("name", "users_table");
    entityRef.put("fullyQualifiedName", "prod_db.analytics.users_table");
    thread.put("entityRef", entityRef);

    // Task details
    var task = new java.util.HashMap<String, Object>();
    task.put("id", 123);
    task.put("status", "Resolved");
    thread.put("task", task);

    // The entity IS the thread for TASK_RESOLVED
    event.setEntity(thread);

    return event;
  }

  private ChangeEvent createLogicalTestCaseAddedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.LOGICAL_TEST_CASE_ADDED);
    event.setEntityType("table");
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("prod_db.analytics.users_table");
    event.setUserName("test.engineer");
    event.setTimestamp(FIXED_TIMESTAMP);

    // For LOGICAL_TEST_CASE_ADDED, the entity is the table that got test cases added
    var entity = new java.util.HashMap<String, Object>();
    entity.put("entityType", "table");
    entity.put("name", "users_table");
    entity.put("fullyQualifiedName", "prod_db.analytics.users_table");
    entity.put("href", "http://localhost:8585/table/prod_db.analytics.users_table");
    event.setEntity(entity);

    return event;
  }

  private ChangeEvent createThreadCreatedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.THREAD_CREATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("john.doe");
    event.setTimestamp(FIXED_TIMESTAMP);

    // For THREAD_CREATED, the entity IS the Thread object
    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Task");
    thread.put("createdBy", "john.doe");

    // EntityRef for the actual entity the thread is about
    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "table");
    entityRef.put("name", "customer_orders");
    entityRef.put("fullyQualifiedName", "prod_db.sales.customer_orders");
    thread.put("entityRef", entityRef);

    // Task details
    var task = new java.util.HashMap<String, Object>();
    task.put("type", "RequestDescription");
    task.put("status", "Open");

    // Assignees
    var assignees = new java.util.ArrayList<java.util.Map<String, String>>();
    var assignee1 = new java.util.HashMap<String, String>();
    assignee1.put("name", "alice.smith");
    assignees.add(assignee1);
    var assignee2 = new java.util.HashMap<String, String>();
    assignee2.put("name", "bob.jones");
    assignees.add(assignee2);
    task.put("assignees", assignees);

    thread.put("task", task);

    // The entity IS the thread for THREAD_CREATED
    event.setEntity(thread);

    return event;
  }

  private ChangeEvent createThreadUpdatedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.THREAD_UPDATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("alice.smith");
    event.setTimestamp(FIXED_TIMESTAMP);

    // For THREAD_UPDATED, the entity IS the Thread object
    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Task");
    thread.put("updatedBy", "alice.smith");

    // EntityRef for the actual entity the thread is about
    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "table");
    entityRef.put("name", "customer_orders");
    entityRef.put("fullyQualifiedName", "prod_db.sales.customer_orders");
    thread.put("entityRef", entityRef);

    // Task details showing updated status
    var task = new java.util.HashMap<String, Object>();
    task.put("id", 123);
    task.put("type", "RequestDescription");
    task.put("status", "In Progress");

    // Assignees
    var assignees = new java.util.ArrayList<java.util.Map<String, String>>();
    var assignee1 = new java.util.HashMap<String, String>();
    assignee1.put("name", "alice.smith");
    assignees.add(assignee1);
    var assignee2 = new java.util.HashMap<String, String>();
    assignee2.put("name", "bob.jones");
    assignees.add(assignee2);
    task.put("assignees", assignees);

    thread.put("task", task);

    // The entity IS the thread for THREAD_UPDATED
    event.setEntity(thread);

    return event;
  }

  private ChangeEvent createThreadCreatedConversationEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.THREAD_CREATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("jane.doe");
    event.setTimestamp(FIXED_TIMESTAMP);

    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Conversation");
    thread.put("createdBy", "jane.doe");
    thread.put("message", "What is the schema for this table?");

    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "table");
    entityRef.put("name", "user_profiles");
    entityRef.put("fullyQualifiedName", "prod_db.users.user_profiles");
    thread.put("entityRef", entityRef);

    event.setEntity(thread);
    return event;
  }

  private ChangeEvent createThreadCreatedAnnouncementEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.THREAD_CREATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("admin.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Announcement");
    thread.put("createdBy", "admin.user");

    var announcement = new java.util.HashMap<String, Object>();
    announcement.put("description", "Scheduled maintenance on production database");
    announcement.put("startTime", FIXED_TIMESTAMP);
    announcement.put("endTime", FIXED_TIMESTAMP + 3600000L);
    thread.put("announcement", announcement);

    event.setEntity(thread);
    return event;
  }

  private ChangeEvent createThreadUpdatedConversationEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.THREAD_UPDATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("bob.smith");
    event.setTimestamp(FIXED_TIMESTAMP);

    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Conversation");
    thread.put("updatedBy", "bob.smith");
    thread.put("message", "The schema has been updated in the documentation");

    var entityRef = new java.util.HashMap<String, Object>();
    entityRef.put("id", UUID.randomUUID().toString());
    entityRef.put("type", "table");
    entityRef.put("name", "user_profiles");
    entityRef.put("fullyQualifiedName", "prod_db.users.user_profiles");
    thread.put("entityRef", entityRef);

    event.setEntity(thread);
    return event;
  }

  private ChangeEvent createThreadUpdatedAnnouncementEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.THREAD_UPDATED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("admin.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Announcement");
    thread.put("updatedBy", "admin.user");

    var announcement = new java.util.HashMap<String, Object>();
    announcement.put("description", "Maintenance window extended by 1 hour");
    announcement.put("startTime", FIXED_TIMESTAMP);
    announcement.put("endTime", FIXED_TIMESTAMP + 7200000L);
    thread.put("announcement", announcement);

    event.setEntity(thread);
    return event;
  }

  private ChangeEvent createThreadUpdatedAnnouncementDeletedEvent() {
    var event = new ChangeEvent();
    event.setEventType(EventType.ENTITY_DELETED);
    event.setEntityType(Entity.THREAD);
    event.setEntityId(FIXED_ENTITY_ID);
    event.setEntityFullyQualifiedName("thread-" + FIXED_ENTITY_ID);
    event.setUserName("admin.user");
    event.setTimestamp(FIXED_TIMESTAMP);

    var thread = new java.util.HashMap<String, Object>();
    thread.put("type", "Announcement");
    thread.put("updatedBy", "admin.user");

    var announcement = new java.util.HashMap<String, Object>();
    announcement.put("description", "Maintenance has been cancelled");
    thread.put("announcement", announcement);

    event.setEntity(thread);
    return event;
  }

  private SubscriptionDestination createEmailDestination() {
    var destination = new SubscriptionDestination();
    destination.setId(UUID.randomUUID());
    destination.setType(SubscriptionDestination.SubscriptionType.EMAIL);
    destination.setTimeout(10);
    destination.setReadTimeout(10);
    return destination;
  }

  private SubscriptionDestination createSlackDestination() {
    var destination = new SubscriptionDestination();
    destination.setId(UUID.randomUUID());
    destination.setType(SubscriptionDestination.SubscriptionType.SLACK);
    destination.setTimeout(10);
    destination.setReadTimeout(10);
    return destination;
  }

  private SubscriptionDestination createTeamsDestination() {
    var destination = new SubscriptionDestination();
    destination.setId(UUID.randomUUID());
    destination.setType(SubscriptionDestination.SubscriptionType.MS_TEAMS);
    destination.setTimeout(10);
    destination.setReadTimeout(10);
    return destination;
  }

  private SubscriptionDestination createGChatDestination() {
    var destination = new SubscriptionDestination();
    destination.setId(UUID.randomUUID());
    destination.setType(SubscriptionDestination.SubscriptionType.G_CHAT);
    destination.setTimeout(10);
    destination.setReadTimeout(10);
    return destination;
  }
}
