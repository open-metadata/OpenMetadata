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
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.notifications.recipients.Lookup;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;

/**
 * Resolves system administrators: every user with the admin role, with the address the
 * destination's channel uses.
 */
public class AdminRecipientResolver implements RecipientResolutionStrategy {
  private static final int PAGE_SIZE = 50;

  @Override
  public Recipients resolve(
      ChangeEvent event, SubscriptionAction action, SubscriptionDestination destination) {
    return admins(destination);
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination) {
    return admins(destination);
  }

  private static Recipients admins(SubscriptionDestination destination) {
    return Recipients.from(
        Lookup.of("the admins", AdminRecipientResolver::everyAdmin),
        admins ->
            admins.stream()
                .map(admin -> Recipients.of(Recipient.fromUser(admin, destination)))
                .collect(Recipients.combined()));
  }

  private static List<User> everyAdmin() {
    UserRepository users = (UserRepository) Entity.getEntityRepository(Entity.USER);
    ListFilter admins = new ListFilter(Include.ALL);
    admins.addQueryParam("isAdmin", "true");
    List<User> found = new ArrayList<>();
    String after = null;
    do {
      ResultList<User> page =
          users.listAfter(null, users.getFields("email,profile"), admins, PAGE_SIZE, after);
      found.addAll(page.getData());
      after = page.getPaging().getAfter();
    } while (after != null);
    return found;
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.ADMINS;
  }
}
