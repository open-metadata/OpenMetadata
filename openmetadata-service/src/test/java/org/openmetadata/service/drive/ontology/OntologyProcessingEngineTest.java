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

package org.openmetadata.service.drive.ontology;

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
import org.openmetadata.schema.entity.context.OntologyProcessingStatus;
import org.openmetadata.schema.entity.context.OntologyStats;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

@ExtendWith(MockitoExtension.class)
class OntologyProcessingEngineTest {

  @Mock ContextMemoryRepository memoryRepo;
  @Mock OntologyGrounding grounding;
  @Mock OntologyExtractor extractor;
  @Mock OntologyReconciler reconciler;

  @Test
  void skipsWhenHashUnchanged() {
    UUID id = UUID.randomUUID();
    ContextMemory memory =
        new ContextMemory().withId(id).withTitle("t").withQuestion("q").withAnswer("a");
    String hash = OntologyProcessingEngine.hashOf(memory);
    memory.setOntologyStats(new OntologyStats().withSourceHash(hash));
    when(memoryRepo.get(any(), any(), any())).thenReturn(memory);

    OntologyProcessingEngine engine =
        OntologyProcessingEngine.forTest(memoryRepo, grounding, extractor, reconciler);
    engine.run(id);

    verify(extractor, never()).derive(any(), any());
  }

  @Test
  void runsFullPipelineWhenHashChanged() {
    UUID id = UUID.randomUUID();
    ContextMemory memory =
        new ContextMemory().withId(id).withTitle("title").withQuestion("q").withAnswer("a");
    memory.setOntologyStats(new OntologyStats().withSourceHash("stale-hash"));
    when(memoryRepo.get(any(), any(), any())).thenReturn(memory);

    OntologyContext ctx =
        new OntologyContext(java.util.List.of(), java.util.List.of(), java.util.List.of());
    OntologyDerivation verdict =
        new OntologyDerivation(
            new OntologyVerdict(
                OntologyAction.SKIP, null, null, null, null, null, null, null, null, null),
            new OntologyVerdict(
                OntologyAction.SKIP, null, null, null, null, null, null, null, null, null));
    OntologyReconciler.ReconcileResult result = new OntologyReconciler.ReconcileResult(1, 1, 2, 0);

    when(grounding.fetchCandidates(any())).thenReturn(ctx);
    when(extractor.derive(any(), any())).thenReturn(verdict);
    when(reconciler.reconcile(any(), any(), any(), any(), anyBoolean(), anyBoolean()))
        .thenReturn(result);

    OntologyProcessingEngine engine =
        OntologyProcessingEngine.forTest(memoryRepo, grounding, extractor, reconciler);
    engine.run(id);

    verify(extractor, times(1)).derive(any(), any());
    verify(reconciler, times(1)).reconcile(any(), any(), any(), any(), anyBoolean(), anyBoolean());
    ArgumentCaptor<OntologyStats> statsCaptor = ArgumentCaptor.forClass(OntologyStats.class);
    verify(memoryRepo, times(2)).stampOntologyStats(any(), statsCaptor.capture());
    List<OntologyStats> stamps = statsCaptor.getAllValues();
    assertEquals(OntologyProcessingStatus.Processing, stamps.get(0).getStatus());
    assertEquals(OntologyProcessingStatus.Processed, stamps.get(1).getStatus());
  }

  @Test
  void stampsHashEvenWhenReconcileThrows() {
    UUID id = UUID.randomUUID();
    ContextMemory memory =
        new ContextMemory().withId(id).withTitle("title").withQuestion("q").withAnswer("a");
    memory.setOntologyStats(new OntologyStats().withSourceHash("stale-hash"));
    when(memoryRepo.get(any(), any(), any())).thenReturn(memory);

    OntologyContext ctx =
        new OntologyContext(java.util.List.of(), java.util.List.of(), java.util.List.of());
    OntologyDerivation verdict =
        new OntologyDerivation(
            new OntologyVerdict(
                OntologyAction.SKIP, null, null, null, null, null, null, null, null, null),
            new OntologyVerdict(
                OntologyAction.SKIP, null, null, null, null, null, null, null, null, null));

    when(grounding.fetchCandidates(any())).thenReturn(ctx);
    when(extractor.derive(any(), any())).thenReturn(verdict);
    doThrow(new RuntimeException("simulated deterministic reconcile failure"))
        .when(reconciler)
        .reconcile(any(), any(), any(), any(), anyBoolean(), anyBoolean());

    OntologyProcessingEngine engine =
        OntologyProcessingEngine.forTest(memoryRepo, grounding, extractor, reconciler);
    engine.run(id);

    ArgumentCaptor<OntologyStats> statsCaptor = ArgumentCaptor.forClass(OntologyStats.class);
    verify(memoryRepo, times(2)).stampOntologyStats(any(), statsCaptor.capture());
    OntologyStats stamped = statsCaptor.getValue();
    assertEquals(OntologyProcessingStatus.Failed, stamped.getStatus());
    assertEquals("simulated deterministic reconcile failure", stamped.getError());
    assertNotNull(stamped.getSourceHash());
    assertEquals(OntologyProcessingEngine.hashOf(memory), stamped.getSourceHash());
    assertEquals(0, stamped.getDerivedTermCount());
    assertEquals(0, stamped.getDerivedMetricCount());
    assertEquals(0, stamped.getReusedCount());
  }
}
