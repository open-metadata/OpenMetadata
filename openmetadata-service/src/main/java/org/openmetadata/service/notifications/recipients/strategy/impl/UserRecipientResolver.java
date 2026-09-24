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

package org.openmetadata.service.notifications.recipients.strategy.impl;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.Lookup;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves users by name or ID.
 *
 * <p>By name, it looks up the users the action's receivers list names. By ID, it resolves the
 * users of relationship-based resolvers. A user that does not exist, or has no address on
 * the destination's channel, reaches nobody; one that could not be read is a failure; neither
 * costs the other users their message.
 */
public class UserRecipientResolver implements RecipientResolutionStrategy {

  private static final String USER_FIELDS = "id,profile,email";

  @Override
  public Recipients resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return byName(action, destination);
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return byName(action, destination);
  }

  public Recipients resolve(List<UUID> userIds, SubscriptionDestination destination) {
    return listOrEmpty(userIds).stream()
        .map(
            id ->
                reached(
                    "user " + id,
                    () -> Entity.<User>getEntity(Entity.USER, id, USER_FIELDS, Include.NON_DELETED),
                    destination))
        .collect(Recipients.combined());
  }

  private Recipients byName(SubscriptionAction action, SubscriptionDestination destination) {
    Collection<String> names =
        action == null || action.getReceivers() == null ? List.of() : action.getReceivers();
    return names.stream()
        .map(
            name ->
                reached(
                    "user " + name,
                    () ->
                        Entity.<User>getEntityByName(
                            Entity.USER, name, USER_FIELDS, Include.NON_DELETED),
                    destination))
        .collect(Recipients.combined());
  }

  private static Recipients reached(
      String what, Supplier<User> read, SubscriptionDestination destination) {
    return Recipients.from(
        Lookup.of(what, () -> Recipient.fromUser(read.get(), destination)), Recipients::of);
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.USERS;
  }
}
