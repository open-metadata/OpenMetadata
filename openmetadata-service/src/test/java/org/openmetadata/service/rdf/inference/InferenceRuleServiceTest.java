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

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.net.URI;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;

class InferenceRuleServiceTest {
  private static final String RULE_NAME = "test-rule";
  private static final String GRAPH_URI = "https://open-metadata.org/graph/inferred/test-rule";

  @Test
  void deleteOfSystemRuleThrowsAndSkipsClearAndDelete() {
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceMaterializer materializer = mock(InferenceMaterializer.class);
    when(ruleRepository.get(RULE_NAME)).thenReturn(status(true));
    final InferenceRuleService service = new InferenceRuleService(ruleRepository, materializer);

    assertThrows(BadRequestException.class, () -> service.delete(RULE_NAME));

    verify(materializer, never()).clear(anyString());
    verify(ruleRepository, never()).delete(anyString());
    verify(ruleRepository, never()).markAllDirty();
  }

  @Test
  void deleteOfCustomRuleClearsBeforeDeletingThenMarksDirty() {
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceMaterializer materializer = mock(InferenceMaterializer.class);
    when(ruleRepository.get(RULE_NAME)).thenReturn(status(false));
    final InferenceRuleService service = new InferenceRuleService(ruleRepository, materializer);

    service.delete(RULE_NAME);

    final InOrder order = inOrder(materializer, ruleRepository);
    order.verify(materializer).clear(GRAPH_URI);
    order.verify(ruleRepository).delete(RULE_NAME);
    order.verify(ruleRepository).markAllDirty();
  }

  @Test
  void deleteResolvesRuleFirstAndPropagatesNotFoundForUnknownName() {
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceMaterializer materializer = mock(InferenceMaterializer.class);
    when(ruleRepository.get("missing")).thenThrow(new NotFoundException("missing"));
    final InferenceRuleService service = new InferenceRuleService(ruleRepository, materializer);

    assertThrows(NotFoundException.class, () -> service.delete("missing"));

    verify(materializer, never()).clear(anyString());
    verify(ruleRepository, never()).delete(anyString());
    verify(ruleRepository, never()).markAllDirty();
  }

  @Test
  void upsertReturnsRepositoryStatusAndMarksAllDirty() {
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceMaterializer materializer = mock(InferenceMaterializer.class);
    final InferenceRule rule = rule();
    final InferenceRuleStatus upserted = status(false);
    when(ruleRepository.upsert(RULE_NAME, rule)).thenReturn(upserted);
    final InferenceRuleService service = new InferenceRuleService(ruleRepository, materializer);

    final InferenceRuleStatus result = service.upsert(RULE_NAME, rule);

    assertSame(upserted, result);
    final InOrder order = inOrder(ruleRepository);
    order.verify(ruleRepository).upsert(RULE_NAME, rule);
    order.verify(ruleRepository).markAllDirty();
  }

  @Test
  void upsertMarksAllDirtyEvenWhenStatusIsUnchanged() {
    final InferenceRuleRepository ruleRepository = mock(InferenceRuleRepository.class);
    final InferenceMaterializer materializer = mock(InferenceMaterializer.class);
    final InferenceRule rule = rule();
    final InferenceRuleStatus unchanged = status(false).withDirty(false);
    when(ruleRepository.upsert(RULE_NAME, rule)).thenReturn(unchanged);
    final InferenceRuleService service = new InferenceRuleService(ruleRepository, materializer);

    final InferenceRuleStatus result = service.upsert(RULE_NAME, rule);

    assertSame(unchanged, result);
    verify(ruleRepository).markAllDirty();
    verify(materializer, never()).materialize(false, null);
  }

  private static InferenceRule rule() {
    return new InferenceRule()
        .withName(RULE_NAME)
        .withEnabled(true)
        .withRuleBody("CONSTRUCT { ?s <urn:inferred> ?o } WHERE { ?s <urn:source> ?o }");
  }

  private static InferenceRuleStatus status(final boolean systemRule) {
    return new InferenceRuleStatus()
        .withRule(rule())
        .withGraphUri(URI.create(GRAPH_URI))
        .withDirty(true)
        .withSystemRule(systemRule)
        .withTripleCount(0);
  }
}
