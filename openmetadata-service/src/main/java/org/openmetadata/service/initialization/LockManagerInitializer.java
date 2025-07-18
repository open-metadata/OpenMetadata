package org.openmetadata.service.initialization;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.lock.HierarchicalLockManager;

/**
 * Initializes the hierarchical lock manager for OpenMetadata entity deletion optimization.
 * This should be called during application startup.
 */
@Slf4j
public class LockManagerInitializer {
  
  private static volatile boolean initialized = false;
  
  /**
   * Initialize the lock manager. This method is safe to call multiple times.
   */
  public static void initialize() {
    if (initialized) {
      return;
    }
    
    synchronized (LockManagerInitializer.class) {
      if (initialized) {
        return;
      }
      
      try {
        LOG.info("Initializing hierarchical lock manager for entity deletion optimization");
        
        // Get the collection DAO
        var collectionDAO = Entity.getCollectionDAO();
        if (collectionDAO == null) {
          LOG.warn("CollectionDAO not available, skipping lock manager initialization");
          return;
        }
        
        // Initialize the lock manager
        HierarchicalLockManager lockManager = new HierarchicalLockManager(
            collectionDAO.deletionLockDAO()
        );
        
        // Set it on EntityRepository
        EntityRepository.setLockManager(lockManager);
        
        initialized = true;
        LOG.info("Hierarchical lock manager initialized successfully");
        
      } catch (Exception e) {
        LOG.error("Failed to initialize hierarchical lock manager: {}", e.getMessage(), e);
        // Continue without locking for backward compatibility
      }
    }
  }
  
  /**
   * Check if the lock manager is initialized
   */
  public static boolean isInitialized() {
    return initialized;
  }
  
  /**
   * Force re-initialization (for testing)
   */
  public static void forceReinitialize() {
    initialized = false;
    initialize();
  }
}