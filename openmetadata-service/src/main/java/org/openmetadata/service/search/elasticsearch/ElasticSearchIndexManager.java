package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import es.co.elastic.clients.elasticsearch.indices.DeleteIndexRequest;
import es.co.elastic.clients.elasticsearch.indices.DeleteIndexResponse;
import es.co.elastic.clients.elasticsearch.indices.ElasticsearchIndicesClient;
import es.co.elastic.clients.elasticsearch.indices.ExistsRequest;
import es.co.elastic.clients.elasticsearch.indices.GetAliasRequest;
import es.co.elastic.clients.elasticsearch.indices.GetAliasResponse;
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
      LOG.error("ElasticSearch client is not available. Cannot check index exists.");
      return false;
    }
    try {
      ElasticsearchIndicesClient indicesClient = client.indices();
      ExistsRequest request = ExistsRequest.of(e -> e.index(indexName));
      BooleanResponse response = indicesClient.exists(request);
      LOG.info("index {} exist: {}", indexName, response.value());
      return response.value();
    } catch (Exception e) {
      LOG.error("Failed to check if index {} exists", indexName, e);
      return false;
    }
  }

  @Override
  public void createIndex(IndexMapping indexMapping, String indexMappingContent) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot create index.");
      return;
    }
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);
      createIndexInternal(indexName, indexMappingContent);
      createAliases(indexMapping);
    } catch (Exception e) {
      LOG.error("Failed to create index {} due to", indexMapping.getIndexName(clusterAlias), e);
    }
  }

  @Override
  public void updateIndex(IndexMapping indexMapping, String indexMappingContent) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot update index.");
      return;
    }
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
      LOG.error(
          "Failed to update Elasticsearch index {} due to",
          indexMapping.getIndexName(clusterAlias),
          e);
    }
  }

  @Override
  public void deleteIndex(IndexMapping indexMapping) {
    String indexName = indexMapping.getIndexName(clusterAlias);
    deleteIndexInternal(indexName);
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
    String indexName = indexMapping.getIndexName(clusterAlias);
    Set<String> aliasSet = new HashSet<>(Arrays.asList(aliasNames));
    addAliasesInternal(indexName, aliasSet);
  }

  @Override
  public void createIndex(String indexName, String indexMappingContent) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot create index.");
      return;
    }
    try {
      createIndexInternal(indexName, indexMappingContent);
    } catch (Exception e) {
      LOG.error("Failed to create index {} due to", indexName, e);
    }
  }

  private void createIndexInternal(String indexName, String indexMappingContent)
      throws IOException {
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
  }

  @Override
  public void deleteIndex(String indexName) {
    deleteIndexInternal(indexName);
  }

  private void deleteIndexInternal(String indexName) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot delete index.");
      return;
    }
    try {
      DeleteIndexRequest request = DeleteIndexRequest.of(builder -> builder.index(indexName));
      DeleteIndexResponse response = client.indices().delete(request);

      if (response.acknowledged()) {
        LOG.info("Successfully deleted index: {}", indexName);
      } else {
        LOG.warn("Index deletion for {} was not acknowledged", indexName);
      }
    } catch (Exception e) {
      LOG.error("Failed to delete index {} due to", indexName, e);
    }
  }

  @Override
  public void addAliases(String indexName, Set<String> aliases) {
    addAliasesInternal(indexName, aliases);
  }

  private void addAliasesInternal(String indexName, Set<String> aliases) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot add aliases.");
      return;
    }
    if (aliases == null || aliases.isEmpty()) {
      return;
    }
    try {
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              u -> {
                for (String alias : aliases) {
                  u.actions(a -> a.add(add -> add.index(indexName).alias(alias)));
                }
                return u;
              });

      UpdateAliasesResponse response = client.indices().updateAliases(request);

      if (response.acknowledged()) {
        LOG.info("Aliases {} added to index {}", aliases, indexName);
      } else {
        LOG.warn("Alias update for index {} was not acknowledged", indexName);
      }
    } catch (Exception e) {
      LOG.error("Failed to add aliases {} to index {} due to", aliases, indexName, e);
    }
  }

  @Override
  public void removeAliases(String indexName, Set<String> aliases) {
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot remove aliases.");
      return;
    }
    if (aliases == null || aliases.isEmpty()) {
      return;
    }
    try {
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              u -> {
                for (String alias : aliases) {
                  u.actions(a -> a.remove(remove -> remove.index(indexName).alias(alias)));
                }
                return u;
              });

      UpdateAliasesResponse response = client.indices().updateAliases(request);

      if (response.acknowledged()) {
        LOG.info("Aliases {} removed from index {}", aliases, indexName);
      } else {
        LOG.warn("Alias removal for index {} was not acknowledged", indexName);
      }
    } catch (Exception e) {
      LOG.error("Failed to remove aliases {} from index {} due to", aliases, indexName, e);
    }
  }

  @Override
  public Set<String> getAliases(String indexName) {
    Set<String> aliases = new HashSet<>();
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot get aliases.");
      return aliases;
    }
    try {
      GetAliasRequest request = GetAliasRequest.of(g -> g.index(indexName));
      GetAliasResponse response = client.indices().getAlias(request);

      response
          .result()
          .forEach(
              (index, aliasDetails) -> {
                aliases.addAll(aliasDetails.aliases().keySet());
              });

      LOG.info("Retrieved aliases for index {}: {}", indexName, aliases);
    } catch (Exception e) {
      LOG.error("Failed to get aliases for index {} due to", indexName, e);
    }
    return aliases;
  }

  @Override
  public Set<String> getIndicesByAlias(String aliasName) {
    Set<String> indices = new HashSet<>();
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot get indices by alias.");
      return indices;
    }
    try {
      GetAliasRequest request = GetAliasRequest.of(g -> g.name(aliasName));
      GetAliasResponse response = client.indices().getAlias(request);

      indices.addAll(response.result().keySet());

      LOG.info("Retrieved indices for alias {}: {}", aliasName, indices);
    } catch (Exception e) {
      LOG.error("Failed to get indices for alias {} due to", aliasName, e);
    }
    return indices;
  }

  @Override
  public Set<String> listIndicesByPrefix(String prefix) {
    Set<String> indices = new HashSet<>();
    if (!isClientAvailable) {
      LOG.error("ElasticSearch client is not available. Cannot list indices by prefix.");
      return indices;
    }
    try {
      String pattern = prefix + "*";
      GetAliasRequest request = GetAliasRequest.of(g -> g.index(pattern));
      GetAliasResponse response = client.indices().getAlias(request);

      indices.addAll(response.result().keySet());

      LOG.info("Retrieved {} indices matching prefix '{}': {}", indices.size(), prefix, indices);
    } catch (Exception e) {
      LOG.error("Failed to list indices by prefix {} due to", prefix, e);
    }
    return indices;
  }
}
