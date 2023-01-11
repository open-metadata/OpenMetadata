package org.openmetadata.service.elasticsearch.indexresolver;

import org.openmetadata.service.elasticsearch.ElasticSearchIndexResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DefaultElasticSearchIndexResolver implements ElasticSearchIndexResolver {
  private static final Logger LOGGER = LoggerFactory.getLogger(DefaultElasticSearchIndexResolver.class);

  @Override
  public IndexInfo indexInfo(IndexType type) {
    LOGGER.debug("Using DefaultElasticSearchIndexResolver");
    switch (type) {
      case TABLE_SEARCH_INDEX:
        return new IndexInfo("table_search_index", "/elasticsearch/default/table_index_mapping.json");
      case TOPIC_SEARCH_INDEX:
        return new IndexInfo("topic_search_index", "/elasticsearch/default/topic_index_mapping.json");
      case DASHBOARD_SEARCH_INDEX:
        return new IndexInfo("dashboard_search_index", "/elasticsearch/default/dashboard_index_mapping.json");
      case PIPELINE_SEARCH_INDEX:
        return new IndexInfo("pipeline_search_index", "/elasticsearch/default/pipeline_index_mapping.json");
      case USER_SEARCH_INDEX:
        return new IndexInfo("user_search_index", "/elasticsearch/default/user_index_mapping.json");
      case TEAM_SEARCH_INDEX:
        return new IndexInfo("team_search_index", "/elasticsearch/default/team_index_mapping.json");
      case GLOSSARY_SEARCH_INDEX:
        return new IndexInfo("glossary_search_index", "/elasticsearch/default/glossary_index_mapping.json");
      case MLMODEL_SEARCH_INDEX:
        return new IndexInfo("mlmodel_search_index", "/elasticsearch/default/mlmodel_index_mapping.json");
      case TAG_SEARCH_INDEX:
        return new IndexInfo("tag_search_index", "/elasticsearch/default/tag_index_mapping.json");
      case ENTITY_REPORT_DATA_INDEX:
        return new IndexInfo("entity_report_data_index", "/elasticsearch/default/entity_report_data_index.json");
      case WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX:
        return new IndexInfo(
            "web_analytic_entity_view_report_data_index",
            "/elasticsearch/default/web_analytic_entity_view_report_data_index.json");
      case WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX:
        return new IndexInfo(
            "web_analytic_user_activity_report_data_index",
            "/elasticsearch/default/web_analytic_user_activity_report_data_index.json");
      default:
        throw new IllegalArgumentException("No such IndexType:" + type);
    }
  }
}
