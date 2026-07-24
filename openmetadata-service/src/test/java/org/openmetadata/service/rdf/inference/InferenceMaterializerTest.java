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

package org.openmetadata.service.rdf.inference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.ServiceUnavailableException;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.configuration.rdf.InferenceMaterializationResult;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfRepository;

class InferenceMaterializerTest {
  private static final Clock CLOCK =
      Clock.fixed(Instant.ofEpochMilli(1_750_000_000_000L), ZoneOffset.UTC);

  @Test
  void materializesDirtyRulesWithoutReadingTriplesIntoTheJvm() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceRuleStatus dirty = status(true, 0L);
    final InferenceRuleStatus clean = status(false, 3L);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    when(rdfRepository.getGraphTripleCount(dirty.getGraphUri().toString())).thenReturn(3L);
    when(ruleRepository.listForMaterialization(false, null)).thenReturn(List.of(dirty));
    when(ruleRepository.recordMaterialized("test-rule", CLOCK.millis(), 3L)).thenReturn(clean);

    final InferenceMaterializationResult result =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK).materialize(false, null);

    assertEquals(1, result.getSuccessfulRules());
    assertEquals(0, result.getFailedRules());
    assertEquals(3, result.getProcessedRules().getFirst().getTripleCount());
    verify(rdfRepository, never()).executeSparqlQuery(anyString(), anyString());
    verify(rdfRepository, never()).executeSparqlQueryDirect(anyString(), anyString());
  }

  @Test
  void clearsDisabledRulesWithoutExecutingTheirConstructQuery() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceRuleStatus disabled = status(true, 5L);
    disabled.getRule().setEnabled(false);
    final InferenceRuleStatus clean = status(false, 0L);
    clean.getRule().setEnabled(false);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    when(ruleRepository.listForMaterialization(false, null)).thenReturn(List.of(disabled));
    when(ruleRepository.recordMaterialized("test-rule", CLOCK.millis(), 0L)).thenReturn(clean);

    final InferenceMaterializationResult result =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK).materialize(false, null);

    assertEquals(1, result.getSuccessfulRules());
    assertEquals(0, result.getProcessedRules().getFirst().getTripleCount());
    verify(rdfRepository, times(1)).executeInferenceMaterializationUpdate(anyString());
    verify(rdfRepository, never()).getGraphTripleCount(anyString());
  }

  @Test
  void materializeThrowsServiceUnavailableWhenStoreDisabled() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(false);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    final InferenceMaterializer materializer =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK);

    assertThrows(ServiceUnavailableException.class, () -> materializer.materialize(false, null));
    verify(ruleRepository, never()).listForMaterialization(anyBoolean(), anyString());
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void materializeThrowsServiceUnavailableWhenMaterializedInferenceFlagIsNull() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig())
        .thenReturn(configuration().withMaterializedInferenceEnabled(null));
    final InferenceMaterializer materializer =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK);

    assertThrows(ServiceUnavailableException.class, () -> materializer.materialize(false, null));
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void materializeThrowsServiceUnavailableWhenMaterializedInferenceFlagIsFalse() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig())
        .thenReturn(configuration().withMaterializedInferenceEnabled(false));
    final InferenceMaterializer materializer =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK);

    assertThrows(ServiceUnavailableException.class, () -> materializer.materialize(false, null));
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void materializeThrowsServiceUnavailableWhenStorageIsNotFuseki() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig())
        .thenReturn(configuration().withStorageType(RdfConfiguration.StorageType.QLEVER));
    final InferenceMaterializer materializer =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK);

    assertThrows(ServiceUnavailableException.class, () -> materializer.materialize(false, null));
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void clearThrowsServiceUnavailableWhenStoreDisabled() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(false);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    final InferenceMaterializer materializer =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK);

    assertThrows(
        ServiceUnavailableException.class,
        () -> materializer.clear("https://open-metadata.org/graph/inferred/test-rule"));
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void clearExecutesUpdateWhenAvailable() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());

    new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK)
        .clear("https://open-metadata.org/graph/inferred/test-rule");

    verify(rdfRepository, times(1)).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void ruleFailureIsCountedAndRecordedWithRuleNameAndExceptionMessage() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceRuleStatus target = namedStatus("broken-rule", true);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    when(ruleRepository.listForMaterialization(false, null)).thenReturn(List.of(target));
    when(rdfRepository.getGraphTripleCount(target.getGraphUri().toString()))
        .thenThrow(new RuntimeException("triple count boom"));
    when(ruleRepository.recordFailure(eq("broken-rule"), anyString()))
        .thenReturn(namedStatus("broken-rule", true));

    final InferenceMaterializationResult result =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK).materialize(false, null);

    assertEquals(0, result.getSuccessfulRules());
    assertEquals(1, result.getFailedRules());
    final ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
    verify(ruleRepository).recordFailure(eq("broken-rule"), messageCaptor.capture());
    assertTrue(messageCaptor.getValue().contains("broken-rule"));
    assertTrue(messageCaptor.getValue().contains("triple count boom"));
    verify(ruleRepository, never()).recordMaterialized(eq("broken-rule"), anyLong(), anyLong());
  }

  @Test
  void oneRuleFailureDoesNotAbortRemainingRules() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceRuleStatus good = namedStatus("good-rule", true);
    final InferenceRuleStatus bad = namedStatus("bad-rule", true);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    when(ruleRepository.listForMaterialization(false, null)).thenReturn(List.of(bad, good));
    when(rdfRepository.getGraphTripleCount(bad.getGraphUri().toString()))
        .thenThrow(new RuntimeException("bad boom"));
    when(rdfRepository.getGraphTripleCount(good.getGraphUri().toString())).thenReturn(7L);
    when(ruleRepository.recordMaterialized("good-rule", CLOCK.millis(), 7L))
        .thenReturn(namedStatus("good-rule", false));
    when(ruleRepository.recordFailure(eq("bad-rule"), anyString()))
        .thenReturn(namedStatus("bad-rule", true));

    final InferenceMaterializationResult result =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK).materialize(false, null);

    assertEquals(1, result.getSuccessfulRules());
    assertEquals(1, result.getFailedRules());
    assertEquals(2, result.getProcessedRules().size());
    verify(ruleRepository, times(1)).recordMaterialized("good-rule", CLOCK.millis(), 7L);
    verify(ruleRepository, times(1)).recordFailure(eq("bad-rule"), anyString());
  }

  @Test
  void materializeWithUnknownRequestedRuleThrowsNotFoundBeforeAnyUpdate() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    doThrow(new NotFoundException("Inference rule 'ghost' was not found"))
        .when(ruleRepository)
        .get("ghost");
    final InferenceMaterializer materializer =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK);

    assertThrows(NotFoundException.class, () -> materializer.materialize(false, "ghost"));
    verify(ruleRepository, never()).listForMaterialization(anyBoolean(), anyString());
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
  }

  @Test
  void emptyTargetListReturnsZeroAndRunsNoClearOrUpdate() {
    final RdfRepository rdfRepository = mock(RdfRepository.class);
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    when(rdfRepository.isEnabled()).thenReturn(true);
    when(rdfRepository.getConfig()).thenReturn(configuration());
    when(ruleRepository.listForMaterialization(false, null)).thenReturn(List.of());

    final InferenceMaterializationResult result =
        new InferenceMaterializer(rdfRepository, ruleRepository, CLOCK).materialize(false, null);

    assertEquals(0, result.getSuccessfulRules());
    assertEquals(0, result.getFailedRules());
    assertTrue(result.getProcessedRules().isEmpty());
    verify(rdfRepository, never()).executeInferenceMaterializationUpdate(anyString());
    verify(rdfRepository, never()).getGraphTripleCount(anyString());
  }

  private static InferenceRuleStatus namedStatus(final String name, final boolean dirty) {
    final InferenceRule rule =
        new InferenceRule()
            .withName(name)
            .withEnabled(true)
            .withRuleBody("CONSTRUCT { ?s <urn:inferred> ?o } WHERE { ?s <urn:source> ?o }");
    return new InferenceRuleStatus()
        .withRule(rule)
        .withGraphUri(URI.create("https://open-metadata.org/graph/inferred/" + name))
        .withDirty(dirty)
        .withSystemRule(false)
        .withTripleCount(0);
  }

  private static InferenceRuleStatus status(final boolean dirty, final long tripleCount) {
    final InferenceRule rule =
        new InferenceRule()
            .withName("test-rule")
            .withEnabled(true)
            .withRuleBody("CONSTRUCT { ?s <urn:inferred> ?o } WHERE { ?s <urn:source> ?o }");
    return new InferenceRuleStatus()
        .withRule(rule)
        .withGraphUri(URI.create("https://open-metadata.org/graph/inferred/test-rule"))
        .withDirty(dirty)
        .withSystemRule(false)
        .withTripleCount(Math.toIntExact(tripleCount));
  }

  private static RdfConfiguration configuration() {
    return new RdfConfiguration()
        .withEnabled(true)
        .withStorageType(RdfConfiguration.StorageType.FUSEKI)
        .withMaterializedInferenceEnabled(true);
  }
}
