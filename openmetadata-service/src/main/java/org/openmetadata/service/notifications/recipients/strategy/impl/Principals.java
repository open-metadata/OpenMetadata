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

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.Recipients;

/** The users and teams a list of references names, as recipients of one destination. */
final class Principals {
  private Principals() {}

  static Recipients of(
      List<EntityReference> references,
      UserRecipientResolver users,
      TeamRecipientResolver teams,
      SubscriptionDestination destination) {
    return users
        .resolve(idsOf(references, Entity.USER), destination)
        .and(teams.resolve(idsOf(references, Entity.TEAM), destination));
  }

  private static List<UUID> idsOf(List<EntityReference> references, String type) {
    return listOrEmpty(references).stream()
        .filter(reference -> type.equalsIgnoreCase(reference.getType()))
        .map(EntityReference::getId)
        .toList();
  }
}
