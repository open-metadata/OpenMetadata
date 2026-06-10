package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.VersionUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.exception.IndexMappingHashException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IndexMappingVersionDAO;

@Slf4j
public class IndexMappingVersionTracker {
  public static final String SYSTEM_UPDATED_BY = "system";
  private static final String VERSION_RESOURCE_PATH = "/catalog/VERSION";

  // Server version and mappers are immutable for the process lifetime; resolve once instead of
  // re-reading /catalog/VERSION and re-allocating an ObjectMapper on every per-entity stamp.
  private static final String SERVER_VERSION = currentServerVersion();
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final ObjectMapper CANONICAL_MAPPER =
      new ObjectMapper().configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true);

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

  public static IndexMappingVersionTracker create(CollectionDAO daoCollection) {
    return new IndexMappingVersionTracker(daoCollection, SERVER_VERSION, SYSTEM_UPDATED_BY);
  }

  private static String currentServerVersion() {
    return VersionUtils.getOpenMetadataServerVersion(VERSION_RESOURCE_PATH).getVersion();
  }

  public enum MappingDriftState {
    CURRENT,
    STALE,
    UNTRACKED
  }

  public List<String> getChangedMappings() throws IOException {
    List<String> changedMappings = new ArrayList<>();
    Map<String, String> storedHashes = getStoredMappingHashes();
    Map<String, MappingEntry> currentMappings = computeCurrentMappings();

    for (Map.Entry<String, MappingEntry> entry : currentMappings.entrySet()) {
      String entityType = entry.getKey();
      String currentHash = entry.getValue().hash();
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

  public Map<String, MappingDriftState> computeDrift() throws IOException {
    Map<String, String> storedHashes = getStoredMappingHashes();
    Map<String, MappingEntry> currentMappings = computeCurrentMappings();
    Map<String, MappingDriftState> drift = new HashMap<>();
    for (Map.Entry<String, MappingEntry> entry : currentMappings.entrySet()) {
      String storedHash = storedHashes.get(entry.getKey());
      drift.put(entry.getKey(), classifyState(storedHash, entry.getValue().hash()));
    }
    return Collections.unmodifiableMap(drift);
  }

  private MappingDriftState classifyState(String storedHash, String currentHash) {
    MappingDriftState state;
    if (storedHash == null) {
      state = MappingDriftState.UNTRACKED;
    } else if (Objects.equals(storedHash, currentHash)) {
      state = MappingDriftState.CURRENT;
    } else {
      state = MappingDriftState.STALE;
    }
    return state;
  }

  /**
   * Returns {@code true} when the indexes were last built at a different major/minor release than
   * the version currently running. A patch-level bump (e.g. {@code 1.12.8 -> 1.12.9}) returns
   * {@code false} so smart reindexing only touches changed mappings, whereas a major/minor bump
   * (e.g. {@code 1.12.8 -> 1.13.0} or {@code 1.12.8 -> 2.0.0}) returns {@code true} so every index
   * is recreated and fully reindexed. A fresh install with no stored versions returns
   * {@code false} because every mapping is already reported as changed.
   */
  public boolean requiresFullReindexForVersionUpgrade() {
    String previousVersion = findStoredVersionWithDifferentMajorMinor();
    boolean requiresFullReindex = previousVersion != null;
    if (requiresFullReindex) {
      LOG.info(
          "Index mapping version change {} -> {} crosses a major/minor release - full reindex required",
          previousVersion,
          version);
    }
    return requiresFullReindex;
  }

  private String findStoredVersionWithDifferentMajorMinor() {
    String currentMajorMinor = VersionUtils.getMajorMinorVersion(version);
    String mismatchedVersion = null;
    for (String storedVersion : indexMappingVersionDAO.getDistinctMappingVersions()) {
      if (!currentMajorMinor.equals(VersionUtils.getMajorMinorVersion(storedVersion))) {
        mismatchedVersion = storedVersion;
      }
    }
    return mismatchedVersion;
  }

  public void updateMappingVersions() throws IOException {
    persistMappingVersions(computeCurrentMappings());
  }

  /**
   * Persists the version/hash only for the entities that were actually reindexed. Stamping every
   * entity (as the no-arg overload does) would mask entities that still need a reindex when only a
   * subset was run - on a later major/minor upgrade those skipped entities would wrongly look
   * up-to-date and never be recreated.
   */
  public void updateMappingVersions(Collection<String> reindexedEntities) throws IOException {
    Map<String, MappingEntry> currentMappings = computeCurrentMappings();
    Map<String, MappingEntry> reindexedMappings = new HashMap<>();
    for (String entityType : reindexedEntities) {
      MappingEntry mappingEntry = currentMappings.get(entityType);
      if (mappingEntry != null) {
        reindexedMappings.put(entityType, mappingEntry);
      }
    }
    persistMappingVersions(reindexedMappings);
  }

  /**
   * Stamps the version/hash for a single entity. Used by the index promotion path ({@code
   * DefaultRecreateHandler}) so each entity is recorded the moment its staged index is promoted,
   * instead of blanket-stamping at job end. Hashes only that entity's mapping to avoid rehashing
   * every entity on every promotion.
   */
  public void updateMappingVersion(String entityType) throws IOException {
    MappingEntry mappingEntry = computeMappingForEntity(entityType);
    if (mappingEntry == null) {
      LOG.warn("No index mapping found for entity '{}'; skipping version stamp", entityType);
    } else {
      persistMappingVersions(Map.of(entityType, mappingEntry));
    }
  }

  private void persistMappingVersions(Map<String, MappingEntry> mappings) {
    long updatedAt = System.currentTimeMillis();
    for (Map.Entry<String, MappingEntry> entry : mappings.entrySet()) {
      MappingEntry mappingEntry = entry.getValue();
      indexMappingVersionDAO.upsertIndexMappingVersion(
          entry.getKey(),
          mappingEntry.hash(),
          JsonUtils.pojoToJson(mappingEntry.json()),
          version,
          updatedAt,
          updatedBy);
    }
    LOG.info("Updated index mapping versions for {} entities", mappings.size());
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

  private record MappingEntry(String hash, JsonNode json) {}

  private Map<String, MappingEntry> computeCurrentMappings() throws IOException {
    Map<String, MappingEntry> mappings = new HashMap<>();

    // Use IndexMappingLoader as the source of truth for entity types and their mapping file paths.
    // This avoids constructing file paths manually and ensures all entity types are covered,
    // including camelCase ones like glossaryTerm, databaseSchema, etc.
    Map<String, IndexMapping> indexMappings = IndexMappingLoader.getInstance().getIndexMapping();

    for (Map.Entry<String, IndexMapping> entry : indexMappings.entrySet()) {
      MappingEntry mappingEntry = toMappingEntry(entry.getKey(), entry.getValue());
      if (mappingEntry != null) {
        mappings.put(entry.getKey(), mappingEntry);
      }
    }

    return mappings;
  }

  private MappingEntry computeMappingForEntity(String entityType) throws IOException {
    IndexMapping indexMapping = IndexMappingLoader.getInstance().getIndexMapping().get(entityType);
    MappingEntry result = null;
    if (indexMapping != null) {
      result = toMappingEntry(entityType, indexMapping);
    }
    return result;
  }

  private MappingEntry toMappingEntry(String entityType, IndexMapping indexMapping)
      throws IOException {
    JsonNode mapping = loadMappingForEntity(entityType, indexMapping);
    MappingEntry result = null;
    if (mapping != null) {
      try {
        result = new MappingEntry(computeHash(mapping), mapping);
      } catch (IndexMappingHashException e) {
        LOG.error("Failed to compute hash for entity type: {}", entityType, e);
        throw new IOException("Failed to compute mapping hash for " + entityType, e);
      }
    }
    return result;
  }

  private JsonNode loadMappingForEntity(String entityType, IndexMapping indexMapping) {
    try {
      Map<String, JsonNode> allLanguageMappings = new HashMap<>();
      String[] languages = {"en", "jp", "ru", "zh"};

      for (String lang : languages) {
        // Use the indexMappingFile from indexMapping.json which has the correct path template
        String mappingPath = "/" + indexMapping.getIndexMappingFile(lang);
        try (var stream = getClass().getResourceAsStream(mappingPath)) {
          if (stream != null) {
            String mappingContent = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            allLanguageMappings.put(lang, MAPPER.readTree(mappingContent));
          }
        }
      }

      if (!allLanguageMappings.isEmpty()) {
        return MAPPER.valueToTree(allLanguageMappings);
      }
    } catch (Exception e) {
      LOG.debug("Could not load mapping for entity: {}", entityType, e);
    }
    return null;
  }

  private String computeHash(JsonNode mapping) throws IOException, IndexMappingHashException {
    try {
      MessageDigest digest = MessageDigest.getInstance("MD5");
      String canonicalJson = CANONICAL_MAPPER.writeValueAsString(mapping);
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
