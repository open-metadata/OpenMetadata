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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.Entity.TEST_DEFINITION;
import static org.openmetadata.service.Entity.TEST_SUITE;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.MetricAssetDirection;
import org.openmetadata.schema.api.data.MetricAssetRollup;
import org.openmetadata.schema.api.data.MetricDimensionRollup;
import org.openmetadata.schema.api.data.MetricIncident;
import org.openmetadata.schema.api.data.MetricObservability;
import org.openmetadata.schema.api.data.MetricObservabilityReasonCode;
import org.openmetadata.schema.api.data.MetricSourceCoverage;
import org.openmetadata.schema.api.data.MetricTestResult;
import org.openmetadata.schema.api.data.MetricTestStatusCounts;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricHealth;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/** Computes Metric health from every active test on direct upstream Tables. */
@Slf4j
public class MetricObservabilityBuilder {
  static final double HEALTHY_THRESHOLD = 90.0;
  static final double AT_RISK_THRESHOLD = 75.0;

  private final MetricRepository metricRepository;
  private final Timer latency;
  private final DistributionSummary upstreamTableCount;
  private final DistributionSummary activeTestCount;
  private final Counter failures;
  private final Counter redactedSources;

  public MetricObservabilityBuilder(MetricRepository metricRepository) {
    this(metricRepository, Metrics.globalRegistry);
  }

  MetricObservabilityBuilder(MetricRepository metricRepository, MeterRegistry meterRegistry) {
    this.metricRepository = metricRepository;
    latency =
        Timer.builder("om_metric_observability_duration")
            .description("Time spent computing Metric observability")
            .publishPercentileHistogram()
            .register(meterRegistry);
    upstreamTableCount =
        DistributionSummary.builder("om_metric_observability_upstream_tables")
            .description("Direct upstream Tables evaluated per Metric observability request")
            .register(meterRegistry);
    activeTestCount =
        DistributionSummary.builder("om_metric_observability_active_tests")
            .description("Active tests evaluated per Metric observability request")
            .register(meterRegistry);
    failures =
        Counter.builder("om_metric_observability_failures_total")
            .description("Metric observability computations that could not be completed")
            .register(meterRegistry);
    redactedSources =
        Counter.builder("om_metric_observability_redacted_sources_total")
            .description("Metric upstream sources redacted from response details")
            .register(meterRegistry);
  }

  public MetricObservability build(UUID metricId) {
    return build(metricId, null, null);
  }

  public MetricObservability build(UUID metricId, Set<UUID> visibleAssetIds) {
    return build(metricId, null, visibleAssetIds);
  }

  public MetricObservability build(
      UUID metricId, List<MetricAssetDirection> linkedAssets, Set<UUID> visibleAssetIds) {
    MetricObservability result;
    boolean failed = false;
    long startedAt = System.nanoTime();
    try {
      result = compute(metricId, linkedAssets, visibleAssetIds);
    } catch (RuntimeException exception) {
      failed = true;
      LOG.warn("Failed to compute Metric observability for {}", metricId, exception);
      result = unavailable();
    }
    recordTelemetry(result, System.nanoTime() - startedAt, failed);
    return result;
  }

  void recordTelemetry(MetricObservability result, long durationNanos, boolean failed) {
    latency.record(durationNanos, TimeUnit.NANOSECONDS);
    if (failed) {
      failures.increment();
    }
    if (result == null) {
      return;
    }
    upstreamTableCount.record(valueOrZero(result.getUpstreamAssetCount()));
    MetricTestStatusCounts counts = result.getStatusCounts();
    if (counts != null) {
      activeTestCount.record(
          valueOrZero(counts.getPassed())
              + valueOrZero(counts.getFailed())
              + valueOrZero(counts.getAborted())
              + valueOrZero(counts.getQueued())
              + valueOrZero(counts.getMissing()));
    }
    if (result.getSourceCoverage() != null) {
      redactedSources.increment(valueOrZero(result.getSourceCoverage().getRestrictedTables()));
    }
  }

  private static int valueOrZero(Integer value) {
    return value == null ? 0 : value;
  }

  private MetricObservability compute(
      UUID metricId, List<MetricAssetDirection> prefetchedLinkedAssets, Set<UUID> visibleAssetIds) {
    Metric metric = metricRepository.get(null, metricId, metricRepository.getFields("id"));
    List<MetricAssetDirection> linkedAssets =
        prefetchedLinkedAssets == null
            ? metricRepository.getAssetsWithDirection(metricId)
            : List.copyOf(prefetchedLinkedAssets);
    List<EntityReference> upstreamTables = directUpstreamTables(linkedAssets);
    List<Observation> observations = loadObservations(upstreamTables);
    Set<UUID> visibleUpstream = visibleAssets(upstreamTables, visibleAssetIds);
    Set<UUID> visibleLinked = visibleLinkedAssetIds(linkedAssets, visibleAssetIds);
    List<MetricIncident> incidents = loadIncidents(observations, visibleUpstream);
    return summarize(
            metric.getEntityReference(),
            linkedAssets,
            upstreamTables,
            observations,
            incidents,
            visibleUpstream,
            visibleLinked)
        .withEvaluatedAt(System.currentTimeMillis());
  }

  private Set<UUID> visibleLinkedAssetIds(
      List<MetricAssetDirection> linkedAssets, Set<UUID> visibleAssetIds) {
    Set<UUID> visible = new HashSet<>();
    for (MetricAssetDirection linked : linkedAssets) {
      UUID id = linked.getAsset().getId();
      if (visibleAssetIds == null || visibleAssetIds.contains(id)) {
        visible.add(id);
      }
    }
    return visible;
  }

  private List<EntityReference> directUpstreamTables(List<MetricAssetDirection> linkedAssets) {
    return linkedAssets.stream()
        .filter(linked -> MetricAssetDirection.Direction.UPSTREAM.equals(linked.getDirection()))
        .map(MetricAssetDirection::getAsset)
        .filter(asset -> TABLE.equals(asset.getType()))
        .sorted(Comparator.comparing(EntityReference::getId))
        .toList();
  }

  private Set<UUID> visibleAssets(List<EntityReference> upstreamTables, Set<UUID> visibleAssetIds) {
    Set<UUID> visible = new HashSet<>();
    for (EntityReference table : upstreamTables) {
      if (visibleAssetIds == null || visibleAssetIds.contains(table.getId())) {
        visible.add(table.getId());
      }
    }
    return visible;
  }

  private List<Observation> loadObservations(List<EntityReference> upstreamTables) {
    Map<UUID, EntityReference> tableBySuite = tableBySuite(upstreamTables);
    Map<UUID, List<ResultSummary>> results = latestResults(new ArrayList<>(tableBySuite.keySet()));
    Map<UUID, UUID> suiteByTest = suiteByTest(tableBySuite.keySet());
    Map<UUID, TestCase> testCases = activeTestCases(suiteByTest.keySet());
    Map<UUID, TestDefinition> definitions = definitions(testCases.values());
    List<Observation> observations = new ArrayList<>();
    for (TestCase testCase : testCases.values()) {
      UUID suiteId = suiteByTest.get(testCase.getId());
      EntityReference table = tableBySuite.get(suiteId);
      if (table != null) {
        observations.add(toObservation(table, testCase, definitions, results.get(suiteId)));
      }
    }
    return observations;
  }

  private Map<UUID, EntityReference> tableBySuite(List<EntityReference> tables) {
    if (tables.isEmpty()) {
      return Map.of();
    }
    List<String> tableIds = tables.stream().map(table -> table.getId().toString()).toList();
    Map<UUID, EntityReference> tablesById =
        tables.stream().collect(Collectors.toMap(EntityReference::getId, Function.identity()));
    Map<UUID, EntityReference> result = new LinkedHashMap<>();
    for (CollectionDAO.EntityRelationshipObject relationship :
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findToBatch(tableIds, Relationship.CONTAINS.ordinal(), TABLE, TEST_SUITE)) {
      result.put(
          UUID.fromString(relationship.getToId()),
          tablesById.get(UUID.fromString(relationship.getFromId())));
    }
    return retainActiveSuites(result);
  }

  private Map<UUID, EntityReference> retainActiveSuites(Map<UUID, EntityReference> tableBySuite) {
    List<EntityReference> active =
        Entity.getEntityReferencesByIds(
            TEST_SUITE, new ArrayList<>(tableBySuite.keySet()), Include.NON_DELETED);
    Set<UUID> activeIds = active.stream().map(EntityReference::getId).collect(Collectors.toSet());
    return tableBySuite.entrySet().stream()
        .filter(entry -> activeIds.contains(entry.getKey()))
        .collect(
            Collectors.toMap(
                Map.Entry::getKey, Map.Entry::getValue, (left, right) -> left, LinkedHashMap::new));
  }

  private Map<UUID, UUID> suiteByTest(Set<UUID> suiteIds) {
    if (suiteIds.isEmpty()) {
      return Map.of();
    }
    List<String> ids = suiteIds.stream().map(UUID::toString).toList();
    Map<UUID, UUID> result = new LinkedHashMap<>();
    for (CollectionDAO.EntityRelationshipObject relationship :
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findToBatch(ids, Relationship.CONTAINS.ordinal(), TEST_SUITE, TEST_CASE)) {
      result.putIfAbsent(
          UUID.fromString(relationship.getToId()), UUID.fromString(relationship.getFromId()));
    }
    return result;
  }

  private Map<UUID, TestCase> activeTestCases(Set<UUID> testCaseIds) {
    if (testCaseIds.isEmpty()) {
      return Map.of();
    }
    List<TestCase> tests =
        Entity.getCollectionDAO()
            .testCaseDAO()
            .findEntitiesByIds(new ArrayList<>(testCaseIds), Include.NON_DELETED);
    TestCaseRepository testCaseRepository =
        (TestCaseRepository) Entity.getEntityRepository(TEST_CASE);
    testCaseRepository.setFieldsInBulk(testCaseRepository.getFields(TEST_DEFINITION), tests);
    return tests.stream().collect(Collectors.toMap(TestCase::getId, Function.identity()));
  }

  private Map<UUID, TestDefinition> definitions(Iterable<TestCase> tests) {
    Set<UUID> ids = new LinkedHashSet<>();
    for (TestCase test : tests) {
      if (test.getTestDefinition() != null) {
        ids.add(test.getTestDefinition().getId());
      }
    }
    if (ids.isEmpty()) {
      return Map.of();
    }
    List<TestDefinition> definitions =
        Entity.getCollectionDAO()
            .testDefinitionDAO()
            .findEntitiesByIds(new ArrayList<>(ids), Include.NON_DELETED);
    return definitions.stream()
        .collect(Collectors.toMap(TestDefinition::getId, Function.identity()));
  }

  private Map<UUID, List<ResultSummary>> latestResults(List<UUID> suiteIds) {
    if (suiteIds.isEmpty()) {
      return Map.of();
    }
    TestCaseResultRepository repository =
        (TestCaseResultRepository) Entity.getEntityTimeSeriesRepository(TEST_CASE_RESULT);
    return repository.listResultSummariesForTestSuites(suiteIds);
  }

  private Observation toObservation(
      EntityReference table,
      TestCase testCase,
      Map<UUID, TestDefinition> definitions,
      List<ResultSummary> summaries) {
    ResultSummary result = latestFor(testCase.getFullyQualifiedName(), summaries);
    TestDefinition definition =
        testCase.getTestDefinition() == null
            ? null
            : definitions.get(testCase.getTestDefinition().getId());
    String dimension =
        definition == null || definition.getDataQualityDimension() == null
            ? DataQualityDimensions.NO_DIMENSION.value()
            : definition.getDataQualityDimension().value();
    return new Observation(table, testCase, dimension, result);
  }

  private ResultSummary latestFor(String testCaseFqn, List<ResultSummary> summaries) {
    return listOrEmpty(summaries).stream()
        .filter(summary -> testCaseFqn.equals(summary.getTestCaseName()))
        .max(Comparator.comparing(ResultSummary::getTimestamp))
        .orElse(null);
  }

  List<MetricIncident> loadIncidents(List<Observation> observations, Set<UUID> visibleAssets) {
    Map<String, Observation> observationByHash = new HashMap<>();
    List<String> testCaseFqns = new ArrayList<>();
    for (Observation observation : observations) {
      if (visibleAssets.contains(observation.asset().getId())) {
        String fqn = observation.testCase().getFullyQualifiedName();
        observationByHash.put(FullyQualifiedName.buildHash(fqn), observation);
        testCaseFqns.add(fqn);
      }
    }
    if (testCaseFqns.isEmpty()) {
      return List.of();
    }
    List<MetricIncident> incidents = new ArrayList<>();
    Set<UUID> seen = new HashSet<>();
    for (CollectionDAO.LatestRecordWithFQNHash record :
        Entity.getCollectionDAO()
            .testCaseResolutionStatusTimeSeriesDao()
            .getLatestRecordBatch(testCaseFqns)) {
      Observation observation = observationByHash.get(record.getEntityFQNHash());
      TestCaseResolutionStatus status =
          JsonUtils.readValue(record.getJson(), TestCaseResolutionStatus.class);
      if (observation != null && isUnresolved(status) && seen.add(status.getStateId())) {
        incidents.add(toIncident(status, observation));
      }
    }
    return incidents;
  }

  private boolean isUnresolved(TestCaseResolutionStatus status) {
    return status != null
        && status.getStateId() != null
        && !TestCaseResolutionStatusTypes.Resolved.equals(status.getTestCaseResolutionStatusType());
  }

  private MetricIncident toIncident(TestCaseResolutionStatus status, Observation observation) {
    return new MetricIncident()
        .withId(status.getStateId())
        .withTestCase(observation.testCase().getEntityReference())
        .withAsset(observation.asset())
        .withSeverity(status.getSeverity() == null ? null : status.getSeverity().value())
        .withStatus(status.getTestCaseResolutionStatusType().value())
        .withTimestamp(status.getTimestamp());
  }

  static MetricObservability summarize(
      EntityReference metric,
      List<MetricAssetDirection> linkedAssets,
      List<EntityReference> upstreamTables,
      List<Observation> observations,
      List<MetricIncident> incidents,
      Set<UUID> visibleAssets) {
    return summarize(
        metric,
        linkedAssets,
        upstreamTables,
        observations,
        incidents,
        visibleAssets,
        visibleAssets);
  }

  static MetricObservability summarize(
      EntityReference metric,
      List<MetricAssetDirection> linkedAssets,
      List<EntityReference> upstreamTables,
      List<Observation> observations,
      List<MetricIncident> incidents,
      Set<UUID> visibleAssets,
      Set<UUID> visibleLinkedAssets) {
    RollupAccumulator accumulator = new RollupAccumulator(visibleAssets);
    observations.forEach(accumulator::add);
    Double score = accumulator.score();
    MetricHealth health = healthFor(score);
    int restricted = upstreamTables.size() - visibleAssets.size();
    MetricObservabilityReasonCode reason =
        reasonFor(linkedAssets, upstreamTables, score, health, restricted);
    return new MetricObservability()
        .withMetric(metric)
        .withHealth(health)
        .withScore(score)
        .withReasonCode(reason)
        .withRollupReason(reason.value())
        .withAssets(accumulator.assetRollups(upstreamTables))
        .withLinkedAssets(visibleLinkedAssets(linkedAssets, visibleLinkedAssets))
        .withDimensions(accumulator.dimensionRollups())
        .withTests(accumulator.testResults())
        .withIncidents(incidents)
        .withStatusCounts(accumulator.statusCounts())
        .withSourceCoverage(accumulator.coverage(upstreamTables, restricted))
        .withLatestRunTime(accumulator.latestRunTime())
        .withPartial(restricted > 0)
        .withUpstreamAssetCount(upstreamTables.size())
        .withEvaluatedAssetCount(accumulator.evaluatedAssetCount());
  }

  private static List<MetricAssetDirection> visibleLinkedAssets(
      List<MetricAssetDirection> linkedAssets, Set<UUID> visibleAssets) {
    return linkedAssets.stream()
        .filter(linked -> visibleAssets.contains(linked.getAsset().getId()))
        .toList();
  }

  private static MetricObservabilityReasonCode reasonFor(
      List<MetricAssetDirection> linkedAssets,
      List<EntityReference> upstreamTables,
      Double score,
      MetricHealth health,
      int restricted) {
    MetricObservabilityReasonCode reason;
    if (linkedAssets.isEmpty()) {
      reason = MetricObservabilityReasonCode.NO_LINKED_ASSETS;
    } else if (upstreamTables.isEmpty()) {
      reason = MetricObservabilityReasonCode.NO_UPSTREAM_TABLES;
    } else if (restricted > 0) {
      reason = MetricObservabilityReasonCode.PARTIAL_DETAILS;
    } else if (score == null) {
      reason = MetricObservabilityReasonCode.NO_TERMINAL_RESULTS;
    } else {
      reason = MetricObservabilityReasonCode.fromValue(health.value());
    }
    return reason;
  }

  private MetricObservability unavailable() {
    return new MetricObservability()
        .withHealth(MetricHealth.UNKNOWN)
        .withReasonCode(MetricObservabilityReasonCode.UNAVAILABLE)
        .withRollupReason(MetricObservabilityReasonCode.UNAVAILABLE.value())
        .withEvaluatedAt(System.currentTimeMillis());
  }

  static MetricHealth healthFor(Double score) {
    MetricHealth health;
    if (score == null) {
      health = MetricHealth.UNKNOWN;
    } else if (score >= HEALTHY_THRESHOLD) {
      health = MetricHealth.HEALTHY;
    } else if (score >= AT_RISK_THRESHOLD) {
      health = MetricHealth.AT_RISK;
    } else {
      health = MetricHealth.DEGRADED;
    }
    return health;
  }

  static record Observation(
      EntityReference asset, TestCase testCase, String dimension, ResultSummary result) {}

  private static final class RollupAccumulator {
    private final Set<UUID> visibleAssets;
    private final Map<UUID, SourceCounts> sourceCounts = new LinkedHashMap<>();
    private final Map<String, StatusCounter> dimensionCounts = new LinkedHashMap<>();
    private final List<MetricTestResult> testResults = new ArrayList<>();
    private int passed;
    private int failed;
    private int aborted;
    private int queued;
    private int missing;
    private Long latestRunTime;

    private RollupAccumulator(Set<UUID> visibleAssets) {
      this.visibleAssets = visibleAssets;
    }

    private void add(Observation observation) {
      SourceCounts source =
          sourceCounts.computeIfAbsent(
              observation.asset().getId(), ignored -> new SourceCounts(observation.asset()));
      source.activeTests++;
      ResultSummary result = observation.result();
      if (result == null || result.getStatus() == null) {
        missing++;
        addVisibleTest(observation);
      } else if (TestCaseStatus.Queued.equals(result.getStatus())) {
        queued++;
        addVisibleTest(observation);
      } else if (isTerminal(result.getStatus())) {
        addTerminal(observation, source);
      } else {
        missing++;
        addVisibleTest(observation);
      }
    }

    private boolean isTerminal(TestCaseStatus status) {
      return TestCaseStatus.Success.equals(status)
          || TestCaseStatus.Failed.equals(status)
          || TestCaseStatus.Aborted.equals(status);
    }

    private void addTerminal(Observation observation, SourceCounts source) {
      TestCaseStatus status = observation.result().getStatus();
      if (TestCaseStatus.Success.equals(status)) {
        passed++;
        source.passed++;
      } else if (TestCaseStatus.Failed.equals(status)) {
        failed++;
        source.failed++;
      } else if (TestCaseStatus.Aborted.equals(status)) {
        aborted++;
        source.aborted++;
      }
      source.latestRun = max(source.latestRun, observation.result().getTimestamp());
      latestRunTime = max(latestRunTime, observation.result().getTimestamp());
      dimensionCounts
          .computeIfAbsent(observation.dimension(), ignored -> new StatusCounter())
          .add(status);
      addVisibleTest(observation);
    }

    private void addVisibleTest(Observation observation) {
      if (visibleAssets.contains(observation.asset().getId())) {
        ResultSummary result = observation.result();
        testResults.add(
            new MetricTestResult()
                .withTestCase(observation.testCase().getEntityReference())
                .withAsset(observation.asset())
                .withDimension(observation.dimension())
                .withStatus(
                    result == null || result.getStatus() == null
                        ? null
                        : result.getStatus().value())
                .withTimestamp(result == null ? null : result.getTimestamp()));
      }
    }

    private Double score() {
      int terminal = passed + failed + aborted;
      return terminal == 0 ? null : (passed / (double) terminal) * 100.0;
    }

    private List<MetricAssetRollup> assetRollups(List<EntityReference> upstreamTables) {
      List<MetricAssetRollup> rollups = new ArrayList<>();
      for (EntityReference table : upstreamTables) {
        if (visibleAssets.contains(table.getId())) {
          SourceCounts counts = sourceCounts.getOrDefault(table.getId(), new SourceCounts(table));
          rollups.add(counts.toRollup());
        }
      }
      return rollups;
    }

    private List<MetricDimensionRollup> dimensionRollups() {
      return dimensionCounts.entrySet().stream()
          .map(entry -> entry.getValue().toDimension(entry.getKey()))
          .toList();
    }

    private MetricTestStatusCounts statusCounts() {
      return new MetricTestStatusCounts()
          .withPassed(passed)
          .withFailed(failed)
          .withAborted(aborted)
          .withQueued(queued)
          .withMissing(missing)
          .withTerminal(passed + failed + aborted);
    }

    private MetricSourceCoverage coverage(
        List<EntityReference> upstreamTables, int restrictedTables) {
      int testedTables =
          (int) sourceCounts.values().stream().filter(source -> source.activeTests > 0).count();
      double percentage =
          upstreamTables.isEmpty() ? 0.0 : (testedTables / (double) upstreamTables.size()) * 100.0;
      return new MetricSourceCoverage()
          .withUpstreamTables(upstreamTables.size())
          .withTestedTables(testedTables)
          .withVisibleTables(visibleAssets.size())
          .withRestrictedTables(restrictedTables)
          .withCoveragePercent(percentage)
          .withPartial(restrictedTables > 0);
    }

    private int evaluatedAssetCount() {
      return (int) sourceCounts.values().stream().filter(SourceCounts::hasTerminal).count();
    }

    private List<MetricTestResult> testResults() {
      return List.copyOf(testResults);
    }

    private Long latestRunTime() {
      return latestRunTime;
    }
  }

  private static final class SourceCounts {
    private final EntityReference asset;
    private int activeTests;
    private int passed;
    private int failed;
    private int aborted;
    private Long latestRun;

    private SourceCounts(EntityReference asset) {
      this.asset = asset;
    }

    private boolean hasTerminal() {
      return passed + failed + aborted > 0;
    }

    private MetricAssetRollup toRollup() {
      int terminal = passed + failed + aborted;
      Double score = terminal == 0 ? null : (passed / (double) terminal) * 100.0;
      return new MetricAssetRollup()
          .withAsset(asset)
          .withScore(score)
          .withHealth(healthFor(score))
          .withTotal(terminal)
          .withPassed(passed)
          .withFailed(failed)
          .withAborted(aborted)
          .withLatestRunTime(latestRun)
          .withRedacted(false);
    }
  }

  private static final class StatusCounter {
    private int passed;
    private int failed;
    private int aborted;

    private void add(TestCaseStatus status) {
      if (TestCaseStatus.Success.equals(status)) {
        passed++;
      } else if (TestCaseStatus.Failed.equals(status)) {
        failed++;
      } else if (TestCaseStatus.Aborted.equals(status)) {
        aborted++;
      }
    }

    private MetricDimensionRollup toDimension(String dimension) {
      int total = passed + failed + aborted;
      double score = total == 0 ? 0.0 : (passed / (double) total) * 100.0;
      return new MetricDimensionRollup()
          .withDimension(dimension)
          .withTotal(total)
          .withPassed(passed)
          .withFailed(failed)
          .withAborted(aborted)
          .withScore(score);
    }
  }

  private static Long max(Long left, Long right) {
    Long result = left;
    if (right != null && (left == null || right > left)) {
      result = right;
    }
    return result;
  }
}
