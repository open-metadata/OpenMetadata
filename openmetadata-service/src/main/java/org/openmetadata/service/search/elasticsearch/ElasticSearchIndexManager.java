package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.elasticsearch.indices.DeleteIndexRequest;
import es.co.elastic.clients.elasticsearch.indices.DeleteIndexResponse;
import es.co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import es.co.elastic.clients.elasticsearch.indices.ExistsRequest;
import es.co.elastic.clients.elasticsearch.indices.PutMappingRequest;
import es.co.elastic.clients.elasticsearch.indices.UpdateAliasesRequest;
import es.co.elastic.clients.elasticsearch.indices.UpdateAliasesResponse;
import es.co.elastic.clients.transport.endpoints.BooleanResponse;
import java.io.IOException;
import java.io.StringReader;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient;

/**
 * ElasticSearch implementation of index management operations.
 * This class handles all index-related operations for ElasticSearch.
 */
@Slf4j
public class ElasticSearchIndexManager implements IndexManagementClient {
  private final ElasticsearchClient client;
  private final String clusterAlias;
  private final boolean isClientAvailable;

  public ElasticSearchIndexManager(ElasticsearchClient client, String clusterAlias) {
    this.client = client;
    this.clusterAlias = clusterAlias != null ? clusterAlias : "";
    this.isClientAvailable = client != null;
  }

  @Override
  public boolean indexExists(String indexName) {
    if (!isClientAvailable) {
      return false;
    }
    try {
      ElasticsearchIndicesClient indicesClient = client.indices();
      ExistsRequest request = ExistsRequest.of(e -> e.index(indexName));
      BooleanResponse response = indicesClient.exists(request);
      LOG.info("index {} exist: {}", indexName, response.value());
      return response.value();
    } catch (IOException e) {
      LOG.error("Failed to check if index {} exists", indexName, e);
      return false;
    }
  }

  @Override
  public void createIndex(IndexMapping indexMapping, String indexMappingContent) {
    if (isClientAvailable) {
      try {
        String indexName = indexMapping.getIndexName(clusterAlias);

        CreateIndexRequest request =
            CreateIndexRequest.of(
                builder -> {
                  builder.index(indexName);
                  if (indexMappingContent != null) {
                    builder.withJson(new StringReader(indexMappingContent));
                  }
                  return builder;
                });

        client.indices().create(request);

        LOG.info("Successfully created index: {}", indexName);
        createAliases(indexMapping);

      } catch (Exception e) {
        LOG.error(
            "Failed to create index for {} due to", indexMapping.getIndexName(clusterAlias), e);
      }
    } else {
      LOG.error(
          "Failed to create Elasticsearch index: client is not properly configured. Check your OpenMetadata configuration.");
    }
  }

  @Override
  public void updateIndex(IndexMapping indexMapping, String indexMappingContent) {
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);

      PutMappingRequest request =
          PutMappingRequest.of(
              builder -> {
                builder.index(indexName);
                if (indexMappingContent != null) {
                  builder.withJson(new StringReader(indexMappingContent));
                }
                return builder;
              });

      client.indices().putMapping(request);
      LOG.info("Successfully updated mapping for index: {}", indexName);

    } catch (Exception e) {
      LOG.warn(
          "Failed to update Elasticsearch index {} due to",
          indexMapping.getIndexName(clusterAlias),
          e);
    }
  }

  @Override
  public void deleteIndex(IndexMapping indexMapping) {
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);

      es.co.elastic.clients.elasticsearch.indices.DeleteIndexRequest request =
          DeleteIndexRequest.of(b -> b.index(indexName));
      DeleteIndexResponse response = client.indices().delete(request);

      LOG.debug("{} Deleted: {}", indexName, response.acknowledged());
    } catch (Exception e) {
      LOG.error(
          "Failed to delete Elasticsearch index: {}", indexMapping.getIndexName(clusterAlias), e);
    }
  }

  @Override
  public void createAliases(IndexMapping indexMapping) {
    try {
      Set<String> aliases = new HashSet<>(indexMapping.getParentAliases(clusterAlias));
      aliases.add(indexMapping.getAlias(clusterAlias));
      addIndexAlias(indexMapping, aliases.toArray(new String[0]));
    } catch (Exception e) {
      LOG.error("Failed to create aliases for {} due to", indexMapping.getAlias(clusterAlias), e);
    }
  }

  @Override
  public void addIndexAlias(IndexMapping indexMapping, String... aliasNames) {
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);

      // Build the request
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              u -> {
                for (String alias : aliasNames) {
                  u.actions(a -> a.add(add -> add.index(indexName).alias(alias)));
                }
                return u;
              });

      UpdateAliasesResponse response = client.indices().updateAliases(request);

      if (response.acknowledged()) {
        LOG.info("Aliases {} added to index {}", Arrays.toString(aliasNames), indexName);
      } else {
        LOG.warn("Alias update for index {} was not acknowledged", indexName);
      }

    } catch (Exception e) {
      LOG.error("Failed to create alias for {} due to", indexMapping.getAlias(clusterAlias), e);
    }
  }
}
