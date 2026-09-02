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

package org.openmetadata.service.notifications.recipients;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;
import org.openmetadata.service.notifications.recipients.strategy.impl.ExternalRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.TeamRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.UserRecipientResolver;

/**
 * Team email is optional, and so is the Slack/MsTeams/GChat webhook on a user or team profile.
 * Recipients carrying no contact information for the destination type, and recipients that cannot
 * be fetched at all, must be skipped individually instead of discarding every other recipient.
 */
class RecipientResolutionTest {

  private static final String TEAM_EMAIL = "data-platform@open-metadata.org";
  private static final String USER_EMAIL = "with-webhook@open-metadata.org";
  private static final String VALID_RECEIVER = "https://hooks.open-metadata.org/services/valid";
  private static final UUID TEAM_WITH_CONTACT_ID = UUID.randomUUID();
  private static final UUID TEAM_WITHOUT_CONTACT_ID = UUID.randomUUID();
  private static final UUID USER_ID = UUID.randomUUID();

  @Test
  void teamWithoutEmailDoesNotDropTheOtherTeams() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubTeamById(entityMock, TEAM_WITH_CONTACT_ID, team("data-platform", TEAM_EMAIL));
      stubTeamById(entityMock, TEAM_WITHOUT_CONTACT_ID, team("no-email-team", null));

      Set<Recipient> recipients =
          new TeamRecipientResolver()
              .resolve(
                  List.of(TEAM_WITHOUT_CONTACT_ID, TEAM_WITH_CONTACT_ID),
                  destination(SubscriptionType.EMAIL));

      assertEquals(Set.of(TEAM_EMAIL), emailsOf(recipients));
    }
  }

  @Test
  void unresolvableTeamDoesNotDropTheOtherTeams() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubTeamById(entityMock, TEAM_WITH_CONTACT_ID, team("data-platform", TEAM_EMAIL));
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TEAM), eq(TEAM_WITHOUT_CONTACT_ID), any(), eq(Include.NON_DELETED)))
          .thenThrow(new IllegalStateException("team not found"));

      Set<Recipient> recipients =
          new TeamRecipientResolver()
              .resolve(
                  List.of(TEAM_WITHOUT_CONTACT_ID, TEAM_WITH_CONTACT_ID),
                  destination(SubscriptionType.EMAIL));

      assertEquals(Set.of(TEAM_EMAIL), emailsOf(recipients));
    }
  }

  @Test
  void teamWithoutSlackWebhookDoesNotDropTheOtherTeams() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubTeamByName(
          entityMock,
          "with-webhook",
          team("with-webhook", TEAM_EMAIL)
              .withProfile(slackProfile("https://hooks.slack.com/services/team")));
      stubTeamByName(entityMock, "no-webhook", team("no-webhook", TEAM_EMAIL));

      Set<Recipient> recipients =
          new TeamRecipientResolver()
              .resolve(
                  UUID.randomUUID(),
                  Entity.TABLE,
                  new Webhook().withReceivers(Set.of("no-webhook", "with-webhook")),
                  destination(SubscriptionType.SLACK));

      assertEquals(1, recipients.size());
      assertTrue(recipients.iterator().next() instanceof WebhookRecipient);
    }
  }

  @Test
  void userWithoutSlackWebhookDoesNotDropTheOtherUsers() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUserByName(
          entityMock,
          "with-webhook",
          user("with-webhook", USER_EMAIL)
              .withProfile(slackProfile("https://hooks.slack.com/services/user")));
      stubUserByName(entityMock, "no-webhook", user("no-webhook", "no-webhook@open-metadata.org"));

      Set<Recipient> recipients =
          new UserRecipientResolver()
              .resolve(
                  UUID.randomUUID(),
                  Entity.TABLE,
                  new Webhook().withReceivers(Set.of("no-webhook", "with-webhook")),
                  destination(SubscriptionType.SLACK));

      assertEquals(1, recipients.size());
      assertTrue(recipients.iterator().next() instanceof WebhookRecipient);
    }
  }

  @Test
  void userWithoutEmailIsSkipped() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () -> Entity.getEntity(eq(Entity.USER), eq(USER_ID), any(), eq(Include.NON_DELETED)))
          .thenReturn(user("no-email-user", null));

      Set<Recipient> recipients =
          new UserRecipientResolver()
              .resolve(List.of(USER_ID), destination(SubscriptionType.EMAIL));

      assertTrue(recipients.isEmpty());
    }
  }

  @Test
  void malformedExternalReceiverDoesNotDropTheOtherReceivers() {
    Set<Recipient> recipients =
        new ExternalRecipientResolver()
            .resolve(
                UUID.randomUUID(),
                Entity.TABLE,
                new Webhook().withReceivers(Set.of(VALID_RECEIVER, "{{SLACK_WEBHOOK_URL}}")),
                externalDestination());

    assertEquals(Set.of(VALID_RECEIVER), endpointsOf(recipients));
  }

  @Test
  void blankExternalReceiverIsSkipped() {
    Set<Recipient> recipients =
        new ExternalRecipientResolver()
            .resolve(
                UUID.randomUUID(),
                Entity.TABLE,
                new Webhook().withReceivers(Set.of(VALID_RECEIVER, "  ")),
                externalDestination());

    assertEquals(Set.of(VALID_RECEIVER), endpointsOf(recipients));
  }

  @Test
  void emailRecipientIsNullWhenTeamHasNoEmail() {
    assertNull(EmailRecipient.fromTeam(team("no-email-team", null)));
    assertNull(EmailRecipient.fromTeam(team("blank-email-team", "")));
    assertEquals(TEAM_EMAIL, EmailRecipient.fromTeam(team("data-platform", TEAM_EMAIL)).getEmail());
  }

  private static void stubTeamById(MockedStatic<Entity> entityMock, UUID teamId, Team team) {
    entityMock
        .when(() -> Entity.getEntity(eq(Entity.TEAM), eq(teamId), any(), eq(Include.NON_DELETED)))
        .thenReturn(team);
  }

  private static void stubTeamByName(MockedStatic<Entity> entityMock, String name, Team team) {
    entityMock
        .when(
            () -> Entity.getEntityByName(eq(Entity.TEAM), eq(name), any(), eq(Include.NON_DELETED)))
        .thenReturn(team);
  }

  private static void stubUserByName(MockedStatic<Entity> entityMock, String name, User user) {
    entityMock
        .when(
            () -> Entity.getEntityByName(eq(Entity.USER), eq(name), any(), eq(Include.NON_DELETED)))
        .thenReturn(user);
  }

  private static SubscriptionDestination destination(SubscriptionType type) {
    return new SubscriptionDestination().withType(type);
  }

  private static SubscriptionDestination externalDestination() {
    return new SubscriptionDestination()
        .withType(SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(new Webhook().withEndpoint(URI.create("https://fallback.open-metadata.org")));
  }

  private static Set<String> endpointsOf(Set<Recipient> recipients) {
    return recipients.stream()
        .map(WebhookRecipient.class::cast)
        .map(recipient -> recipient.getWebhook().getEndpoint().toString())
        .collect(Collectors.toSet());
  }

  private static Set<String> emailsOf(Set<Recipient> recipients) {
    return recipients.stream()
        .map(EmailRecipient.class::cast)
        .map(EmailRecipient::getEmail)
        .collect(Collectors.toSet());
  }

  private static Team team(String name, String email) {
    return new Team().withId(UUID.randomUUID()).withName(name).withEmail(email);
  }

  private static User user(String name, String email) {
    return new User().withId(UUID.randomUUID()).withName(name).withEmail(email);
  }

  private static Profile slackProfile(String endpoint) {
    return new Profile()
        .withSubscription(
            new SubscriptionConfig().withSlack(new Webhook().withEndpoint(URI.create(endpoint))));
  }
}
