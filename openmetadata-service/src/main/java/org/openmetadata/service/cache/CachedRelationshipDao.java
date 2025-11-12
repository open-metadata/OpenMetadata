package org.openmetadata.service.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;

@Slf4j
@RequiredArgsConstructor
public class CachedRelationshipDao {
  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  private static final TypeReference<List<EntityReference>> ENTITY_REF_LIST_TYPE =
      new TypeReference<List<EntityReference>>() {};

  public List<EntityReference> list(
      UUID entityId, String entityType, String relType, String direction) {
    String cacheKey = keys.rel(entityType, entityId, relType, direction);

    Optional<String> cached = cache.get(cacheKey);
    if (cached.isPresent()) {
      LOG.debug(
          "Cache hit for relationships: {} -> {} -> {} -> {}",
          entityType,
          entityId,
          relType,
          direction);
      try {
        return JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
      } catch (Exception e) {
        LOG.warn("Failed to deserialize cached relationships, fetching from DB", e);
        cache.del(cacheKey); // Remove corrupted cache entry
      }
    }

    LOG.debug(
        "Cache miss for relationships: {} -> {} -> {} -> {}",
        entityType,
        entityId,
        relType,
        direction);

    // Fetch from database
    List<EntityReference> relationships =
        fetchRelationshipsFromDatabase(entityId, entityType, relType, direction);

    // Cache the result
    if (!relationships.isEmpty()) {
      try {
        String json = JsonUtils.pojoToJson(relationships);
        cache.set(cacheKey, json, Duration.ofSeconds(config.relationshipTtlSeconds));
        LOG.debug(
            "Cached {} relationships for: {} -> {}", relationships.size(), entityType, entityId);
      } catch (Exception e) {
        LOG.warn("Failed to cache relationships", e);
      }
    }

    return relationships;
  }

  private List<EntityReference> fetchRelationshipsFromDatabase(
      UUID entityId, String entityType, String relType, String direction) {
    try {
      // Parse relationship type
      Relationship relationship = Relationship.valueOf(relType.toUpperCase());
      int relationOrdinal = relationship.ordinal();

      List<EntityRelationshipRecord> records;
      if ("OUT".equalsIgnoreCase(direction)) {
        // Find relationships where this entity is the source (FROM -> TO)
        records = dao.relationshipDAO().findTo(entityId, entityType, relationOrdinal);
      } else if ("IN".equalsIgnoreCase(direction)) {
        // Find relationships where this entity is the target (TO <- FROM)
        records = dao.relationshipDAO().findFrom(entityId, entityType, relationOrdinal);
      } else {
        LOG.warn("Invalid relationship direction: {}", direction);
        return Collections.emptyList();
      }

      // Convert records to EntityReferences
      return convertToEntityReferences(records, direction);
    } catch (IllegalArgumentException e) {
      LOG.warn("Invalid relationship type: {}", relType);
      return Collections.emptyList();
    } catch (Exception e) {
      LOG.error("Failed to fetch relationships from database", e);
      return Collections.emptyList();
    }
  }

  private List<EntityReference> convertToEntityReferences(
      List<EntityRelationshipRecord> records, String direction) {
    if (records == null || records.isEmpty()) {
      return Collections.emptyList();
    }

    List<EntityReference> references = new ArrayList<>();
    for (EntityRelationshipRecord record : records) {
      try {
        EntityReference ref = new EntityReference();

        if ("OUT".equalsIgnoreCase(direction)) {
          // For OUT direction, we want the TO entity
          ref.setId(record.getId()); // This is toId
          ref.setType(record.getType()); // This is toEntity type
        } else {
          // For IN direction, we want the FROM entity
          ref.setId(record.getId()); // This is fromId
          ref.setType(record.getType()); // This is fromEntity type
        }

        // Try to get additional info from JSON if available
        if (record.getJson() != null) {
          try {
            Map<String, Object> jsonData = JsonUtils.readValue(record.getJson(), Map.class);
            if (jsonData.containsKey("name")) {
              ref.setName((String) jsonData.get("name"));
            }
            if (jsonData.containsKey("fullyQualifiedName")) {
              ref.setFullyQualifiedName((String) jsonData.get("fullyQualifiedName"));
            }
            if (jsonData.containsKey("displayName")) {
              ref.setDisplayName((String) jsonData.get("displayName"));
            }
          } catch (Exception e) {
            // If JSON parsing fails, continue with basic reference
            LOG.debug("Could not parse relationship JSON: {}", e.getMessage());
          }
        }

        references.add(ref);
      } catch (Exception e) {
        LOG.warn("Failed to convert relationship record to EntityReference", e);
      }
    }

    return references;
  }

  /**
   * Get cached owners for an entity
   */
  public List<EntityReference> getOwners(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    try {
      Optional<String> cached = cache.hget(cacheKey, "owners");
      if (cached.isPresent()) {
        return JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get cached owners: {} -> {}", entityType, entityId, e);
    }
    return null;
  }

  /**
   * Get cached domains for an entity
   */
  public List<EntityReference> getDomains(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    try {
      Optional<String> cached = cache.hget(cacheKey, "domains");
      if (cached.isPresent()) {
        return JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get cached domains: {} -> {}", entityType, entityId, e);
    }
    return null;
  }

  /**
   * Write-through cache: Store owners relationship
   */
  public void putOwners(String entityType, UUID entityId, String ownersJson) {
    if (ownersJson == null || ownersJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(
          cacheKey, Map.of("owners", ownersJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached owners for: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache owners: {} -> {}", entityType, entityId, e);
    }
  }

  /**
   * Write-through cache: Store domains relationship
   */
  public void putDomains(String entityType, UUID entityId, String domainsJson) {
    if (domainsJson == null || domainsJson.isEmpty()) {
      return;
    }

    String cacheKey = keys.entity(entityType, entityId);
    try {
      cache.hset(
          cacheKey, Map.of("domains", domainsJson), Duration.ofSeconds(config.entityTtlSeconds));
      LOG.debug("Write-through cached domains for: {} -> {}", entityType, entityId);
    } catch (Exception e) {
      LOG.warn("Failed to write-through cache domains: {} -> {}", entityType, entityId, e);
    }
  }

  /**
   * Fetch and cache relationships by specific type and direction.
   * This is optimized for common relationship queries.
   */
  public List<EntityReference> getRelationships(
      UUID entityId, String entityType, Relationship relationship, boolean isFromRelationship) {
    String direction = isFromRelationship ? "IN" : "OUT";
    String relType = relationship.name();
    return list(entityId, entityType, relType, direction);
  }

  /**
   * Batch fetch relationships for multiple entities (reduces N+1 queries).
   */
  public Map<UUID, List<EntityReference>> batchGetRelationships(
      List<UUID> entityIds,
      String entityType,
      Relationship relationship,
      boolean isFromRelationship) {
    Map<UUID, List<EntityReference>> result = new HashMap<>();
    List<UUID> cacheMisses = new ArrayList<>();

    String direction = isFromRelationship ? "IN" : "OUT";
    String relType = relationship.name();

    // Check cache for each entity
    for (UUID entityId : entityIds) {
      String cacheKey = keys.rel(entityType, entityId, relType, direction);
      Optional<String> cached = cache.get(cacheKey);

      if (cached.isPresent()) {
        try {
          List<EntityReference> refs = JsonUtils.readValue(cached.get(), ENTITY_REF_LIST_TYPE);
          result.put(entityId, refs);
        } catch (Exception e) {
          LOG.warn("Failed to deserialize cached relationships for entity: {}", entityId);
          cacheMisses.add(entityId);
        }
      } else {
        cacheMisses.add(entityId);
      }
    }

    // Batch fetch cache misses from database
    if (!cacheMisses.isEmpty()) {
      try {
        List<String> entityIdStrings =
            cacheMisses.stream().map(UUID::toString).collect(java.util.stream.Collectors.toList());

        List<CollectionDAO.EntityRelationshipObject> batchRecords;
        if (isFromRelationship) {
          batchRecords =
              dao.relationshipDAO().findFromBatch(entityIdStrings, relationship.ordinal());
        } else {
          batchRecords =
              dao.relationshipDAO()
                  .findToBatch(entityIdStrings, relationship.ordinal(), entityType);
        }

        // Group by entity ID and cache
        Map<UUID, List<EntityReference>> batchResults =
            groupRelationshipsByEntity(batchRecords, isFromRelationship);

        for (Map.Entry<UUID, List<EntityReference>> entry : batchResults.entrySet()) {
          UUID entityId = entry.getKey();
          List<EntityReference> refs = entry.getValue();

          // Add to result
          result.put(entityId, refs);

          // Cache the result
          if (!refs.isEmpty()) {
            String cacheKey = keys.rel(entityType, entityId, relType, direction);
            try {
              String json = JsonUtils.pojoToJson(refs);
              cache.set(cacheKey, json, Duration.ofSeconds(config.relationshipTtlSeconds));
            } catch (Exception e) {
              LOG.warn("Failed to cache batch relationships for entity: {}", entityId);
            }
          }
        }

        // Add empty lists for entities with no relationships
        for (UUID entityId : cacheMisses) {
          if (!result.containsKey(entityId)) {
            result.put(entityId, Collections.emptyList());
          }
        }
      } catch (Exception e) {
        LOG.error("Failed to batch fetch relationships from database", e);
        // Return empty lists for all cache misses
        for (UUID entityId : cacheMisses) {
          result.put(entityId, Collections.emptyList());
        }
      }
    }

    return result;
  }

  private Map<UUID, List<EntityReference>> groupRelationshipsByEntity(
      List<CollectionDAO.EntityRelationshipObject> records, boolean isFromRelationship) {
    Map<UUID, List<EntityReference>> grouped = new HashMap<>();

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID entityId =
          isFromRelationship
              ? UUID.fromString(record.getToId())
              : UUID.fromString(record.getFromId());

      EntityReference ref = new EntityReference();
      if (isFromRelationship) {
        ref.setId(UUID.fromString(record.getFromId()));
        ref.setType(record.getFromEntity());
      } else {
        ref.setId(UUID.fromString(record.getToId()));
        ref.setType(record.getToEntity());
      }

      // Parse JSON for additional fields
      if (record.getJson() != null) {
        try {
          Map<String, Object> jsonData = JsonUtils.readValue(record.getJson(), Map.class);
          if (jsonData.containsKey("name")) {
            ref.setName((String) jsonData.get("name"));
          }
          if (jsonData.containsKey("fullyQualifiedName")) {
            ref.setFullyQualifiedName((String) jsonData.get("fullyQualifiedName"));
          }
        } catch (Exception e) {
          LOG.debug("Could not parse relationship JSON");
        }
      }

      grouped.computeIfAbsent(entityId, k -> new ArrayList<>()).add(ref);
    }

    return grouped;
  }

  public void invalidate(UUID entityId, String entityType) {
    // Invalidate all relationship caches for this entity
    // Include all possible relationship types
    for (Relationship rel : Relationship.values()) {
      for (String direction : List.of("IN", "OUT")) {
        String cacheKey = keys.rel(entityType, entityId, rel.name(), direction);
        cache.del(cacheKey);
      }
    }
    LOG.debug("Invalidated all relationship caches for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateOwners(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the owners field from the hash
    cache.hdel(cacheKey, "owners");
    LOG.debug("Invalidated owners cache for entity: {} -> {}", entityType, entityId);
  }

  public void invalidateDomains(String entityType, UUID entityId) {
    String cacheKey = keys.entity(entityType, entityId);
    // Remove just the domains field from the hash
    cache.hdel(cacheKey, "domains");
    LOG.debug("Invalidated domains cache for entity: {} -> {}", entityType, entityId);
  }
}
