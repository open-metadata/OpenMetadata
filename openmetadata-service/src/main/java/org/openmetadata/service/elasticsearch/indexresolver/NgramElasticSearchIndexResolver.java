package org.openmetadata.service.elasticsearch.indexresolver;

import org.elasticsearch.index.query.MultiMatchQueryBuilder;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.search.fetch.subphase.highlight.HighlightBuilder;
import org.jetbrains.annotations.Nullable;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class NgramElasticSearchIndexResolver extends DefaultElasticSearchIndexResolver {
  private static final Logger LOGGER = LoggerFactory.getLogger(NgramElasticSearchIndexResolver.class);

  private static final ThreadLocal<QueryStringQueryBuilder> CURRENT_QUERY = new ThreadLocal<>();

  @Override
  public QueryStringQueryBuilder customizeQuery(
      @Nullable ElasticSearchIndexResolver.IndexType indexType, QueryStringQueryBuilder builder) {
    QueryStringQueryBuilder customizedQuery = builder.type(MultiMatchQueryBuilder.Type.PHRASE);

    if (indexType == IndexType.TABLE_SEARCH_INDEX) {
      // cache current query_string query into thread_local variable.
      // it is used in 'customizeHighlight' method.
      CURRENT_QUERY.set(customizedQuery);
    }

    return customizedQuery;
  }

  @Override
  public HighlightBuilder customizeHighlight(
      @Nullable ElasticSearchIndexResolver.IndexType indexType, HighlightBuilder builder) {
    QueryStringQueryBuilder currentQueryBuilder = CURRENT_QUERY.get();
    if (currentQueryBuilder != null && indexType == IndexType.TABLE_SEARCH_INDEX) {

      // TABLE_SEARCH_INDEX uses function_score query. function_score query on NGRAM index breaks highlights,
      // so that we add highlight_query on each field in highlights.
      // With highlight_query, all highlight information are rebuild from the highlight_query.
      // the query used for highligh_query must be same with the query used in function_score query.
      // the latest query used for function_score is cached into CURRENT_QUERY thread-local variable
      // by previous call of 'customizeQuery' method.
      return builder.highlightQuery(currentQueryBuilder);
    } else {
      return super.customizeHighlight(indexType, builder);
    }
  }

  @Override
  public IndexInfo indexInfo(IndexType type) {
    LOGGER.debug("Using NgramElasticSearchIndexResolver");
    IndexInfo indexInfo = super.indexInfo(type);
    String indexName = indexInfo.getIndexName();

    switch (type) {
      case TABLE_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/table_index_mapping.json");
      case TOPIC_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/topic_index_mapping.json");
      case DASHBOARD_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/dashboard_index_mapping.json");
      case PIPELINE_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/pipeline_index_mapping.json");
      case USER_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/user_index_mapping.json");
      case TEAM_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/team_index_mapping.json");
      case GLOSSARY_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/glossary_index_mapping.json");
      case MLMODEL_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/mlmodel_index_mapping.json");
      case TAG_SEARCH_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/tag_index_mapping.json");
      case ENTITY_REPORT_DATA_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/entity_report_data_index.json");
      case WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/web_analytic_entity_view_report_data_index.json");
      case WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA_INDEX:
        return new IndexInfo(indexName, "/elasticsearch/ngram/web_analytic_user_activity_report_data_index.json");
      default:
        throw new IllegalArgumentException("No such IndexType:" + type);
    }
  }
}
