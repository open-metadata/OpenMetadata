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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/**
 * Resolves teams by name or ID.
 *
 * <p>By name, it looks up the teams the action's receivers list names. By ID, it resolves the
 * teams of relationship-based resolvers. A team that does not exist, or has no address on
 * the destination's channel, reaches nobody; one that could not be read is a failure; neither
 * costs the other teams their message.
 */
public class TeamRecipientResolver implements RecipientResolutionStrategy {

  private static final String TEAM_FIELDS = "id,profile,email";

  @Override
  public Recipients resolve(
      ChangeEvent event,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory) {
    return byName(action, directory);
  }

  @Override
  public Recipients resolve(
      UUID entityId,
      String entityType,
      SubscriptionAction action,
      SubscriptionDestination destination,
      AddressDirectory directory) {
    return byName(action, directory);
  }

  public Recipients resolve(List<UUID> teamIds, AddressDirectory directory) {
    return listOrEmpty(teamIds).stream()
        .map(
            id ->
                reached(
                    "team " + id,
                    () -> Entity.<Team>getEntity(Entity.TEAM, id, TEAM_FIELDS, Include.NON_DELETED),
                    directory))
        .collect(Recipients.combined());
  }

  private Recipients byName(SubscriptionAction action, AddressDirectory directory) {
    Collection<String> names =
        action == null || action.getReceivers() == null ? List.of() : action.getReceivers();
    return names.stream()
        .map(
            name ->
                reached(
                    "team " + name,
                    () ->
                        Entity.<Team>getEntityByName(
                            Entity.TEAM, name, TEAM_FIELDS, Include.NON_DELETED),
                    directory))
        .collect(Recipients.combined());
  }

  private static Recipients reached(String what, Supplier<Team> read, AddressDirectory directory) {
    return Recipients.from(Lookup.of(what, () -> directory.ofTeam(read.get())), Recipients::of);
  }

  @Override
  public SubscriptionDestination.SubscriptionCategory getCategory() {
    return SubscriptionDestination.SubscriptionCategory.TEAMS;
  }
}
