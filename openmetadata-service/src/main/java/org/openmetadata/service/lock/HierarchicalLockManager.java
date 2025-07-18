package org.openmetadata.service.lock;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityLockedException;
import org.openmetadata.service.jdbi3.DeletionLock;
import org.openmetadata.service.jdbi3.DeletionLockDAO;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Manages hierarchical locks for entity deletion to prevent orphaned entities
 * during cascade deletion operations.
 */
@Slf4j
public class HierarchicalLockManager {
  
  private final DeletionLockDAO lockDAO;
  
  // Cache of locked FQN prefixes for fast lookup
  private final Cache<String, Set<String>> fqnCache = Caffeine.newBuilder()
      .maximumSize(10000)
      .expireAfterWrite(5, TimeUnit.MINUTES)
      .build();
  
  // Configuration
  private static final int DEFAULT_LOCK_TIMEOUT_HOURS = 1;
  private static final int STALE_LOCK_CHECK_INTERVAL_MINUTES = 5;
  
  public HierarchicalLockManager(DeletionLockDAO lockDAO) {
    this.lockDAO = lockDAO;
  }
  
  /**
   * Acquire deletion lock for an entity and all its children
   */
  @Transaction
  public DeletionLock acquireDeletionLock(EntityInterface entity, String lockedBy, boolean cascade) {
    // Check if any parent is already locked
    checkParentLocks(entity);
    
    // Check if this entity is already locked
    String entityType = Entity.getEntityTypeFromObject(entity);
    DeletionLock existingLock = lockDAO.findByEntity(entity.getId(), entityType);
    if (existingLock != null) {
      throw new EntityLockedException(
          String.format("Entity %s is already locked for deletion by %s at %s",
              entity.getFullyQualifiedName(), existingLock.getLockedBy(), existingLock.getLockedAt())
      );
    }
    
    // Create lock entry
    DeletionLock lock = DeletionLock.builder()
        .id(UUID.randomUUID())
        .entityId(entity.getId())
        .entityType(entityType)
        .entityFqn(entity.getFullyQualifiedName())
        .lockType(DeletionLock.LockType.DELETE_IN_PROGRESS.getValue())
        .lockedBy(lockedBy)
        .lockedAt(Instant.now())
        .deletionScope(cascade ? DeletionLock.DeletionScope.CASCADE.getValue() 
                              : DeletionLock.DeletionScope.ENTITY_ONLY.getValue())
        .expectedCompletion(estimateCompletionTime(entity, cascade))
        .build();
    
    try {
      lockDAO.insert(lock);
      
      // Update cache
      invalidateFqnCache(entity.getFullyQualifiedName());
      
      LOG.info("Acquired deletion lock for entity {} by {}", entity.getFullyQualifiedName(), lockedBy);
      return lock;
      
    } catch (Exception e) {
      LOG.error("Failed to acquire deletion lock for entity {}: {}", 
          entity.getFullyQualifiedName(), e.getMessage());
      throw new RuntimeException("Failed to acquire deletion lock", e);
    }
  }
  
  /**
   * Check if any parent entity has an active deletion lock
   */
  private void checkParentLocks(EntityInterface entity) {
    String fqn = entity.getFullyQualifiedName();
    List<String> parentFqns = getParentFqns(fqn);
    
    for (String parentFqn : parentFqns) {
      List<DeletionLock> locks = lockDAO.findByFqnPrefix(parentFqn);
      if (!locks.isEmpty()) {
        DeletionLock activeLock = locks.get(0);
        throw new EntityLockedException(
            String.format("Cannot modify entity %s. Parent entity %s is being deleted. " +
                          "Deletion started at %s, expected completion: %s",
                          fqn, activeLock.getEntityFqn(), 
                          activeLock.getLockedAt(), 
                          activeLock.getExpectedCompletion())
        );
      }
    }
  }
  
  /**
   * Check if entity creation/update is allowed (no parent deletion in progress)
   */
  public void checkModificationAllowed(EntityInterface entity) {
    String fqn = entity.getFullyQualifiedName();
    
    // Fast path: check cache first
    if (isFqnLocked(fqn)) {
      // Slow path: check database for details
      checkParentLocks(entity);
    }
  }
  
  /**
   * Check if entity creation/update is allowed by FQN
   */
  public void checkModificationAllowedByFqn(String fqn) {
    // Check if any parent FQN has a lock
    List<DeletionLock> parentLocks = lockDAO.findParentLocks(fqn);
    if (!parentLocks.isEmpty()) {
      DeletionLock lock = parentLocks.get(0);
      throw new EntityLockedException(
          String.format("Cannot create/modify entity under %s. Parent %s is being deleted. " +
                        "Started at %s, expected completion: %s",
                        fqn, lock.getEntityFqn(), lock.getLockedAt(), lock.getExpectedCompletion())
      );
    }
  }
  
  /**
   * Release deletion lock
   */
  @Transaction
  public void releaseDeletionLock(UUID entityId, String entityType) {
    DeletionLock lock = lockDAO.findByEntity(entityId, entityType);
    if (lock != null) {
      lockDAO.delete(lock.getId());
      invalidateFqnCache(lock.getEntityFqn());
      LOG.info("Released deletion lock for entity {} (was locked by {})", 
          lock.getEntityFqn(), lock.getLockedBy());
    }
  }
  
  /**
   * Get deletion lock status for an entity
   */
  public DeletionLock getLock(UUID entityId, String entityType) {
    return lockDAO.findByEntity(entityId, entityType);
  }
  
  /**
   * Get all active deletion locks
   */
  public List<DeletionLock> getAllActiveLocks() {
    // This would need a new DAO method to get all locks
    return Collections.emptyList(); // Placeholder
  }
  
  /**
   * Clean up stale locks (for crashed deletions)
   * This method should be called periodically by a background job
   */
  public void cleanupStaleLocks() {
    Instant staleTime = Instant.now().minus(DEFAULT_LOCK_TIMEOUT_HOURS, ChronoUnit.HOURS);
    List<DeletionLock> staleLocks = lockDAO.findStaleLocks(staleTime);
    
    for (DeletionLock lock : staleLocks) {
      LOG.warn("Cleaning up stale deletion lock for entity: {} locked at: {} by: {}", 
               lock.getEntityFqn(), lock.getLockedAt(), lock.getLockedBy());
      releaseDeletionLock(lock.getEntityId(), lock.getEntityType());
    }
    
    if (!staleLocks.isEmpty()) {
      LOG.info("Cleaned up {} stale deletion locks", staleLocks.size());
    }
  }
  
  /**
   * Force cleanup of all stale locks older than specified duration
   */
  public int forceCleanupStaleLocks(Duration olderThan) {
    Instant staleTime = Instant.now().minus(olderThan);
    int deleted = lockDAO.deleteStaleLocks(staleTime);
    
    if (deleted > 0) {
      // Clear cache as we don't know which FQNs were affected
      fqnCache.invalidateAll();
      LOG.info("Force cleaned up {} stale deletion locks older than {}", deleted, olderThan);
    }
    
    return deleted;
  }
  
  /**
   * Get lock statistics
   */
  public Map<String, Object> getLockStatistics() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("totalActiveLocks", lockDAO.countActiveLocks());
    stats.put("cacheSize", fqnCache.estimatedSize());
    
    // Add per-entity-type counts if needed
    for (String entityType : Entity.getEntityList()) {
      int count = lockDAO.countActiveLocksByType(entityType);
      if (count > 0) {
        stats.put(entityType + "Locks", count);
      }
    }
    
    return stats;
  }
  
  // Helper methods
  
  /**
   * Extract parent FQNs from a given FQN
   * For example: "service.database.schema.table" returns:
   * ["service", "service.database", "service.database.schema"]
   */
  private List<String> getParentFqns(String fqn) {
    List<String> parents = new ArrayList<>();
    String[] parts = fqn.split("\\.");
    
    StringBuilder current = new StringBuilder();
    for (int i = 0; i < parts.length - 1; i++) {
      if (i > 0) {
        current.append(".");
      }
      current.append(parts[i]);
      parents.add(current.toString());
    }
    
    return parents;
  }
  
  /**
   * Check if an FQN is locked using cache
   */
  private boolean isFqnLocked(String fqn) {
    Set<String> lockedPrefixes = fqnCache.get("all", k -> loadLockedFqnPrefixes());
    
    // Check if any locked prefix matches this FQN
    for (String prefix : lockedPrefixes) {
      if (fqn.startsWith(prefix + ".") || fqn.equals(prefix)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Load all locked FQN prefixes from database
   */
  private Set<String> loadLockedFqnPrefixes() {
    // This would need a DAO method to get all locked FQNs
    // For now, return empty set
    return new HashSet<>();
  }
  
  /**
   * Invalidate FQN cache
   */
  private void invalidateFqnCache(String fqn) {
    fqnCache.invalidate("all");
  }
  
  /**
   * Estimate completion time based on entity type and cascade scope
   */
  private Instant estimateCompletionTime(EntityInterface entity, boolean cascade) {
    // Simple estimation - can be made more sophisticated based on entity counts
    int estimatedMinutes = cascade ? 30 : 5;
    
    // For certain entity types, adjust the estimate
    String entityType = Entity.getEntityTypeFromObject(entity);
    if (Entity.DATABASE_SERVICE.equals(entityType)) {
      estimatedMinutes = cascade ? 120 : 10; // Database services take longer
    } else if (Entity.DATABASE.equals(entityType)) {
      estimatedMinutes = cascade ? 60 : 5;
    }
    
    return Instant.now().plus(estimatedMinutes, ChronoUnit.MINUTES);
  }
}