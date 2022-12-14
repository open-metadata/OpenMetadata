package org.openmetadata.service.elasticsearch.indexresolver;

import org.openmetadata.service.elasticsearch.ElasticSearchIndexResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PostConstruct;

public class DefaultElasticSearchIndexResolver implements ElasticSearchIndexResolver {
  private static final Logger LOGGER = LoggerFactory.getLogger(DefaultElasticSearchIndexResolver.class);

  @PostConstruct
  public void onConstruct() {
    LOGGER.info("Using DefaultElasticSearchIndexResolver");
  }

  @Override
  public IndexInfo indexInfo(IndexType type) {
    switch (type) {
      case TABLE_SEARCH_INDEX:
        return new IndexInfo("table_search_index", "/elasticsearch/table_index_mapping.json");
      case TOPIC_SEARCH_INDEX:
        return new IndexInfo("topic_search_index", "/elasticsearch/topic_index_mapping.json");
      case DASHBOARD_SEARCH_INDEX:
        return new IndexInfo("dashboard_search_index", "/elasticsearch/dashboard_index_mapping.json");
      case PIPELINE_SEARCH_INDEX:
        return new IndexInfo("pipeline_search_index", "/elasticsearch/pipeline_index_mapping.json");
      case USER_SEARCH_INDEX:
        return new IndexInfo("user_search_index", "/elasticsearch/user_index_mapping.json");
      case TEAM_SEARCH_INDEX:
        return new IndexInfo("team_search_index", "/elasticsearch/team_index_mapping.json");
      case GLOSSARY_SEARCH_INDEX:
        return new IndexInfo("glossary_search_index", "/elasticsearch/glossary_index_mapping.json");
      case MLMODEL_SEARCH_INDEX:
        return new IndexInfo("mlmodel_search_index", "/elasticsearch/mlmodel_index_mapping.json");
      case TAG_SEARCH_INDEX:
        return new IndexInfo("tag_search_index", "/elasticsearch/tag_index_mapping.json");
      default:
        throw new IllegalArgumentException("No such IndexType:" + type);
    }
  }
}
