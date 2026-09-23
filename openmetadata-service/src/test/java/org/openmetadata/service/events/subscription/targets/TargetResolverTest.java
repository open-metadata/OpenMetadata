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

package org.openmetadata.service.events.subscription.targets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.service.events.subscription.channels.Channels;
import org.openmetadata.service.notifications.recipients.RecipientLookups;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;

class TargetResolverTest {
  private static final ChangeEvent EVENT = new ChangeEvent().withId(UUID.randomUUID());
  private static final String HOOK = "https://hooks.example.com/services/T1";

  private final SubscriptionDestination owners = destination(true);
  private final SubscriptionDestination teams = destination(true);

  @Test
  void samePersonThroughTwoDestinationsGetsOneMessage() {
    Map<UUID, Set<Recipient>> found =
        Map.of(owners.getId(), Set.of(hook(HOOK)), teams.getId(), Set.of(hook(HOOK)));

    List<Target> targets = resolve(found, owners, teams).targets();

    assertEquals(1, targets.size());
    assertEquals(owners.getId(), targets.getFirst().sentThrough());
    assertEquals(List.of(owners.getId(), teams.getId()), targets.getFirst().origins());
  }

  // A team is an address of its own, never a group of people.
  @Test
  void teamAndMemberAreTwoAddresses() {
    Map<UUID, Set<Recipient>> found =
        Map.of(
            owners.getId(),
            Set.of(new EmailRecipient("alice@corp.com", "alice")),
            teams.getId(),
            Set.of(new EmailRecipient("data-team@corp.com", "data-team")));

    assertEquals(2, resolve(found, owners, teams).targets().size());
  }

  @Test
  void mailboxesDifferingInCaseGetOneEmail() {
    Map<UUID, Set<Recipient>> found =
        Map.of(
            owners.getId(),
            Set.of(new EmailRecipient("Alice@corp.com", "alice")),
            teams.getId(),
            Set.of(new EmailRecipient(" alice@CORP.com ", "alice")));

    List<Target> targets = resolve(found, owners, teams).targets();

    assertEquals(1, targets.size());
    EmailRecipient sentTo = (EmailRecipient) targets.getFirst().recipient();
    assertEquals("Alice@corp.com", sentTo.getEmail(), "the spelling seen first");
  }

  @Test
  void queryParamsDistinguishWebhookEndpoints() {
    Recipient routeA = new WebhookRecipient(webhook(HOOK).withQueryParams(Map.of("route", "a")));
    Recipient routeB = new WebhookRecipient(webhook(HOOK).withQueryParams(Map.of("route", "b")));
    Map<UUID, Set<Recipient>> found = Map.of(owners.getId(), Set.of(routeA, routeB));

    assertEquals(2, resolve(found, owners).targets().size());
  }

  // Nothing is normalised beyond what is compared today, so no two endpoints are merged.
  @Test
  void endpointsDistinctTodayStayDistinct() {
    Set<Recipient> written =
        Set.of(
            hook("https://hooks.example.com/a"),
            hook("https://hooks.example.com/a/"),
            hook("https://hooks.example.com:443/a"),
            hook("https://hooks.example.com/a?x=1&y=2"),
            hook("https://hooks.example.com/a?y=2&x=1"));
    Set<Recipient> sameAsTheFirst = Set.of(hook("HTTPS://HOOKS.example.com/a"));
    Map<UUID, Set<Recipient>> found =
        Map.of(owners.getId(), written, teams.getId(), sameAsTheFirst);

    assertEquals(5, resolve(found, owners, teams).targets().size());
  }

  @Test
  void receiversDoNotLeakAcrossEvents() {
    List<Set<Recipient>> perEvent =
        new ArrayList<>(List.of(Set.of(hook(HOOK + "/first")), Set.of(hook(HOOK + "/second"))));
    TargetResolver resolver = new TargetResolver((event, destination) -> perEvent.removeFirst());

    List<Target> first = resolver.resolve(EVENT, List.of(owners)).targets();
    List<Target> second = resolver.resolve(EVENT, List.of(owners)).targets();

    assertEquals(1, first.size());
    assertEquals(1, second.size());
    assertEquals(hook(HOOK + "/second").identity(), second.getFirst().identity());
  }

  @Test
  void disabledDestinationNeverSends() {
    SubscriptionDestination switchedOff = destination(false);
    List<UUID> asked = new ArrayList<>();
    TargetResolver resolver =
        new TargetResolver(
            (event, destination) -> {
              asked.add(destination.getId());
              return Set.of(hook(HOOK));
            });

    assertTrue(resolver.resolve(EVENT, List.of(switchedOff)).targets().isEmpty());
    assertTrue(asked.isEmpty());
    assertTrue(TargetResolver.themselves(List.of(switchedOff)).targets().isEmpty());
  }

  // Fetching a team without its profile once lost its chat webhook for every team-owned asset.
  @Test
  void teamOwnerSlackWebhookResolves() {
    Team team =
        new Team()
            .withName("data-platform")
            .withProfile(
                new Profile().withSubscription(new SubscriptionConfig().withSlack(webhook(HOOK))));

    Recipient address = Channels.of("Slack").orElseThrow().directory().ofTeam(team);

    assertEquals(hook(HOOK).identity(), address.identity());
    assertEquals("data-platform", address.name());
  }

  @Test
  void failedLookupFailsTheDestination() {
    TargetResolver resolver =
        new TargetResolver(
            (event, destination) -> {
              if (destination == owners) {
                throw new IllegalStateException("the database did not answer");
              }
              return Set.of(hook(HOOK));
            });

    TargetResolver.Resolved resolved = resolver.resolve(EVENT, List.of(owners, teams));

    assertEquals(Map.of(owners.getId(), "the database did not answer"), resolved.failedLookups());
    assertEquals(1, resolved.targets().size(), "the other destination still sends");
  }

  // A resolver skips a recipient it cannot look up; the others still get the message.
  @Test
  void oneRecipientWhoseLookupFailsCostsOnlyItself() {
    TargetResolver resolver =
        new TargetResolver(
            (event, destination) -> {
              Set<Recipient> found = new HashSet<>();
              try {
                throw new IllegalStateException("team A could not be read");
              } catch (IllegalStateException e) {
                RecipientLookups.reportUnlessAbsent(e);
              }
              found.add(hook(HOOK));
              return found;
            });

    TargetResolver.Resolved resolved = resolver.resolve(EVENT, List.of(teams));

    assertEquals(1, resolved.targets().size(), "team B still gets the message");
    assertEquals(Map.of(teams.getId(), "team A could not be read"), resolved.failedLookups());
  }

  @Test
  void lookupOutsideAResolutionStillThrows() {
    assertThrows(
        RecipientLookups.LookupFailedException.class,
        () -> RecipientLookups.reportUnlessAbsent(new IllegalStateException("no answer")));
  }

  private static TargetResolver.Resolved resolve(
      Map<UUID, Set<Recipient>> found, SubscriptionDestination... destinations) {
    return new TargetResolver((event, destination) -> found.get(destination.getId()))
        .resolve(EVENT, List.of(destinations));
  }

  private static SubscriptionDestination destination(boolean enabled) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionDestination.SubscriptionType.SLACK)
        .withEnabled(enabled);
  }

  private static Recipient hook(String endpoint) {
    return new WebhookRecipient(webhook(endpoint));
  }

  private static Webhook webhook(String endpoint) {
    return new Webhook().withEndpoint(URI.create(endpoint));
  }
}
