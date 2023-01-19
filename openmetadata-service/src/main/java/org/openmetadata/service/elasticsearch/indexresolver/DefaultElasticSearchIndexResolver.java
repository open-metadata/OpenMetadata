package org.openmetadata.service.elasticsearch.indexresolver;

import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DefaultElasticSearchIndexResolver implements ElasticSearchIndexResolver {
  private static final Logger LOGGER = LoggerFactory.getLogger(DefaultElasticSearchIndexResolver.class);

  private final Map<IndexType, String> typeIndexNameMap =
      Map.ofEntries(
          Map.entry(IndexType.TABLE_SEARCH_INDEX, "table_search_index"),
          Map.entry(IndexType.TOPIC_SEARCH_INDEX, "topic_search_index"),
          Map.entry(IndexType.DASHBOARD_SEARCH_INDEX, "dashboard_search_index"),
          Map.entry(IndexType.PIPELINE_SEARCH_INDEX, "pipeline_search_index"),
          Map.entry(IndexType.USER_SEARCH_INDEX, "user_search_index"),
          Map.entry(IndexType.TEAM_SEARCH_INDEX, "team_search_index"),
          Map.entry(IndexType.GLOSSARY_SEARCH_INDEX, "glossary_search_index"),
          Map.entry(IndexType.MLMODEL_SEARCH_INDEX, "mlmodel_search_index"),
          Map.entry(IndexType.TAG_SEARCH_INDEX, "tag_search_index"),
          Map.entry(IndexType.ENTITY_REPORT_DATA_INDEX, "entity_report_data_index"),
          Map.entry(IndexType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX, "web_analytic_entity_view_report_data_index"),
          Map.entry(
              IndexType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX, "web_analytic_user_activity_report_data_index"));

  private final Map<String, IndexType> indexNameTypeMap =
      typeIndexNameMap.entrySet().stream()
          .collect(Collectors.toMap(Map.Entry::getValue, Map.Entry::getKey, (oldValue, newValue) -> oldValue));

  @Override
  public Optional<IndexType> findTypeFromIndexName(String indexName) {
    return Optional.ofNullable(indexNameTypeMap.get(indexName));
  }

  @Override
  public IndexInfo indexInfo(IndexType type) {
    LOGGER.debug("Using DefaultElasticSearchIndexResolver");

    String indexName =
        Optional.ofNullable(typeIndexNameMap.get(type))
            .orElseThrow(() -> new IllegalArgumentException("No index name found for:" + type));

    switch (type) {
      case TABLE_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/table_index_mapping.json");
      case TOPIC_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/topic_index_mapping.json");
      case DASHBOARD_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/dashboard_index_mapping.json");
      case PIPELINE_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/pipeline_index_mapping.json");
      case USER_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/user_index_mapping.json");
      case TEAM_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/team_index_mapping.json");
      case GLOSSARY_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/glossary_index_mapping.json");
      case MLMODEL_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/mlmodel_index_mapping.json");
      case TAG_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/tag_index_mapping.json");
      case ENTITY_REPORT_DATA_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/entity_report_data_index.json");
      case WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/web_analytic_entity_view_report_data_index.json");
      case WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/default/web_analytic_user_activity_report_data_index.json");
      default:
        throw new IllegalArgumentException("No such IndexType:" + type);
    }
  }
}
