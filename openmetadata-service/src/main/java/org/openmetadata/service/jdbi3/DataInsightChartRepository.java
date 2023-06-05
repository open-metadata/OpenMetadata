package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.service.util.EntityUtil;

public class DataInsightChartRepository extends EntityRepository<DataInsightChart> {
  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights/charts";
  public static final String LAST_SESSION = "lastSession";
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";
  public static final String DATA_ENTITY_TYPE = "data.entityType";
  public static final String TIMESTAMP = "timestamp";
  public static final String ENTITY_COUNT = "entityCount";
  public static final String DATA_ENTITY_COUNT = "data.entityCount";
  public static final String ENTITY_TYPE = "entityType";
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
  public static final List<String> SUPPORTS_TEAM_FILTER =
      Arrays.asList(
          "TotalEntitiesByType",
          "TotalEntitiesByTier",
          "PercentageOfEntitiesWithDescriptionByType",
          "PercentageOfEntitiesWithOwnerByType",
          "DailyActiveUsers",
          "MostActiveUsers");

  public static final List<String> SUPPORTS_TIER_FILTER =
      Arrays.asList(
          "TotalEntitiesByType",
          "TotalEntitiesByTier",
          "PercentageOfEntitiesWithDescriptionByType",
          "PercentageOfEntitiesWithOwnerByType",
          "PageViewsByEntities",
          "MostViewedEntities");

  public DataInsightChartRepository(CollectionDAO dao) {
    super(
        COLLECTION_PATH,
        DATA_INSIGHT_CHART,
        DataInsightChart.class,
        dao.dataInsightChartDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS,
        null);
  }

  @Override
  public DataInsightChart setFields(DataInsightChart entity, EntityUtil.Fields fields) {
    return entity;
  }

  @Override
  public void prepare(DataInsightChart entity) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(DataInsightChart entity, boolean update) throws IOException {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataInsightChart entity) {
    storeOwner(entity, entity.getOwner());
  }

  /* public SearchRequest buildSearchRequest(
        Long startTs,
        Long endTs,
        String tier,
        String team,
        DataInsightChartResult.DataInsightChartType dataInsightChartName,
        String dataReportIndex) {
      SearchSourceBuilder searchSourceBuilder =
          buildQueryFilter(startTs, endTs, tier, team, dataInsightChartName.value());
      AggregationBuilder aggregationBuilder = buildQueryAggregation(dataInsightChartName);
      searchSourceBuilder.aggregation(aggregationBuilder);
      searchSourceBuilder.timeout(new TimeValue(30, TimeUnit.SECONDS));

      SearchRequest searchRequest = new SearchRequest(dataReportIndex);
      searchRequest.source(searchSourceBuilder);
      return searchRequest;
    }

    public DataInsightChartResult processDataInsightChartResult(
        SearchResponse searchResponse, DataInsightChartResult.DataInsightChartType dataInsightChartName)
        throws ParseException {
      DataInsightAggregatorInterface processor =
          DataInsightAggregatorFactory.createDataAggregator(searchResponse.getAggregations(), dataInsightChartName);
      return processor.process();
    }
  */
  /*public SearchSourceBuilder buildQueryFilter(
      Long startTs, Long endTs, String tier, String team, String dataInsightChartName) {

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder searchQueryFiler = new BoolQueryBuilder();

    if (team != null && SUPPORTS_TEAM_FILTER.contains(dataInsightChartName)) {
      List<String> teamArray = Arrays.asList(team.split("\\s*,\\s*"));

      BoolQueryBuilder teamQueryFilter = QueryBuilders.boolQuery();
      teamQueryFilter.should(QueryBuilders.termsQuery(DATA_TEAM, teamArray));
      searchQueryFiler.must(teamQueryFilter);
    }

    if (tier != null && SUPPORTS_TIER_FILTER.contains(dataInsightChartName)) {
      List<String> tierArray = Arrays.asList(tier.split("\\s*,\\s*"));

      BoolQueryBuilder tierQueryFilter = QueryBuilders.boolQuery();
      tierQueryFilter.should(QueryBuilders.termsQuery(DATA_ENTITY_TIER, tierArray));
      searchQueryFiler.must(tierQueryFilter);
    }

    RangeQueryBuilder dateQueryFilter = QueryBuilders.rangeQuery(TIMESTAMP).gte(startTs).lte(endTs);

    searchQueryFiler.must(dateQueryFilter);
    return searchSourceBuilder.query(searchQueryFiler).fetchSource(false);
  }

  public AggregationBuilder buildQueryAggregation(DataInsightChartResult.DataInsightChartType dataInsightChartName)
      throws IllegalArgumentException {
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram(TIMESTAMP).field(TIMESTAMP).calendarInterval(DateHistogramInterval.DAY);

    TermsAggregationBuilder termsAggregationBuilder;
    SumAggregationBuilder sumAggregationBuilder;
    SumAggregationBuilder sumEntityCountAggregationBuilder =
        AggregationBuilders.sum(ENTITY_COUNT).field(DATA_ENTITY_COUNT);

    switch (dataInsightChartName) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE).size(1000);
        sumAggregationBuilder =
            AggregationBuilders.sum(COMPLETED_DESCRIPTION_FRACTION).field(DATA_COMPLETED_DESCRIPTIONS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE).size(1000);
        sumAggregationBuilder = AggregationBuilders.sum(HAS_OWNER_FRACTION).field(DATA_HAS_OWNER);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case TOTAL_ENTITIES_BY_TIER:
        termsAggregationBuilder =
            AggregationBuilders.terms(ENTITY_TIER).field(DATA_ENTITY_TIER).missing("NoTier").size(1000);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumEntityCountAggregationBuilder));
      case TOTAL_ENTITIES_BY_TYPE:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE).size(1000);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumEntityCountAggregationBuilder));
      case DAILY_ACTIVE_USERS:
        return dateHistogramAggregationBuilder;
      case PAGE_VIEWS_BY_ENTITIES:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE).size(1000);
        SumAggregationBuilder sumPageViewsByEntityTypes = AggregationBuilders.sum(PAGE_VIEWS).field(DATA_VIEWS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumPageViewsByEntityTypes));
      case MOST_VIEWED_ENTITIES:
        termsAggregationBuilder =
            AggregationBuilders.terms(ENTITY_FQN)
                .field(DATA_ENTITY_FQN)
                .size(10)
                .order(BucketOrder.aggregation(PAGE_VIEWS, false));

        TermsAggregationBuilder ownerTermsAggregationBuilder = AggregationBuilders.terms(OWNER).field(DATA_OWNER);
        TermsAggregationBuilder entityTypeTermsAggregationBuilder =
            AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE);
        TermsAggregationBuilder entityHrefAggregationBuilder =
            AggregationBuilders.terms(ENTITY_HREF).field(DATA_ENTITY_HREF);
        SumAggregationBuilder sumEntityPageViewsAggregationBuilder =
            AggregationBuilders.sum(PAGE_VIEWS).field(DATA_VIEWS);

        return termsAggregationBuilder
            .subAggregation(sumEntityPageViewsAggregationBuilder)
            .subAggregation(ownerTermsAggregationBuilder)
            .subAggregation(entityTypeTermsAggregationBuilder)
            .subAggregation(entityHrefAggregationBuilder);
      case MOST_ACTIVE_USERS:
        termsAggregationBuilder =
            AggregationBuilders.terms(USER_NAME)
                .field(DATA_USER_NAME)
                .size(10)
                .order(BucketOrder.aggregation(SESSIONS, false));
        TermsAggregationBuilder teamTermsAggregationBuilder = AggregationBuilders.terms(TEAM).field(DATA_TEAM);
        SumAggregationBuilder sumSessionAggregationBuilder = AggregationBuilders.sum(SESSIONS).field(DATA_SESSIONS);
        SumAggregationBuilder sumUserPageViewsAggregationBuilder =
            AggregationBuilders.sum(PAGE_VIEWS).field(DATA_PAGE_VIEWS);
        MaxAggregationBuilder lastSessionAggregationBuilder =
            AggregationBuilders.max(LAST_SESSION).field(DATA_LAST_SESSION);
        SumAggregationBuilder sumSessionDurationAggregationBuilder =
            AggregationBuilders.sum(SESSION_DURATION).field(DATA_TOTAL_SESSION_DURATION);
        return termsAggregationBuilder
            .subAggregation(sumSessionAggregationBuilder)
            .subAggregation(sumUserPageViewsAggregationBuilder)
            .subAggregation(lastSessionAggregationBuilder)
            .subAggregation(sumSessionDurationAggregationBuilder)
            .subAggregation(teamTermsAggregationBuilder);
      default:
        throw new IllegalArgumentException(String.format("Invalid dataInsightChartType name %s", dataInsightChartName));
    }
  }*/
}
