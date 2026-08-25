package org.openmetadata.search;

import jakarta.json.JsonObject;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Getter
public class IndexMappingLoader {

  private static volatile IndexMappingLoader instance;
  private ElasticSearchConfiguration elasticSearchConfiguration;
  private String searchIndexMappingLanguage;

  private static final String OM_INDEX_MAPPING_FILE_PATH = "elasticsearch/indexMapping.json";
  private static final String COLLATE_INDEX_MAPPING_FILE_PATH =
      "elasticsearch/collate/indexMapping.json";
  private static final Logger LOG = LoggerFactory.getLogger(IndexMappingLoader.class);

  @Getter Map<String, IndexMapping> indexMapping = new HashMap<>();
  @Getter Map<String, Map<String, Object>> entityIndexMapping = new HashMap<>();

  private IndexMappingLoader(ElasticSearchConfiguration elasticSearchConfiguration)
      throws IOException {
    this.elasticSearchConfiguration = elasticSearchConfiguration;
    if (elasticSearchConfiguration.getSearchIndexMappingLanguage() == null) {
      this.searchIndexMappingLanguage = "en";
    } else {
      this.searchIndexMappingLanguage =
          elasticSearchConfiguration.getSearchIndexMappingLanguage().toString().toLowerCase();
    }
    loadIndexMapping();
    loadEntityIndexMapping();
  }

  private IndexMappingLoader() throws IOException {
    this.searchIndexMappingLanguage = "en";
    loadIndexMapping();
    loadEntityIndexMapping();
  }

  public static void init(ElasticSearchConfiguration elasticSearchConfiguration)
      throws IOException {
    synchronized (IndexMappingLoader.class) {
      if (instance == null) {
        instance = new IndexMappingLoader(elasticSearchConfiguration);
      }
    }
  }

  public static void init() throws IOException {
    synchronized (IndexMappingLoader.class) {
      if (instance == null) {
        instance = new IndexMappingLoader();
      }
    }
  }

  public static IndexMappingLoader getInstance() {
    IndexMappingLoader result = instance;
    if (result != null) {
      return result;
    } else {
      throw new IllegalStateException("IndexMappingLoader is not initialized. Call init() first.");
    }
  }

  private void loadIndexMapping() throws IOException {
    Set<String> entities;
    try (InputStream inputStream =
        IndexMappingLoader.class.getClassLoader().getResourceAsStream(OM_INDEX_MAPPING_FILE_PATH)) {

      if (inputStream == null) {
        throw new IOException("Could not find " + OM_INDEX_MAPPING_FILE_PATH + " in classpath");
      }

      JsonObject jsonPayload =
          JsonUtils.readJson(new String(inputStream.readAllBytes())).asJsonObject();
      entities = jsonPayload.keySet();
      for (String s : entities) {
        indexMapping.put(s, JsonUtils.readValue(jsonPayload.get(s).toString(), IndexMapping.class));
      }
    } catch (Exception e) {
      throw new JsonParsingException("Failed to load indexMapping.json", e);
    }
    try (InputStream inputStream2 =
        IndexMappingLoader.class
            .getClassLoader()
            .getResourceAsStream(COLLATE_INDEX_MAPPING_FILE_PATH)) {
      if (inputStream2 != null) {
        JsonObject jsonPayload =
            JsonUtils.readJson(new String(inputStream2.readAllBytes())).asJsonObject();
        entities = jsonPayload.keySet();
        for (String s : entities) {
          indexMapping.put(
              s, JsonUtils.readValue(jsonPayload.get(s).toString(), IndexMapping.class));
        }
      }
    } catch (Exception e) {
      LOG.warn("Failed to load indexMapping.json");
    }
  }

  private void loadEntityIndexMapping() throws IOException {
    if (entityIndexMapping == null) {
      throw new IllegalStateException(
          "Entity index map is not loaded. Call loadIndexMapping() first.");
    }

    for (Map.Entry<String, IndexMapping> entry : indexMapping.entrySet()) {
      String entityName = entry.getKey();
      IndexMapping indexMapping = entry.getValue();
      try (InputStream inputStream =
          IndexMappingLoader.class
              .getClassLoader()
              .getResourceAsStream(indexMapping.getIndexMappingFile(searchIndexMappingLanguage))) {
        if (inputStream == null) {
          throw new IOException(
              "Could not find "
                  + indexMapping.getIndexMappingFile(searchIndexMappingLanguage)
                  + " in classpath");
        }
        Map<String, Object> jsonMap =
            JsonUtils.getMapFromJson(new String(inputStream.readAllBytes()));
        entityIndexMapping.put(entityName, jsonMap);
      } catch (Exception e) {
        throw new JsonParsingException("Failed to load index mapping for " + entityName, e);
      }
    }
  }
}
