package org.openmetadata.service.apps.bundles.insights.processors;

import static org.openmetadata.schema.EntityInterface.ENTITY_TYPE_TO_CLASS_MAP;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class DataInsightsEntityEnricherProcessor
    implements Processor<List<Map<String, Object>>, ResultList<? extends EntityInterface>> {

  private final StepStats stats = new StepStats();

  public DataInsightsEntityEnricherProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<Map<String, Object>> process(
      ResultList<? extends EntityInterface> input, Map<String, Object> contextData)
      throws SearchIndexException {
    List<Map<String, Object>> enrichedMaps;
    try {
      enrichedMaps =
          input.getData().stream()
              .map(entity -> getEntityVersions(entity, contextData))
              .flatMap(Collection::stream)
              .map(entityVersionMap -> enrichEntity(entityVersionMap, contextData))
              .map(this::generateDailyEntitySnapshots)
              .flatMap(Collection::stream)
              .toList();
      updateStats(input.getData().size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.getData().size())
              .withFailedCount(input.getData().size())
              .withSuccessCount(0)
              .withMessage(
                  "Entities Processor Encountered Failure. Converting requests to Es Request.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[DataInsightsEntityEnricherProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.getData().size());
      throw new SearchIndexException(error);
    }
    return enrichedMaps;
  }

  private Long getStartOfDayTimestamp(Long timestamp) {
    return (long) ((int) (timestamp / 1000 / 60 / 60 / 24)) * 1000 * 60 * 60 * 24;
  }

  private Long timestampSubtractDays(Long timestamp, int days) {
    return timestamp - 1000L * 60 * 60 * 24 * days;
  }

  private Long timestampPlusOneDay(Long timestamp) {
    return timestamp + 1000 * 60 * 60 * 24;
  }

  private List<Map<String, Object>> getEntityVersions(
      EntityInterface entity, Map<String, Object> contextData) {
    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    Long timestamp = (Long) contextData.get(TIMESTAMP_KEY);
    Long initialTimestamp = (Long) contextData.get("initialTimestamp");
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    EntityHistory entityHistory = entityRepository.listVersions(entity.getId());

    Long pointerTimestamp = timestamp;
    List<Map<String, Object>> entityVersions = new java.util.ArrayList<>();

    for (Object version : entityHistory.getVersions()) {
      EntityInterface versionEntity =
          JsonUtils.readOrConvertValue(
              version, ENTITY_TYPE_TO_CLASS_MAP.get(entityType.toLowerCase()));
      Long versionTimestamp = getStartOfDayTimestamp(versionEntity.getUpdatedAt());
      if (versionTimestamp >= pointerTimestamp) {
        continue;
      } else if (versionTimestamp < initialTimestamp) {
        Map<String, Object> versionMap = new HashMap<>();

        versionMap.put("endTimestamp", pointerTimestamp);
        versionMap.put("startTimestamp", initialTimestamp);
        versionMap.put("versionEntity", versionEntity);

        entityVersions.add(versionMap);
        break;
      } else {
        Map<String, Object> versionMap = new HashMap<>();

        versionMap.put("endTimestamp", pointerTimestamp);
        versionMap.put("startTimestamp", timestampPlusOneDay(versionTimestamp));
        versionMap.put("versionEntity", versionEntity);

        entityVersions.add(versionMap);
        pointerTimestamp = versionTimestamp;
      }
    }
    return entityVersions;
  }

  private Map<String, Object> enrichEntity(
      Map<String, Object> entityVersionMap, Map<String, Object> contextData) {
    EntityInterface entity = (EntityInterface) entityVersionMap.get("versionEntity");
    Long startTimestamp = (Long) entityVersionMap.get("startTimestamp");
    Long endTimestamp = (Long) entityVersionMap.get("endTimestamp");

    Map<String, Object> entityMap = JsonUtils.getMap(entity);
    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    List<Class<?>> interfaces = List.of(entity.getClass().getInterfaces());

    // Enrich with EntityType
    if (CommonUtil.nullOrEmpty(entityType)) {
      throw new IllegalArgumentException(
          "[EsEntitiesProcessor] entityType cannot be null or empty.");
    }

    entityMap.put(ENTITY_TYPE_KEY, entityType);

    // Enrich with Timestamp
    entityMap.put("startTimestamp", startTimestamp);
    entityMap.put("endTimestamp", endTimestamp);

    // Enrich with Description Stats
    if (interfaces.contains(ColumnsEntityInterface.class)) {
      entityMap.put("numberOfColumns", ((ColumnsEntityInterface) entity).getColumns().size());
      entityMap.put(
          "numberOfColumnsWithDescription",
          ((ColumnsEntityInterface) entity)
              .getColumns().stream()
                  .map(column -> CommonUtil.nullOrEmpty(column.getDescription()) ? 0 : 1)
                  .reduce(0, Integer::sum));
      entityMap.put("hasDescription", CommonUtil.nullOrEmpty(entity.getDescription()) ? 0 : 1);
    }

    return entityMap;
  }

  private List<Map<String, Object>> generateDailyEntitySnapshots(
      Map<String, Object> entityVersionMap) {
    Long startTimestamp = (Long) entityVersionMap.remove("startTimestamp");
    Long endTimestamp = (Long) entityVersionMap.remove("endTimestamp");

    List<Map<String, Object>> dailyEntitySnapshots = new java.util.ArrayList<>();

    Long pointerTimestamp = endTimestamp;

    while (pointerTimestamp >= startTimestamp) {
      Map<String, Object> dailyEntitySnapshot = new HashMap<>(entityVersionMap);

      dailyEntitySnapshot.put(TIMESTAMP_KEY, pointerTimestamp);
      dailyEntitySnapshots.add(dailyEntitySnapshot);

      pointerTimestamp = timestampSubtractDays(pointerTimestamp, 1);
    }
    return dailyEntitySnapshots;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
