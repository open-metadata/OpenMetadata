/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.approval;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.LifecycleEventType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeLifecycleEventDAO;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Unit tests for lifecycle event recording and the change request metrics it feeds. */
class ChangeRequestLifecycleTest {
  private SimpleMeterRegistry meters;

  @BeforeEach
  void addRegistry() {
    meters = new SimpleMeterRegistry();
    Metrics.addRegistry(meters);
  }

  @AfterEach
  void removeRegistry() {
    Metrics.removeRegistry(meters);
    meters.close();
  }

  private double lifecycleCount(String entityType, LifecycleEventType type) {
    var counter =
        meters
            .find("change_request_lifecycle")
            .tags("entityType", entityType, "event", type.value())
            .counter();
    return counter == null ? 0 : counter.count();
  }

  @Nested
  class Record {
    private MockedStatic<Entity> entity;
    private ChangeLifecycleEventDAO events;

    @BeforeEach
    void mockDao() {
      CollectionDAO dao = mock(CollectionDAO.class);
      events = mock(ChangeLifecycleEventDAO.class);
      when(dao.changeLifecycleEventDAO()).thenReturn(events);
      entity = mockStatic(Entity.class);
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
    }

    @AfterEach
    void closeMock() {
      entity.close();
    }

    private ChangeRequest request(ChangeRequestStatus status) {
      return new ChangeRequest()
          .withId(UUID.randomUUID())
          .withEntityType(Entity.TABLE)
          .withStatus(status)
          .withActiveRevisionNumber(3);
    }

    private ChangeLifecycleEvent recorded() {
      ArgumentCaptor<ChangeLifecycleEvent> captor =
          ArgumentCaptor.forClass(ChangeLifecycleEvent.class);
      verify(events).insert(captor.capture());
      return captor.getValue();
    }

    @Test
    void eventFollowsTheLastSequenceAndCarriesTheTransition() {
      ChangeRequest request = request(ChangeRequestStatus.APPLIED);
      when(events.lastSequence(request.getId())).thenReturn(4);
      long before = System.currentTimeMillis();

      ChangeRequestLifecycle.record(
          request, LifecycleEventType.APPLIED, ChangeRequestStatus.APPROVED, "alice", "ok");

      ChangeLifecycleEvent event = recorded();
      assertEquals(5, event.getSequence());
      assertEquals(request.getId(), event.getChangeRequestId());
      assertEquals(LifecycleEventType.APPLIED, event.getEventType());
      assertEquals(ChangeRequestStatus.APPROVED, event.getFromStatus());
      assertEquals(ChangeRequestStatus.APPLIED, event.getToStatus());
      assertEquals(3, event.getRevisionNumber());
      assertEquals("alice", event.getActor());
      assertEquals("ok", event.getReason());
      assertTrue(event.getTimestamp() >= before);
    }

    @Test
    void firstEventStartsAtOne() {
      ChangeRequest request = request(ChangeRequestStatus.PENDING);
      when(events.lastSequence(request.getId())).thenReturn(0);

      ChangeRequestLifecycle.record(request, LifecycleEventType.SUBMITTED, null, "alice", null);

      ChangeLifecycleEvent event = recorded();
      assertEquals(1, event.getSequence());
      assertNull(event.getFromStatus());
      assertNull(event.getReason());
    }

    @Test
    void systemStepsHaveNoActor() {
      ChangeRequest request = request(ChangeRequestStatus.CONFLICTED);
      ChangeRequestLifecycle.record(
          request, LifecycleEventType.CONFLICTED, ChangeRequestStatus.APPROVED, null, "moved");
      assertNull(recorded().getActor());
    }

    @Test
    void eachRecordedEventIsCountedByEntityTypeAndEvent() {
      double before = lifecycleCount(Entity.TABLE, LifecycleEventType.REVISED);
      ChangeRequest request = request(ChangeRequestStatus.PENDING);

      ChangeRequestLifecycle.record(
          request, LifecycleEventType.REVISED, ChangeRequestStatus.PENDING, "alice", null);
      ChangeRequestLifecycle.record(
          request, LifecycleEventType.REVISED, ChangeRequestStatus.PENDING, "alice", null);

      assertEquals(before + 2, lifecycleCount(Entity.TABLE, LifecycleEventType.REVISED));
    }
  }

  @Nested
  class CountedAfterCommit {
    private MockedStatic<Entity> entity;

    @BeforeEach
    void mockDao() {
      CollectionDAO dao = mock(CollectionDAO.class);
      when(dao.changeLifecycleEventDAO()).thenReturn(mock(ChangeLifecycleEventDAO.class));
      entity = mockStatic(Entity.class);
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
    }

    @AfterEach
    void closeMock() {
      PostCommitActionQueue.clear();
      entity.close();
    }

    private ChangeRequest request() {
      return new ChangeRequest()
          .withId(UUID.randomUUID())
          .withEntityType(Entity.DOMAIN)
          .withStatus(ChangeRequestStatus.PENDING)
          .withActiveRevisionNumber(1);
    }

    @Test
    void eventInsideATransactionIsCountedOnlyOnceItCommits() {
      double before = lifecycleCount(Entity.DOMAIN, LifecycleEventType.SUBMITTED);
      PostCommitActionQueue.begin();
      ChangeRequestLifecycle.record(request(), LifecycleEventType.SUBMITTED, null, "alice", null);
      assertEquals(before, lifecycleCount(Entity.DOMAIN, LifecycleEventType.SUBMITTED));

      PostCommitActionQueue.run(PostCommitActionQueue.drain());

      assertEquals(before + 1, lifecycleCount(Entity.DOMAIN, LifecycleEventType.SUBMITTED));
    }

    @Test
    void eventOfARolledBackTransactionIsNeverCounted() {
      double before = lifecycleCount(Entity.DOMAIN, LifecycleEventType.CANCELLED);
      PostCommitActionQueue.begin();
      ChangeRequestLifecycle.record(
          request(), LifecycleEventType.CANCELLED, ChangeRequestStatus.PENDING, "admin", "x");

      PostCommitActionQueue.clear();

      assertEquals(before, lifecycleCount(Entity.DOMAIN, LifecycleEventType.CANCELLED));
    }
  }

  @Nested
  class EndedAs {
    @Test
    void everyEndingMapsToItsOwnEvent() {
      assertEquals(
          LifecycleEventType.REJECTED,
          ChangeRequestLifecycle.endedAs(ChangeRequestStatus.REJECTED));
      assertEquals(
          LifecycleEventType.CONFLICTED,
          ChangeRequestLifecycle.endedAs(ChangeRequestStatus.CONFLICTED));
      assertEquals(
          LifecycleEventType.WITHDRAWN,
          ChangeRequestLifecycle.endedAs(ChangeRequestStatus.WITHDRAWN));
      assertEquals(
          LifecycleEventType.CANCELLED,
          ChangeRequestLifecycle.endedAs(ChangeRequestStatus.CANCELLED));
      assertEquals(
          LifecycleEventType.APPLIED, ChangeRequestLifecycle.endedAs(ChangeRequestStatus.APPLIED));
      assertEquals(
          LifecycleEventType.APPROVED,
          ChangeRequestLifecycle.endedAs(ChangeRequestStatus.APPROVED));
    }

    @Test
    void everyStatusHasAnEventAndEndingsAreDistinct() {
      Set<LifecycleEventType> mapped =
          EnumSet.allOf(ChangeRequestStatus.class).stream()
              .map(ChangeRequestLifecycle::endedAs)
              .collect(Collectors.toSet());
      assertEquals(ChangeRequestStatus.values().length, mapped.size());
    }
  }

  @Nested
  class MetricsRecorded {
    @Test
    void admissionIsCountedAsHeldOrShadow() {
      ChangeRequestMetrics.admission(Entity.GLOSSARY, false);
      ChangeRequestMetrics.admission(Entity.GLOSSARY, true);
      ChangeRequestMetrics.admission(Entity.GLOSSARY, true);

      assertEquals(
          1,
          meters
              .get("change_request_admission")
              .tags("entityType", Entity.GLOSSARY, "outcome", "held")
              .counter()
              .count());
      assertEquals(
          2,
          meters
              .get("change_request_admission")
              .tags("entityType", Entity.GLOSSARY, "outcome", "shadow")
              .counter()
              .count());
    }

    @Test
    void admissionLatencyIsTimedPerEntityType() {
      Timer.Sample sample = ChangeRequestMetrics.startAdmission();
      ChangeRequestMetrics.stopAdmission(sample, Entity.DOMAIN);
      assertEquals(
          1,
          meters
              .get("change_request_admission_latency")
              .tags("entityType", Entity.DOMAIN)
              .timer()
              .count());
    }

    @Test
    void deliveryResultsAreCounted() {
      ChangeRequestMetrics.delivery("delivered");
      ChangeRequestMetrics.delivery("retrying");
      ChangeRequestMetrics.delivery("delivered");
      assertEquals(
          2, meters.get("change_request_delivery").tags("result", "delivered").counter().count());
      assertEquals(
          1, meters.get("change_request_delivery").tags("result", "retrying").counter().count());
    }

    @Test
    void pendingGaugeReportsTheLastCount() {
      ChangeRequestMetrics.pending(7);
      assertEquals(7, meters.get("change_request_pending").gauge().value());
      ChangeRequestMetrics.pending(2);
      assertEquals(2, meters.get("change_request_pending").gauge().value());
    }
  }
}
