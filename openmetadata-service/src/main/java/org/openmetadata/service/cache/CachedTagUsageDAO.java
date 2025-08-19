/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.cache;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class CachedTagUsageDAO implements CollectionDAO.TagUsageDAO {

  private final CollectionDAO.TagUsageDAO delegate;
  private static final String TAG_CACHE_PREFIX = "tags:";
  private static final String TAG_PREFIX_CACHE_PREFIX = "tags:prefix:";
  private static final String TAG_BATCH_CACHE_PREFIX = "tags:batch:";

  private static final LoadingCache<String, List<TagLabel>> INTERNAL_TAG_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .recordStats()
          .build(
              new CacheLoader<String, List<TagLabel>>() {
                @Override
                public List<TagLabel> load(String key) {
                  // This should not be called directly
                  return null;
                }
              });

  private static final LoadingCache<String, List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>>
      INTERNAL_BATCH_CACHE =
          CacheBuilder.newBuilder()
              .maximumSize(5000)
              .expireAfterWrite(5, TimeUnit.MINUTES)
              .recordStats()
              .build(
                  new CacheLoader<String, List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>>() {
                    @Override
                    public List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> load(String key) {
                      // This should not be called directly
                      return null;
                    }
                  });

  private static final LoadingCache<String, Map<String, List<TagLabel>>> INTERNAL_PREFIX_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(5000)
          .expireAfterWrite(5, TimeUnit.MINUTES)
          .recordStats()
          .build(
              new CacheLoader<String, Map<String, List<TagLabel>>>() {
                @Override
                public Map<String, List<TagLabel>> load(String key) {
                  // This should not be called directly
                  return null;
                }
              });

  public CachedTagUsageDAO(CollectionDAO.TagUsageDAO delegate) {
    this.delegate = delegate;
  }

  @Override
  public void applyTag(
      int source,
      String tagFQN,
      String tagFQNHash,
      String targetFQN,
      String targetFQNHash,
      int labelType,
      int state) {
    try {
      delegate.applyTag(source, tagFQN, tagFQNHash, targetFQN, targetFQNHash, labelType, state);

      if (RelationshipCache.isAvailable()) {
        invalidateTagCaches(targetFQNHash);
        RelationshipCache.bumpTag(tagFQN, 1);
        LOG.debug("Applied tag {} to entity {} and invalidated Redis cache", tagFQN, targetFQNHash);
      } else {
        invalidateInternalCaches(targetFQNHash);
        LOG.debug(
            "Applied tag {} to entity {} and invalidated internal cache", tagFQN, targetFQNHash);
      }
    } catch (Exception e) {
      LOG.error("Error applying tag {} to entity {}: {}", tagFQN, targetFQNHash, e.getMessage(), e);
      throw e;
    }
  }

  private void invalidateInternalCaches(String targetFQNHash) {
    // Invalidate only cache entries that might contain this entity's tags
    // Note: Internal caches use FQN as key, not FQN hash

    // 1. Direct tag cache - look for entries that might be this entity
    // Since we have the hash but cache uses FQN, we need to check all entries
    INTERNAL_TAG_CACHE
        .asMap()
        .entrySet()
        .removeIf(
            entry -> {
              // Check if this cache entry is for the modified entity
              String key = entry.getKey();
              return FullyQualifiedName.buildHash(key).equals(targetFQNHash);
            });

    // 2. Batch caches that might include this entity's hash
    INTERNAL_BATCH_CACHE.asMap().keySet().removeIf(key -> key.contains(targetFQNHash));

    // 3. Prefix caches - only invalidate entries where the target might be affected
    // Since prefix cache returns multiple entities, we need to check if any might match
    INTERNAL_PREFIX_CACHE
        .asMap()
        .entrySet()
        .removeIf(
            entry -> {
              Map<String, List<TagLabel>> value = entry.getValue();
              if (value != null) {
                // Check if any of the keys in the result might be the affected entity
                return value.keySet().stream().anyMatch(k -> k.equals(targetFQNHash));
              }
              return false;
            });
  }

  @Override
  public List<TagLabel> getTags(String targetFQN) {
    String cacheKey = TAG_CACHE_PREFIX + targetFQN;

    if (RelationshipCache.isAvailable()) {
      try {
        Map<String, Object> cachedData = RelationshipCache.get(cacheKey);
        @SuppressWarnings("unchecked")
        List<TagLabel> cachedTags = (List<TagLabel>) cachedData.get("tags");
        if (cachedTags != null) {
          LOG.debug("Redis cache hit for tags of entity: {}", targetFQN);
          return cachedTags;
        }

        List<TagLabel> tags = delegate.getTags(targetFQN);

        if (tags != null && !tags.isEmpty()) {
          Map<String, Object> cacheData = new HashMap<>();
          cacheData.put("tags", tags);
          RelationshipCache.put(cacheKey, cacheData);
          LOG.debug("Cached {} tags in Redis for entity: {}", tags.size(), targetFQN);
        }
        return tags;
      } catch (Exception e) {
        LOG.error("Error with Redis cache for entity {}: {}", targetFQN, e.getMessage(), e);
        return delegate.getTags(targetFQN);
      }
    } else {
      try {
        List<TagLabel> cachedTags = INTERNAL_TAG_CACHE.getIfPresent(targetFQN);
        if (cachedTags != null) {
          LOG.debug("Internal cache hit for tags of entity: {}", targetFQN);
          return cachedTags;
        }

        List<TagLabel> tags = delegate.getTags(targetFQN);
        if (tags != null && !tags.isEmpty()) {
          INTERNAL_TAG_CACHE.put(targetFQN, tags);
          LOG.debug("Cached {} tags in internal cache for entity: {}", tags.size(), targetFQN);
        }
        return tags;
      } catch (Exception e) {
        LOG.error("Error with internal cache for entity {}: {}", targetFQN, e.getMessage(), e);
        return delegate.getTags(targetFQN);
      }
    }
  }

  @Override
  public List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> getTagsInternalBatch(
      List<String> targetFQNs) {
    if (targetFQNs == null || targetFQNs.isEmpty()) {
      return delegate.getTagsInternalBatch(targetFQNs);
    }

    List<String> targetFQNHashes =
        targetFQNs.stream().map(FullyQualifiedName::buildHash).sorted().toList();
    String batchKey = TAG_BATCH_CACHE_PREFIX + String.join(",", targetFQNHashes);

    if (RelationshipCache.isAvailable()) {
      try {
        Map<String, Object> cachedData = RelationshipCache.get(batchKey);
        @SuppressWarnings("unchecked")
        List<TagLabelWithFQNHash> cachedBatch =
            (List<TagLabelWithFQNHash>) cachedData.get("batchTags");
        if (cachedBatch != null) {
          LOG.debug("Redis cache hit for batch tags query with {} entities", targetFQNs.size());
          return cachedBatch;
        }

        List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> batchTags =
            delegate.getTagsInternalBatch(targetFQNs);

        if (batchTags != null) {
          Map<String, Object> cacheData = new HashMap<>();
          cacheData.put("batchTags", batchTags);
          RelationshipCache.put(batchKey, cacheData);
          LOG.debug(
              "Cached batch tags in Redis for {} entities with {} total tags",
              targetFQNHashes.size(),
              batchTags.size());
        }
        return batchTags;
      } catch (Exception e) {
        LOG.error(
            "Error with Redis cache for batch tags ({} entities): {}",
            targetFQNHashes.size(),
            e.getMessage(),
            e);
        return delegate.getTagsInternalBatch(targetFQNHashes);
      }
    } else {
      try {
        List<TagLabelWithFQNHash> cachedBatch = INTERNAL_BATCH_CACHE.getIfPresent(batchKey);
        if (cachedBatch != null) {
          LOG.debug("Internal cache hit for batch tags query with {} entities", targetFQNs.size());
          return cachedBatch;
        }

        List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> batchTags =
            delegate.getTagsInternalBatch(targetFQNs);
        if (batchTags != null) {
          INTERNAL_BATCH_CACHE.put(batchKey, batchTags);
          LOG.debug(
              "Cached batch tags in internal cache for {} entities with {} total tags",
              targetFQNHashes.size(),
              batchTags.size());
        }
        return batchTags;
      } catch (Exception e) {
        LOG.error(
            "Error with internal cache for batch tags ({} entities): {}",
            targetFQNHashes.size(),
            e.getMessage(),
            e);
        return delegate.getTagsInternalBatch(targetFQNHashes);
      }
    }
  }

  @Override
  public Map<String, List<TagLabel>> getTagsByPrefix(
      String targetFQNPrefix, String postfix, boolean requiresFqnHash) {
    if (!RelationshipCache.isAvailable()) {
      return delegate.getTagsByPrefix(targetFQNPrefix, postfix, requiresFqnHash);
    }
    String prefixKey =
        TAG_PREFIX_CACHE_PREFIX + targetFQNPrefix + ":" + postfix + ":" + requiresFqnHash;

    try {
      Map<String, Object> cachedData = RelationshipCache.get(prefixKey);
      @SuppressWarnings("unchecked")
      Map<String, List<TagLabel>> cachedPrefixTags =
          (Map<String, List<TagLabel>>) cachedData.get("prefixTags");
      if (cachedPrefixTags != null) {
        LOG.debug("Cache hit for prefix tags query: {}", targetFQNPrefix);
        return cachedPrefixTags;
      }

      Map<String, List<TagLabel>> prefixTags =
          delegate.getTagsByPrefix(targetFQNPrefix, postfix, requiresFqnHash);

      if (prefixTags != null && !prefixTags.isEmpty()) {
        Map<String, Object> cacheData = new HashMap<>();
        cacheData.put("prefixTags", prefixTags);
        RelationshipCache.put(prefixKey, cacheData);
        LOG.debug(
            "Cached prefix tags result for prefix {} with {} entities",
            targetFQNPrefix,
            prefixTags.size());
      }

      return prefixTags;

    } catch (Exception e) {
      LOG.error("Error retrieving tags by prefix {}: {}", targetFQNPrefix, e.getMessage(), e);
      return delegate.getTagsByPrefix(targetFQNPrefix, postfix, requiresFqnHash);
    }
  }

  @Override
  public void deleteTagsByTarget(String targetFQNHash) {
    try {
      delegate.deleteTagsByTarget(targetFQNHash);
      if (RelationshipCache.isAvailable()) {
        invalidateTagCaches(targetFQNHash);
        LOG.debug("Deleted tags for entity {} and invalidated cache", targetFQNHash);
      }
    } catch (Exception e) {
      LOG.error("Error deleting tags for entity {}: {}", targetFQNHash, e.getMessage(), e);
      throw e;
    }
  }

  @Override
  public void deleteTagLabelsByFqn(String tagFQNHash) {
    try {
      delegate.deleteTagLabelsByFqn(tagFQNHash);
      if (RelationshipCache.isAvailable()) {
        RelationshipCache.evict(TAG_CACHE_PREFIX + tagFQNHash);
        LOG.debug("Deleted tag {} and invalidated specific tag cache", tagFQNHash);
      }
    } catch (Exception e) {
      LOG.error("Error deleting tag {}: {}", tagFQNHash, e.getMessage(), e);
      throw e;
    }
  }

  @Override
  public void deleteTagLabels(int source, String tagFQNHash) {
    try {
      int deletedCount = delegate.getTagCount(source, tagFQNHash);
      delegate.deleteTagLabels(source, tagFQNHash);
      if (RelationshipCache.isAvailable()) {
        RelationshipCache.evict(TAG_CACHE_PREFIX + tagFQNHash);
        LOG.debug("Invalidated specific tag cache for hash: {}", tagFQNHash);
        if (deletedCount > 0) {
          // For now, we'll log that tags were deleted but can't update specific counter
          LOG.debug(
              "Deleted {} tag labels with hash {} - counter update requires FQN mapping",
              deletedCount,
              tagFQNHash);
        }
        LOG.debug(
            "Deleted tag labels for source {} and tagFQNHash {} and invalidated cache",
            source,
            tagFQNHash);
      }
    } catch (Exception e) {
      LOG.error(
          "Error deleting tag labels for source {} and tagFQNHash {}: {}",
          source,
          tagFQNHash,
          e.getMessage(),
          e);
      throw e;
    }
  }

  /**
   * Invalidate tag caches for a specific entity
   */
  private void invalidateTagCaches(String targetFQNHash) {
    try {
      // 1. Direct tag cache for this entity
      RelationshipCache.evict(TAG_CACHE_PREFIX + targetFQNHash);
      
      // 2. Invalidate prefix caches that might include this entity
      // Since prefix queries use LIKE patterns, we need to invalidate all prefix caches
      // that could potentially match this entity
      // This is a trade-off between cache accuracy and performance
      String prefixPattern = TAG_PREFIX_CACHE_PREFIX + "*";
      RelationshipCache.evictPattern(prefixPattern);
      
      // 3. Invalidate batch caches that might include this entity
      String batchPattern = TAG_BATCH_CACHE_PREFIX + "*";
      RelationshipCache.evictPattern(batchPattern);
      
      LOG.debug("Invalidated tag caches for entity: {} including prefix and batch caches", targetFQNHash);

    } catch (Exception e) {
      LOG.warn("Error invalidating tag caches for entity {}: {}", targetFQNHash, e.getMessage());
    }
  }

  // Implement missing methods from TagUsageDAO interface
  @Override
  public List<TagLabel> getTagsInternal(String targetFQNHash) {
    return delegate.getTagsInternal(targetFQNHash);
  }

  @Override
  public List<Pair<String, TagLabel>> getTagsInternalByPrefix(String... targetFQNHash) {
    // Only use Redis cache for multi-server consistency
    if (!RelationshipCache.isAvailable()) {
      // For single-server deployments without Redis, go directly to database
      // to avoid stale cache issues
      return delegate.getTagsInternalByPrefix(targetFQNHash);
    }
    
    // Create cache key from the concatenated hash values
    String cacheKey = TAG_PREFIX_CACHE_PREFIX + "internal:" + String.join(":", targetFQNHash);
    
    try {
      Map<String, Object> cachedData = RelationshipCache.get(cacheKey);
      @SuppressWarnings("unchecked")
      List<Pair<String, TagLabel>> cachedResult = 
          (List<Pair<String, TagLabel>>) cachedData.get("prefixTags");
      if (cachedResult != null) {
        LOG.debug("Redis cache hit for getTagsInternalByPrefix with pattern: {}", targetFQNHash[0]);
        return cachedResult;
      }
      
      // Cache miss - fetch from database
      List<Pair<String, TagLabel>> result = delegate.getTagsInternalByPrefix(targetFQNHash);
      
      if (result != null && !result.isEmpty()) {
        Map<String, Object> cacheData = new HashMap<>();
        cacheData.put("prefixTags", result);
        RelationshipCache.put(cacheKey, cacheData);
        LOG.debug(
            "Cached getTagsInternalByPrefix result in Redis with {} entries for pattern: {}", 
            result.size(), 
            targetFQNHash[0]);
      }
      
      return result;
      
    } catch (Exception e) {
      LOG.error("Error with Redis cache for getTagsInternalByPrefix: {}", e.getMessage(), e);
      return delegate.getTagsInternalByPrefix(targetFQNHash);
    }
  }

  @Override
  public List<TagLabelMigration> listAll() {
    return delegate.listAll();
  }

  @Override
  public int getTagCount(int source, String tagFqnHash) {
    return delegate.getTagCount(source, tagFqnHash);
  }

  @Override
  public void deleteTagsByTagAndTargetEntity(String tagFqnHash, String targetFQNHashPrefix) {
    delegate.deleteTagsByTagAndTargetEntity(tagFqnHash, targetFQNHashPrefix);
  }

  @Override
  public void deleteTagLabelsByTargetPrefix(String targetFQNHashPrefix) {
    delegate.deleteTagLabelsByTargetPrefix(targetFQNHashPrefix);
  }

  @Override
  public void upsertFQNHash(
      int source,
      String tagFQN,
      String tagFQNHash,
      String targetFQNHash,
      int labelType,
      int state,
      String targetFQN) {
    delegate.upsertFQNHash(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, targetFQN);
  }

  @Override
  public void renameInternal(int source, String oldFQNHash, String newFQN, String newFQNHash) {
    delegate.renameInternal(source, oldFQNHash, newFQN, newFQNHash);
  }

  @Override
  public void updateTagPrefixInternal(String update) {
    delegate.updateTagPrefixInternal(update);
  }

  @Override
  public List<String> getTargetFQNHashForTag(String tagFQNHash) {
    return delegate.getTargetFQNHashForTag(tagFQNHash);
  }

  @Override
  public List<String> getTargetFQNHashForTagPrefix(String tagFQNHashPrefix) {
    return delegate.getTargetFQNHashForTagPrefix(tagFQNHashPrefix);
  }

  @Override
  public Map<String, Integer> getTagCountsBulk(int source, List<String> tagFQNs) {
    if (!RelationshipCache.isAvailable() || tagFQNs == null || tagFQNs.isEmpty()) {
      return delegate.getTagCountsBulk(source, tagFQNs);
    }

    String cacheKey = TAG_BATCH_CACHE_PREFIX + "counts:" + source + ":" + tagFQNs.hashCode();

    try {
      Map<String, Object> cachedData = RelationshipCache.get(cacheKey);
      @SuppressWarnings("unchecked")
      Map<String, Integer> cachedCounts = (Map<String, Integer>) cachedData.get("tagCounts");
      if (cachedCounts != null) {
        LOG.debug("Cache hit for bulk tag counts: {} tags from source {}", tagFQNs.size(), source);
        return cachedCounts;
      }

      Map<String, Integer> counts = delegate.getTagCountsBulk(source, tagFQNs);

      if (counts != null) {
        Map<String, Object> cacheData = new HashMap<>();
        cacheData.put("tagCounts", counts);
        RelationshipCache.put(cacheKey, cacheData);
        LOG.debug("Cached bulk tag counts for {} tags from source {}", tagFQNs.size(), source);
      }

      return counts;
    } catch (Exception e) {
      LOG.error("Error retrieving bulk tag counts: {}", e.getMessage(), e);
      return delegate.getTagCountsBulk(source, tagFQNs);
    }
  }

  @Override
  @Deprecated
  public List<Map.Entry<String, Integer>> getTagCountsBulkComplex(
      String sampleTagFQN,
      int source,
      String tagFQNHash,
      String tagFQNHashPrefix,
      List<String> tagFQNs) {
    // Since this is deprecated, we'll delegate directly without caching
    // This ensures backward compatibility while encouraging use of the newer method
    return delegate.getTagCountsBulkComplex(
        sampleTagFQN, source, tagFQNHash, tagFQNHashPrefix, tagFQNs);
  }

  @Override
  public void applyTagsBatch(List<TagLabel> tagLabels, String targetFQN) {
    if (tagLabels == null || tagLabels.isEmpty()) {
      return;
    }

    try {
      delegate.applyTagsBatch(tagLabels, targetFQN);
      if (RelationshipCache.isAvailable()) {
        String targetFQNHash = FullyQualifiedName.buildHash(targetFQN);
        invalidateTagCaches(targetFQNHash);

        // Update tag usage counters
        for (TagLabel tagLabel : tagLabels) {
          RelationshipCache.bumpTag(tagLabel.getTagFQN(), 1);
        }

        LOG.debug(
            "Applied {} tags to entity {} in batch and invalidated cache",
            tagLabels.size(),
            targetFQN);
      }
    } catch (Exception e) {
      LOG.error("Error applying tags batch to entity {}: {}", targetFQN, e.getMessage(), e);
      throw e;
    }
  }

  @Override
  public void deleteTagsBatch(List<TagLabel> tagLabels, String targetFQN) {
    if (tagLabels == null || tagLabels.isEmpty()) {
      return;
    }

    try {
      delegate.deleteTagsBatch(tagLabels, targetFQN);
      if (RelationshipCache.isAvailable()) {
        String targetFQNHash = FullyQualifiedName.buildHash(targetFQN);
        invalidateTagCaches(targetFQNHash);

        // Update tag usage counters
        for (TagLabel tagLabel : tagLabels) {
          RelationshipCache.bumpTag(tagLabel.getTagFQN(), -1);
        }

        LOG.debug(
            "Deleted {} tags from entity {} in batch and invalidated cache",
            tagLabels.size(),
            targetFQN);
      }
    } catch (Exception e) {
      LOG.error("Error deleting tags batch from entity {}: {}", targetFQN, e.getMessage(), e);
      throw e;
    }
  }

  @Override
  public void applyTagsBatchInternal(
      List<Integer> sources,
      List<String> tagFQNs,
      List<String> tagFQNHashes,
      List<String> targetFQNs,
      List<String> targetFQNHashes,
      List<Integer> labelTypes,
      List<Integer> states) {
    // This is an internal method that delegates directly to the database
    delegate.applyTagsBatchInternal(
        sources, tagFQNs, tagFQNHashes, targetFQNs, targetFQNHashes, labelTypes, states);
  }

  @Override
  public void deleteTagsBatchInternal(
      List<Integer> sources, List<String> tagFQNHashes, List<String> targetFQNHashes) {
    // This is an internal method that delegates directly to the database
    delegate.deleteTagsBatchInternal(sources, tagFQNHashes, targetFQNHashes);
  }
  
  @Override
  public List<String> getTargetFQNsForTag(String tagFQN) {
    return delegate.getTargetFQNsForTag(tagFQN);
  }
}
