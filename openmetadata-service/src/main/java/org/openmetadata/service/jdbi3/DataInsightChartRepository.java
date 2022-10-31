package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.RangeQueryBuilder;
import org.elasticsearch.search.aggregations.AbstractAggregationBuilder;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramAggregationBuilder;
import org.elasticsearch.search.aggregations.bucket.histogram.DateHistogramInterval;
import org.elasticsearch.search.aggregations.bucket.terms.TermsAggregationBuilder;
import org.elasticsearch.search.aggregations.metrics.SumAggregationBuilder;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

public class DataInsightChartRepository extends EntityRepository<DataInsightChart> {
  public static final String COLLECTION_PATH = "/v1/dataInsight";
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";
  private static final String DATA_ENTITY_TYPE = "data.entityType";
  private static final String TIMESTAMP = "timestamp";
  private static final String ENTITY_COUNT = "entityCount";
  private static final String DATA_ENTITY_COUNT = "data.entityCount";
  private static final String ENTITY_TYPE = "entityType";
  private static final String COMPLETED_DESCRIPTION_FRACTION = "completedDescriptionFraction";
  private static final String DATA_COMPLETED_DESCRIPTIONS = "data.completedDescriptions";
  private static final String HAS_OWNER_FRACTION = "hasOwnerFraction";
  private static final String DATA_HAS_OWNER = "data.hasOwner";
  private static final String ENTITY_TIER = "entityTier";
  private static final String DATA_ENTITY_TIER = "data.entityTier";
  private static final String DATA_TEAM = "data.team";

  public DataInsightChartRepository(CollectionDAO dao) {
    super(
        COLLECTION_PATH,
        DATA_INSIGHT_CHART,
        DataInsightChart.class,
        dao.dataInsightChartDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public DataInsightChart setFields(DataInsightChart entity, EntityUtil.Fields fields) throws IOException {
    entity.setOwner(fields.contains(Entity.FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(DataInsightChart entity) throws IOException {
    setFullyQualifiedName(entity);
  }

  @Override
  public void storeEntity(DataInsightChart entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity.getId(), entity, update);
    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(DataInsightChart entity) throws IOException {
    storeOwner(entity, entity.getOwner());
  }

  public SearchSourceBuilder buildQueryFilter(Long startTs, Long endTs, String tier, String team) {

    SearchSourceBuilder searchSourceBuilder = new SearchSourceBuilder();
    BoolQueryBuilder searchQueryFiler = new BoolQueryBuilder();

    if (team != null) {
      List<String> teamArray = new ArrayList<String>(Arrays.asList(team));

      BoolQueryBuilder teamQueryFilter = QueryBuilders.boolQuery();
      teamQueryFilter.should(QueryBuilders.termsQuery(DATA_TEAM, teamArray));
      searchQueryFiler.must(teamQueryFilter);
    }

    if (tier != null) {
      List<String> tierArray = new ArrayList<String>(Arrays.asList(tier));

      BoolQueryBuilder tierQueryFilter = QueryBuilders.boolQuery();
      tierQueryFilter.should(QueryBuilders.termsQuery(DATA_ENTITY_TIER, tierArray));
      searchQueryFiler.must(tierQueryFilter);
    }

    RangeQueryBuilder dateQueryFilter = QueryBuilders.rangeQuery(TIMESTAMP).gte(startTs).lte(endTs);

    searchQueryFiler.must(dateQueryFilter);
    return searchSourceBuilder.query(searchQueryFiler).fetchSource(false);
  }

  public AbstractAggregationBuilder buildQueryAggregation(
      DataInsightChartResult.DataInsightChartType dataInsightChartName) throws IllegalArgumentException {
    DateHistogramAggregationBuilder dateHistogramAggregationBuilder =
        AggregationBuilders.dateHistogram(TIMESTAMP).field(TIMESTAMP).calendarInterval(DateHistogramInterval.DAY);

    TermsAggregationBuilder termsAggregationBuilder;
    SumAggregationBuilder sumAggregationBuilder;
    SumAggregationBuilder sumEntityCountAggregationBuilder =
        AggregationBuilders.sum(ENTITY_COUNT).field(DATA_ENTITY_COUNT);

    switch (dataInsightChartName) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE);
        sumAggregationBuilder =
            AggregationBuilders.sum(COMPLETED_DESCRIPTION_FRACTION).field(DATA_COMPLETED_DESCRIPTIONS);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE);
        sumAggregationBuilder = AggregationBuilders.sum(HAS_OWNER_FRACTION).field(DATA_HAS_OWNER);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder
                .subAggregation(sumAggregationBuilder)
                .subAggregation(sumEntityCountAggregationBuilder));
      case TOTAL_ENTITIES_BY_TIER:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TIER).field(DATA_ENTITY_TIER);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumEntityCountAggregationBuilder));
      case TOTAL_ENTITIES_BY_TYPE:
        termsAggregationBuilder = AggregationBuilders.terms(ENTITY_TYPE).field(DATA_ENTITY_TYPE);
        return dateHistogramAggregationBuilder.subAggregation(
            termsAggregationBuilder.subAggregation(sumEntityCountAggregationBuilder));
      default:
        throw new IllegalArgumentException(String.format("Invalid dataInsightChartType name %s", dataInsightChartName));
    }
  }
}
