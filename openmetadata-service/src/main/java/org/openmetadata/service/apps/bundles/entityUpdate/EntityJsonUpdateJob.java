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

package org.openmetadata.service.apps.bundles.entityUpdate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import java.util.ArrayList;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.schema.utils.JsonUtils;
import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

/**
 * Background job to update entity JSONs when relationships change.
 * This maintains consistency in the hybrid storage model where relationships
 * are stored both in JSON and relationship tables.
 * 
 * This job processes updates asynchronously to avoid blocking delete/rename operations.
 * It's triggered from postDelete() and update() methods of repositories.
 */
@Slf4j
public class EntityJsonUpdateJob extends AbstractNativeApplication implements Job {
  
  private static final BlockingQueue<UpdateTask> updateQueue = new LinkedBlockingQueue<>(10000);
  private static final ObjectMapper mapper = JsonUtils.getObjectMapper();
  private static boolean isRunning = false;
  private static EntityJsonUpdateJob instance;
  
  // Task types
  @Data
  @Builder
  public static class UpdateTask {
    public enum TaskType {
      TAG_DELETED,
      TAG_RENAMED,
      OWNER_DELETED,
      OWNER_RENAMED,
      DOMAIN_DELETED,
      DOMAIN_RENAMED,
      DATA_PRODUCT_DELETED,
      DATA_PRODUCT_RENAMED
    }
    
    private TaskType type;
    private String oldFQN;
    private String newFQN;
    private String newName;
    private UUID entityId;
    private String entityType;
    private TagSource tagSource;
  }
  
  public EntityJsonUpdateJob(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
    instance = this;
  }
  
  public static EntityJsonUpdateJob getInstance() {
    if (instance == null) {
      // Return a dummy instance that just queues tasks without processing
      // The real instance will be created when the job is initialized
      return new EntityJsonUpdateJob(null, null) {
        @Override
        public void execute(JobExecutionContext context) {
          // No-op for dummy instance
        }
      };
    }
    return instance;
  }
  
  // Public methods for enqueuing updates
  public void enqueueEntityDelete(EntityInterface entity) {
    if (entity == null) return;
    
    // Check if this is a tag, owner, domain, or data product
    String entityType = entity.getEntityReference().getType();
    
    if (Entity.TAG.equals(entityType) || Entity.CLASSIFICATION.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.TAG_DELETED)
          .oldFQN(entity.getFullyQualifiedName())
          .tagSource(TagSource.CLASSIFICATION)
          .build();
      updateQueue.offer(task);
    } else if (Entity.USER.equals(entityType) || Entity.TEAM.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.OWNER_DELETED)
          .entityId(entity.getId())
          .entityType(entityType)
          .build();
      updateQueue.offer(task);
    } else if (Entity.DOMAIN.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.DOMAIN_DELETED)
          .entityId(entity.getId())
          .build();
      updateQueue.offer(task);
    } else if (Entity.DATA_PRODUCT.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.DATA_PRODUCT_DELETED)
          .entityId(entity.getId())
          .build();
      updateQueue.offer(task);
    }
  }
  
  public void enqueueEntityRename(EntityInterface oldEntity, EntityInterface newEntity) {
    if (oldEntity == null || newEntity == null) return;
    
    String entityType = newEntity.getEntityReference().getType();
    
    if (Entity.TAG.equals(entityType) || Entity.CLASSIFICATION.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.TAG_RENAMED)
          .oldFQN(oldEntity.getFullyQualifiedName())
          .newFQN(newEntity.getFullyQualifiedName())
          .newName(newEntity.getName())
          .tagSource(TagSource.CLASSIFICATION)
          .build();
      updateQueue.offer(task);
    } else if (Entity.USER.equals(entityType) || Entity.TEAM.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.OWNER_RENAMED)
          .entityId(newEntity.getId())
          .entityType(entityType)
          .newName(newEntity.getName())
          .newFQN(newEntity.getFullyQualifiedName())
          .build();
      updateQueue.offer(task);
    } else if (Entity.DOMAIN.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.DOMAIN_RENAMED)
          .entityId(newEntity.getId())
          .newName(newEntity.getName())
          .newFQN(newEntity.getFullyQualifiedName())
          .build();
      updateQueue.offer(task);
    } else if (Entity.DATA_PRODUCT.equals(entityType)) {
      UpdateTask task = UpdateTask.builder()
          .type(UpdateTask.TaskType.DATA_PRODUCT_RENAMED)
          .entityId(newEntity.getId())
          .newName(newEntity.getName())
          .newFQN(newEntity.getFullyQualifiedName())
          .build();
      updateQueue.offer(task);
    }
  }
  
  @Override
  public void execute(JobExecutionContext context) {
    if (isRunning) {
      LOG.info("EntityJsonUpdateJob is already running, skipping this execution");
      return;
    }
    
    try {
      isRunning = true;
      processQueuedUpdates();
    } finally {
      isRunning = false;
    }
  }
  
  /**
   * Process all queued update tasks
   */
  private void processQueuedUpdates() {
    int processedCount = 0;
    UpdateTask task;
    
    LOG.info("Starting EntityJsonUpdateJob, queue size: {}", updateQueue.size());
    
    try {
      while ((task = updateQueue.poll(100, TimeUnit.MILLISECONDS)) != null) {
        try {
          processTask(task);
          processedCount++;
          
          if (processedCount % 100 == 0) {
            LOG.info("Processed {} entity JSON updates", processedCount);
          }
        } catch (Exception e) {
          LOG.error("Error processing update task {}: {}", task, e.getMessage(), e);
        }
      }
    } catch (InterruptedException e) {
      LOG.warn("EntityJsonUpdateJob interrupted", e);
      Thread.currentThread().interrupt();
    }
    
    if (processedCount > 0) {
      LOG.info("EntityJsonUpdateJob completed, processed {} updates", processedCount);
    }
  }
  
  private void processTask(UpdateTask task) {
    switch (task.getType()) {
      case TAG_DELETED:
        processTagDeletion(task.getOldFQN(), task.getTagSource());
        break;
      case TAG_RENAMED:
        processTagRename(task.getOldFQN(), task.getNewFQN(), task.getNewName(), task.getTagSource());
        break;
      case OWNER_DELETED:
        processOwnerDeletion(task.getEntityId(), task.getEntityType());
        break;
      case OWNER_RENAMED:
        processOwnerRename(task.getEntityId(), task.getEntityType(), task.getNewName(), task.getNewFQN());
        break;
      case DOMAIN_DELETED:
        processDomainDeletion(task.getEntityId());
        break;
      case DOMAIN_RENAMED:
        processDomainRename(task.getEntityId(), task.getNewName(), task.getNewFQN());
        break;
      case DATA_PRODUCT_DELETED:
        processDataProductDeletion(task.getEntityId());
        break;
      case DATA_PRODUCT_RENAMED:
        processDataProductRename(task.getEntityId(), task.getNewName(), task.getNewFQN());
        break;
    }
  }
  
  private void processTagDeletion(String tagFQN, TagSource source) {
    // Get all entities that have this tag
    String tagFQNHash = org.openmetadata.service.util.FullyQualifiedName.buildHash(tagFQN);
    List<String> targetFQNHashes = collectionDAO.tagUsageDAO().getTargetFQNHashForTag(tagFQNHash);
    LOG.debug("Removing tag {} from {} entities", tagFQN, targetFQNHashes.size());
    
    for (String targetFQNHash : targetFQNHashes) {
      try {
        removeTagFromEntityJson(targetFQNHash, tagFQN);
      } catch (Exception e) {
        LOG.error("Failed to remove tag {} from entity {}: {}", tagFQN, targetFQNHash, e.getMessage());
      }
    }
  }
  
  private void processTagRename(String oldFQN, String newFQN, String newName, TagSource source) {
    // Get all entities that have this tag (using new FQN as it's already renamed in tag_usage)
    String newFQNHash = org.openmetadata.service.util.FullyQualifiedName.buildHash(newFQN);
    List<String> targetFQNHashes = collectionDAO.tagUsageDAO().getTargetFQNHashForTag(newFQNHash);
    LOG.debug("Renaming tag {} to {} in {} entities", oldFQN, newFQN, targetFQNHashes.size());
    
    for (String targetFQNHash : targetFQNHashes) {
      try {
        updateTagInEntityJson(targetFQNHash, oldFQN, newFQN, newName);
      } catch (Exception e) {
        LOG.error("Failed to rename tag {} in entity {}: {}", oldFQN, targetFQNHash, e.getMessage());
      }
    }
  }
  
  private void processOwnerDeletion(UUID ownerId, String ownerType) {
    // Get all entities owned by this owner
    // Find entities that this owner owns (owner -> entity relationship)
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        collectionDAO.relationshipDAO().findTo(ownerId, ownerType, org.openmetadata.schema.type.Relationship.OWNS.ordinal());
    LOG.debug("Removing owner {} from {} entities", ownerId, relationships.size());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      try {
        removeOwnerFromEntityJson(rel.getId(), rel.getType(), ownerId);
      } catch (Exception e) {
        LOG.error("Failed to remove owner {} from entity {}: {}", ownerId, rel.getId(), e.getMessage());
      }
    }
  }
  
  private void processOwnerRename(UUID ownerId, String ownerType, String newName, String newFQN) {
    // Get all entities owned by this owner
    // Find entities that this owner owns (owner -> entity relationship)
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        collectionDAO.relationshipDAO().findTo(ownerId, ownerType, org.openmetadata.schema.type.Relationship.OWNS.ordinal());
    LOG.debug("Updating owner {} name in {} entities", ownerId, relationships.size());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      try {
        updateOwnerInEntityJson(rel.getId(), rel.getType(), ownerId, newName, newFQN);
      } catch (Exception e) {
        LOG.error("Failed to update owner {} in entity {}: {}", ownerId, rel.getId(), e.getMessage());
      }
    }
  }
  
  private void processDomainDeletion(UUID domainId) {
    // Get all entities in this domain
    // Find entities that belong to this domain
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        collectionDAO.relationshipDAO().findTo(domainId, Entity.DOMAIN, org.openmetadata.schema.type.Relationship.HAS.ordinal());
    LOG.debug("Removing domain {} from {} entities", domainId, relationships.size());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      try {
        removeDomainFromEntityJson(rel.getId(), rel.getType(), domainId);
      } catch (Exception e) {
        LOG.error("Failed to remove domain {} from entity {}: {}", domainId, rel.getId(), e.getMessage());
      }
    }
  }
  
  private void processDomainRename(UUID domainId, String newName, String newFQN) {
    // Get all entities in this domain
    // Find entities that belong to this domain
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        collectionDAO.relationshipDAO().findTo(domainId, Entity.DOMAIN, org.openmetadata.schema.type.Relationship.HAS.ordinal());
    LOG.debug("Updating domain {} name in {} entities", domainId, relationships.size());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      try {
        updateDomainInEntityJson(rel.getId(), rel.getType(), domainId, newName, newFQN);
      } catch (Exception e) {
        LOG.error("Failed to update domain {} in entity {}: {}", domainId, rel.getId(), e.getMessage());
      }
    }
  }
  
  private void processDataProductDeletion(UUID dataProductId) {
    // Find entities that belong to this data product
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        collectionDAO.relationshipDAO().findTo(dataProductId, Entity.DATA_PRODUCT, org.openmetadata.schema.type.Relationship.HAS.ordinal());
    LOG.debug("Removing data product {} from {} entities", dataProductId, relationships.size());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      try {
        removeDataProductFromEntityJson(rel.getId(), rel.getType(), dataProductId);
      } catch (Exception e) {
        LOG.error("Failed to remove data product {} from entity {}: {}", dataProductId, rel.getId(), e.getMessage());
      }
    }
  }
  
  private void processDataProductRename(UUID dataProductId, String newName, String newFQN) {
    // Find entities that belong to this data product
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        collectionDAO.relationshipDAO().findTo(dataProductId, Entity.DATA_PRODUCT, org.openmetadata.schema.type.Relationship.HAS.ordinal());
    LOG.debug("Updating data product {} name in {} entities", dataProductId, relationships.size());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      try {
        updateDataProductInEntityJson(rel.getId(), rel.getType(), dataProductId, newName, newFQN);
      } catch (Exception e) {
        LOG.error("Failed to update data product {} in entity {}: {}", dataProductId, rel.getId(), e.getMessage());
      }
    }
  }
  
  // Individual update methods for each type
  
  private void removeTagFromEntityJson(String targetFQNHash, String tagFQN) {
    // TODO: Need reverse lookup from FQN hash to entity type and ID
    // This would require iterating through entity types or maintaining a mapping
    LOG.debug("Need to implement reverse lookup for targetFQNHash: {}", targetFQNHash);
  }
  
  private void updateTagInEntityJson(String targetFQNHash, String oldFQN, String newFQN, String newName) {
    // TODO: Need reverse lookup from FQN hash to entity type and ID
    LOG.debug("Need to implement reverse lookup for targetFQNHash: {}", targetFQNHash);
  }
  
  private void removeOwnerFromEntityJson(UUID entityId, String entityType, UUID ownerId) {
    try {
      // Get the entity repository to properly update the JSON
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.warn("No repository found for entity type: {}", entityType);
        return;
      }
      
      EntityDAO<?> dao = repository.getDao();
      String json = dao.findById(dao.getTableName(), entityId, "");
      
      if (json != null) {
        ObjectNode entityNode = (ObjectNode) mapper.readTree(json);
        ArrayNode owners = (ArrayNode) entityNode.get("owners");
        
        if (owners != null && owners.size() > 0) {
          boolean modified = false;
          
          for (JsonNode owner : owners) {
            if (owner.has("id")) {
              String id = owner.get("id").asText();
              if (id.equals(ownerId.toString())) {
                // Mark the owner as deleted instead of removing it
                ((ObjectNode) owner).put("deleted", true);
                modified = true;
              }
            }
          }
          
          if (modified) {
            dao.update(entityId, null, mapper.writeValueAsString(entityNode));
            LOG.debug("Marked owner {} as deleted in {} {}", ownerId, entityType, entityId);
          }
        }
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {} {} not found, skipping owner deletion marking", entityType, entityId);
    } catch (Exception e) {
      LOG.error("Error marking owner {} as deleted in {} {}: {}", ownerId, entityType, entityId, e.getMessage());
    }
  }
  
  private void updateOwnerInEntityJson(UUID entityId, String entityType, UUID ownerId, String newName, String newFQN) {
    try {
      // Get the entity repository to properly update the JSON
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.warn("No repository found for entity type: {}", entityType);
        return;
      }
      
      EntityDAO<?> dao = repository.getDao();
      String json = dao.findById(dao.getTableName(), entityId, "");
      
      if (json != null) {
        ObjectNode entityNode = (ObjectNode) mapper.readTree(json);
        ArrayNode owners = (ArrayNode) entityNode.get("owners");
        
        if (owners != null) {
          boolean updated = false;
          
          for (JsonNode owner : owners) {
            if (owner.has("id") && owner.get("id").asText().equals(ownerId.toString())) {
              ((ObjectNode) owner).put("name", newName);
              ((ObjectNode) owner).put("fullyQualifiedName", newFQN);
              ((ObjectNode) owner).put("displayName", newName);
              updated = true;
            }
          }
          
          if (updated) {
            dao.update(entityId, null, mapper.writeValueAsString(entityNode));
            LOG.debug("Updated owner {} name in {} {}", ownerId, entityType, entityId);
          }
        }
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {} {} not found, skipping owner update", entityType, entityId);
    } catch (Exception e) {
      LOG.error("Error updating owner {} in {} {}: {}", ownerId, entityType, entityId, e.getMessage());
    }
  }
  
  private void removeDomainFromEntityJson(UUID entityId, String entityType, UUID domainId) {
    try {
      // Get the entity repository to properly update the JSON
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.warn("No repository found for entity type: {}", entityType);
        return;
      }
      
      EntityDAO<?> dao = repository.getDao();
      String json = dao.findById(dao.getTableName(), entityId, "");
      
      if (json != null) {
        ObjectNode entityNode = (ObjectNode) mapper.readTree(json);
        ArrayNode domains = (ArrayNode) entityNode.get("domains");
        
        if (domains != null && domains.size() > 0) {
          ArrayNode newDomains = mapper.createArrayNode();
          boolean removed = false;
          
          for (JsonNode domain : domains) {
            if (domain.has("id")) {
              String id = domain.get("id").asText();
              if (!id.equals(domainId.toString())) {
                newDomains.add(domain);
              } else {
                removed = true;
              }
            }
          }
          
          if (removed) {
            entityNode.set("domains", newDomains);
            dao.update(entityId, null, mapper.writeValueAsString(entityNode));
            LOG.debug("Removed domain {} from {} {}", domainId, entityType, entityId);
          }
        }
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {} {} not found, skipping domain removal", entityType, entityId);
    } catch (Exception e) {
      LOG.error("Error removing domain {} from {} {}: {}", domainId, entityType, entityId, e.getMessage());
    }
  }
  
  private void updateDomainInEntityJson(UUID entityId, String entityType, UUID domainId, String newName, String newFQN) {
    try {
      // Get the entity repository to properly update the JSON
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.warn("No repository found for entity type: {}", entityType);
        return;
      }
      
      EntityDAO<?> dao = repository.getDao();
      String json = dao.findById(dao.getTableName(), entityId, "");
      
      if (json != null) {
        ObjectNode entityNode = (ObjectNode) mapper.readTree(json);
        ArrayNode domains = (ArrayNode) entityNode.get("domains");
        
        if (domains != null) {
          boolean updated = false;
          
          for (JsonNode domain : domains) {
            if (domain.has("id") && domain.get("id").asText().equals(domainId.toString())) {
              ((ObjectNode) domain).put("name", newName);
              ((ObjectNode) domain).put("fullyQualifiedName", newFQN);
              ((ObjectNode) domain).put("displayName", newName);
              updated = true;
            }
          }
          
          if (updated) {
            dao.update(entityId, null, mapper.writeValueAsString(entityNode));
            LOG.debug("Updated domain {} name in {} {}", domainId, entityType, entityId);
          }
        }
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {} {} not found, skipping domain update", entityType, entityId);
    } catch (Exception e) {
      LOG.error("Error updating domain {} in {} {}: {}", domainId, entityType, entityId, e.getMessage());
    }
  }
  
  private void removeDataProductFromEntityJson(UUID entityId, String entityType, UUID dataProductId) {
    try {
      // Get the entity repository to properly update the JSON
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.warn("No repository found for entity type: {}", entityType);
        return;
      }
      
      EntityDAO<?> dao = repository.getDao();
      String json = dao.findById(dao.getTableName(), entityId, "");
      
      if (json != null) {
        ObjectNode entityNode = (ObjectNode) mapper.readTree(json);
        ArrayNode dataProducts = (ArrayNode) entityNode.get("dataProducts");
        
        if (dataProducts != null && dataProducts.size() > 0) {
          ArrayNode newDataProducts = mapper.createArrayNode();
          boolean removed = false;
          
          for (JsonNode dataProduct : dataProducts) {
            if (dataProduct.has("id")) {
              String id = dataProduct.get("id").asText();
              if (!id.equals(dataProductId.toString())) {
                newDataProducts.add(dataProduct);
              } else {
                removed = true;
              }
            }
          }
          
          if (removed) {
            entityNode.set("dataProducts", newDataProducts);
            dao.update(entityId, null, mapper.writeValueAsString(entityNode));
            LOG.debug("Removed data product {} from {} {}", dataProductId, entityType, entityId);
          }
        }
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {} {} not found, skipping data product removal", entityType, entityId);
    } catch (Exception e) {
      LOG.error("Error removing data product {} from {} {}: {}", dataProductId, entityType, entityId, e.getMessage());
    }
  }
  
  private void updateDataProductInEntityJson(UUID entityId, String entityType, UUID dataProductId, String newName, String newFQN) {
    try {
      // Get the entity repository to properly update the JSON
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      if (repository == null) {
        LOG.warn("No repository found for entity type: {}", entityType);
        return;
      }
      
      EntityDAO<?> dao = repository.getDao();
      String json = dao.findById(dao.getTableName(), entityId, "");
      
      if (json != null) {
        ObjectNode entityNode = (ObjectNode) mapper.readTree(json);
        ArrayNode dataProducts = (ArrayNode) entityNode.get("dataProducts");
        
        if (dataProducts != null) {
          boolean updated = false;
          
          for (JsonNode dataProduct : dataProducts) {
            if (dataProduct.has("id") && dataProduct.get("id").asText().equals(dataProductId.toString())) {
              ((ObjectNode) dataProduct).put("name", newName);
              ((ObjectNode) dataProduct).put("fullyQualifiedName", newFQN);
              ((ObjectNode) dataProduct).put("displayName", newName);
              updated = true;
            }
          }
          
          if (updated) {
            dao.update(entityId, null, mapper.writeValueAsString(entityNode));
            LOG.debug("Updated data product {} name in {} {}", dataProductId, entityType, entityId);
          }
        }
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Entity {} {} not found, skipping data product update", entityType, entityId);
    } catch (Exception e) {
      LOG.error("Error updating data product {} in {} {}: {}", dataProductId, entityType, entityId, e.getMessage());
    }
  }
  
  // Static methods to queue updates from repositories
  
  public static void queueTagDeletion(String tagFQN, TagSource source) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.TAG_DELETED)
          .oldFQN(tagFQN)
          .tagSource(source)
          .build());
      LOG.debug("Queued tag deletion for {}", tagFQN);
    } catch (Exception e) {
      LOG.error("Failed to queue tag deletion for {}: {}", tagFQN, e.getMessage());
    }
  }
  
  public static void queueTagRename(String oldFQN, String newFQN, String newName, TagSource source) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.TAG_RENAMED)
          .oldFQN(oldFQN)
          .newFQN(newFQN)
          .newName(newName)
          .tagSource(source)
          .build());
      LOG.debug("Queued tag rename from {} to {}", oldFQN, newFQN);
    } catch (Exception e) {
      LOG.error("Failed to queue tag rename from {} to {}: {}", oldFQN, newFQN, e.getMessage());
    }
  }
  
  public static void queueOwnerDeletion(UUID ownerId, String ownerType) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.OWNER_DELETED)
          .entityId(ownerId)
          .entityType(ownerType)
          .build());
      LOG.debug("Queued owner deletion for {}", ownerId);
    } catch (Exception e) {
      LOG.error("Failed to queue owner deletion for {}: {}", ownerId, e.getMessage());
    }
  }
  
  public static void queueOwnerRename(UUID ownerId, String ownerType, String newName, String newFQN) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.OWNER_RENAMED)
          .entityId(ownerId)
          .entityType(ownerType)
          .newName(newName)
          .newFQN(newFQN)
          .build());
      LOG.debug("Queued owner rename for {}", ownerId);
    } catch (Exception e) {
      LOG.error("Failed to queue owner rename for {}: {}", ownerId, e.getMessage());
    }
  }
  
  public static void queueDomainDeletion(UUID domainId) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.DOMAIN_DELETED)
          .entityId(domainId)
          .build());
      LOG.debug("Queued domain deletion for {}", domainId);
    } catch (Exception e) {
      LOG.error("Failed to queue domain deletion for {}: {}", domainId, e.getMessage());
    }
  }
  
  public static void queueDomainRename(UUID domainId, String newName, String newFQN) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.DOMAIN_RENAMED)
          .entityId(domainId)
          .newName(newName)
          .newFQN(newFQN)
          .build());
      LOG.debug("Queued domain rename for {}", domainId);
    } catch (Exception e) {
      LOG.error("Failed to queue domain rename for {}: {}", domainId, e.getMessage());
    }
  }
  
  public static void queueDataProductDeletion(UUID dataProductId) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.DATA_PRODUCT_DELETED)
          .entityId(dataProductId)
          .build());
      LOG.debug("Queued data product deletion for {}", dataProductId);
    } catch (Exception e) {
      LOG.error("Failed to queue data product deletion for {}: {}", dataProductId, e.getMessage());
    }
  }
  
  public static void queueDataProductRename(UUID dataProductId, String newName, String newFQN) {
    try {
      updateQueue.offer(UpdateTask.builder()
          .type(UpdateTask.TaskType.DATA_PRODUCT_RENAMED)
          .entityId(dataProductId)
          .newName(newName)
          .newFQN(newFQN)
          .build());
      LOG.debug("Queued data product rename for {}", dataProductId);
    } catch (Exception e) {
      LOG.error("Failed to queue data product rename for {}: {}", dataProductId, e.getMessage());
    }
  }
  
  public static int getQueueSize() {
    return updateQueue.size();
  }
}