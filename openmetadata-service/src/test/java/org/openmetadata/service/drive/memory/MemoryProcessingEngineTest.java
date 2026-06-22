/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.memory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryProcessingStatus;
import org.openmetadata.schema.entity.context.MemoryStats;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

@ExtendWith(MockitoExtension.class)
class MemoryProcessingEngineTest {

  @Mock ContextMemoryRepository memoryRepo;
  @Mock MemoryGrounding grounding;
  @Mock MemoryExtractor extractor;
  @Mock MemoryReconciler reconciler;

  @Test
  void skipsWhenHashUnchanged() {
    UUID id = UUID.randomUUID();
    ContextMemory memory =
        new ContextMemory().withId(id).withTitle("t").withQuestion("q").withAnswer("a");
    String hash = MemoryProcessingEngine.hashOf(memory);
    memory.setMemoryStats(new MemoryStats().withSourceHash(hash));
    when(memoryRepo.get(any(), any(), any())).thenReturn(memory);

    MemoryProcessingEngine engine =
        MemoryProcessingEngine.forTest(memoryRepo, grounding, extractor, reconciler);
    engine.run(id);

    verify(extractor, never()).derive(any(), any());
  }

  @Test
  void runsFullPipelineWhenHashChanged() {
    UUID id = UUID.randomUUID();
    ContextMemory memory =
        new ContextMemory().withId(id).withTitle("title").withQuestion("q").withAnswer("a");
    memory.setMemoryStats(new MemoryStats().withSourceHash("stale-hash"));
    when(memoryRepo.get(any(), any(), any())).thenReturn(memory);

    MemoryContext ctx =
        new MemoryContext(java.util.List.of(), java.util.List.of(), java.util.List.of());
    MemoryDerivation verdict =
        new MemoryDerivation(
            new MemoryVerdict(
                MemoryAction.SKIP, null, null, null, null, null, null, null, null, null),
            new MemoryVerdict(
                MemoryAction.SKIP, null, null, null, null, null, null, null, null, null));
    MemoryReconciler.ReconcileResult result = new MemoryReconciler.ReconcileResult(1, 1, 2, 0);

    when(grounding.fetchCandidates(any())).thenReturn(ctx);
    when(extractor.derive(any(), any())).thenReturn(verdict);
    when(reconciler.reconcile(any(), any(), any(), any(), anyBoolean(), anyBoolean()))
        .thenReturn(result);

    MemoryProcessingEngine engine =
        MemoryProcessingEngine.forTest(memoryRepo, grounding, extractor, reconciler);
    engine.run(id);

    verify(extractor, times(1)).derive(any(), any());
    verify(reconciler, times(1)).reconcile(any(), any(), any(), any(), anyBoolean(), anyBoolean());
    ArgumentCaptor<MemoryStats> statsCaptor = ArgumentCaptor.forClass(MemoryStats.class);
    verify(memoryRepo, times(2)).stampMemoryStats(any(), statsCaptor.capture());
    List<MemoryStats> stamps = statsCaptor.getAllValues();
    assertEquals(MemoryProcessingStatus.Processing, stamps.get(0).getStatus());
    assertEquals(MemoryProcessingStatus.Processed, stamps.get(1).getStatus());
  }

  @Test
  void stampsHashEvenWhenReconcileThrows() {
    UUID id = UUID.randomUUID();
    ContextMemory memory =
        new ContextMemory().withId(id).withTitle("title").withQuestion("q").withAnswer("a");
    memory.setMemoryStats(new MemoryStats().withSourceHash("stale-hash"));
    when(memoryRepo.get(any(), any(), any())).thenReturn(memory);

    MemoryContext ctx =
        new MemoryContext(java.util.List.of(), java.util.List.of(), java.util.List.of());
    MemoryDerivation verdict =
        new MemoryDerivation(
            new MemoryVerdict(
                MemoryAction.SKIP, null, null, null, null, null, null, null, null, null),
            new MemoryVerdict(
                MemoryAction.SKIP, null, null, null, null, null, null, null, null, null));

    when(grounding.fetchCandidates(any())).thenReturn(ctx);
    when(extractor.derive(any(), any())).thenReturn(verdict);
    doThrow(new RuntimeException("simulated deterministic reconcile failure"))
        .when(reconciler)
        .reconcile(any(), any(), any(), any(), anyBoolean(), anyBoolean());

    MemoryProcessingEngine engine =
        MemoryProcessingEngine.forTest(memoryRepo, grounding, extractor, reconciler);
    engine.run(id);

    ArgumentCaptor<MemoryStats> statsCaptor = ArgumentCaptor.forClass(MemoryStats.class);
    verify(memoryRepo, times(2)).stampMemoryStats(any(), statsCaptor.capture());
    MemoryStats stamped = statsCaptor.getValue();
    assertEquals(MemoryProcessingStatus.Failed, stamped.getStatus());
    assertEquals("simulated deterministic reconcile failure", stamped.getError());
    assertNotNull(stamped.getSourceHash());
    assertEquals(MemoryProcessingEngine.hashOf(memory), stamped.getSourceHash());
    assertEquals(0, stamped.getDerivedTermCount());
    assertEquals(0, stamped.getDerivedMetricCount());
    assertEquals(0, stamped.getReusedCount());
  }
}
