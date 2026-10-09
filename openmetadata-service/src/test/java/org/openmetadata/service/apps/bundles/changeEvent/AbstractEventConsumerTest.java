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

package org.openmetadata.service.apps.bundles.changeEvent;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.util.DIContainer;
import org.quartz.JobDetail;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

@ExtendWith(MockitoExtension.class)
class AbstractEventConsumerTest {

  @Mock private DIContainer dependencies;
  @Mock private JobExecutionContext jobExecutionContext;
  @Mock private JobDetail jobDetail;
  @Mock private EventSubscription eventSubscription;

  private TestEventConsumer testEventConsumer;
  private UUID subscriptionId;
  private UUID destinationId;

  static class TestEventConsumer extends AbstractEventConsumer {

    public TestEventConsumer(DIContainer dependencies) {
      super(dependencies);
    }

    @Override
    public ResultList<ChangeEvent> pollEvents(long offset, long batchSize) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
      List<ChangeEvent> events = new ArrayList<>();
      return new ResultList<>(events, new ArrayList<>(), null, null, (int) batchSize);
    }

    @Override
    protected void handle(List<ChangeEvent> events) {
      // Override to avoid static dependencies in tests
      // In real implementation, this would process events
    }

    @Override
    public void handleFailedEvent(EventPublisherException ex, boolean errorOnSub) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
    }

    @Override
    public void commit(JobExecutionContext jobExecutionContext) {
      // Override to avoid Entity.getCollectionDAO() static call in tests
    }
  }

  @BeforeEach
  void setUp() {
    testEventConsumer = new TestEventConsumer(dependencies);
    subscriptionId = UUID.randomUUID();
    destinationId = UUID.randomUUID();

    lenient().when(jobExecutionContext.getJobDetail()).thenReturn(jobDetail);
    lenient().when(eventSubscription.getId()).thenReturn(subscriptionId);
    lenient().when(eventSubscription.getBatchSize()).thenReturn(10);
    lenient().when(eventSubscription.getRetries()).thenReturn(3);
    lenient().when(eventSubscription.getName()).thenReturn("test-subscription");
    lenient().when(eventSubscription.getDestinations()).thenReturn(Collections.emptyList());
    lenient().when(eventSubscription.getEnabled()).thenReturn(true);
  }

  @Test
  void testConstructor() {
    assertNotNull(testEventConsumer);
    assertNotNull(testEventConsumer.dependencies);
  }

  /**
   * Quartz worker threads are pooled and shared with every other scheduled job, and never pass
   * through the JAX-RS response filter that clears these ThreadLocals for HTTP requests. Whatever
   * runs next on the thread inherits anything left behind, so a tick must leave it clean however it
   * exits — including an early return when the subscription cannot be loaded.
   *
   * <p>Scope of this test: it pins the end-to-end invariant and fails if the cleanup is removed
   * altogether. It does <b>not</b> isolate the exit-side clear from the entry-side one, because the
   * only paths that previously skipped cleanup run inside the private {@code init}, which offers no
   * seam for a test to populate the ThreadLocals mid-tick. That the exit clear is unconditional is
   * enforced structurally, by the try/finally in {@code execute}.
   */
  @Test
  void execute_leavesThreadCleanForTheNextJob() {
    ImpersonationContext.setImpersonatedBy("someone");

    try {
      testEventConsumer.execute(jobExecutionContext);
    } catch (RuntimeException | JobExecutionException expectedInThisHarness) {
      // The subscription cannot be resolved here, so the tick either returns early or throws.
      // Either way the cleanup guarantee below must hold.
    }

    assertNull(
        ImpersonationContext.getImpersonatedBy(),
        "A tick must leave the thread clean, or the next job scheduled onto it reads stale "
            + "per-request state");
  }

  @Test
  void testPollEventsReturnsResultList() {
    ResultList<ChangeEvent> result = testEventConsumer.pollEvents(0L, 10L);

    assertNotNull(result);
    assertNotNull(result.getData());
    assertNotNull(result.getErrors());
  }

  @Test
  void testPollEventsWithDifferentOffsets() {
    ResultList<ChangeEvent> result1 = testEventConsumer.pollEvents(0L, 5L);
    ResultList<ChangeEvent> result2 = testEventConsumer.pollEvents(10L, 15L);

    assertNotNull(result1);
    assertNotNull(result2);
  }

  @Test
  void testPollingWithZeroBatchSize() {
    ResultList<ChangeEvent> result = testEventConsumer.pollEvents(0L, 0L);

    assertNotNull(result);
    assertEquals(0, result.getPaging().getTotal());
  }

  @Test
  void testPollingWithNegativeOffset() {
    ResultList<ChangeEvent> result = testEventConsumer.pollEvents(-1L, 10L);

    assertNotNull(result);
  }

  @Test
  void testConstants() {
    assertEquals("SubscriptionMapKey", AbstractEventConsumer.DESTINATION_MAP_KEY);
    assertEquals("eventSubscription.Offset", AbstractEventConsumer.OFFSET_EXTENSION);
    assertEquals("eventSubscription.metrics", AbstractEventConsumer.METRICS_EXTENSION);
    assertEquals("eventSubscription.failedEvent", AbstractEventConsumer.FAILED_EVENT_EXTENSION);
  }

  @Test
  void testFailureTowardsEnum() {
    assertEquals(2, AbstractEventConsumer.FailureTowards.values().length);
    assertEquals("SUBSCRIBER", AbstractEventConsumer.FailureTowards.SUBSCRIBER.name());
    assertEquals("PUBLISHER", AbstractEventConsumer.FailureTowards.PUBLISHER.name());
  }

  @Test
  void testCursorPlanAdvancesAcrossContiguousOffsets() {
    List<ChangeEventRecord> records =
        List.of(new ChangeEventRecord(11, "{}"), new ChangeEventRecord(12, "{}"));

    AbstractEventConsumer.CursorPlan plan =
        AbstractEventConsumer.planCursor(10, 0L, records, 1_000L);

    assertEquals(12, plan.offset());
    assertEquals(0L, plan.pendingGapSince());
    assertEquals(2, plan.recordCount());
    assertFalse(plan.skippedGap());
  }

  @Test
  void testCursorPlanWaitsAtNewHeadGap() {
    List<ChangeEventRecord> records =
        List.of(new ChangeEventRecord(12, "{}"), new ChangeEventRecord(13, "{}"));

    AbstractEventConsumer.CursorPlan plan =
        AbstractEventConsumer.planCursor(10, 0L, records, 1_000L);

    assertEquals(10, plan.offset());
    assertEquals(1_000L, plan.pendingGapSince());
    assertEquals(0, plan.recordCount());
    assertFalse(plan.skippedGap());
  }

  @Test
  void testCursorPlanConsumesGapWhenLowerOffsetCommits() {
    List<ChangeEventRecord> records =
        List.of(
            new ChangeEventRecord(11, "{}"),
            new ChangeEventRecord(12, "{}"),
            new ChangeEventRecord(13, "{}"));

    AbstractEventConsumer.CursorPlan plan =
        AbstractEventConsumer.planCursor(10, 500L, records, 1_000L);

    assertEquals(13, plan.offset());
    assertEquals(0L, plan.pendingGapSince());
    assertEquals(3, plan.recordCount());
    assertFalse(plan.skippedGap());
  }

  @Test
  void testCursorPlanSkipsGapOnlyAfterTimeout() {
    List<ChangeEventRecord> records =
        List.of(new ChangeEventRecord(12, "{}"), new ChangeEventRecord(13, "{}"));
    long now = AbstractEventConsumer.GAP_RESOLVE_TIMEOUT_MS + 1_000L;

    AbstractEventConsumer.CursorPlan plan =
        AbstractEventConsumer.planCursor(10, 1_000L, records, now);

    assertEquals(11, plan.offset());
    assertEquals(0L, plan.pendingGapSince());
    assertEquals(0, plan.recordCount());
    assertTrue(plan.skippedGap());
  }

  @Test
  void testCursorPlanStopsAtGapAfterContiguousPrefix() {
    List<ChangeEventRecord> records =
        List.of(new ChangeEventRecord(11, "{}"), new ChangeEventRecord(13, "{}"));

    AbstractEventConsumer.CursorPlan plan =
        AbstractEventConsumer.planCursor(10, 500L, records, 1_000L);

    assertEquals(11, plan.offset());
    assertEquals(0L, plan.pendingGapSince());
    assertEquals(1, plan.recordCount());
    assertFalse(plan.skippedGap());
  }
}
