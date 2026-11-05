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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricAssetRollup;
import org.openmetadata.schema.api.data.MetricIncident;
import org.openmetadata.schema.api.data.MetricObservability;
import org.openmetadata.schema.api.data.MetricObservabilityReasonCode;
import org.openmetadata.schema.api.data.MetricSourceCoverage;
import org.openmetadata.schema.api.data.MetricTestStatusCounts;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.Severity;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricHealth;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Covers the health banding, which is the one piece of the rollup that is pure arithmetic and
 * therefore worth pinning without a database. Everything else in the builder reads real entities
 * and is exercised by MetricResourceIT instead.
 */
class MetricObservabilityBuilderTest {

  @ParameterizedTest
  @CsvSource({
    "100.0, HEALTHY",
    "90.0, HEALTHY",
    "89.999, AT_RISK",
    "89.0, AT_RISK",
    "75.0, AT_RISK",
    "74.999, DEGRADED",
    "50.0, DEGRADED",
    "0.0, DEGRADED"
  })
  void healthFor_bandsScoresAtTheDocumentedBoundaries(double score, MetricHealth expected) {
    assertEquals(expected, MetricObservabilityBuilder.healthFor(score));
  }

  @Test
  void healthFor_unscoredAssetIsUnknownRatherThanZero() {
    assertEquals(
        MetricHealth.UNKNOWN,
        MetricObservabilityBuilder.healthFor(null),
        "An asset with no tests must not be treated as a 0% failure");
  }

  @Test
  void thresholdsMatchTheDocumentedBands() {
    assertEquals(90.0, MetricObservabilityBuilder.HEALTHY_THRESHOLD);
    assertEquals(75.0, MetricObservabilityBuilder.AT_RISK_THRESHOLD);
  }

  @Test
  void telemetryRecordsLatencySourcesTestsFailuresAndRedaction() {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    MetricObservabilityBuilder builder = new MetricObservabilityBuilder(null, registry);
    MetricObservability result =
        new MetricObservability()
            .withUpstreamAssetCount(4)
            .withStatusCounts(
                new MetricTestStatusCounts()
                    .withPassed(2)
                    .withFailed(1)
                    .withAborted(1)
                    .withQueued(2)
                    .withMissing(3))
            .withSourceCoverage(new MetricSourceCoverage().withRestrictedTables(2));

    builder.recordTelemetry(result, 5_000_000L, false);

    assertEquals(1, registry.get("om_metric_observability_duration").timer().count());
    assertEquals(
        4.0, registry.get("om_metric_observability_upstream_tables").summary().totalAmount());
    assertEquals(9.0, registry.get("om_metric_observability_active_tests").summary().totalAmount());
    assertEquals(
        2.0, registry.get("om_metric_observability_redacted_sources_total").counter().count());
    assertEquals(0.0, registry.get("om_metric_observability_failures_total").counter().count());
  }

  @Test
  void telemetryCountsUnavailableComputationsAsFailures() {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    MetricObservabilityBuilder builder = new MetricObservabilityBuilder(null, registry);

    MetricObservability result = builder.build(UUID.randomUUID());

    assertEquals(MetricObservabilityReasonCode.UNAVAILABLE, result.getReasonCode());
    assertEquals(1, registry.get("om_metric_observability_duration").timer().count());
    assertEquals(1.0, registry.get("om_metric_observability_failures_total").counter().count());
  }

  @Test
  void buildUsesPrefetchedLinkedAssetsWithoutResolvingLineageAgain() {
    UUID metricId = UUID.randomUUID();
    Metric metric = new Metric().withId(metricId).withName("revenue");
    MetricRepository repository = mock(MetricRepository.class);
    Fields fields = new Fields(Set.of("id"));
    when(repository.getFields("id")).thenReturn(fields);
    when(repository.get(null, metricId, fields)).thenReturn(metric);
    MetricObservabilityBuilder builder =
        new MetricObservabilityBuilder(repository, new SimpleMeterRegistry());

    MetricObservability result = builder.build(metricId, List.of(), Set.of());

    assertEquals(MetricHealth.UNKNOWN, result.getHealth());
    verify(repository, never()).getAssetsWithDirection(metricId);
  }

  @Test
  void loadIncidentsSkipsTheBatchDaoWhenThereAreNoVisibleTests() {
    MetricObservabilityBuilder builder =
        new MetricObservabilityBuilder(null, new SimpleMeterRegistry());

    assertTrue(builder.loadIncidents(List.of(), Set.of()).isEmpty());
  }

  @Test
  void latestResultSelectionUsesTheNewestMatchingTestCase() throws Exception {
    String testCaseFqn = "service.database.schema.table.test";
    ResultSummary older =
        new ResultSummary().withStatus(TestCaseStatus.Success).withTimestamp(100L);
    ResultSummary newest =
        new ResultSummary().withStatus(TestCaseStatus.Failed).withTimestamp(300L);
    ResultSummary other =
        new ResultSummary()
            .withTestCaseName("service.database.schema.table.other")
            .withStatus(TestCaseStatus.Success)
            .withTimestamp(900L);
    older.setTestCaseName(testCaseFqn);
    newest.setTestCaseName(testCaseFqn);
    MetricObservabilityBuilder builder =
        new MetricObservabilityBuilder(null, new SimpleMeterRegistry());

    assertSame(newest, invokeLatestResult(builder, testCaseFqn, List.of(older, other, newest)));
    assertNull(invokeLatestResult(builder, "missing", List.of(older, other, newest)));
  }

  @Test
  void activeTestCasesHydratesRelationshipDerivedTestDefinitions() throws Exception {
    UUID testCaseId = UUID.randomUUID();
    UUID definitionId = UUID.randomUUID();
    TestCase testCase = new TestCase().withId(testCaseId).withName("consistency_test");
    EntityReference definition =
        new EntityReference()
            .withId(definitionId)
            .withName("consistency_definition")
            .withType(Entity.TEST_DEFINITION);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.TestCaseDAO testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
    TestCaseRepository testCaseRepository = mock(TestCaseRepository.class);
    Fields fields = new Fields(Set.of(Entity.TEST_DEFINITION), Entity.TEST_DEFINITION);
    when(collectionDAO.testCaseDAO()).thenReturn(testCaseDAO);
    when(testCaseDAO.findEntitiesByIds(List.of(testCaseId), Include.NON_DELETED))
        .thenReturn(List.of(testCase));
    when(testCaseRepository.getFields(Entity.TEST_DEFINITION)).thenReturn(fields);
    doAnswer(
            invocation -> {
              testCase.setTestDefinition(definition);
              return null;
            })
        .when(testCaseRepository)
        .setFieldsInBulk(fields, List.of(testCase));
    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entity
          .when(() -> Entity.getEntityRepository(Entity.TEST_CASE))
          .thenReturn(testCaseRepository);
      MetricObservabilityBuilder builder =
          new MetricObservabilityBuilder(null, new SimpleMeterRegistry());

      Map<UUID, TestCase> testCases = invokeActiveTestCases(builder, Set.of(testCaseId));

      assertEquals(definition, testCases.get(testCaseId).getTestDefinition());
    }
  }

  @Test
  void incidentsExposeSeverityAndStatusWhileFilteringResolvedAndDuplicateStates() {
    EntityReference source = table("incident_source");
    MetricObservabilityBuilder.Observation primary =
        observation(source, "primary", "Accuracy", TestCaseStatus.Failed, 100L);
    MetricObservabilityBuilder.Observation duplicate =
        observation(source, "duplicate", "Accuracy", TestCaseStatus.Failed, 200L);
    MetricObservabilityBuilder.Observation resolved =
        observation(source, "resolved", "Accuracy", TestCaseStatus.Failed, 300L);
    UUID sharedStateId = UUID.randomUUID();
    UUID resolvedStateId = UUID.randomUUID();
    TestCaseResolutionStatus openStatus =
        resolutionStatus(
            sharedStateId, TestCaseResolutionStatusTypes.New, Severity.Severity1, 400L);
    TestCaseResolutionStatus duplicateStatus =
        resolutionStatus(
            sharedStateId, TestCaseResolutionStatusTypes.Ack, Severity.Severity2, 500L);
    TestCaseResolutionStatus resolvedStatus =
        resolutionStatus(
            resolvedStateId, TestCaseResolutionStatusTypes.Resolved, Severity.Severity3, 600L);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO statusDAO =
        mock(CollectionDAO.TestCaseResolutionStatusTimeSeriesDAO.class);
    when(collectionDAO.testCaseResolutionStatusTimeSeriesDao()).thenReturn(statusDAO);
    when(statusDAO.getLatestRecordBatch(anyList()))
        .thenReturn(
            List.of(
                incidentRecord(primary, openStatus),
                incidentRecord(duplicate, duplicateStatus),
                incidentRecord(resolved, resolvedStatus)));
    Entity.setCollectionDAO(collectionDAO);

    try {
      MetricObservabilityBuilder builder =
          new MetricObservabilityBuilder(null, new SimpleMeterRegistry());
      List<MetricIncident> incidents =
          builder.loadIncidents(List.of(primary, duplicate, resolved), Set.of(source.getId()));

      assertEquals(1, incidents.size());
      MetricIncident incident = incidents.getFirst();
      assertEquals(sharedStateId, incident.getId());
      assertEquals(primary.testCase().getId(), incident.getTestCase().getId());
      assertEquals(source.getId(), incident.getAsset().getId());
      assertEquals(Severity.Severity1.value(), incident.getSeverity());
      assertEquals(TestCaseResolutionStatusTypes.New.value(), incident.getStatus());
      assertEquals(400L, incident.getTimestamp());
    } finally {
      Entity.cleanup();
    }
  }

  @Test
  void summarize_scoresOnlyTerminalResultsAndUsesLatestTerminalRun() {
    EntityReference first = table("first");
    EntityReference second = table("second");
    List<MetricObservabilityBuilder.Observation> observations =
        List.of(
            observation(first, "success", "Accuracy", TestCaseStatus.Success, 100L),
            observation(first, "queued", "Accuracy", TestCaseStatus.Queued, 900L),
            observation(first, "missing", "Accuracy", null, null),
            observation(second, "failed", "Completeness", TestCaseStatus.Failed, 200L),
            observation(second, "aborted", "Completeness", TestCaseStatus.Aborted, 300L));

    MetricObservability result =
        MetricObservabilityBuilder.summarize(
            metric(),
            linked(first, second),
            List.of(first, second),
            observations,
            List.of(),
            Set.of(first.getId(), second.getId()));

    assertEquals(100.0 / 3.0, result.getScore(), 0.0001);
    assertEquals(MetricHealth.DEGRADED, result.getHealth());
    assertEquals(1, result.getStatusCounts().getPassed());
    assertEquals(1, result.getStatusCounts().getFailed());
    assertEquals(1, result.getStatusCounts().getAborted());
    assertEquals(1, result.getStatusCounts().getQueued());
    assertEquals(1, result.getStatusCounts().getMissing());
    assertEquals(3, result.getStatusCounts().getTerminal());
    assertEquals(300L, result.getLatestRunTime());
    assertEquals(2, result.getDimensions().size());
    assertEquals(5, result.getTests().size());
    MetricAssetRollup failedSource =
        result.getAssets().stream()
            .filter(rollup -> second.getId().equals(rollup.getAsset().getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(2, failedSource.getTotal());
    assertEquals(1, failedSource.getFailed());
    assertEquals(1, failedSource.getAborted());
    var completeness =
        result.getDimensions().stream()
            .filter(rollup -> "Completeness".equals(rollup.getDimension()))
            .findFirst()
            .orElseThrow();
    assertEquals(2, completeness.getTotal());
    assertEquals(1, completeness.getFailed());
    assertEquals(1, completeness.getAborted());
  }

  @Test
  void summarize_keepsGlobalScoreWhileRedactingRestrictedSourceDetails() {
    EntityReference visible = table("visible");
    EntityReference restricted = table("restricted");
    List<MetricObservabilityBuilder.Observation> observations =
        List.of(
            observation(visible, "pass", "Accuracy", TestCaseStatus.Success, 100L),
            observation(restricted, "fail", "Accuracy", TestCaseStatus.Failed, 200L));

    MetricObservability result =
        MetricObservabilityBuilder.summarize(
            metric(),
            linked(visible, restricted),
            List.of(visible, restricted),
            observations,
            List.of(),
            Set.of(visible.getId()),
            Set.of(visible.getId()));

    assertEquals(50.0, result.getScore());
    assertEquals(2, result.getStatusCounts().getTerminal());
    assertEquals(1, result.getAssets().size());
    assertEquals(visible.getId(), result.getAssets().getFirst().getAsset().getId());
    assertEquals(1, result.getTests().size());
    assertTrue(result.getPartial());
    assertTrue(result.getSourceCoverage().getPartial());
    assertEquals(1, result.getSourceCoverage().getRestrictedTables());
    assertEquals(MetricObservabilityReasonCode.PARTIAL_DETAILS, result.getReasonCode());
  }

  @Test
  void summarize_exposesVisibleLinkedAssetsButScoresOnlyUpstreamTables() {
    EntityReference upstream = table("upstream");
    EntityReference downstream = table("downstream");
    MetricAssetDirection upstreamLink = link(upstream, MetricAssetDirection.Direction.UPSTREAM);
    MetricAssetDirection downstreamLink =
        link(downstream, MetricAssetDirection.Direction.DOWNSTREAM);

    MetricObservability result =
        MetricObservabilityBuilder.summarize(
            metric(),
            List.of(upstreamLink, downstreamLink),
            List.of(upstream),
            List.of(observation(upstream, "pass", "Accuracy", TestCaseStatus.Success, 100L)),
            List.of(),
            Set.of(upstream.getId()),
            Set.of(upstream.getId(), downstream.getId()));

    assertEquals(100.0, result.getScore());
    assertEquals(2, result.getLinkedAssets().size());
    assertTrue(
        result.getLinkedAssets().stream().anyMatch(link -> link.getAsset().equals(downstream)));
    assertEquals(1, result.getAssets().size());
  }

  @Test
  void summarize_withoutTerminalResultsIsUnknownInsteadOfDegraded() {
    EntityReference source = table("source");
    MetricObservability result =
        MetricObservabilityBuilder.summarize(
            metric(),
            linked(source),
            List.of(source),
            List.of(
                observation(source, "queued", "Accuracy", TestCaseStatus.Queued, 100L),
                observation(source, "missing", "Accuracy", null, null)),
            List.of(),
            Set.of(source.getId()));

    assertNull(result.getScore());
    assertEquals(MetricHealth.UNKNOWN, result.getHealth());
    assertEquals(MetricObservabilityReasonCode.NO_TERMINAL_RESULTS, result.getReasonCode());
    assertEquals(0, result.getStatusCounts().getTerminal());
    assertEquals(0, result.getDimensions().size());
    MetricAssetRollup sourceRollup = result.getAssets().getFirst();
    assertNull(sourceRollup.getScore());
    assertFalse(sourceRollup.getRedacted());
  }

  @Test
  void summarize_treatsAResultWithoutStatusAsMissing() {
    EntityReference source = table("source");
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("missing_status")
            .withFullyQualifiedName("source.missing_status");
    ResultSummary resultWithoutStatus = new ResultSummary().withTimestamp(100L);

    MetricObservability result =
        MetricObservabilityBuilder.summarize(
            metric(),
            linked(source),
            List.of(source),
            List.of(
                new MetricObservabilityBuilder.Observation(
                    source, testCase, "Accuracy", resultWithoutStatus)),
            List.of(),
            Set.of(source.getId()));

    assertEquals(1, result.getStatusCounts().getMissing());
    assertEquals(0, result.getStatusCounts().getTerminal());
    assertNull(result.getTests().getFirst().getStatus());
    assertEquals(100L, result.getTests().getFirst().getTimestamp());
    assertEquals(MetricObservabilityReasonCode.NO_TERMINAL_RESULTS, result.getReasonCode());
  }

  private EntityReference metric() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("metric")
        .withName("metric")
        .withFullyQualifiedName("metric");
  }

  private EntityReference table(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("table")
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private List<MetricAssetDirection> linked(EntityReference... assets) {
    return List.of(assets).stream()
        .map(asset -> link(asset, MetricAssetDirection.Direction.UPSTREAM))
        .toList();
  }

  private MetricAssetDirection link(
      EntityReference asset, MetricAssetDirection.Direction direction) {
    return new MetricAssetDirection()
        .withAsset(asset)
        .withDirection(direction)
        .withAffectsHealth(
            "table".equals(asset.getType())
                && MetricAssetDirection.Direction.UPSTREAM.equals(direction));
  }

  private MetricObservabilityBuilder.Observation observation(
      EntityReference asset, String name, String dimension, TestCaseStatus status, Long timestamp) {
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(asset.getFullyQualifiedName() + "." + name);
    ResultSummary summary =
        status == null ? null : new ResultSummary().withStatus(status).withTimestamp(timestamp);
    return new MetricObservabilityBuilder.Observation(asset, testCase, dimension, summary);
  }

  private ResultSummary invokeLatestResult(
      MetricObservabilityBuilder builder, String testCaseFqn, List<ResultSummary> summaries)
      throws Exception {
    Method latestFor =
        MetricObservabilityBuilder.class.getDeclaredMethod("latestFor", String.class, List.class);
    latestFor.setAccessible(true);
    return (ResultSummary) latestFor.invoke(builder, testCaseFqn, summaries);
  }

  @SuppressWarnings("unchecked")
  private Map<UUID, TestCase> invokeActiveTestCases(
      MetricObservabilityBuilder builder, Set<UUID> testCaseIds) throws Exception {
    Method activeTestCases =
        MetricObservabilityBuilder.class.getDeclaredMethod("activeTestCases", Set.class);
    activeTestCases.setAccessible(true);
    return (Map<UUID, TestCase>) activeTestCases.invoke(builder, testCaseIds);
  }

  private TestCaseResolutionStatus resolutionStatus(
      UUID stateId, TestCaseResolutionStatusTypes status, Severity severity, long timestamp) {
    return new TestCaseResolutionStatus()
        .withStateId(stateId)
        .withTestCaseResolutionStatusType(status)
        .withSeverity(severity)
        .withTimestamp(timestamp);
  }

  private CollectionDAO.LatestRecordWithFQNHash incidentRecord(
      MetricObservabilityBuilder.Observation observation, TestCaseResolutionStatus status) {
    return new CollectionDAO.LatestRecordWithFQNHash(
        FullyQualifiedName.buildHash(observation.testCase().getFullyQualifiedName()),
        JsonUtils.pojoToJson(status));
  }
}
