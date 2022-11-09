package org.openmetadata.service.dataInsight;

import org.elasticsearch.search.aggregations.Aggregations;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;

public class DataInsightAggregatorFactory {

  public DataInsightAggregatorFactory() {}

  public static DataInsightAggregatorInterface createDataAggregator(
      Aggregations aggregations, DataInsightChartResult.DataInsightChartType dataInsightChartType)
      throws IllegalArgumentException {
    switch (dataInsightChartType) {
      case PERCENTAGE_OF_ENTITIES_WITH_DESCRIPTION_BY_TYPE:
        return new EntitiesDescriptionAggregator(aggregations, dataInsightChartType);
      case PERCENTAGE_OF_ENTITIES_WITH_OWNER_BY_TYPE:
        return new EntitiesOwnerAggregator(aggregations, dataInsightChartType);
      case TOTAL_ENTITIES_BY_TYPE:
        return new TotalEntitiesAggregator(aggregations, dataInsightChartType);
      case TOTAL_ENTITIES_BY_TIER:
        return new TotalEntitiesByTierAggregator(aggregations, dataInsightChartType);
      case DAILY_ACTIVE_USERS:
        return new DailyActiveUsersAggregator(aggregations, dataInsightChartType);
      case PAGE_VIEWS_BY_ENTITIES:
        return new PageViewsByEntitiesAggregator(aggregations, dataInsightChartType);
      case MOST_ACTIVE_USERS:
        return new MostActiveUsersAggregator(aggregations, dataInsightChartType);
      case MOST_VIEWED_ENTITIES:
        return new MostViewedEntitiesAggregator(aggregations, dataInsightChartType);
      default:
        throw new IllegalArgumentException(
            String.format("No processor found for chart Type %s ", dataInsightChartType));
    }
  }
}
