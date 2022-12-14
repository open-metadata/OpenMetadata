package org.openmetadata.service.elasticsearch;

import java.lang.reflect.InvocationTargetException;
import lombok.AllArgsConstructor;
import lombok.Data;
import org.elasticsearch.index.query.QueryStringQueryBuilder;

public interface ElasticSearchIndexResolver {
  IndexInfo indexInfo(IndexType type);
  default QueryStringQueryBuilder customizeQuery(QueryStringQueryBuilder builder) {
    return builder;
  }

  static ElasticSearchIndexResolver fromClassName(String name) {
    try {
      Class<?> clazz = Class.forName(name);
      return (ElasticSearchIndexResolver) clazz.getDeclaredConstructor().newInstance();
    } catch (ClassNotFoundException e) {
      throw new IllegalStateException("The target ElasticSearchIndexResolver class not found.", e);
    } catch (InvocationTargetException | InstantiationException | IllegalAccessException | NoSuchMethodException e) {
      throw new IllegalStateException("Could not instantiate a class: " + name, e);
    }
  }

  @Data
  @AllArgsConstructor
  class IndexInfo {
    private String indexName;
    private String mappingFilePath;
  }

  enum IndexType {
    TABLE_SEARCH_INDEX,
    TOPIC_SEARCH_INDEX,
    DASHBOARD_SEARCH_INDEX,
    PIPELINE_SEARCH_INDEX,
    USER_SEARCH_INDEX,
    TEAM_SEARCH_INDEX,
    GLOSSARY_SEARCH_INDEX,
    MLMODEL_SEARCH_INDEX,
    TAG_SEARCH_INDEX,
    ENTITY_REPORT_DATA_INDEX,
    WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX,
    WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX;
  }
}
