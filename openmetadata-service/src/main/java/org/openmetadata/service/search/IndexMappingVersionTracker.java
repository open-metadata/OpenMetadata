package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.IndexMappingHashException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IndexMappingVersionDAO;

@Slf4j
public class IndexMappingVersionTracker {
  private final IndexMappingVersionDAO indexMappingVersionDAO;
  private final String updatedBy;
  private final String version;
  private final CollectionDAO daoCollection;

  public IndexMappingVersionTracker(CollectionDAO daoCollection, String version, String updatedBy) {
    this.daoCollection = daoCollection;
    this.indexMappingVersionDAO = daoCollection.indexMappingVersionDAO();
    this.version = version;
    this.updatedBy = updatedBy;
  }

  public List<String> getChangedMappings() throws IOException {
    List<String> changedMappings = new ArrayList<>();
    Map<String, String> storedHashes = getStoredMappingHashes();
    Map<String, String> currentHashes = computeCurrentMappingHashes();

    for (Map.Entry<String, String> entry : currentHashes.entrySet()) {
      String entityType = entry.getKey();
      String currentHash = entry.getValue();
      String storedHash = storedHashes.get(entityType);

      if (storedHash == null || !storedHash.equals(currentHash)) {
        changedMappings.add(entityType);
        LOG.info("Index mapping changed for entity: {}", entityType);
      }
    }

    if (changedMappings.isEmpty()) {
      LOG.info("No changes detected in index mappings");
    } else {
      LOG.info("Changed index mappings detected for entities: {}", changedMappings);
    }

    return changedMappings;
  }

  public void updateMappingVersions() throws IOException {
    Map<String, String> currentHashes = computeCurrentMappingHashes();
    long updatedAt = System.currentTimeMillis();

    for (Map.Entry<String, String> entry : currentHashes.entrySet()) {
      String entityType = entry.getKey();
      String mappingHash = entry.getValue();
      JsonNode mappingJson = loadMappingForEntity(entityType);

      indexMappingVersionDAO.upsertIndexMappingVersion(
          entityType,
          mappingHash,
          JsonUtils.pojoToJson(mappingJson),
          version,
          updatedAt,
          updatedBy);
    }
    LOG.info("Updated index mapping versions for {} entities", currentHashes.size());
  }

  private Map<String, String> getStoredMappingHashes() {
    Map<String, String> hashes = new HashMap<>();
    List<IndexMappingVersionDAO.IndexMappingVersion> versions =
        indexMappingVersionDAO.getAllMappingVersions();
    for (IndexMappingVersionDAO.IndexMappingVersion ver : versions) {
      hashes.put(ver.entityType, ver.mappingHash);
    }
    return hashes;
  }

  private Map<String, String> computeCurrentMappingHashes() throws IOException {
    Map<String, String> hashes = new HashMap<>();

    // Get all entity types
    Set<String> entityTypes = Entity.getEntityList();

    for (String entityType : entityTypes) {
      JsonNode mapping = loadMappingForEntity(entityType);
      if (mapping != null) {
        try {
          String hash = computeHash(mapping);
          hashes.put(entityType, hash);
        } catch (IndexMappingHashException e) {
          LOG.error("Failed to compute hash for entity type: {}", entityType, e);
          throw new IOException("Failed to compute mapping hash for " + entityType, e);
        }
      }
    }

    return hashes;
  }

  private JsonNode loadMappingForEntity(String entityType) throws IOException {
    try {
      ObjectMapper mapper = new ObjectMapper();
      Map<String, JsonNode> allLanguageMappings = new HashMap<>();
      String[] languages = {"en", "zh", "jp"};

      for (String lang : languages) {
        String mappingPath =
            String.format(
                "/elasticsearch/%s/%s_index_mapping.json", lang, entityType.toLowerCase());
        try (var stream = getClass().getResourceAsStream(mappingPath)) {
          if (stream != null) {
            String mappingContent = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            allLanguageMappings.put(lang, mapper.readTree(mappingContent));
          }
        }
      }

      String mappingPath =
          String.format("/elasticsearch/%s_index_mapping.json", entityType.toLowerCase());
      try (var stream = getClass().getResourceAsStream(mappingPath)) {
        if (stream != null) {
          String mappingContent = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
          allLanguageMappings.put("default", mapper.readTree(mappingContent));
        }
      }

      if (!allLanguageMappings.isEmpty()) {
        return mapper.valueToTree(allLanguageMappings);
      }
    } catch (Exception e) {
      LOG.debug("Could not load mapping for entity: {}", entityType, e);
    }
    return null;
  }

  private String computeHash(JsonNode mapping) throws IOException, IndexMappingHashException {
    try {
      MessageDigest digest = MessageDigest.getInstance("MD5");
      ObjectMapper mapper = new ObjectMapper();
      mapper.configure(
          com.fasterxml.jackson.databind.SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);
      String canonicalJson = mapper.writeValueAsString(mapping);
      byte[] hash = digest.digest(canonicalJson.getBytes(StandardCharsets.UTF_8));
      return bytesToHex(hash);
    } catch (NoSuchAlgorithmException e) {
      // MD5 is a standard algorithm that should always be available
      throw new IndexMappingHashException(
          "MD5 algorithm not available - this should never happen", e);
    }
  }

  private String bytesToHex(byte[] bytes) {
    StringBuilder result = new StringBuilder();
    for (byte b : bytes) {
      result.append(String.format("%02x", b));
    }
    return result.toString();
  }
}
