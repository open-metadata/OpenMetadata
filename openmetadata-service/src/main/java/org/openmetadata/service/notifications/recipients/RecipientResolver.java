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

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.alert.type.EmailAlertConfig;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.DataContractLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.DefaultLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.LineageBasedDownstreamHandler;
import org.openmetadata.service.notifications.recipients.downstream.impl.TestCaseLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.TestSuiteLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.ThreadLineageResolver;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.notifications.recipients.strategy.impl.AdminRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.AssigneeRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.ExternalRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.FollowerRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.MentionRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.OwnerRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.TeamRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.UserRecipientResolver;

/**
 * Main entry point for recipient resolution.
 *
 * Orchestrates all resolution strategies and handlers to resolve recipients for notifications
 * based on subscription destination configuration, entity type, and action flags.
 */
@Slf4j
public class RecipientResolver {

  private static final Map<
          SubscriptionDestination.SubscriptionCategory, RecipientResolutionStrategy>
      STRATEGIES;
  private static final Map<String, EntityLineageResolver> LINEAGE_RESOLVERS;

  static {
    // 1. Create user and team resolvers (needed by other strategies)
    UserRecipientResolver userResolver = new UserRecipientResolver();
    TeamRecipientResolver teamResolver = new TeamRecipientResolver();

    // 2. Create strategy implementations
    STRATEGIES =
        Map.ofEntries(
            Map.entry(
                SubscriptionDestination.SubscriptionCategory.EXTERNAL,
                new ExternalRecipientResolver()),
            Map.entry(
                SubscriptionDestination.SubscriptionCategory.OWNERS,
                new OwnerRecipientResolver(userResolver, teamResolver)),
            Map.entry(
                SubscriptionDestination.SubscriptionCategory.FOLLOWERS,
                new FollowerRecipientResolver(userResolver, teamResolver)),
            Map.entry(
                SubscriptionDestination.SubscriptionCategory.ADMINS, new AdminRecipientResolver()),
            Map.entry(SubscriptionDestination.SubscriptionCategory.USERS, userResolver),
            Map.entry(SubscriptionDestination.SubscriptionCategory.TEAMS, teamResolver),
            Map.entry(
                SubscriptionDestination.SubscriptionCategory.ASSIGNEES,
                new AssigneeRecipientResolver(userResolver, teamResolver)),
            Map.entry(
                SubscriptionDestination.SubscriptionCategory.MENTIONS,
                new MentionRecipientResolver()));

    // 3. Create entity lineage resolvers for downstream handling (mapped by entity type)
    LINEAGE_RESOLVERS =
        Map.ofEntries(
            Map.entry(Entity.TEST_CASE, new TestCaseLineageResolver()),
            Map.entry(Entity.THREAD, new ThreadLineageResolver()),
            Map.entry(Entity.TEST_SUITE, new TestSuiteLineageResolver()),
            Map.entry(Entity.DATA_CONTRACT, new DataContractLineageResolver()),
            Map.entry("*", new DefaultLineageResolver())); // Catch-all
  }

  public RecipientResolver() {
    // Empty constructor - uses static initialized strategies and lineage resolvers
  }

  /**
   * Resolves and deduplicates recipients across multiple destinations of the same type.
   * Deduplication uses Recipient.equals() (email for EmailRecipient, endpoint for WebhookRecipient).
   *
   * @param event the change event triggering the notification
   * @param destinations list of subscription destinations to resolve recipients for
   * @return deduplicated set of resolved recipients
   */
  public Set<Recipient> resolveRecipients(
      ChangeEvent event, List<SubscriptionDestination> destinations) {

    Set<Recipient> allRecipients = new HashSet<>();

    for (SubscriptionDestination destination : destinations) {
      Set<Recipient> recipients = resolveRecipientsForDestination(event, destination);
      allRecipients.addAll(recipients);
    }

    return allRecipients;
  }

  /**
   * Resolves recipients for a single destination by extracting the action config from the
   * destination configuration.
   */
  private Set<Recipient> resolveRecipientsForDestination(
      ChangeEvent event, SubscriptionDestination destination) {

    Set<Recipient> recipients = new HashSet<>();

    try {
      SubscriptionDestination.SubscriptionCategory category = destination.getCategory();

      // 1. Get primary recipients based on category
      RecipientResolutionStrategy strategy = STRATEGIES.get(category);
      if (strategy == null) {
        LOG.error("No strategy found for category {}", category);
        return Set.of();
      }

      SubscriptionAction action = extractActionConfig(destination);
      // All entities (including threads) use the same category-based strategy routing
      // Use ChangeEvent method to safely handle deleted entities via payload snapshot
      recipients.addAll(strategy.resolve(event, action, destination));

      // 2. Add downstream recipients if enabled (only for INTERNAL categories)
      if (Boolean.TRUE.equals(destination.getNotifyDownstream())
          && category != SubscriptionDestination.SubscriptionCategory.EXTERNAL) {
        LineageBasedDownstreamHandler downstreamHandler =
            new LineageBasedDownstreamHandler(LINEAGE_RESOLVERS, strategy);
        Set<Recipient> downstreamRecipients =
            downstreamHandler.resolveDownstreamRecipients(
                action, destination, event, destination.getDownstreamDepth());
        recipients.addAll(downstreamRecipients);
      }

    } catch (Exception e) {
      LOG.error(
          "Failed to resolve recipients for event {}-{}",
          event.getEntityType(),
          event.getEntityId(),
          e);
    }

    return recipients;
  }

  /**
   * Extracts the action configuration from the destination config based on destination type.
   */
  private SubscriptionAction extractActionConfig(SubscriptionDestination destination) {
    Object config = destination.getConfig();
    if (config == null) {
      return null;
    }

    return switch (destination.getType()) {
      case EMAIL -> JsonUtils.convertValue(config, EmailAlertConfig.class);
      case SLACK, MS_TEAMS, G_CHAT, WEBHOOK -> JsonUtils.convertValue(config, Webhook.class);
      default -> null;
    };
  }
}
