package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSummary;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentPipeline;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.SnapshotMaterializer;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionResolver;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionedWindow;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class DataInsightsEntityEnricherProcessor
    implements Processor<List<Map<String, Object>>, ResultList<? extends EntityInterface>> {

  private final StepStats stats = new StepStats();
  private static final Set<String> NON_TIER_ENTITIES = Set.of("tag", "glossaryTerm", "dataProduct");

  // Step name constants — also used as the key under which each step's StepStats is exposed via
  // {@link #getEntityStats()} and merged into the workflow-level stats.
  static final String STEP_IDENTITY = "identity";
  static final String STEP_DESCRIPTION_SOURCES = "descriptionSources";
  static final String STEP_TAG_TIER_SOURCES = "tagAndTierSources";
  static final String STEP_TEAM = "team";
  static final String STEP_TIER = "tier";
  static final String STEP_DESCRIPTION_STATS = "descriptionStats";
  static final String STEP_CUSTOM_PROPERTIES = "customProperties";

  /**
   * Step pipeline: each entity-version's enrichment runs through this list once. A step that
   * throws produces no fields on that version's snapshot, but sibling steps still run and the
   * entity is still emitted to the index. See {@link EnrichmentPipeline} for the failure-isolation
   * contract.
   */
  private final EnrichmentPipeline pipeline = buildPipeline();

  private final VersionResolver versionResolver = new VersionResolver();
  private final SnapshotMaterializer snapshotMaterializer = new SnapshotMaterializer();

  public DataInsightsEntityEnricherProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  private EnrichmentPipeline buildPipeline() {
    return new EnrichmentPipeline(
        List.of(
            step(STEP_IDENTITY, this::applyIdentityStep),
            step(STEP_DESCRIPTION_SOURCES, this::applyDescriptionSourcesStep),
            step(STEP_TAG_TIER_SOURCES, this::applyTagAndTierSourcesStep),
            step(STEP_TEAM, this::applyTeamStep),
            step(STEP_TIER, this::applyTierStep),
            step(STEP_DESCRIPTION_STATS, this::applyDescriptionStatsStep),
            step(STEP_CUSTOM_PROPERTIES, this::applyCustomPropertiesStep)));
  }

  private static EnrichmentStep step(String name, Consumer<EnrichmentTarget> body) {
    return new EnrichmentStep() {
      @Override
      public String name() {
        return name;
      }

      @Override
      public void apply(EnrichmentTarget target) {
        body.accept(target);
      }
    };
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
      LOG.debug(
          "[DataInsightsEntityEnricherProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
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
      LOG.debug(
          "[DataInsightsEntityEnricherProcessor] Single entity enrichment failed. Details: {}",
          JsonUtils.pojoToJson(error));
      updateStats(0, 1);
      throw new SearchIndexException(error);
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
   * Runs the enrichment pipeline against a prepared target. Package-private for direct unit
   * testing (see {@code DataInsightsEntityEnricherProcessorTest}), which can construct synthetic
   * {@link EnrichmentTarget}s without needing to mock the version-resolver path.
   */
  void enrichEntity(EnrichmentTarget target) {
    pipeline.run(target);
  }

  // ─────────────────────────────── Step implementations ───────────────────────────────
  // Each method below is the body of one EnrichmentStep registered in buildPipeline(). They
  // mutate target.entityMap() additively and never read each other's output.

  private void applyIdentityStep(EnrichmentTarget target) {
    target.entityMap().put(ENTITY_TYPE_KEY, target.context().entityType());
    // Per-version window timestamps live on the VersionedWindow and are read directly by the
    // SnapshotMaterializer; they are intentionally NOT put on the entityMap. Pre-Stage-2 they
    // were briefly written here only to be removed again by the day-fanout — clearer to skip
    // the round-trip. The final daily snapshot has @timestamp set by the materializer.
  }

  private void applyDescriptionSourcesStep(EnrichmentTarget target) {
    target
        .entityMap()
        .put(
            "descriptionSources",
            SearchIndexUtils.processDescriptionSources(target.entity(), target.changeSummary()));
  }

  private void applyTagAndTierSourcesStep(EnrichmentTarget target) {
    SearchIndexUtils.TagAndTierSources tagAndTierSources =
        SearchIndexUtils.processTagAndTierSources(target.entity());
    target.entityMap().put("tagSources", tagAndTierSources.getTagSources());
    target.entityMap().put("tierSources", tagAndTierSources.getTierSources());
  }

  private void applyTeamStep(EnrichmentTarget target) {
    String team = processTeam(target.entity());
    if (team != null) {
      target.entityMap().put("team", team);
    }
  }

  private void applyTierStep(EnrichmentTarget target) {
    String tier = processTier(target.entity());
    if (tier != null) {
      target.entityMap().put("tier", tier);
    }
  }

  private void applyDescriptionStatsStep(EnrichmentTarget target) {
    EntityInterface entity = target.entity();
    Map<String, Object> entityMap = target.entityMap();
    entityMap.put("hasDescription", CommonUtil.nullOrEmpty(entity.getDescription()) ? 0 : 1);
    if (!SearchIndexUtils.hasColumns(entity)) {
      return;
    }
    ColumnsEntityInterface columnsEntity = (ColumnsEntityInterface) entity;
    int totalColumns = columnsEntity.getColumns().size();
    int columnsWithDescription =
        columnsEntity.getColumns().stream()
            .map(column -> CommonUtil.nullOrEmpty(column.getDescription()) ? 0 : 1)
            .reduce(0, Integer::sum);
    entityMap.put("numberOfColumns", totalColumns);
    entityMap.put("numberOfColumnsWithDescription", columnsWithDescription);
    entityMap.put("hasColumnDescription", columnsWithDescription == totalColumns ? 1 : 0);
  }

  private void applyCustomPropertiesStep(EnrichmentTarget target) {
    Object customProperties = target.entityMap().get("extension");
    if (customProperties != null) {
      target
          .entityMap()
          .put(String.format("%sCustomProperty", target.context().entityType()), customProperties);
    }
  }

  /**
   * Removes the recursive {@code children} subtree from every top-level column entry in the
   * serialized entity map. The DI data stream uses dynamic field mapping, and deeply nested
   * STRUCT/UNION column types can expand into hundreds of unique field paths per document,
   * pushing the index past OpenSearch's {@code index.mapping.total_fields.limit} of 1000.
   * Top-level column metadata (name, type, description, etc.) is preserved.
   */
  @SuppressWarnings("unchecked")
  private static void stripNestedColumnChildren(Map<String, Object> entityMap) {
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

  private String processTeam(EntityInterface entity) {
    Optional<List<EntityReference>> oEntityOwners = Optional.ofNullable(entity.getOwners());
    if (oEntityOwners.isEmpty() || oEntityOwners.get().isEmpty()) {
      return null;
    }
    EntityReference entityOwner = oEntityOwners.get().get(0);
    if (Entity.TEAM.equals(entityOwner.getType())) {
      return entityOwner.getName();
    }
    // Historical version rows from entity_extension carry owners as bare {id, type}
    // refs with no fullyQualifiedName — only the latest version returned by
    // listVersionsWithOffset is hydrated. Resolve by id instead of by FQN so the
    // lookup works on both shapes; the id is always present.
    if (entityOwner.getId() == null) {
      return null;
    }
    try {
      User owner = Entity.getEntity(Entity.USER, entityOwner.getId(), "teams", Include.ALL);
      if (owner != null && owner.getTeams() != null && !owner.getTeams().isEmpty()) {
        return owner.getTeams().get(0).getName();
      }
    } catch (EntityNotFoundException ex) {
      // Owner deleted — we can't infer the team for this historical snapshot.
      LOG.debug(
          "Owner {} for {} '{}' version '{}' not found.",
          entityOwner.getId(),
          Entity.getEntityTypeFromObject(entity),
          entity.getFullyQualifiedName(),
          entity.getVersion());
    } catch (Exception ex) {
      // Defensive: a per-version team-resolution failure must not drop the
      // entity's snapshots. Better to emit a snapshot without `team` than lose
      // every day's record for this entity.
      LOG.warn(
          "Failed to resolve team for owner {} of {} '{}' version '{}': {}",
          entityOwner.getId(),
          Entity.getEntityTypeFromObject(entity),
          entity.getFullyQualifiedName(),
          entity.getVersion(),
          ex.toString());
    }
    return null;
  }

  private String processTier(EntityInterface entity) {
    String tier = null;

    if (!NON_TIER_ENTITIES.contains(Entity.getEntityTypeFromObject(entity))) {
      tier = "NoTier";
    }

    Optional<List<TagLabel>> oEntityTags = Optional.ofNullable(entity.getTags());

    if (oEntityTags.isPresent()) {
      Optional<String> oEntityTier =
          getEntityTier(oEntityTags.get().stream().map(TagLabel::getTagFQN).toList());
      if (oEntityTier.isPresent()) {
        tier = oEntityTier.get();
      }
    }
    return tier;
  }

  private Optional<String> getEntityTier(List<String> entityTags) {
    Optional<String> entityTier = Optional.empty();

    List<String> tierTags = entityTags.stream().filter(tag -> tag.startsWith("Tier")).toList();

    // We can directly get the first element if the list is not empty since there can only be ONE
    // Tier tag.
    if (!tierTags.isEmpty()) {
      entityTier = Optional.of(tierTags.get(0));
    }

    return entityTier;
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
