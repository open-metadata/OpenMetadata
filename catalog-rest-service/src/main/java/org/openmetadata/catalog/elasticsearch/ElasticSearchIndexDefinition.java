package org.openmetadata.catalog.elasticsearch;

import java.io.IOException;
import java.io.InputStream;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public  final class ElasticSearchIndexDefinition {

  private ElasticSearchIndexDefinition() {
  }

  public enum ElasticSearchIndexType {
    TABLE_SEARCH_INDEX("table_search_index", "elasticsearch/table_index_mapping.json"),
    TOPIC_SEARCH_INDEX("topic_search_index", "elasticsearch/topic_index_mapping.json"),
    DASHBOARD_SEARCH_INDEX("dashboard_search_index", "elasticsearch/dashboard_index_mapping.json"),
    PIPELINE_SEARCH_INDEX("pipeline_search_index", "elasticsearch/pipeline_index_mapping.json"),
    DBT_MODEL_SEARCH_INDEX("dbt_model_search_index", "elasticsearch/dbt_index_mapping.json");

    public final String indexName;
    public final String indexMappingFile;

    ElasticSearchIndexType(String indexName, String indexMappingFile) {
      this.indexName = indexName;
      this.indexMappingFile = indexMappingFile;
    }
  }

  public static String getIndexMapping(ElasticSearchIndexType elasticSearchIndexType)
      throws URISyntaxException, IOException {
    URL resource = ElasticSearchIndexDefinition.class
        .getClassLoader().getResource(elasticSearchIndexType.indexMappingFile);
    Path path = Paths.get(resource.toURI());
    return new String(Files.readAllBytes(path));
  }

}
