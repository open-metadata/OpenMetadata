package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.stream.JsonParser;
import java.io.IOException;
import java.io.StringReader;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.mapping.TypeMapping;
import os.org.opensearch.client.opensearch.indices.CreateIndexRequest;
import os.org.opensearch.client.opensearch.indices.CreateIndexResponse;
import os.org.opensearch.client.opensearch.indices.DeleteIndexRequest;
import os.org.opensearch.client.opensearch.indices.DeleteIndexResponse;
import os.org.opensearch.client.opensearch.indices.ExistsRequest;
import os.org.opensearch.client.opensearch.indices.IndexSettings;
import os.org.opensearch.client.opensearch.indices.PutMappingRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesRequest;
import os.org.opensearch.client.opensearch.indices.UpdateAliasesResponse;
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
      return false;
    }
    try {
      BooleanResponse response = client.indices().exists(ExistsRequest.of(e -> e.index(indexName)));
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

        if (indexMappingContent != null && !indexMappingContent.isEmpty()) {
          // Parse the mapping content
          JsonNode rootNode = JsonUtils.readTree(indexMappingContent);
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

          CreateIndexResponse createIndexResponse = client.indices().create(createIndexRequest);
          LOG.info("{} Created {}", indexName, createIndexResponse.acknowledged());
        } else {
          // Create index without mappings
          CreateIndexRequest request = CreateIndexRequest.of(builder -> builder.index(indexName));
          CreateIndexResponse createIndexResponse = client.indices().create(request);
          LOG.info("{} Created without mappings {}", indexName, createIndexResponse.acknowledged());
        }

        // creating alias for indexes
        createAliases(indexMapping);
      } catch (Exception e) {
        LOG.error(
            "Failed to create OpenSearch index [{}]", indexMapping.getIndexName(clusterAlias), e);
      }
    } else {
      LOG.error(
          "Failed to create Open Search index as client is not property configured, Please check your OpenMetadata configuration");
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
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);
      os.org.opensearch.client.opensearch.indices.DeleteIndexRequest request =
          DeleteIndexRequest.of(b -> b.index(indexName));
      DeleteIndexResponse response = client.indices().delete(request);
      LOG.debug("{} Deleted: {}", indexName, response.acknowledged());
    } catch (Exception e) {
      LOG.error(
          "Failed to delete OpenSearch index: {}", indexMapping.getIndexName(clusterAlias), e);
    }
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
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);

      // Build the UpdateAliasesRequest
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              updateBuilder -> {
                for (String alias : aliasNames) {
                  updateBuilder.actions(
                      actionBuilder ->
                          actionBuilder.add(
                              addBuilder -> addBuilder.index(indexName).alias(alias)));
                }
                return updateBuilder;
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
    JsonParser parser =
        client
            ._transport()
            .jsonpMapper()
            .jsonProvider()
            .createParser(new StringReader(settingsNode.toString()));
    return IndexSettings._DESERIALIZER.deserialize(parser, client._transport().jsonpMapper());
  }
}
