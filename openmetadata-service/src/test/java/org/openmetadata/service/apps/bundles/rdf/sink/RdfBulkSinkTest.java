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
package org.openmetadata.service.apps.bundles.rdf.sink;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor;
import org.openmetadata.service.apps.bundles.rdf.RdfBatchProcessor.BatchProcessingResult;
import org.openmetadata.service.rdf.RdfRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("RdfBulkSink single-writer buffering")
class RdfBulkSinkTest {

  private static final Duration WAIT = Duration.ofSeconds(10);

  @Mock private RdfRepository rdfRepository;
  @Mock private RdfBatchProcessor batchProcessor;

  private RdfBulkSink sink;

  @BeforeEach
  void setUp() {
    lenient().when(rdfRepository.translateEntities(anyList())).thenReturn(List.of());
    sink = new RdfBulkSink(rdfRepository, batchProcessor, () -> false);
  }

  @AfterEach
  void tearDown() {
    sink.close();
  }

  private List<EntityInterface> batchOf(int size) {
    return java.util.stream.IntStream.range(0, size)
        .mapToObj(
            i -> {
              EntityInterface entity = mock(EntityInterface.class);
              lenient().when(entity.getId()).thenReturn(UUID.randomUUID());
              return entity;
            })
        .toList();
  }

  @Test
  @DisplayName("acks complete in submission order")
  void acksCompleteInSubmissionOrder() throws Exception {
    CountDownLatch releaseFirst = new CountDownLatch(1);
    List<String> completionOrder = new CopyOnWriteArrayList<>();
    when(batchProcessor.processEntitiesPreTranslated(anyString(), anyList(), anyList(), any()))
        .thenAnswer(
            invocation -> {
              releaseFirst.await();
              return new BatchProcessingResult(1, 0);
            })
        .thenReturn(new BatchProcessingResult(1, 0));

    CompletableFuture<BatchProcessingResult> first = sink.submit("table", batchOf(1));
    CompletableFuture<BatchProcessingResult> second = sink.submit("table", batchOf(1));
    first.thenRun(() -> completionOrder.add("first"));
    second.thenRun(() -> completionOrder.add("second"));

    releaseFirst.countDown();
    await().atMost(WAIT).until(() -> completionOrder.size() == 2);
    assertEquals(List.of("first", "second"), completionOrder);
  }

  @Test
  @DisplayName("at most one batch is ever in flight at the processor")
  void singleWriterNeverOverlaps() throws Exception {
    AtomicInteger inFlight = new AtomicInteger();
    AtomicInteger maxInFlight = new AtomicInteger();
    when(batchProcessor.processEntitiesPreTranslated(anyString(), anyList(), anyList(), any()))
        .thenAnswer(
            invocation -> {
              int now = inFlight.incrementAndGet();
              maxInFlight.accumulateAndGet(now, Math::max);
              // Widen the overlap window without sleeping: spin briefly.
              long spinUntil = System.nanoTime() + 2_000_000L;
              while (System.nanoTime() < spinUntil) {
                Thread.onSpinWait();
              }
              inFlight.decrementAndGet();
              return new BatchProcessingResult(1, 0);
            });

    CompletableFuture<?> last = null;
    for (int i = 0; i < 4; i++) {
      last = sink.submit("table", batchOf(1));
    }
    last.join();

    assertEquals(1, maxInFlight.get(), "single-writer invariant violated");
  }

  @Test
  @DisplayName("a full submission queue blocks the submitter until the writer drains")
  void submitBlocksWhenQueueFull() throws Exception {
    CountDownLatch releaseWriter = new CountDownLatch(1);
    when(batchProcessor.processEntitiesPreTranslated(anyString(), anyList(), anyList(), any()))
        .thenAnswer(
            invocation -> {
              releaseWriter.await();
              return new BatchProcessingResult(1, 0);
            });

    AtomicInteger submitted = new AtomicInteger();
    AtomicBoolean allSubmitted = new AtomicBoolean(false);
    Thread submitter =
        Thread.ofPlatform()
            .daemon()
            .start(
                () -> {
                  try {
                    // 1 in-flight at the writer + queue capacity, then one more
                    // that must block until the writer makes room.
                    for (int i = 0; i < 7; i++) {
                      sink.submit("table", batchOf(1));
                      submitted.incrementAndGet();
                    }
                    allSubmitted.set(true);
                  } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                  }
                });

    await().atMost(WAIT).until(() -> submitted.get() >= 5);
    assertTrue(submitted.get() < 7, "submitter should be blocked by the bounded queue");

    releaseWriter.countDown();
    await().atMost(WAIT).untilTrue(allSubmitted);
    submitter.join(WAIT.toMillis());
  }

  @Test
  @DisplayName("close drains everything already submitted")
  void closeDrainsPendingBatches() throws Exception {
    when(batchProcessor.processEntitiesPreTranslated(anyString(), anyList(), anyList(), any()))
        .thenReturn(new BatchProcessingResult(1, 0));

    CompletableFuture<BatchProcessingResult> first = sink.submit("table", batchOf(1));
    CompletableFuture<BatchProcessingResult> second = sink.submit("table", batchOf(1));

    sink.close();

    assertEquals(1, first.join().successCount());
    assertEquals(1, second.join().successCount());
  }

  @Test
  @DisplayName("translation failure fails that batch's ack with the cause")
  void translationFailureFailsAck() throws Exception {
    when(rdfRepository.translateEntities(anyList()))
        .thenThrow(new IllegalStateException("translator broken"));

    CompletableFuture<BatchProcessingResult> ack = sink.submit("table", batchOf(1));

    CompletionException thrown = assertThrows(CompletionException.class, ack::join);
    assertTrue(thrown.getCause().getMessage().contains("translator broken"));
  }

  @Test
  @DisplayName("a closed sink rejects new submissions")
  void closedSinkRejectsSubmissions() {
    sink.close();
    assertThrows(IllegalStateException.class, () -> sink.submit("table", batchOf(1)));
  }

  @Test
  @DisplayName("stop supplier is passed through to the processor")
  void stopSupplierPassedThrough() throws Exception {
    AtomicBoolean sawStopSupplier = new AtomicBoolean(false);
    BooleanSupplier stop = () -> true;
    sink.close();
    sink = new RdfBulkSink(rdfRepository, batchProcessor, stop);
    when(batchProcessor.processEntitiesPreTranslated(anyString(), anyList(), anyList(), any()))
        .thenAnswer(
            invocation -> {
              BooleanSupplier passed = invocation.getArgument(3);
              sawStopSupplier.set(passed != null && passed.getAsBoolean());
              return new BatchProcessingResult(0, 0);
            });

    sink.submit("table", batchOf(1)).join();

    assertTrue(sawStopSupplier.get());
  }

  @Test
  @DisplayName("translation time is measured and reported as processTimeMs")
  void translationTimeIsReportedAsProcessTime() throws Exception {
    when(rdfRepository.translateEntities(any()))
        .thenAnswer(
            invocation -> {
              // Deliberate work so the measured translate time cannot be zero.
              long until = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(15);
              while (System.nanoTime() < until) {
                Thread.onSpinWait();
              }
              return List.of();
            });
    when(batchProcessor.processEntitiesPreTranslated(any(), any(), any(), any()))
        .thenReturn(new RdfBatchProcessor.BatchProcessingResult(1, 0));

    RdfBatchProcessor.BatchProcessingResult result =
        sink.submit("table", List.of(mock(EntityInterface.class))).get(30, TimeUnit.SECONDS);

    // Previously always 0: the run record showed no translation cost at all.
    assertTrue(
        result.processTimeMs() >= 10,
        "translation time must be measured, saw " + result.processTimeMs() + "ms");
  }
}
