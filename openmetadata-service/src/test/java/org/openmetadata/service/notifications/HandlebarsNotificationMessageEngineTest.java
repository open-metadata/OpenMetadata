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
    // Build the complete HTML envelope that matches the template
    String envelopeHtml =
        "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01 Transitional//EN\" \"http://www.w3.org/TR/html4/loose.dtd\">"
            + "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:v=\"urn:schemas-microsoft-com:vml\" xmlns:o=\"urn:schemas-microsoft-com:office:office\">"
            + "<head>"
            + "<!--[if gte mso 9]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->"
            + "<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            + "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=Edge\"/>"
            + "<meta name=\"x-apple-disable-message-reformatting\">"
            + "<title></title>"
            + "<style>html{-webkit-text-size-adjust:none;-ms-text-size-adjust:none}@media only screen and (max-device-width:600px),only screen and (max-width:600px){.mob_100{width:100%!important;max-width:100%!important}.mob_full{width:auto!important;display:block!important;padding:0 10px!important}.mob_center{text-align:center!important}.mob_center_bl{margin-left:auto;margin-right:auto}.mob_hidden{display:none!important}.only_mob{display:block!important}}@media only screen and (max-width:600px){.mob_100{width:100%!important;max-width:100%!important}.mob_100 img,.mob_100 table{max-width:100%!important}.mob_full{width:auto!important;display:block!important;padding:0 10px!important}.mob_center{text-align:center!important}.mob_center_bl{margin-left:auto;margin-right:auto}.mob_hidden{display:none!important}.only_mob{display:block!important}}.creative{width:100%!important;max-width:100%!important}.mail_preheader{display:none!important}form input, form textarea{font-family: Arial, sans-serif;width: 100%;box-sizing: border-box;font-size: 13px;color:#000000;outline:none;padding: 0px 15px;}form textarea{resize:vertical;line-height: normal;padding: 10px 15px;}form button{border: 0px none;cursor:pointer;}</style>"
            + "<style>@media only screen and (max-width:480px){u+.body .full-wrap{width:100%!important;width:100vw!important}}</style>"
            + "<style>@-ms-viewport{width:device-width}</style>"
            + "<!--[if (gte mso 9)|(IE)]><style type=\"text/css\">table {border-collapse: collapse !important;}.outf14{font-size:14px !important;} .not_for_outlook{mso-hide: all !important;display: none !important;font-size:0;max-height:0;line-height: 0;mso-hide: all;}.outpadding{padding-left: 0 !important;padding-right: 0 !important;}</style><![endif]-->"
            + "</head>"
            + "<body class=\"body\" style=\"padding:0;margin:0\">"
            + "<div class=\"full-wrap\">"
            + "<table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" class=\"full-wrap\">"
            + "<tr><td align=\"center\" bgcolor=\"#f5f5f5\" style=\"line-height: normal; hyphens: none;\">"
            + "<div>"
            + "<!--[if (gte mso 9)|(IE)]><table width=\"700\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"width: 700px;\"><tr><td><![endif]-->"
            + "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width: 700px;\">"
            + "<tr><td align=\"center\" valign=\"top\" height=\"auto\" bgcolor=\"#ffffff\" style=\"padding: 10px; height:auto;\">"
            + "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"590\" style=\"width: 590px;\">"
            + "<div><img src=\"https://i.imgur.com/7fn1VBe.png\" width=\"1000\" alt=\"\" border=\"0\" style=\"display: block; max-width: 1000px; width: 100%;\" class=\"w1000px\"></div>"
            + "</table>"
            + "<div>"
            + "<!--[if (gte mso 9)|(IE)]><table width=\"600\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"width: 600px;\"><tr><td><![endif]-->"
            + "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width: 600px;\">"
            + "<tr><td align=\"center\" valign=\"top\" style=\"border-radius: 10px;\">"
            + "Hello,<br/><br/>"
            + content
            + "<br/><br/>Happy Exploring!<br/>Thanks."
            + "</td></tr></table>"
            + "<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->"
            + "</div>"
            + "<div>"
            + "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\" style=\"max-width: 600px;\">"
            + "<tr><td align=\"center\" valign=\"middle\">"
            + "<div>"
            + "<table border=\"0\" cellspacing=\"0\" cellpadding=\"0\" width=\"100%\">"
            + "<tr><td align=\"center\" valign=\"middle\" height=\"1\">"
            + "<p style=\"font-family: Inter, sans-serif; font-size: 12px; color: #6c757d; text-align: center\">OpenMetadata</p>"
            + "</td></tr></table>"
            + "</div></td></tr></table>"
            + "</div>"
            + "</td></tr></table>"
            + "<!--[if (gte mso 9)|(IE)]></td></tr></table><![endif]-->"
            + "</div>"
            + "</td></tr></table>"
            + "</div>"
            + "</body></html>";

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
            "<strong>admin.user</strong> performed entityFieldsChanged on <a href=\"http://localhost:8585/dashboard/analytics.sales_dashboard\" rel=\"nofollow\">analytics.sales_dashboard</a><br /><strong>Changed:</strong> description, owner");

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
                                    "*admin.user* performed entityFieldsChanged on <http://localhost:8585/dashboard/analytics.sales_dashboard|analytics.sales_dashboard>\n*Changed:* description, owner")
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
                                                "**admin.user** performed entityFieldsChanged on [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard)\n**Changed:** description, owner")
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
                                                        "*admin.user* performed entityFieldsChanged on [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard)\n*Changed:* description, owner")))
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
            "<strong>alice.admin</strong> soft deleted table <a href=\"http://localhost:8585/table/staging_db.warehouse.inventory\" rel=\"nofollow\">staging_db.warehouse.inventory</a>");

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
                                    "*alice.admin* soft deleted table <http://localhost:8585/table/staging_db.warehouse.inventory|staging_db.warehouse.inventory>")
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
                                                "**alice.admin** soft deleted table [staging_db.warehouse.inventory](http://localhost:8585/table/staging_db.warehouse.inventory)")
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
                                                        "*alice.admin* soft deleted table [staging_db.warehouse.inventory](http://localhost:8585/table/staging_db.warehouse.inventory)")))
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
            "<strong>&#64;alice.user</strong> posted a message on asset <a href=\"http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all\" rel=\"nofollow\">analytics.sales_dashboard</a><br /><strong>&#64;bob.analyst:</strong> This looks great! I have a question about the metrics.<br /><strong>&#64;alice.user:</strong> Thanks! Happy to discuss the metrics in detail.");

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
                                    "*@alice.user* posted a message on asset <http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all|analytics.sales_dashboard>\n*@bob.analyst:* This looks great! I have a question about the metrics.\n*@alice.user:* Thanks! Happy to discuss the metrics in detail.")
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
                                                "**@alice.user** posted a message on asset [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all)\n**@bob.analyst:** This looks great! I have a question about the metrics.\n**@alice.user:** Thanks! Happy to discuss the metrics in detail.")
                                            .wrap(true)
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
                                                        "*@alice.user* posted a message on asset [analytics.sales_dashboard](http://localhost:8585/dashboard/analytics.sales_dashboard/activity_feed/all)\n*@bob.analyst:* This looks great! I have a question about the metrics.\n*@alice.user:* Thanks! Happy to discuss the metrics in detail.")))
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
            "<strong>&#64;task.creator</strong> closed Task with Id: 123 for Asset <a href=\"http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks\" rel=\"nofollow\">prod_db.analytics.users_table</a><br /><strong>Current Status:</strong> Closed");

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
                                    "*@task.creator* closed Task with Id: 123 for Asset <http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks|prod_db.analytics.users_table>\n*Current Status:* Closed")
                                .build())
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
                                                "**@task.creator** closed Task with Id: 123 for Asset [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)\n**Current Status:** Closed")
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
                                                        "*@task.creator* closed Task with Id: 123 for Asset [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)\n*Current Status:* Closed")))
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
            "<strong>&#64;task.creator</strong> resolved Task with Id: 123 for Asset <a href=\"http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks\" rel=\"nofollow\">prod_db.analytics.users_table</a><br /><strong>Current Status:</strong> Resolved");

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
                                    "*@task.creator* resolved Task with Id: 123 for Asset <http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks|prod_db.analytics.users_table>\n*Current Status:* Resolved")
                                .build())
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
                                                "**@task.creator** resolved Task with Id: 123 for Asset [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)\n**Current Status:** Resolved")
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
                                                        "*@task.creator* resolved Task with Id: 123 for Asset [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table/activity_feed/tasks)\n*Current Status:* Resolved")))
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
            "<strong>test.engineer</strong> added logical test cases to <a href=\"http://localhost:8585/table/prod_db.analytics.users_table\" rel=\"nofollow\">prod_db.analytics.users_table</a>");

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
                                    "*test.engineer* added logical test cases to <http://localhost:8585/table/prod_db.analytics.users_table|prod_db.analytics.users_table>")
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
                                                "**test.engineer** added logical test cases to [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table)")
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
                                                        "*test.engineer* added logical test cases to [prod_db.analytics.users_table](http://localhost:8585/table/prod_db.analytics.users_table)")))
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
            "<strong>&#64;john.doe</strong> created a Task for table <a href=\"http://localhost:8585/table/prod_db.sales.customer_orders\" rel=\"nofollow\">prod_db.sales.customer_orders</a><br /><strong>Task Type:</strong> RequestDescription<br /><strong>Assignees:</strong> &#64;alice.smith, &#64;bob.jones<br /><strong>Current Status:</strong> Open");

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
                                    "*@john.doe* created a Task for table <http://localhost:8585/table/prod_db.sales.customer_orders|prod_db.sales.customer_orders>\n*Task Type:* RequestDescription\n*Assignees:* @alice.smith, @bob.jones\n*Current Status:* Open")
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
                                                "**@john.doe** created a Task for table [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)\n**Task Type:** RequestDescription\n**Assignees:** @alice.smith, @bob.jones\n**Current Status:** Open")
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
                                                        "*@john.doe* created a Task for table [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)\n*Task Type:* RequestDescription\n*Assignees:* @alice.smith, @bob.jones\n*Current Status:* Open")))
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
                                                "**@alice.smith** posted update on the Task with Id: 123 for Asset [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)\n**Task Type:** RequestDescription\n**Assignees:** @alice.smith, @bob.jones\n**Current Status:** In Progress")
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
                                                        "*@alice.smith* posted update on the Task with Id: 123 for Asset [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)\n*Task Type:* RequestDescription\n*Assignees:* @alice.smith, @bob.jones\n*Current Status:* In Progress")))
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
            "<strong>&#64;jane.doe</strong> started a conversation for asset <a href=\"http://localhost:8585/table/prod_db.users.user_profiles\" rel=\"nofollow\">prod_db.users.user_profiles</a><br />What is the schema for this table?");

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
                                    "*@jane.doe* started a conversation for asset <http://localhost:8585/table/prod_db.users.user_profiles|prod_db.users.user_profiles>\nWhat is the schema for this table?")
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
                                                "**@jane.doe** started a conversation for asset [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)\nWhat is the schema for this table?")
                                            .wrap(true)
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
                                                        "*@jane.doe* started a conversation for asset [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)\nWhat is the schema for this table?")))
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
            "<strong>&#64;admin.user</strong> posted an Announcement<br /><strong>Description:</strong> Scheduled maintenance on production database<br /><strong>Started At:</strong> 2022-01-01 01:00:00<br /><strong>Ends At:</strong> 2022-01-01 02:00:00");

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
                                .text(
                                    "*@admin.user* posted an Announcement\n*Description:* Scheduled maintenance on production database\n*Started At:* 2022-01-01 01:00:00\n*Ends At:* 2022-01-01 02:00:00")
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
                                            .text(
                                                "**@admin.user** posted an Announcement\n**Description:** Scheduled maintenance on production database\n**Started At:** 2022-01-01 01:00:00\n**Ends At:** 2022-01-01 02:00:00")
                                            .wrap(true)
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
                                                        "*@admin.user* posted an Announcement\n*Description:* Scheduled maintenance on production database\n*Started At:* 2022-01-01 01:00:00\n*Ends At:* 2022-01-01 02:00:00")))
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
            "<strong>&#64;bob.smith</strong> posted update on Conversation for asset <a href=\"http://localhost:8585/table/prod_db.users.user_profiles\" rel=\"nofollow\">prod_db.users.user_profiles</a><br />The schema has been updated in the documentation");

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
                                    "*@bob.smith* posted update on Conversation for asset <http://localhost:8585/table/prod_db.users.user_profiles|prod_db.users.user_profiles>\nThe schema has been updated in the documentation")
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
                                                "**@bob.smith** posted update on Conversation for asset [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)\nThe schema has been updated in the documentation")
                                            .wrap(true)
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
                                                        "*@bob.smith* posted update on Conversation for asset [prod_db.users.user_profiles](http://localhost:8585/table/prod_db.users.user_profiles)\nThe schema has been updated in the documentation")))
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
            "<strong>&#64;admin.user</strong> posted an update on Announcement<br /><strong>Description:</strong> Maintenance window extended by 1 hour<br /><strong>Started At:</strong> 2022-01-01 01:00:00<br /><strong>Ends At:</strong> 2022-01-01 03:00:00");

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
                                .text(
                                    "*@admin.user* posted an update on Announcement\n*Description:* Maintenance window extended by 1 hour\n*Started At:* 2022-01-01 01:00:00\n*Ends At:* 2022-01-01 03:00:00")
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
                                            .text(
                                                "**@admin.user** posted an update on Announcement\n**Description:** Maintenance window extended by 1 hour\n**Started At:** 2022-01-01 01:00:00\n**Ends At:** 2022-01-01 03:00:00")
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
                                                        "*@admin.user* posted an update on Announcement\n*Description:* Maintenance window extended by 1 hour\n*Started At:* 2022-01-01 01:00:00\n*Ends At:* 2022-01-01 03:00:00")))
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
            "<strong>&#64;admin.user</strong> posted an update on Announcement<br /><strong>Announcement Deleted:</strong> Maintenance has been cancelled");

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
                                .text(
                                    "*@admin.user* posted an update on Announcement\n*Announcement Deleted:* Maintenance has been cancelled")
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
                                            .text(
                                                "**@admin.user** posted an update on Announcement\n**Announcement Deleted:** Maintenance has been cancelled")
                                            .wrap(true)
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
                                                        "*@admin.user* posted an update on Announcement\n*Announcement Deleted:* Maintenance has been cancelled")))
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
            "<strong>john.doe</strong> deleted table prod_db.analytics.users_table");

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
                                .text("*john.doe* deleted table prod_db.analytics.users_table")
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
                                                "**john.doe** deleted table prod_db.analytics.users_table")
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
                                                        "*john.doe* deleted table prod_db.analytics.users_table")))
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
            "<strong>jane.smith</strong> created table <a href=\"http://localhost:8585/table/prod_db.sales.customer_orders\" rel=\"nofollow\">prod_db.sales.customer_orders</a><br />Description: Customer order transaction data with payment details");

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
                                    "*jane.smith* created table <http://localhost:8585/table/prod_db.sales.customer_orders|prod_db.sales.customer_orders>\nDescription: Customer order transaction data with payment details")
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
                                                "**jane.smith** created table [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)\nDescription: Customer order transaction data with payment details")
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
                                                        "*jane.smith* created table [prod_db.sales.customer_orders](http://localhost:8585/table/prod_db.sales.customer_orders)\nDescription: Customer order transaction data with payment details")))
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
    task.put("status", "Closed");
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
