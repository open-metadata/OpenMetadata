package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;

import java.util.Arrays;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

public class DataInsightChartRepository extends EntityRepository<DataInsightChart> {

  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights/charts";
  public static final String LAST_SESSION = "lastSession";
  public static final String DATA_ENTITY_TYPE = "data.entityType";
  public static final String TIMESTAMP = "timestamp";
  public static final String ENTITY_COUNT = "entityCount";
  public static final String DATA_ENTITY_COUNT = "data.entityCount";
  public static final String ENTITY_TYPE = "entityType";
  public static final String SERVICE_NAME = "serviceName";
  public static final String DATA_SERVICE_NAME = "data.serviceName";
  public static final String COMPLETED_DESCRIPTION_FRACTION = "completedDescriptionFraction";
  public static final String DATA_COMPLETED_DESCRIPTIONS = "data.completedDescriptions";
  public static final String HAS_OWNER_FRACTION = "hasOwnerFraction";
  public static final String DATA_HAS_OWNER = "data.hasOwner";
  public static final String ENTITY_TIER = "entityTier";
  public static final String DATA_ENTITY_TIER = "data.entityTier";
  public static final String DATA_TEAM = "data.team";
  public static final String DATA_USER_NAME = "data.userName";
  public static final String DATA_PAGE_VIEWS = "data.totalPageView";
  public static final String DATA_SESSIONS = "data.totalSessions";
  public static final String SESSIONS = "sessions";
  public static final String PAGE_VIEWS = "pageViews";
  public static final String DATA_LAST_SESSION = "data.lastSession";
  public static final String SESSION_DURATION = "sessionDuration";
  public static final String DATA_TOTAL_SESSION_DURATION = "data.totalSessionDuration";
  public static final String DATA_VIEWS = "data.views";
  public static final String ENTITY_FQN = "entityFqn";
  public static final String DATA_ENTITY_FQN = "data.entityFqn";
  public static final String OWNER = "owner";
  public static final String DATA_OWNER = "data.owner";
  public static final String USER_NAME = "userName";
  public static final String TEAM = "team";
  public static final String ENTITY_HREF = "entityHref";
  public static final String DATA_ENTITY_HREF = "data.entityHref";
  public static final List<String> SUPPORTS_TEAM_FILTER = Arrays.asList(
    "TotalEntitiesByType",
    "TotalEntitiesByTier",
    "PercentageOfEntitiesWithDescriptionByType",
    "PercentageOfEntitiesWithOwnerByType",
    "DailyActiveUsers",
    "MostActiveUsers"
  );

  public static final List<String> SUPPORTS_TIER_FILTER = Arrays.asList(
    "TotalEntitiesByType",
    "TotalEntitiesByTier",
    "PercentageOfEntitiesWithDescriptionByType",
    "PercentageOfEntitiesWithOwnerByType",
    "PageViewsByEntities",
    "MostViewedEntities"
  );

  public static final List<String> SUPPORTS_NULL_DATE_RANGE = listOf(
    DataInsightChartResult.DataInsightChartType.UNUSED_ASSETS.toString()
  );

  public DataInsightChartRepository() {
    super(
      COLLECTION_PATH,
      DATA_INSIGHT_CHART,
      DataInsightChart.class,
      Entity.getCollectionDAO().dataInsightChartDAO(),
      "",
      ""
    );
  }

  @Override
  public void setFields(DataInsightChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(DataInsightChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(DataInsightChart entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(DataInsightChart entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataInsightChart entity) {
    // No relationships to store beyond what is stored in the super class
  }
}
