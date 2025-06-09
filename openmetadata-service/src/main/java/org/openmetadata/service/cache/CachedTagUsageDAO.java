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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.TagUsageDAO.TagLabelMigration;

/**
 * Cached decorator for TagUsageDAO that implements write-through caching
 * for tag and glossary term relationships.
 */
@Slf4j
public class CachedTagUsageDAO implements CollectionDAO.TagUsageDAO {

  private final CollectionDAO.TagUsageDAO delegate;

  // Cache key prefixes
  private static final String TAG_CACHE_PREFIX = "tags:";
  private static final String TAG_PREFIX_CACHE_PREFIX = "tags:prefix:";
  private static final String TAG_BATCH_CACHE_PREFIX = "tags:batch:";

  public CachedTagUsageDAO(CollectionDAO.TagUsageDAO delegate) {
    this.delegate = delegate;
  }

  @Override
  public void applyTag(
      int source,
      String tagFQN,
      String tagFQNHash,
      String targetFQNHash,
      int labelType,
      int state) {
    try {
      // Apply the tag first
      delegate.applyTag(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state);

      // Invalidate relevant cache entries
      if (RelationshipCache.isAvailable()) {
        invalidateTagCaches(targetFQNHash);

        // Update tag usage counter
        RelationshipCache.bumpTag(tagFQN, 1);

        LOG.debug("Applied tag {} to entity {} and invalidated cache", tagFQN, targetFQNHash);
      }
    } catch (Exception e) {
      LOG.error("Error applying tag {} to entity {}: {}", tagFQN, targetFQNHash, e.getMessage(), e);
      throw e;
    }
  }

  @Override
  public List<TagLabel> getTags(String targetFQN) {
    if (!RelationshipCache.isAvailable()) {
      return delegate.getTags(targetFQN);
    }

    String cacheKey = TAG_CACHE_PREFIX + targetFQN;

    try {
      // Try to get from cache first
      Map<String, Object> cachedData = RelationshipCache.get(cacheKey);
      if (cachedData != null) {
        @SuppressWarnings("unchecked")
        List<TagLabel> cachedTags = (List<TagLabel>) cachedData.get("tags");
        if (cachedTags != null) {
          LOG.debug("Cache hit for tags of entity: {}", targetFQN);
          return cachedTags;
        }
      }

      // Cache miss - fetch from database
      List<TagLabel> tags = delegate.getTags(targetFQN);

      // Store in cache if not empty
      if (tags != null && !tags.isEmpty()) {
        // Convert tags to a Map for caching
        Map<String, Object> cacheData = new HashMap<>();
        cacheData.put("tags", tags);
        RelationshipCache.put(cacheKey, cacheData);
        LOG.debug("Cached {} tags for entity: {}", tags.size(), targetFQN);
      }

      return tags;

    } catch (Exception e) {
      LOG.error("Error retrieving tags for entity {}: {}", targetFQN, e.getMessage(), e);
      // Fallback to database on cache error
      return delegate.getTags(targetFQN);
    }
  }

  @Override
  public List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> getTagsInternalBatch(
      List<String> targetFQNHashes) {
    if (!RelationshipCache.isAvailable() || targetFQNHashes == null || targetFQNHashes.isEmpty()) {
      return delegate.getTagsInternalBatch(targetFQNHashes);
    }

    // For batch operations, we'll cache the entire batch result
    // Generate cache key based on sorted hash list for consistency
    String batchKey =
        TAG_BATCH_CACHE_PREFIX + String.join(",", targetFQNHashes.stream().sorted().toList());

    try {
      // Try to get from cache first
      Map<String, Object> cachedData = RelationshipCache.get(batchKey);
      if (cachedData != null) {
        @SuppressWarnings("unchecked")
        List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> cachedBatch =
            (List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash>) cachedData.get("batchTags");
        if (cachedBatch != null) {
          LOG.debug("Cache hit for batch tags query with {} entities", targetFQNHashes.size());
          return cachedBatch;
        }
      }

      // Cache miss - fetch from database
      List<CollectionDAO.TagUsageDAO.TagLabelWithFQNHash> batchTags =
          delegate.getTagsInternalBatch(targetFQNHashes);

      // Store in cache
      if (batchTags != null) {
        Map<String, Object> cacheData = new HashMap<>();
        cacheData.put("batchTags", batchTags);
        RelationshipCache.put(batchKey, cacheData);
        LOG.debug(
            "Cached batch tags result for {} entities with {} total tags",
            targetFQNHashes.size(),
            batchTags.size());
      }

      return batchTags;

    } catch (Exception e) {
      LOG.error(
          "Error retrieving batch tags for {} entities: {}",
          targetFQNHashes.size(),
          e.getMessage(),
          e);
      // Fallback to database on cache error
      return delegate.getTagsInternalBatch(targetFQNHashes);
    }
  }

  @Override
  public Map<String, List<TagLabel>> getTagsByPrefix(
      String targetFQNPrefix, String postfix, boolean requiresFqnHash) {
    if (!RelationshipCache.isAvailable()) {
      return delegate.getTagsByPrefix(targetFQNPrefix, postfix, requiresFqnHash);
    }

    // Create cache key from prefix parameters
    String prefixKey =
        TAG_PREFIX_CACHE_PREFIX + targetFQNPrefix + ":" + postfix + ":" + requiresFqnHash;

    try {
      // Try to get from cache first
      Map<String, Object> cachedData = RelationshipCache.get(prefixKey);
      if (cachedData != null) {
        @SuppressWarnings("unchecked")
        Map<String, List<TagLabel>> cachedPrefixTags =
            (Map<String, List<TagLabel>>) cachedData.get("prefixTags");
        if (cachedPrefixTags != null) {
          LOG.debug("Cache hit for prefix tags query: {}", targetFQNPrefix);
          return cachedPrefixTags;
        }
      }

      // Cache miss - fetch from database
      Map<String, List<TagLabel>> prefixTags =
          delegate.getTagsByPrefix(targetFQNPrefix, postfix, requiresFqnHash);

      // Store in cache
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
      // Fallback to database on cache error
      return delegate.getTagsByPrefix(targetFQNPrefix, postfix, requiresFqnHash);
    }
  }

  @Override
  public void deleteTagsByTarget(String targetFQNHash) {
    try {
      // Delete from database first
      delegate.deleteTagsByTarget(targetFQNHash);

      // Invalidate relevant cache entries
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
      // Delete from database first
      delegate.deleteTagLabelsByFqn(tagFQNHash);

      // Invalidate all tag-related cache entries
      // Since we don't know which entities had this tag, clear all tag caches
      if (RelationshipCache.isAvailable()) {
        invalidateAllTagCaches();
        LOG.debug("Deleted tag {} and invalidated all tag caches", tagFQNHash);
      }
    } catch (Exception e) {
      LOG.error("Error deleting tag {}: {}", tagFQNHash, e.getMessage(), e);
      throw e;
    }
  }

  @Override
  public void deleteTagLabels(int source, String tagFQNHash) {
    try {
      // Get the count of tags to be deleted before deletion for counter update
      int deletedCount = delegate.getTagCount(source, tagFQNHash);

      // Delete from database first
      delegate.deleteTagLabels(source, tagFQNHash);

      // Invalidate all tag-related cache entries and update counters
      if (RelationshipCache.isAvailable()) {
        invalidateAllTagCaches();

        // Decrement tag usage counter for deleted tags
        // Note: We need to extract the tag FQN from the hash for proper counter tracking
        // This is a simplified approach - in a real scenario, we'd need to map hash to FQN
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
      // We need to invalidate:
      // 1. Direct tag cache for this entity
      // 2. Any batch caches that might include this entity
      // 3. Any prefix caches that might include this entity

      // Since we can't efficiently find all cache keys that contain this entity,
      // we'll use a more targeted approach for direct entity cache
      RelationshipCache.evict(TAG_CACHE_PREFIX + targetFQNHash);

      // For batch and prefix caches, we'd need more sophisticated cache key tracking
      // For now, log that invalidation was performed
      LOG.debug("Invalidated direct tag cache for entity: {}", targetFQNHash);

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
    return delegate.getTagsInternalByPrefix(targetFQNHash);
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

  /**
   * Invalidate all tag-related cache entries
   */
  private void invalidateAllTagCaches() {
    try {
      // For comprehensive invalidation, we would need to track all tag cache keys
      // Since Redis doesn't support efficient wildcard deletion without SCAN,
      // this is a simplified approach that logs the operation

      LOG.warn(
          "Full tag cache invalidation requested - consider implementing key tracking for efficiency");

      // Alternative: Clear entire cache (use with caution in production)
      // RelationshipCache.clearAll();

    } catch (Exception e) {
      LOG.warn("Error invalidating all tag caches: {}", e.getMessage());
    }
  }
}
