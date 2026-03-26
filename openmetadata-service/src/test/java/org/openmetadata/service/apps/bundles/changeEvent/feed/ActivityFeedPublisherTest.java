/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.changeEvent.feed;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.FeedUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ActivityFeedPublisherTest {

  @Mock private EventSubscription eventSubscription;
  @Mock private SubscriptionDestination subscriptionDestination;

  private ActivityFeedPublisher publisher;

  @BeforeEach
  void setUp() {
    when(subscriptionDestination.getType())
        .thenReturn(SubscriptionDestination.SubscriptionType.ACTIVITY_FEED);
    when(subscriptionDestination.getId()).thenReturn(UUID.randomUUID());

    publisher = new ActivityFeedPublisher(eventSubscription, subscriptionDestination);
  }

  @Test
  void testSendMessage_SkipsGracefullyWhenEntityDeleted() {
    ChangeEvent event = createChangeEvent(EventType.ENTITY_CREATED);

    try (MockedStatic<FeedUtils> mockedFeedUtils = mockStatic(FeedUtils.class)) {
      mockedFeedUtils
          .when(() -> FeedUtils.getThreadWithMessage(any(), any()))
          .thenThrow(EntityNotFoundException.byMessage("table instance for test-id not found"));

      assertDoesNotThrow(() -> publisher.sendMessage(event, Collections.emptySet()));
    }
  }

  @Test
  void testSendMessage_ThrowsOnNonEntityNotFoundException() {
    ChangeEvent event = createChangeEvent(EventType.ENTITY_CREATED);

    try (MockedStatic<FeedUtils> mockedFeedUtils = mockStatic(FeedUtils.class)) {
      mockedFeedUtils
          .when(() -> FeedUtils.getThreadWithMessage(any(), any()))
          .thenThrow(new RuntimeException("unexpected error"));

      assertThrows(
          EventPublisherException.class,
          () -> publisher.sendMessage(event, Collections.emptySet()));
    }
  }

  private ChangeEvent createChangeEvent(EventType eventType) {
    ChangeEvent event = new ChangeEvent();
    event.setEventType(eventType);
    event.setEntityType("table");
    event.setEntityId(UUID.randomUUID());
    event.setEntityFullyQualifiedName("test.db.schema.table");
    event.setUserName("admin");
    return event;
  }
}
