package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DI_CHART;

import java.io.IOException;
import java.util.List;
import org.openmetadata.schema.api.dataInsightNew.CreateDIChart;
import org.openmetadata.schema.dataInsightNew.DIChart;
import org.openmetadata.schema.dataInsightNew.DIChartResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.util.EntityUtil;

public class DIChartRepository extends EntityRepository<DIChart> {
  public static final String COLLECTION_PATH = "/v1/analytics/dataInsights_new/charts";
  private static final SearchClient searchClient = Entity.getSearchRepository().getSearchClient();
  public static final String TIMESTAMP_FIELD = "@timestamp";

  public static final String DI_SEARCH_INDEX = "di-data-assets";

  public DIChartRepository() {
    super(COLLECTION_PATH, DI_CHART, DIChart.class, Entity.getCollectionDAO().diChartDAO(), "", "");
  }

  @Override
  public void setFields(DIChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(DIChart entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(DIChart entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(DIChart entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(DIChart entity) {
    // No relationships to store beyond what is stored in the super class
  }

  public DIChartResultList getPreviewData(
      CreateDIChart chart, long startTimestamp, long endTimestamp) throws IOException {
    return searchClient.buildDIChart(chart, startTimestamp, endTimestamp);
  }

  public List<String> getFields() throws IOException {
    return searchClient.fetchDIChartFields();
  }
}
