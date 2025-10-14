package org.openmetadata.service.search.opensearch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
import os.org.opensearch.client.opensearch.indices.GetAliasRequest;
import os.org.opensearch.client.opensearch.indices.GetAliasResponse;
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
    try {
      UpdateAliasesRequest request =
          UpdateAliasesRequest.of(
              updateBuilder -> {
                for (String alias : aliases) {
                  updateBuilder.actions(
                      actionBuilder ->
                          actionBuilder.add(
                              addBuilder -> addBuilder.index(indexName).alias(alias)));
                }
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
      GetAliasRequest request = GetAliasRequest.of(g -> g.name(aliasName));
      GetAliasResponse response = client.indices().getAlias(request);

      indices.addAll(response.result().keySet());

      LOG.info("Retrieved indices for alias {}: {}", aliasName, indices);
    } catch (Exception e) {
      LOG.error("Failed to get indices for alias {} due to", aliasName, e);
    }
    return indices;
  }
}
