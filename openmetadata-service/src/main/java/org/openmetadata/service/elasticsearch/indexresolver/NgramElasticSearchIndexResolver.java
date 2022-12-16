package org.openmetadata.service.elasticsearch.indexresolver;

import org.elasticsearch.index.query.MultiMatchQueryBuilder;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class NgramElasticSearchIndexResolver extends DefaultElasticSearchIndexResolver {
  private static final Logger LOGGER = LoggerFactory.getLogger(NgramElasticSearchIndexResolver.class);

  @Override
  public String customizeQueryString(String query) {
    // Convert query string like '*Word*' to '(Word OR *Word*)' for Ngram-search,
    // because wildcard query doesn't work correctly for ngram-index but ngram-search
    // runs always partial-matching-search which logically is same with '*Word*',
    // so we should use 'Word' instead of '*Word*' for ngram index.
    // For other fields we must use '*Word*', so '(Word OR *Word*)' is most desirable.
    String q = query;
    if (q.startsWith("*") && q.length() > 1) {
      q = q.substring(1);
    }
    if (q.endsWith("*") && q.length() > 1) {
      q = q.substring(0, q.length() - 1);
    }
    if (q.equals(query)) {
      return query;
    } else {
      return "(" + q + " OR " + query + ")";
    }
  }

  @Override
  public QueryStringQueryBuilder customizeQuery(QueryStringQueryBuilder builder) {
    return builder.type(MultiMatchQueryBuilder.Type.PHRASE);
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
      default:
        throw new IllegalArgumentException("No such IndexType:" + type);
    }
  }
}
