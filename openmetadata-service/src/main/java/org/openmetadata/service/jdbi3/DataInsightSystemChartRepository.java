package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CUSTOM_CHART;

import java.io.IOException;
import java.text.ParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.util.EntityUtil;
import org.springframework.expression.Expression;

public class DataInsightSystemChartRepository extends EntityRepository<DataInsightCustomChart> {
  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights/system/charts";
  private static final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
  public static final String TIMESTAMP_FIELD = "@timestamp";

  public static final String DI_SEARCH_INDEX = "di-data-assets";

  public static final String FORMULA_FUNC_REGEX =
      "\\b(count|sum|min|max|avg)+\\(k='([^']*)',?\\s*(q='([^']*)')?\\)?";

  public static final String NUMERIC_VALIDATION_REGEX = "[\\d\\.+-\\/\\*\\(\\)\s]+";

  public DataInsightSystemChartRepository() {
    super(
        COLLECTION_PATH,
        DATA_INSIGHT_CUSTOM_CHART,
        DataInsightCustomChart.class,
        Entity.getCollectionDAO().dataInsightCustomChartDAO(),
        "",
        "");
  }

  @Override
  public void setFields(DataInsightCustomChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(DataInsightCustomChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(DataInsightCustomChart entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(DataInsightCustomChart entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DataInsightCustomChart entity) {
    // No relationships to store beyond what is stored in the super class
  }

  public DataInsightCustomChartResultList getPreviewData(
      DataInsightCustomChart chart, long startTimestamp, long endTimestamp) throws IOException {
    return searchClient.buildDIChart(chart, startTimestamp, endTimestamp);
  }
}
