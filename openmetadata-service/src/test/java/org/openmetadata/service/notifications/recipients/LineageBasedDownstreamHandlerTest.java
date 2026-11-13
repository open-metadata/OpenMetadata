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

package org.openmetadata.service.notifications.recipients;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.downstream.impl.DefaultLineageResolver;
import org.openmetadata.service.notifications.recipients.downstream.impl.LineageBasedDownstreamHandler;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.util.LineageGraphExplorer;

class LineageBasedDownstreamHandlerTest {
  private static final UUID CHANGED = UUID.randomUUID();
  private static final UUID DOWNSTREAM = UUID.randomUUID();
  private static final ChangeEvent EVENT =
      new ChangeEvent().withEntityType(Entity.TABLE).withEntityId(CHANGED);

  @Test
  void anEntityInLineageItselfIsWalkedFromItsOwnPlace() {
    RecipientResolutionStrategy owners = owners();

    Set<Recipient> reached;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedConstruction<LineageGraphExplorer> lineage =
            mockConstruction(
                LineageGraphExplorer.class,
                (explorer, context) ->
                    when(explorer.findUniqueEntitiesDownstream(CHANGED, Entity.TABLE, 2))
                        .thenReturn(
                            Set.of(
                                new EntityReference()
                                    .withId(DOWNSTREAM)
                                    .withType(Entity.TABLE))))) {
      entity.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
      reached = resolve(owners);
    }

    assertEquals(Set.of(ownerOf(CHANGED), ownerOf(DOWNSTREAM)), reached);
    verify(owners, never()).resolve(eq(CHANGED), any(), any(), any());
  }

  @Test
  void aFailedLineageReadKeepsTheChangedEntitysOwnRecipients() {
    RecipientResolutionStrategy owners = owners();

    Set<Recipient> reached;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedConstruction<LineageGraphExplorer> lineage =
            mockConstruction(
                LineageGraphExplorer.class,
                (explorer, context) ->
                    when(explorer.findUniqueEntitiesDownstream(any(), any(), any()))
                        .thenThrow(new IllegalStateException("lineage did not answer")))) {
      entity.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
      reached = resolve(owners);
    }

    assertEquals(Set.of(ownerOf(CHANGED)), reached);
  }

  private static Set<Recipient> resolve(RecipientResolutionStrategy owners) {
    return new LineageBasedDownstreamHandler(Map.of("*", new DefaultLineageResolver()), owners)
        .resolveDownstreamRecipients(null, new SubscriptionDestination(), EVENT, 2);
  }

  private static RecipientResolutionStrategy owners() {
    RecipientResolutionStrategy owners = mock(RecipientResolutionStrategy.class);
    when(owners.resolve(any(ChangeEvent.class), any(), any()))
        .thenAnswer(ask -> Set.of(ownerOf(ask.<ChangeEvent>getArgument(0).getEntityId())));
    when(owners.resolve(any(UUID.class), any(), any(), any()))
        .thenAnswer(ask -> Set.of(ownerOf(ask.getArgument(0))));
    return owners;
  }

  private static Recipient ownerOf(UUID tableId) {
    return new EmailRecipient(tableId + "@corp.com");
  }
}
