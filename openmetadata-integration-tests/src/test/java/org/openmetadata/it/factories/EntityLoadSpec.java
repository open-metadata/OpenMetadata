package org.openmetadata.it.factories;

import java.util.EnumMap;
import java.util.Map;

/**
 * Declarative spec for how many entities of each type {@link EntityLoader} should create.
 *
 * <p>Tests own the absolute counts (typically as {@code private static final int} constants
 * in the test class) so a single line change scales the load up or down. {@link EntityLoader}
 * just executes whatever the spec asks for.
 */
public record EntityLoadSpec(
    int parallelWorkers,
    Map<EntityKind, Integer> counts,
    int columnsPerTable,
    int chartsPerDashboard,
    int endpointsPerCollection,
    int columnsPerDataModel,
    int testCasesPerSuite,
    int resultsPerTestCase) {

  /**
   * Entity types {@link EntityLoader} can create. Mirrors {@code perf-test.sh}'s coverage so
   * Java UIITs and the bash perf script can drive equivalent loads. Order is not significant;
   * actual dispatch order honours prerequisites (services before children, glossaries before
   * terms, tables before testCases, etc.).
   */
  public enum EntityKind {
    // Asset entities (each has its own search index)
    TABLE,
    TOPIC,
    DASHBOARD,
    PIPELINE,
    CHART,
    ML_MODEL,
    CONTAINER,
    SEARCH_INDEX,
    API_COLLECTION,
    API_ENDPOINT,
    STORED_PROCEDURE,
    QUERY,
    DASHBOARD_DATA_MODEL,
    // Taxonomy
    GLOSSARY,
    GLOSSARY_TERM,
    CLASSIFICATION,
    TAG,
    // Org
    USER,
    TEAM,
    // Governance
    DOMAIN,
    DATA_PRODUCT,
    // Quality
    TEST_SUITE,
    TEST_CASE,
    // Graph
    LINEAGE_EDGE,
    // Time-series telemetry
    TEST_CASE_RESULT,
    ENTITY_REPORT_DATA,
    WEB_ANALYTIC_VIEW,
    WEB_ANALYTIC_ACTIVITY,
    RAW_COST_ANALYSIS,
    AGG_COST_ANALYSIS
  }

  public int countOf(EntityKind kind) {
    return counts.getOrDefault(kind, 0);
  }

  public int total() {
    return counts.values().stream().mapToInt(Integer::intValue).sum();
  }

  public static Builder builder() {
    return new Builder();
  }

  public static final class Builder {
    private int parallelWorkers = 16;
    private int columnsPerTable = 5;
    private int chartsPerDashboard = 3;
    private int endpointsPerCollection = 3;
    private int columnsPerDataModel = 5;
    private int testCasesPerSuite = 3;
    private int resultsPerTestCase = 5;
    private final Map<EntityKind, Integer> counts = new EnumMap<>(EntityKind.class);

    public Builder parallelWorkers(int n) {
      this.parallelWorkers = n;
      return this;
    }

    public Builder columnsPerTable(int n) {
      this.columnsPerTable = n;
      return this;
    }

    public Builder chartsPerDashboard(int n) {
      this.chartsPerDashboard = n;
      return this;
    }

    public Builder endpointsPerCollection(int n) {
      this.endpointsPerCollection = n;
      return this;
    }

    public Builder columnsPerDataModel(int n) {
      this.columnsPerDataModel = n;
      return this;
    }

    public Builder testCasesPerSuite(int n) {
      this.testCasesPerSuite = n;
      return this;
    }

    public Builder resultsPerTestCase(int n) {
      this.resultsPerTestCase = n;
      return this;
    }

    public Builder count(EntityKind kind, int n) {
      this.counts.put(kind, n);
      return this;
    }

    public EntityLoadSpec build() {
      return new EntityLoadSpec(
          parallelWorkers,
          Map.copyOf(counts),
          columnsPerTable,
          chartsPerDashboard,
          endpointsPerCollection,
          columnsPerDataModel,
          testCasesPerSuite,
          resultsPerTestCase);
    }
  }
}
