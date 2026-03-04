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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves system administrators.
 *
 * This resolver queries for users with admin role and converts them to recipients
 * with appropriate contact information based on the notification type.
 */
@Slf4j
public class AdminRecipientResolver implements RecipientResolutionStrategy {

  @Override
  public Set<Recipient> resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return resolveAdminRecipients(destination);
  }

  @Override
  public Set<Recipient> resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return resolveAdminRecipients(destination);
  }

  private Set<Recipient> resolveAdminRecipients(SubscriptionDestination destination) {
    try {
      List<User> adminUsers = queryAdminUsers();

      if (adminUsers.isEmpty()) {
        return Collections.emptySet();
      }

      return adminUsers.stream()
          .map(user -> Recipient.fromUser(user, destination.getType()))
          .collect(Collectors.toSet());

    } catch (Exception e) {
      LOG.error("Failed to resolve admin recipients", e);
      return Collections.emptySet();
    }
  }

  private List<User> queryAdminUsers() {
    UserRepository userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
    List<User> adminUsers = new ArrayList<>();
    ListFilter listFilter = new ListFilter(Include.ALL);
    listFilter.addQueryParam("isAdmin", "true");
    String after = null;

    try {
      do {
        ResultList<User> result =
            userRepository.listAfter(
                null, userRepository.getFields("email,profile"), listFilter, 50, after);

        adminUsers.addAll(result.getData());

        after = result.getPaging().getAfter();
      } while (after != null);
    } catch (Exception e) {
      LOG.error("Failed to query admin users", e);
    }

    return adminUsers;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.ADMINS;
  }
}
