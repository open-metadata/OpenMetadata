package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.stream.JsonParser;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch._types.mapping.TypeMapping;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.opensearch.indices.CreateIndexResponse;
import os.org.opensearch.client.opensearch.indices.DeleteIndexRequest;
import os.org.opensearch.client.opensearch.indices.DeleteIndexResponse;
import os.org.opensearch.client.opensearch.indices.ExistsRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasResponse;
import os.org.opensearch.client.opensearch.indices.IndexSettings;
import os.org.opensearch.client.opensearch.indices.PutMappingRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesResponse;
import os.org.opensearch.client.opensearch.indices.stats.IndicesStats;
import os.org.opensearch.client.transport.endpoints.BooleanResponse;

/**
 * OpenSearch implementation of index management operations.
 * This class handles all index-related operations for OpenSearch.
 */
@Slf4j
public class OpenSearchIndexManager implements IndexManagementClient {
  private final OpenSearchClient client;
  private final String clusterAlias;
  private final boolean isClientAvailable;

  public OpenSearchIndexManager(OpenSearchClient client, String clusterAlias) {
    this.client = client;
    this.clusterAlias = clusterAlias != null ? clusterAlias : "";
    this.isClientAvailable = client != null;
  }

  @Override
  public boolean indexExists(String indexName) {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot check index exists.");
      return false;
    }
    try {
      BooleanResponse response = client.indices().exists(ExistsRequest.of(e -> e.index(indexName)));
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
      LOG.error("OpenSearch client is not available. Cannot create index.");
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
      LOG.error("OpenSearch client is not available. Cannot update index.");
      return;
    }
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);

      PutMappingRequest request =
          PutMappingRequest.of(
              builder -> {
                builder.index(indexName);
                if (indexMappingContent != null && !indexMappingContent.isEmpty()) {
                  try {
                    // Parse the mapping content to get the mappings section
                    JsonNode rootNode = JsonUtils.readTree(indexMappingContent);
                    JsonNode mappingsNode = rootNode.get("mappings");

                    if (mappingsNode != null && !mappingsNode.isNull()) {
                      // Parse the mappings JSON into TypeMapping
                      TypeMapping typeMapping = parseTypeMapping(mappingsNode);
                      builder.properties(typeMapping.properties());
                    }
                  } catch (Exception e) {
                    LOG.warn("Failed to parse mapping content, skipping mapping update", e);
                  }
                }
                return builder;
              });

      client.indices().putMapping(request);
      LOG.info("Successfully updated mapping for index: {}", indexName);
    } catch (Exception e) {
      LOG.error("Failed to Update Open Search index {}", indexMapping.getIndexName(clusterAlias));
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
      LOG.error(
          "Failed to create aliases for index {} due to",
          indexMapping.getIndexName(clusterAlias),
          e);
    }
  }

  @Override
  public void addIndexAlias(IndexMapping indexMapping, String... aliasNames) {
    String indexName = indexMapping.getIndexName(clusterAlias);
    Set<String> aliasSet = new HashSet<>(Arrays.asList(aliasNames));
    addAliasesInternal(indexName, aliasSet);
  }

  private TypeMapping parseTypeMapping(JsonNode mappingsNode) {
    JsonParser parser =
        client
            ._transport()
            .jsonpMapper()
            .jsonProvider()
            .createParser(new StringReader(mappingsNode.toString()));
    return TypeMapping._DESERIALIZER.deserialize(parser, client._transport().jsonpMapper());
  }

  private IndexSettings parseIndexSettings(JsonNode settingsNode) {
    // Transform Elasticsearch stemmer configuration to OpenSearch format
    JsonNode transformedSettings = OsUtils.transformStemmerForOpenSearch(settingsNode);

    JsonParser parser =
        client
            ._transport()
            .jsonpMapper()
            .jsonProvider()
            .createParser(new StringReader(transformedSettings.toString()));
    return IndexSettings._DESERIALIZER.deserialize(parser, client._transport().jsonpMapper());
  }

  @Override
  public void createIndex(String indexName, String indexMappingContent) {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot create index.");
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
    if (indexMappingContent != null && !indexMappingContent.isEmpty()) {
      // Transform mapping content for OpenSearch compatibility (e.g., flattened -> flat_object)
      String transformedContent = OsUtils.enrichIndexMappingForOpenSearch(indexMappingContent);

      // Parse the mapping content
      JsonNode rootNode = JsonUtils.readTree(transformedContent);
      JsonNode mappingsNode = rootNode.get("mappings");
      JsonNode settingsNode = rootNode.get("settings");

      // Build the request with mappings and settings
      CreateIndexRequest createIndexRequest =
          CreateIndexRequest.of(
              builder -> {
                builder.index(indexName);

                // Add mappings if present
                if (mappingsNode != null && !mappingsNode.isNull()) {
                  try {
                    // Parse the mappings JSON into TypeMapping
                    TypeMapping parseTypeMapping = parseTypeMapping(mappingsNode);
                    builder.mappings(parseTypeMapping);
                  } catch (Exception e) {
                    LOG.warn("Failed to parse mappings, creating index without mappings", e);
                  }
                }

                // Add settings if present
                if (settingsNode != null && !settingsNode.isNull()) {
                  try {
                    IndexSettings settings = parseIndexSettings(settingsNode);
                    builder.settings(settings);
                  } catch (Exception e) {
                    LOG.warn("Failed to parse settings, creating index without settings", e);
                  }
                }

                return builder;
              });

      CreateIndexResponse response = client.indices().create(createIndexRequest);

      LOG.info("{} Created {}", indexName, response.acknowledged());
    } else {
      // Create index without mappings
      CreateIndexRequest createIndexRequest =
          CreateIndexRequest.of(builder -> builder.index(indexName));
      CreateIndexResponse response = client.indices().create(createIndexRequest);

      LOG.info("{} Created without mappings {}", indexName, response.acknowledged());
    }
  }

  @Override
  public void deleteIndex(String indexName) {
    deleteIndexInternal(indexName);
  }

  @Override
  public void deleteIndexWithBackoff(String indexName) {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete index.");
      return;
    }

    int maxRetries = 5;
    long initialDelayMs = 1000; // 1 second
    long maxDelayMs = 60000; // 60 seconds

    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        DeleteIndexRequest request = DeleteIndexRequest.of(builder -> builder.index(indexName));
        DeleteIndexResponse response = client.indices().delete(request);

        if (response.acknowledged()) {
          LOG.info(
              "Successfully deleted index: {} (attempt {}/{})",
              indexName,
              attempt + 1,
              maxRetries + 1);
          return;
        } else {
          LOG.warn(
              "Index deletion for {} was not acknowledged (attempt {}/{})",
              indexName,
              attempt + 1,
              maxRetries + 1);
        }
      } catch (OpenSearchException osEx) {
        // Check if it's a snapshot-related error (status 400 or 503)
        if (osEx.status() == 400 || osEx.status() == 503) {
          if (attempt < maxRetries) {
            long delayMs = Math.min(initialDelayMs * (long) Math.pow(2, attempt), maxDelayMs);
            LOG.warn(
                "Failed to delete index {} due to snapshot or temporary issue (attempt {}/{}). "
                    + "Retrying in {} ms. Error: {}",
                indexName,
                attempt + 1,
                maxRetries + 1,
                delayMs,
                osEx.getMessage());
            try {
              Thread.sleep(delayMs);
            } catch (InterruptedException ie) {
              Thread.currentThread().interrupt();
              LOG.error("Interrupted while waiting to retry index deletion for {}", indexName, ie);
              return;
            }
          } else {
            LOG.error(
                "Failed to delete index {} after {} attempts due to snapshot or temporary issue",
                indexName,
                maxRetries + 1,
                osEx);
            return;
          }
        } else {
          // Non-retryable error
          LOG.error("Failed to delete index {} due to non-retryable error", indexName, osEx);
          return;
        }
      } catch (Exception e) {
        LOG.error("Failed to delete index {} due to unexpected error", indexName, e);
        return;
      }
    }
  }

  private void deleteIndexInternal(String indexName) {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete index.");
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
      LOG.error("OpenSearch client is not available. Cannot add aliases.");
      return;
    }
    if (aliases == null || aliases.isEmpty()) {
      return;
    }
    Set<String> allEntityIndices = listIndicesByPrefix(indexName);
    try {
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              updateBuilder -> {
                allEntityIndices.forEach(
                    actualIndexName -> {
                      for (String alias : aliases) {
                        updateBuilder.actions(
                            actionBuilder ->
                                actionBuilder.add(
                                    addBuilder -> addBuilder.index(actualIndexName).alias(alias)));
                      }
                    });
                return updateBuilder;
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
      LOG.error("OpenSearch client is not available. Cannot remove aliases.");
      return;
    }
    if (aliases == null || aliases.isEmpty()) {
      return;
    }
    try {
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              updateBuilder -> {
                for (String alias : aliases) {
                  updateBuilder.actions(
                      actionBuilder ->
                          actionBuilder.remove(
                              removeBuilder -> removeBuilder.index(indexName).alias(alias)));
                }
                return updateBuilder;
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
  public boolean swapAliases(Set<String> oldIndices, String newIndex, Set<String> aliases) {
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot swap aliases.");
      return false;
    }
    if (aliases == null || aliases.isEmpty()) {
      LOG.debug("No aliases to swap for index {}", newIndex);
      return true;
    }
    if (oldIndices == null) {
      oldIndices = new HashSet<>();
    }

    Set<String> finalOldIndices = oldIndices;
    try {
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              updateBuilder -> {
                // First, remove aliases from all old indices
                for (String oldIndex : finalOldIndices) {
                  for (String alias : aliases) {
                    updateBuilder.actions(
                        actionBuilder ->
                            actionBuilder.remove(
                                removeBuilder -> removeBuilder.index(oldIndex).alias(alias)));
                  }
                }
                // Then, add aliases to the new index
                for (String alias : aliases) {
                  updateBuilder.actions(
                      actionBuilder ->
                          actionBuilder.add(addBuilder -> addBuilder.index(newIndex).alias(alias)));
                }
                return updateBuilder;
              });

      UpdateAliasesResponse response = client.indices().updateAliases(request);

      if (response.acknowledged()) {
        LOG.info(
            "Atomically swapped aliases {} from indices {} to index {}",
            aliases,
            finalOldIndices,
            newIndex);
        return true;
      } else {
        LOG.warn(
            "Alias swap from indices {} to index {} was not acknowledged",
            finalOldIndices,
            newIndex);
        return false;
      }
    } catch (Exception e) {
      LOG.error(
          "Failed to swap aliases {} from indices {} to index {}",
          aliases,
          finalOldIndices,
          newIndex,
          e);
      return false;
    }
  }

  @Override
  public Set<String> getAliases(String indexName) {
    Set<String> aliases = new HashSet<>();
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot get aliases.");
      return aliases;
    }
    try {
      GetAliasRequest request = GetAliasRequest.of(g -> g.index(indexName));
      GetAliasResponse response = client.indices().getAlias(request);

      response
          .result()
          .forEach(
              (index, aliasMetadata) -> {
                aliases.addAll(aliasMetadata.aliases().keySet());
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
      LOG.error("OpenSearch client is not available. Cannot get indices by alias.");
      return indices;
    }
    try {
      boolean isAliasExist = client.indices().existsAlias(b -> b.name(aliasName)).value();
      if (!isAliasExist) {
        LOG.warn("Alias '{}' does not exist. Returning empty index set.", aliasName);
        return indices;
      }

      GetAliasRequest request = GetAliasRequest.of(g -> g.name(aliasName));
      GetAliasResponse response = client.indices().getAlias(request);

      indices.addAll(response.result().keySet());

      LOG.info("Retrieved indices for alias {}: {}", aliasName, indices);
    } catch (OpenSearchException osEx) {
      if (osEx.status() == 404) {
        LOG.warn("Alias '{}' not found (404). Returning empty set.", aliasName);
        return indices;
      }

      // Other errors should not be masked
      LOG.error(
          "Unexpected OpensearchException while getting alias {}: {}",
          aliasName,
          osEx.getMessage(),
          osEx);
    } catch (Exception e) {
      LOG.error("Failed to get indices for alias {} due to", aliasName, e);
    }
    return indices;
  }

  @Override
  public Set<String> listIndicesByPrefix(String prefix) {
    Set<String> indices = new HashSet<>();
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot list indices by prefix.");
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

  @Override
  public List<IndexStats> getAllIndexStats() throws IOException {
    List<IndexStats> result = new ArrayList<>();
    var statsResponse = client.indices().stats(s -> s.index("*"));
    var indices = statsResponse.indices();
    for (var entry : indices.entrySet()) {
      String indexName = entry.getKey();
      if (indexName.startsWith(".")) {
        continue;
      }
      IndicesStats stats = entry.getValue();
      long docs = 0;
      long sizeBytes = 0;
      int primaryShards = 0;
      int replicaShards = 0;
      if (stats.primaries() != null) {
        if (stats.primaries().docs() != null) {
          docs = stats.primaries().docs().count();
        }
        if (stats.primaries().store() != null) {
          sizeBytes = stats.primaries().store().sizeInBytes();
        }
      }
      if (stats.shards() != null) {
        for (var shardEntry : stats.shards().entrySet()) {
          for (var shardStats : shardEntry.getValue()) {
            if (shardStats.routing() != null && shardStats.routing().primary()) {
              primaryShards++;
            } else {
              replicaShards++;
            }
          }
        }
      }
      String health = "GREEN";
      Set<String> aliases = getAliases(indexName);
      result.add(
          new IndexStats(
              indexName, docs, primaryShards, replicaShards, sizeBytes, health, aliases));
    }
    return result;
  }
}
