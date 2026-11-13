/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.alerting.channel.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.audience.Recipient;
import org.openmetadata.service.alerting.audience.WebhookRecipient;
import org.openmetadata.service.alerting.channel.ProfileWebhookSecrets;
import org.openmetadata.service.fernet.Fernet;

/** A team's saved webhook that cannot be used stays a recipient, so the alert reports it. */
class WebhookAddressesTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String ENDPOINT = "https://hooks.example.com/team";

  private final WebhookAddresses addresses = new WebhookAddresses(SubscriptionConfig::getGeneric);

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void aSavedWebhookThatCannotBeUsedIsARecipientThatSaysWhy() {
    Profile savedForAnotherTeam = savedFor(UUID.randomUUID());
    Team team =
        new Team().withId(UUID.randomUUID()).withName("data").withProfile(savedForAnotherTeam);

    Recipient recipient = addresses.ofTeam(team);

    assertEquals("data", recipient.name());
    assertEquals(
        Optional.of("the saved webhook value cannot be used; enter it again on the team"),
        recipient.unusableBecause());
  }

  @Test
  void aSavedWebhookThatOpensIsSentTo() {
    UUID id = UUID.randomUUID();
    Team team = new Team().withId(id).withName("ops").withProfile(savedFor(id));

    Recipient recipient = addresses.ofTeam(team);

    assertTrue(recipient.unusableBecause().isEmpty());
    assertEquals(URI.create(ENDPOINT), ((WebhookRecipient) recipient).getWebhook().getEndpoint());
  }

  @Test
  void aTeamWithoutAWebhookOnTheChannelIsNoRecipient() {
    Profile slackOnly =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withSlack(
                        new Webhook().withEndpoint(URI.create("https://hooks.slack.com/x"))));

    assertNull(addresses.ofTeam(new Team().withId(UUID.randomUUID()).withName("none")));
    assertNull(
        addresses.ofTeam(
            new Team().withId(UUID.randomUUID()).withName("s").withProfile(slackOnly)));
  }

  private static Profile savedFor(UUID teamId) {
    Webhook signed =
        new Webhook()
            .withEndpoint(URI.create(ENDPOINT))
            .withAuthType(Map.of("type", "bearer", "secretKey", "a signing key"));
    return ProfileWebhookSecrets.ofANewEntity(
        new ProfileWebhookSecrets.Holder(Entity.TEAM, teamId),
        new Profile().withSubscription(new SubscriptionConfig().withGeneric(signed)));
  }
}
