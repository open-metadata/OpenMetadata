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
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.channels.Channels;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.ConversationLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.DataContractLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.DefaultLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.LineageBasedDownstreamHandler;
import org.openmetadata.service.notifications.recipients.downstream.impl.TestCaseLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.TestSuiteLineageResolver;
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
            Map.entry(Entity.CONVERSATION, new ConversationLineageResolver()),
            Map.entry(Entity.TEST_SUITE, new TestSuiteLineageResolver()),
            Map.entry(Entity.DATA_CONTRACT, new DataContractLineageResolver()),
            Map.entry("*", new DefaultLineageResolver())); // Catch-all
  }

  public RecipientResolver() {
    // Empty constructor - uses static initialized strategies and lineage resolvers
  }

  /**
   * The recipients of several destinations for one event, deduplicated, for callers that send to
   * whoever could be found. A lookup that failed is logged and costs only what it could not find.
   */
  public Set<Recipient> resolveRecipients(
      ChangeEvent event, List<SubscriptionDestination> destinations) {
    Recipients reached =
        destinations.stream()
            .map(destination -> guarded(event, destination))
            .collect(Recipients.combined());
    reached
        .failures()
        .forEach(
            failure ->
                LOG.warn(
                    "A recipient of event {} could not be looked up: {}", event.getId(), failure));
    return new HashSet<>(reached.found());
  }

  // An unexpected error costs its own destination only.
  private Recipients guarded(ChangeEvent event, SubscriptionDestination destination) {
    Recipients reached;
    try {
      reached = recipientsOf(event, destination);
    } catch (RuntimeException e) {
      LOG.error("Recipients of destination {} could not be resolved", destination.getId(), e);
      reached = Recipients.failed(String.valueOf(e.getMessage()));
    }
    return reached;
  }

  /** The recipients of one destination for one event, and the lookups that failed. */
  public Recipients recipientsOf(ChangeEvent event, SubscriptionDestination destination) {
    Recipients reached = Recipients.none();
    SubscriptionDestination.SubscriptionCategory category = destination.getCategory();
    RecipientResolutionStrategy strategy = STRATEGIES.get(category);
    if (strategy == null) {
      LOG.error("No strategy found for category {}", category);
    } else {
      SubscriptionAction action = extractActionConfig(destination);
      reached =
          strategy
              .resolve(event, action, destination)
              .and(downstreamRecipients(event, action, destination, strategy));
    }
    return reached;
  }

  // Only for internal categories: an external destination names its receivers itself.
  private Recipients downstreamRecipients(
      ChangeEvent event,
      SubscriptionAction action,
      SubscriptionDestination destination,
      RecipientResolutionStrategy strategy) {
    boolean wanted =
        Boolean.TRUE.equals(destination.getNotifyDownstream())
            && destination.getCategory() != SubscriptionDestination.SubscriptionCategory.EXTERNAL;
    return wanted
        ? new LineageBasedDownstreamHandler(LINEAGE_RESOLVERS, strategy)
            .resolveDownstreamRecipients(
                action, destination, event, destination.getDownstreamDepth())
        : Recipients.none();
  }

  /**
   * Extracts the action configuration from the destination config based on destination type.
   */
  private SubscriptionAction extractActionConfig(SubscriptionDestination destination) {
    Object config = destination.getConfig();
    if (config == null) {
      return null;
    }

    if (config instanceof SubscriptionAction action) {
      return action;
    }

    return Channels.required(destination).configRules().receiversOf(destination);
  }
}
