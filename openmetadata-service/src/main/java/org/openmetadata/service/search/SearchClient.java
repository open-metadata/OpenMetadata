package org.openmetadata.service.search;

import java.io.IOException;
import java.text.ParseException;
import java.util.List;
import java.util.TreeMap;
import javax.ws.rs.core.Response;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;

public interface SearchClient<T, I, O, M> {
  boolean createIndex(ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang);

  void updateIndex(ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType, String lang);

  void deleteIndex(ElasticSearchIndexDefinition.ElasticSearchIndexType elasticSearchIndexType);

  String entityBuilder(
      String query,
      int from,
      int size,
      String queryFilter,
      String postFilter,
      boolean fetchSource,
      boolean trackTotalHits,
      String sortFieldParam,
      boolean deleted,
      String index,
      Object sortOrder,
      List<String> includeSourceFields)
      throws IOException;

  Response aggregate(String index, String fieldName) throws IOException;

  Response suggest(
      String fieldName,
      String query,
      int size,
      String deleted,
      boolean fetchSource,
      List<String> includeSourceFields,
      String index)
      throws IOException;

  String getSearchType();

  void updateEntity(ChangeEvent event) throws IOException;

  void updateUser(ChangeEvent event) throws IOException;

  void updateTeam(ChangeEvent event) throws IOException;

  void updateGlossaryTerm(ChangeEvent event) throws IOException;

  void updateGlossary(ChangeEvent event) throws IOException;

  void updateTag(ChangeEvent event) throws IOException;

  void updateDatabase(ChangeEvent event) throws IOException;

  void updateDatabaseSchema(ChangeEvent event) throws IOException;

  void updateDatabaseService(ChangeEvent event) throws IOException;

  void updatePipelineService(ChangeEvent event) throws IOException;

  void updateMlModelService(ChangeEvent event) throws IOException;

  void updateStorageService(ChangeEvent event) throws IOException;

  void updateMessagingService(ChangeEvent event) throws IOException;

  void updateDashboardService(ChangeEvent event) throws IOException;

  void updateClassification(ChangeEvent event) throws IOException;

  void close();

  I bulk(O data, M options) throws IOException;

  int getSuccessFromBulkResponse(I response);

  TreeMap<Long, List<Object>> getSortedDate(
      String team,
      Long scheduleTime,
      Long currentTime,
      DataInsightChartResult.DataInsightChartType chartType,
      String indexName)
      throws IOException, ParseException;

  Response listDataInsightChartResult(
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      String dataReportIndex)
      throws IOException, ParseException;
}
