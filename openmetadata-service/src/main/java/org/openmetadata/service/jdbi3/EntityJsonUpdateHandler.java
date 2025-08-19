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

package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Handles updates to entity JSON when relationships change (delete/rename)
 * This is critical for the hybrid storage approach where relationships are stored
 * both in JSON and relationship tables.
 * 
 * When a tag, owner, domain, or data product is deleted or renamed:
 * 1. The relationship tables are updated (existing behavior)
 * 2. This handler updates the entity JSON to maintain consistency
 */
@Slf4j
public class EntityJsonUpdateHandler {
  
  private final CollectionDAO daoCollection;
  private final ObjectMapper mapper = JsonUtils.getObjectMapper();
  
  public EntityJsonUpdateHandler(CollectionDAO daoCollection) {
    this.daoCollection = daoCollection;
  }
  
  /**
   * Handle deletion of a tag/glossary term
   * Updates all entity JSONs that reference this tag
   */
  public void handleTagDeletion(String tagFQN, int source) {
    LOG.info("Handling tag deletion for: {} (source: {})", tagFQN, source);
    
    // Get all entities that have this tag
    String tagFQNHash = org.openmetadata.service.util.FullyQualifiedName.buildHash(tagFQN);
    List<String> affectedEntities = daoCollection.tagUsageDAO().getTargetFQNHashForTag(tagFQNHash);
    
    for (String targetFQNHash : affectedEntities) {
      updateEntityJsonRemoveTag(targetFQNHash, tagFQN);
    }
  }
  
  /**
   * Handle renaming of a tag/glossary term
   * Updates all entity JSONs to use the new name
   */
  public void handleTagRename(String oldTagFQN, String newTagFQN, int source) {
    LOG.info("Handling tag rename from: {} to: {} (source: {})", oldTagFQN, newTagFQN, source);
    
    // Get all entities that have this tag
    String oldTagFQNHash = org.openmetadata.service.util.FullyQualifiedName.buildHash(oldTagFQN);
    List<String> affectedEntities = daoCollection.tagUsageDAO().getTargetFQNHashForTag(oldTagFQNHash);
    
    for (String targetFQNHash : affectedEntities) {
      updateEntityJsonRenameTag(targetFQNHash, oldTagFQN, newTagFQN);
    }
  }
  
  /**
   * Handle deletion of an owner (user/team)
   * Updates all entity JSONs that have this owner
   */
  public void handleOwnerDeletion(UUID ownerId, String ownerType) {
    LOG.info("Handling owner deletion for: {} (type: {})", ownerId, ownerType);
    
    // Get all entities owned by this owner
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        daoCollection.relationshipDAO().findTo(ownerId, ownerType, Relationship.OWNS.ordinal());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      updateEntityJsonRemoveOwner(rel.getId(), rel.getType(), ownerId);
    }
  }
  
  /**
   * Handle renaming of an owner (user/team)
   * Updates all entity JSONs to use the new owner reference
   */
  public void handleOwnerRename(UUID ownerId, String ownerType, String oldName, String newName, String oldFQN, String newFQN) {
    LOG.info("Handling owner rename for: {} from {} to {}", ownerId, oldName, newName);
    
    // Get all entities owned by this owner
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        daoCollection.relationshipDAO().findTo(ownerId, ownerType, Relationship.OWNS.ordinal());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      updateEntityJsonRenameOwner(rel.getId(), rel.getType(), ownerId, oldName, newName, oldFQN, newFQN);
    }
  }
  
  /**
   * Handle deletion of a domain
   * Updates all entity JSONs that reference this domain
   */
  public void handleDomainDeletion(UUID domainId) {
    LOG.info("Handling domain deletion for: {}", domainId);
    
    // Get all entities in this domain
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        daoCollection.relationshipDAO().findTo(domainId, Entity.DOMAIN, Relationship.HAS.ordinal());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      updateEntityJsonRemoveDomain(rel.getId(), rel.getType(), domainId);
    }
  }
  
  /**
   * Handle renaming of a domain
   * Updates all entity JSONs to use the new domain reference
   */
  public void handleDomainRename(UUID domainId, String oldName, String newName, String oldFQN, String newFQN) {
    LOG.info("Handling domain rename for: {} from {} to {}", domainId, oldName, newName);
    
    // Get all entities in this domain
    List<CollectionDAO.EntityRelationshipRecord> relationships = 
        daoCollection.relationshipDAO().findTo(domainId, Entity.DOMAIN, Relationship.HAS.ordinal());
    
    for (CollectionDAO.EntityRelationshipRecord rel : relationships) {
      updateEntityJsonRenameDomain(rel.getId(), rel.getType(), domainId, oldName, newName, oldFQN, newFQN);
    }
  }
  
  private void updateEntityJsonRemoveTag(String targetFQNHash, String tagFQN) {
    try {
      // This is complex because we need to find the entity by FQN hash
      // In a real implementation, we'd need a reverse lookup or iterate through entity types
      // For now, this is a placeholder showing the approach
      LOG.debug("Would remove tag {} from entity with hash {}", tagFQN, targetFQNHash);
      
      // TODO: Implement actual JSON update logic
      // 1. Find entity by FQN hash
      // 2. Load JSON
      // 3. Remove tag from tags array
      // 4. Update JSON in database
      
    } catch (Exception e) {
      LOG.error("Error removing tag {} from entity {}: {}", tagFQN, targetFQNHash, e.getMessage(), e);
    }
  }
  
  private void updateEntityJsonRenameTag(String targetFQNHash, String oldTagFQN, String newTagFQN) {
    try {
      LOG.debug("Would rename tag {} to {} in entity with hash {}", oldTagFQN, newTagFQN, targetFQNHash);
      
      // TODO: Implement actual JSON update logic
      // 1. Find entity by FQN hash
      // 2. Load JSON
      // 3. Update tagFQN in tags array
      // 4. Update JSON in database
      
    } catch (Exception e) {
      LOG.error("Error renaming tag {} to {} in entity {}: {}", oldTagFQN, newTagFQN, targetFQNHash, e.getMessage(), e);
    }
  }
  
  private void updateEntityJsonRemoveOwner(UUID entityId, String entityType, UUID ownerId) {
    try {
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
          ArrayNode newOwners = mapper.createArrayNode();
          for (JsonNode owner : owners) {
            String id = owner.get("id").asText();
            if (!id.equals(ownerId.toString())) {
              newOwners.add(owner);
            }
          }
          entityNode.set("owners", newOwners);
          
          // Update the entity JSON in database
          dao.update(entityId, null, mapper.writeValueAsString(entityNode));
          LOG.info("Removed owner {} from entity {} JSON", ownerId, entityId);
        }
      }
    } catch (Exception e) {
      LOG.error("Error removing owner {} from entity {} JSON: {}", ownerId, entityId, e.getMessage(), e);
    }
  }
  
  private void updateEntityJsonRenameOwner(UUID entityId, String entityType, UUID ownerId, 
                                           String oldName, String newName, String oldFQN, String newFQN) {
    try {
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
          for (JsonNode owner : owners) {
            String id = owner.get("id").asText();
            if (id.equals(ownerId.toString())) {
              ((ObjectNode) owner).put("name", newName);
              ((ObjectNode) owner).put("fullyQualifiedName", newFQN);
              ((ObjectNode) owner).put("displayName", newName);
            }
          }
          
          // Update the entity JSON in database
          dao.update(entityId, null, mapper.writeValueAsString(entityNode));
          LOG.info("Renamed owner {} in entity {} JSON", ownerId, entityId);
        }
      }
    } catch (Exception e) {
      LOG.error("Error renaming owner {} in entity {} JSON: {}", ownerId, entityId, e.getMessage(), e);
    }
  }
  
  private void updateEntityJsonRemoveDomain(UUID entityId, String entityType, UUID domainId) {
    try {
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
          ArrayNode newDomains = mapper.createArrayNode();
          for (JsonNode domain : domains) {
            String id = domain.get("id").asText();
            if (!id.equals(domainId.toString())) {
              newDomains.add(domain);
            }
          }
          entityNode.set("domains", newDomains);
          
          // Update the entity JSON in database
          dao.update(entityId, null, mapper.writeValueAsString(entityNode));
          LOG.info("Removed domain {} from entity {} JSON", domainId, entityId);
        }
      }
    } catch (Exception e) {
      LOG.error("Error removing domain {} from entity {} JSON: {}", domainId, entityId, e.getMessage(), e);
    }
  }
  
  private void updateEntityJsonRenameDomain(UUID entityId, String entityType, UUID domainId,
                                            String oldName, String newName, String oldFQN, String newFQN) {
    try {
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
          for (JsonNode domain : domains) {
            String id = domain.get("id").asText();
            if (id.equals(domainId.toString())) {
              ((ObjectNode) domain).put("name", newName);
              ((ObjectNode) domain).put("fullyQualifiedName", newFQN);
              ((ObjectNode) domain).put("displayName", newName);
            }
          }
          
          // Update the entity JSON in database
          dao.update(entityId, null, mapper.writeValueAsString(entityNode));
          LOG.info("Renamed domain {} in entity {} JSON", domainId, entityId);
        }
      }
    } catch (Exception e) {
      LOG.error("Error renaming domain {} in entity {} JSON: {}", domainId, entityId, e.getMessage(), e);
    }
  }
}