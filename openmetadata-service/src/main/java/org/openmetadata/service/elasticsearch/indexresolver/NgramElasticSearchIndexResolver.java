package org.openmetadata.service.elasticsearch.indexresolver;

public class NgramElasticSearchIndexResolver extends DefaultElasticSearchIndexResolver {
  @Override
  public IndexInfo indexInfo(IndexType type) {
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
