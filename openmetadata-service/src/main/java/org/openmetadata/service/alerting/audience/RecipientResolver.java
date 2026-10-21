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

package org.openmetadata.service.alerting.audience;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;

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
   * The recipients of one destination for one event, and the lookups that failed.
   *
   * @param directory where the destination's channel reaches a user or a team
   * @param receivers what the destination's configuration names, as its channel reads it
   */
  public Recipients recipientsOf(
      ChangeEvent event,
      SubscriptionDestination destination,
      AddressDirectory directory,
      SubscriptionAction receivers) {
    Recipients reached = Recipients.none();
    SubscriptionDestination.SubscriptionCategory category = destination.getCategory();
    RecipientResolutionStrategy strategy = STRATEGIES.get(category);
    if (strategy == null) {
      LOG.error("No strategy found for category {}", category);
    } else {
      reached =
          strategy
              .resolve(event, receivers, destination, directory)
              .and(downstreamRecipients(event, receivers, destination, directory, strategy));
    }
    return reached;
  }

  // Only for internal categories: an external destination names its receivers itself.
  private Recipients downstreamRecipients(
      ChangeEvent event,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory,
      RecipientResolutionStrategy strategy) {
    boolean wanted =
        Boolean.TRUE.equals(destination.getNotifyDownstream())
            && destination.getCategory() != SubscriptionDestination.SubscriptionCategory.EXTERNAL;
    return wanted
        ? new LineageBasedDownstreamHandler(LINEAGE_RESOLVERS, strategy)
            .resolveDownstreamRecipients(
                action, destination, directory, event, destination.getDownstreamDepth())
        : Recipients.none();
  }
}
