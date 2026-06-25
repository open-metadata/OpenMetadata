package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import com.google.common.annotations.VisibleForTesting;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentPipeline;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.OwnerResolver;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.SnapshotMaterializer;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionResolver;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionedWindow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.CustomPropertiesStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.DescriptionSourcesStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.DescriptionStatsStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.EntityStatusStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.IdentityProjectionStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.OwnerTeamStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.TagAndTierSourcesStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps.TierStep;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class DataInsightsEntityEnricherProcessor
    implements Processor<List<Map<String, Object>>, ResultList<? extends EntityInterface>> {

  /**
   * Cap on {@code LOG.warn} samples per processor lifetime for entity-level failures (i.e.
   * exceptions that escape the version resolver and lose the whole entity). Step-level failures
   * are rate-limited separately inside {@link EnrichmentPipeline}.
   */
  private static final int MAX_ENTITY_LOSS_WARN_SAMPLES = 10;

  private final StepStats stats = new StepStats();
  private final AtomicInteger entityLossWarnCount = new AtomicInteger();

  /**
   * Workflow-scoped owner→team resolver with a bounded Caffeine cache. Shared by the {@link
   * OwnerTeamStep}; one instance per processor (which is one per workflow run), so the cache
   * lifetime matches the workflow's lifetime.
   */
  private final OwnerResolver ownerResolver = new OwnerResolver();

  /**
   * Step pipeline: each entity-version's enrichment runs through this list once. A step that
   * throws produces no fields on that version's snapshot, but sibling steps still run and the
   * entity is still emitted to the index. See {@link EnrichmentPipeline} for the failure-isolation
   * contract.
   *
   * <p>Ordering is not load-bearing for correctness — no step reads keys written by sibling
   * steps (every step reads from {@link EnrichmentTarget#entity()},
   * {@link EnrichmentTarget#changeSummary()}, or {@link EnrichmentTarget#context()}). If a future
   * step starts consuming another step's contribution, re-check ordering at that point.
   */
  private final EnrichmentPipeline pipeline =
      new EnrichmentPipeline(
          List.of(
              new IdentityProjectionStep(),
              new EntityStatusStep(),
              new DescriptionSourcesStep(),
              new TagAndTierSourcesStep(),
              new OwnerTeamStep(ownerResolver),
              new TierStep(),
              new DescriptionStatsStep(),
              new CustomPropertiesStep()));

  private final VersionResolver versionResolver = new VersionResolver();
  private final SnapshotMaterializer snapshotMaterializer = new SnapshotMaterializer();

  public DataInsightsEntityEnricherProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  /**
   * Per-step {@link StepStats} accumulated by the pipeline across this processor's lifetime. The
   * workflow merges these into its aggregate workflow stats so operators can attribute failures to
   * a specific enrichment concern.
   */
  public Map<String, StepStats> getEntityStats() {
    return pipeline.snapshotStats();
  }

  @Override
  public List<Map<String, Object>> process(
      ResultList<? extends EntityInterface> input, Map<String, Object> contextData)
      throws SearchIndexException {
    try {
      EnrichmentContext context = buildAndValidateContext(contextData);
      List<Map<String, Object>> enrichedMaps =
          input.getData().stream()
              .flatMap(entity -> enrichEntityToSnapshots(entity, context).stream())
              .toList();
      updateStats(input.getData().size(), 0);
      return enrichedMaps;
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.getData().size())
              .withFailedCount(input.getData().size())
              .withSuccessCount(0)
              .withMessage(
                  String.format("Entities Enricher Encountered Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      logEntityLossRateLimited(null, e);
      updateStats(0, input.getData().size());
      throw new SearchIndexException(error);
    }
  }

  public List<Map<String, Object>> enrichSingle(
      EntityInterface entity, Map<String, Object> contextData) throws SearchIndexException {
    try {
      EnrichmentContext context = buildAndValidateContext(contextData);
      return enrichEntityToSnapshots(entity, context);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(1)
              .withFailedCount(1)
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Entity Enricher Encountered Failure for entity '%s': %s",
                      entity.getFullyQualifiedName(), e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      logEntityLossRateLimited(entity.getFullyQualifiedName(), e);
      updateStats(0, 1);
      throw new SearchIndexException(error);
    }
  }

  /**
   * Rate-limited {@code LOG.warn} for entity-level losses — exceptions that escape version
   * resolution / target construction and lose every snapshot for the entity. Capped to the first
   * {@link #MAX_ENTITY_LOSS_WARN_SAMPLES} per processor lifetime to avoid log floods on
   * degenerate runs (matching the per-step rate-limit pattern in {@link EnrichmentPipeline}).
   * The full {@link IndexingError} with stack trace is still attached to the thrown {@link
   * SearchIndexException} and recorded in the workflow's failure context regardless.
   */
  private void logEntityLossRateLimited(String entityFqn, Throwable cause) {
    int n = entityLossWarnCount.incrementAndGet();
    if (n > MAX_ENTITY_LOSS_WARN_SAMPLES) {
      return;
    }
    String suffix =
        n == MAX_ENTITY_LOSS_WARN_SAMPLES ? " (further samples suppressed this run)" : "";
    if (entityFqn != null) {
      LOG.warn(
          "[DataInsights enricher] entity='{}' lost: {}{}", entityFqn, cause.toString(), suffix);
    } else {
      LOG.warn("[DataInsights enricher] batch lost: {}{}", cause.toString(), suffix);
    }
  }

  private EnrichmentContext buildAndValidateContext(Map<String, Object> contextData) {
    EnrichmentContext context = EnrichmentContext.from(contextData);
    if (CommonUtil.nullOrEmpty(context.entityType())) {
      throw new IllegalArgumentException(
          "[EsEntitiesProcessor] entityType cannot be null or empty.");
    }
    return context;
  }

  /**
   * Per-entity orchestration: resolve version windows → enrich each → fan out across days. One
   * entity in, N daily snapshots out. The only way to lose the entity entirely is if version
   * resolution itself throws — step failures only drop their own fields, not the entity (see
   * {@link EnrichmentPipeline}).
   */
  private List<Map<String, Object>> enrichEntityToSnapshots(
      EntityInterface entity, EnrichmentContext context) {
    List<Map<String, Object>> snapshots = new ArrayList<>();
    for (VersionedWindow window : versionResolver.resolve(entity, context)) {
      EnrichmentTarget target = buildTarget(window, context);
      enrichEntity(target);
      snapshots.addAll(snapshotMaterializer.materialize(window, target.entityMap()));
    }
    return snapshots;
  }

  private EnrichmentTarget buildTarget(VersionedWindow window, EnrichmentContext context) {
    EntityInterface entity = window.entity();
    Map<String, Object> entityMap = JsonUtils.getMap(entity);
    entityMap.keySet().retainAll(context.entityTypeFields());
    stripNestedColumnChildren(entityMap);
    Map<String, ChangeSummary> changeSummary = SearchIndexUtils.getChangeSummaryMap(entity);
    return new EnrichmentTarget(
        entity,
        entityMap,
        changeSummary,
        window.windowStartTimestamp(),
        window.windowEndTimestamp(),
        context,
        window.shape());
  }

  /**
   * Runs the enrichment pipeline against a prepared target. Only the in-class orchestrator (
   * {@link #enrichEntityToSnapshots}) and the package-local test should call this — it exists as a
   * seam to let the test exercise the wired-up pipeline on synthetic {@link EnrichmentTarget}s
   * without going through the version-resolver path.
   */
  @VisibleForTesting
  void enrichEntity(EnrichmentTarget target) {
    pipeline.run(target);
  }

  /**
   * Removes the recursive {@code children} subtree from every top-level column entry in the
   * serialized entity map. The DI data stream uses dynamic field mapping, and deeply nested
   * STRUCT/UNION column types can expand into hundreds of unique field paths per document,
   * pushing the index past OpenSearch's {@code index.mapping.total_fields.limit} of 1000.
   * Top-level column metadata (name, type, description, etc.) is preserved.
   *
   * <p>Static + package-private so existing reflection-based tests continue to exercise it
   * directly; the {@code buildTarget} method calls it on every target before pipeline run.
   */
  @SuppressWarnings("unchecked")
  static void stripNestedColumnChildren(Map<String, Object> entityMap) {
    Object columns = entityMap.get("columns");
    if (!(columns instanceof List<?> columnList)) {
      return;
    }
    for (Object column : columnList) {
      if (column instanceof Map<?, ?> columnMap) {
        ((Map<String, Object>) columnMap).remove("children");
      }
    }
  }

  @Override
  public synchronized void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
