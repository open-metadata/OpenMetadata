package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.stream.JsonParser;
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
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot delete index.");
      return;
    }
    try {
      String indexName = indexMapping.getIndexName(clusterAlias);
      os.org.opensearch.client.opensearch.indices.DeleteIndexRequest request =
          DeleteIndexRequest.of(b -> b.index(indexName));
      DeleteIndexResponse response = client.indices().delete(request);
      LOG.info("{} Deleted: {}", indexName, response.acknowledged());
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
    if (!isClientAvailable) {
      LOG.error("OpenSearch client is not available. Cannot add index alias.");
      return;
    }
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
    // Transform Elasticsearch stemmer configuration to OpenSearch format
    JsonNode transformedSettings = transformStemmerForOpenSearch(settingsNode);

    JsonParser parser =
        client
            ._transport()
            .jsonpMapper()
            .jsonProvider()
            .createParser(new StringReader(transformedSettings.toString()));
    return IndexSettings._DESERIALIZER.deserialize(parser, client._transport().jsonpMapper());
  }

  private JsonNode transformStemmerForOpenSearch(JsonNode settingsNode) {
    try {
      // Clone the settings to avoid modifying the original
      ObjectNode transformedNode = (ObjectNode) JsonUtils.readTree(settingsNode.toString());

      // Navigate to the filters section if it exists
      JsonNode analysisNode = transformedNode.path("analysis");
      if (!analysisNode.isMissingNode() && analysisNode.isObject()) {
        ObjectNode analysisObj = (ObjectNode) analysisNode;

        JsonNode filtersNode = analysisObj.path("filter");
        if (!filtersNode.isMissingNode() && filtersNode.isObject()) {
          ObjectNode filtersObj = (ObjectNode) filtersNode;

          // Check if om_stemmer exists and has "name": "kstem"
          JsonNode omStemmerNode = filtersObj.path("om_stemmer");
          if (!omStemmerNode.isMissingNode() && omStemmerNode.has("type")) {
            String type = omStemmerNode.get("type").asText();
            if ("stemmer".equals(type) && omStemmerNode.has("name")) {
              String name = omStemmerNode.get("name").asText();
              if ("kstem".equals(name)) {
                // Create a new stemmer configuration for OpenSearch
                ObjectNode newStemmerNode = JsonUtils.getObjectMapper().createObjectNode();
                newStemmerNode.put("type", "stemmer");
                newStemmerNode.put("language", "kstem");

                // Replace the om_stemmer configuration
                filtersObj.set("om_stemmer", newStemmerNode);
              }
            }
          } else {
            LOG.debug("No om_stemmer filter found in settings");
          }
        } else {
          LOG.debug("No filter section found in analysis settings");
        }
      } else {
        LOG.debug("No analysis section found in settings");
      }

      return transformedNode;
    } catch (Exception e) {
      LOG.warn("Failed to transform stemmer settings for OpenSearch, using original settings", e);
      return settingsNode;
    }
  }
}
