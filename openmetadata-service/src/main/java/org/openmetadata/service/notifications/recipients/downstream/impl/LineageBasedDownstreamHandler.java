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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.SubscriptionAction;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.notifications.recipients.Lookup;
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.downstream.DownstreamHandler;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.util.LineageGraphExplorer;

/**
 * Resolves the stakeholders downstream of an event's entity.
 *
 * <p>An {@link EntityLineageResolver} turns the event's entity into the entities lineage starts
 * from (a test case into its table, for example). From each of them it resolves that entity's own
 * recipients, the recipients of every entity downstream of it, and then does the same for its
 * ancestors of another type, visiting each entity once. The strategy decides which recipients an
 * entity has (owners, followers, admins...). A lineage read that fails is a failure of the
 * destination; the branches that could be read still reach their recipients.
 */
@Slf4j
public class LineageBasedDownstreamHandler implements DownstreamHandler {

  private final Map<String, EntityLineageResolver> lineageResolvers;
  private final RecipientResolutionStrategy downstreamStrategy;

  private record Walk(
      SubscriptionAction action,
      SubscriptionDestination destination,
      Integer maxDepth,
      Set<String> visited) {}

  public LineageBasedDownstreamHandler(
      Map<String, EntityLineageResolver> lineageResolvers,
      RecipientResolutionStrategy downstreamStrategy) {
    this.lineageResolvers = lineageResolvers;
    this.downstreamStrategy = downstreamStrategy;
  }

  @Override
  public Recipients resolveDownstreamRecipients(
      SubscriptionAction action,
      SubscriptionDestination destination,
      ChangeEvent changeEvent,
      Integer maxDepth) {
    Walk walk = new Walk(action, destination, maxDepth, new HashSet<>());
    EntityLineageResolver resolver = resolverFor(changeEvent.getEntityType());
    return Recipients.from(
        Lookup.of(
            "the lineage roots of event " + changeEvent.getId(),
            () -> resolver.resolveTraversalEntities(changeEvent)),
        roots -> fromEach(roots, walk));
  }

  private Recipients fromEach(Set<EntityReference> entities, Walk walk) {
    return entities.stream()
        .map(entity -> fromRoot(entity.getId(), entity.getType(), walk))
        .collect(Recipients.combined());
  }

  private Recipients fromRoot(UUID id, String type, Walk walk) {
    if (!walk.visited().add(type + ":" + id)) {
      LOG.debug("Lineage from {} {} was already walked", type, id);
      return Recipients.none();
    }
    return downstreamStrategy
        .resolve(id, type, walk.action(), walk.destination())
        .and(downstreamOf(id, type, walk))
        .and(ancestorsOf(id, type, walk));
  }

  private Recipients downstreamOf(UUID id, String type, Walk walk) {
    return Recipients.from(
        Lookup.of(
            "the lineage downstream of " + type + " " + id,
            () ->
                new LineageGraphExplorer(Entity.getCollectionDAO())
                    .findUniqueEntitiesDownstream(id, type, walk.maxDepth())),
        downstream ->
            downstream.stream()
                .map(
                    entity ->
                        downstreamStrategy.resolve(
                            entity.getId(), entity.getType(), walk.action(), walk.destination()))
                .collect(Recipients.combined()));
  }

  // An ancestor of the same type would walk the same lineage again.
  private Recipients ancestorsOf(UUID id, String type, Walk walk) {
    return Recipients.from(
        Lookup.of(
            "the lineage ancestors of " + type + " " + id,
            () -> resolverFor(type).resolveTraversalEntities(id, type)),
        ancestors ->
            fromEach(
                ancestors.stream()
                    .filter(ancestor -> !ancestor.getType().equals(type))
                    .collect(Collectors.toSet()),
                walk));
  }

  private EntityLineageResolver resolverFor(String entityType) {
    return lineageResolvers.getOrDefault(entityType, lineageResolvers.get("*"));
  }
}
