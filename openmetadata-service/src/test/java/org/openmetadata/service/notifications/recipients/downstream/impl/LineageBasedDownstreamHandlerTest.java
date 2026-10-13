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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
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
import org.openmetadata.service.notifications.recipients.Recipients;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;
import org.openmetadata.service.notifications.recipients.strategy.RecipientResolutionStrategy;
import org.openmetadata.service.util.LineageGraphExplorer;

class LineageBasedDownstreamHandlerTest {
  private static final UUID BROKEN_ROOT = UUID.randomUUID();
  private static final UUID HEALTHY_ROOT = UUID.randomUUID();
  private static final UUID DOWNSTREAM = UUID.randomUUID();

  @Test
  void lineageQueryFailureIsAFailureOtherBranchesResolve() {
    RecipientResolutionStrategy owners = mock(RecipientResolutionStrategy.class);
    when(owners.resolve(any(UUID.class), any(), any(), any()))
        .thenAnswer(ask -> Recipients.of(ownerOf(ask.getArgument(0))));
    EntityLineageResolver roots = mock(EntityLineageResolver.class);
    when(roots.resolveTraversalEntities(any(ChangeEvent.class)))
        .thenReturn(Set.of(table(BROKEN_ROOT), table(HEALTHY_ROOT)));
    when(roots.resolveTraversalEntities(any(UUID.class), any())).thenReturn(Set.of());

    Recipients reached;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedConstruction<LineageGraphExplorer> lineage =
            mockConstruction(
                LineageGraphExplorer.class,
                (explorer, context) -> {
                  when(explorer.findUniqueEntitiesDownstream(eq(BROKEN_ROOT), any(), any()))
                      .thenThrow(new IllegalStateException("lineage did not answer"));
                  when(explorer.findUniqueEntitiesDownstream(eq(HEALTHY_ROOT), any(), any()))
                      .thenReturn(Set.of(table(DOWNSTREAM)));
                })) {
      entity.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
      reached =
          new LineageBasedDownstreamHandler(Map.of("*", roots), owners)
              .resolveDownstreamRecipients(
                  null,
                  new SubscriptionDestination(),
                  new ChangeEvent().withEntityType("table"),
                  2);
    }

    assertEquals(
        Set.of(ownerOf(BROKEN_ROOT), ownerOf(HEALTHY_ROOT), ownerOf(DOWNSTREAM)), reached.found());
    assertEquals(1, reached.failures().size());
    assertTrue(reached.failures().getFirst().contains("lineage did not answer"));
  }

  private static EntityReference table(UUID id) {
    return new EntityReference().withId(id).withType("table");
  }

  private static Recipient ownerOf(UUID tableId) {
    return new EmailRecipient(tableId + "@corp.com", tableId.toString());
  }
}
