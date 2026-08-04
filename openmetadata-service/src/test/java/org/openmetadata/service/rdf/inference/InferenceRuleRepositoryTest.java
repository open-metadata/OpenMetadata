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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfInferenceRuleDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.RdfInferenceRuleDAO.RdfInferenceRuleRow;

class InferenceRuleRepositoryTest {
  private static final long NOW = 1_750_000_000_000L;
  private RdfInferenceRuleDAO ruleDAO;
  private InferenceRuleRepository repository;

  @BeforeEach
  void setUp() {
    ruleDAO = mock(RdfInferenceRuleDAO.class);
    final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
    repository = new InferenceRuleRepository(ruleDAO, clock, "https://metadata.example");
  }

  @Test
  void initializesTheStarterPackOnceAndOrdersRulesByPriorityThenName() {
    when(ruleDAO.listActive())
        .thenReturn(
            List.of(row(rule("z-rule", 20, true), false), row(rule("a-rule", 10, true), false)));

    final List<InferenceRuleStatus> first = repository.list();
    final List<InferenceRuleStatus> second = repository.list();

    assertEquals(List.of("a-rule", "z-rule"), names(first));
    assertEquals(List.of("a-rule", "z-rule"), names(second));
    assertEquals(
        "https://metadata.example/graph/inferred/a-rule",
        first.getFirst().getGraphUri().toString());
    verify(ruleDAO, times(4)).insertIfAbsent(anyString(), anyString(), anyBoolean(), anyLong());
  }

  @Test
  void returnsOnlyDirtyOrForcedMaterializationTargetsIncludingDisabledRules() {
    final InferenceRuleStatus disabledDirty = status(rule("disabled-rule", 10, false), true);
    final InferenceRuleStatus enabledClean = status(rule("clean-rule", 20, true), false);
    when(ruleDAO.listActive())
        .thenReturn(
            List.of(
                row(disabledDirty.getRule(), disabledDirty.getDirty()),
                row(enabledClean.getRule(), enabledClean.getDirty())));

    assertEquals(List.of("disabled-rule"), names(repository.listForMaterialization(false, null)));
    assertEquals(
        List.of("disabled-rule", "clean-rule"),
        names(repository.listForMaterialization(true, null)));
  }

  @Test
  void rejectsMismatchedNamesBeforeWriting() {
    final InferenceRule rule = rule("body-name", 10, true);

    assertThrows(BadRequestException.class, () -> repository.upsert("path-name", rule));

    verify(ruleDAO, never()).upsert(anyString(), anyString(), anyLong());
  }

  @Test
  void preventsSystemRuleDeletion() {
    final InferenceRule rule = rule("system-rule", 10, true);
    when(ruleDAO.findActive("system-rule")).thenReturn(row(rule, true, true));

    assertThrows(BadRequestException.class, () -> repository.delete("system-rule"));

    verify(ruleDAO, never()).softDelete(anyString(), anyLong());
  }

  @Test
  void reportsMissingRulesWithTheirName() {
    final NotFoundException exception =
        assertThrows(NotFoundException.class, () -> repository.get("missing-rule"));

    assertTrue(exception.getMessage().contains("missing-rule"));
  }

  @Test
  void recordMaterializedMarksTheRuleAndReturnsRefreshedTripleCount() {
    final InferenceRule rule = rule("done-rule", 10, true);
    final long completedAt = NOW + 5_000L;
    final long tripleCount = 42L;
    when(ruleDAO.findActive("done-rule"))
        .thenReturn(materializedRow(rule, completedAt, tripleCount));

    final InferenceRuleStatus status = repository.recordMaterialized("done-rule", completedAt, 7L);

    verify(ruleDAO, times(1)).markMaterialized("done-rule", completedAt, 7L);
    assertEquals(42, status.getTripleCount());
    assertEquals(completedAt, status.getLastMaterializedAt());
    assertFalse(status.getDirty());
    assertNull(status.getLastError());
  }

  @Test
  void recordFailureMarksTheRuleAndReReadsPersistedError() {
    final InferenceRule rule = rule("broken-rule", 10, true);
    when(ruleDAO.findActive("broken-rule"))
        .thenReturn(failedRow(rule, "SPARQL execution timed out"));

    final InferenceRuleStatus status =
        repository.recordFailure("broken-rule", "SPARQL execution timed out");

    verify(ruleDAO, times(1)).markFailed("broken-rule", "SPARQL execution timed out");
    assertEquals("SPARQL execution timed out", status.getLastError());
    assertTrue(status.getDirty());
  }

  @Test
  void leavesOptionalMaterializationFieldsUnsetWhenTheRowOmitsThem() {
    final InferenceRule rule = rule("fresh-rule", 10, true);
    when(ruleDAO.findActive("fresh-rule")).thenReturn(row(rule, false));

    final InferenceRuleStatus status = repository.get("fresh-rule");

    assertNull(status.getLastMaterializedAt());
    assertNull(status.getLastError());
    assertEquals(0, status.getTripleCount());
  }

  @Test
  void populatesOptionalMaterializationFieldsWhenTheRowProvidesThem() {
    final InferenceRule rule = rule("aged-rule", 10, true);
    when(ruleDAO.findActive("aged-rule"))
        .thenReturn(
            new RdfInferenceRuleRow(
                "aged-rule",
                JsonUtils.pojoToJson(rule),
                false,
                false,
                NOW,
                NOW - 1_000L,
                99L,
                "previous failure"));

    final InferenceRuleStatus status = repository.get("aged-rule");

    assertEquals(NOW - 1_000L, status.getLastMaterializedAt());
    assertEquals("previous failure", status.getLastError());
    assertEquals(99, status.getTripleCount());
  }

  @Test
  void appendsTrailingSlashWhenBaseUriLacksOne() {
    final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
    final InferenceRuleRepository noSlash =
        new InferenceRuleRepository(ruleDAO, clock, "https://no-slash.example");
    final InferenceRule rule = rule("r", 10, true);
    when(ruleDAO.findActive("r")).thenReturn(row(rule, false));

    assertEquals(
        "https://no-slash.example/graph/inferred/r", noSlash.get("r").getGraphUri().toString());
  }

  @Test
  void doesNotDoubleTrailingSlashWhenBaseUriAlreadyHasOne() {
    final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
    final InferenceRuleRepository withSlash =
        new InferenceRuleRepository(ruleDAO, clock, "https://with-slash.example/");
    final InferenceRule rule = rule("r", 10, true);
    when(ruleDAO.findActive("r")).thenReturn(row(rule, false));

    assertEquals(
        "https://with-slash.example/graph/inferred/r", withSlash.get("r").getGraphUri().toString());
  }

  @Test
  void rejectsNullBaseUriAtConstruction() {
    final Clock clock = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);

    assertThrows(
        NullPointerException.class, () -> new InferenceRuleRepository(ruleDAO, clock, null));
  }

  private static RdfInferenceRuleRow materializedRow(
      final InferenceRule rule, final long lastMaterializedAt, final long tripleCount) {
    return new RdfInferenceRuleRow(
        rule.getName(),
        JsonUtils.pojoToJson(rule),
        false,
        false,
        NOW,
        lastMaterializedAt,
        tripleCount,
        null);
  }

  private static RdfInferenceRuleRow failedRow(final InferenceRule rule, final String error) {
    return new RdfInferenceRuleRow(
        rule.getName(), JsonUtils.pojoToJson(rule), false, true, NOW, null, 0L, error);
  }

  private static List<String> names(final List<InferenceRuleStatus> statuses) {
    return statuses.stream().map(status -> status.getRule().getName()).toList();
  }

  private static InferenceRuleStatus status(final InferenceRule rule, final boolean dirty) {
    return new InferenceRuleStatus().withRule(rule).withDirty(dirty);
  }

  private static RdfInferenceRuleRow row(final InferenceRule rule, final boolean dirty) {
    return row(rule, dirty, false);
  }

  private static RdfInferenceRuleRow row(
      final InferenceRule rule, final boolean dirty, final boolean systemRule) {
    return new RdfInferenceRuleRow(
        rule.getName(), JsonUtils.pojoToJson(rule), systemRule, dirty, NOW, null, 0L, null);
  }

  private static InferenceRule rule(final String name, final int priority, final boolean enabled) {
    return new InferenceRule()
        .withName(name)
        .withPriority(priority)
        .withEnabled(enabled)
        .withRuleBody("CONSTRUCT { ?s <urn:inferred> ?o } WHERE { ?s <urn:source> ?o }");
  }
}
