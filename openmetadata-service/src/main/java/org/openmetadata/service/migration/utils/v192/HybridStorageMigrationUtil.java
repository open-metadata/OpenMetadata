package org.openmetadata.service.migration.utils.v192;

import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.ResultList;

/**
 * Migration utility for implementing hybrid storage in v1.9.2
 *
 * This migration:
 * 1. Populates targetFQN and tagFQN columns in tag_usage table
 * 2. Updates all entity JSONs to include their relationships (tags, owners, domains, dataProducts)
 *
 * This enables fast reads without JOINs while maintaining referential integrity.
 */
@Slf4j
public class HybridStorageMigrationUtil {

  private final CollectionDAO collectionDAO;
  private final Handle handle;
  private final ObjectMapper mapper = JsonUtils.getObjectMapper();
  private static final int BATCH_SIZE = 100;

  public HybridStorageMigrationUtil(CollectionDAO collectionDAO, Handle handle) {
    this.collectionDAO = collectionDAO;
    this.handle = handle;
  }

  /**
   * Step 1: Populate targetFQN and tagFQN columns in tag_usage table
   * This allows us to easily find entities when tags are deleted/renamed
   */
  public void populateTagUsageFQNColumns() {
    LOG.info("Starting to populate FQN columns in tag_usage table");

    try {
      // Get all distinct targetFQNHash values from tag_usage
      List<Map<String, Object>> tagUsageRows =
          handle
              .createQuery(
                  "SELECT DISTINCT targetFQNHash, tagFQN, source FROM tag_usage WHERE targetFQN IS NULL")
              .mapToMap()
              .list();

      LOG.info("Found {} tag_usage rows to update", tagUsageRows.size());

      int updated = 0;
      Map<String, String> fqnHashToFqnCache = new HashMap<>();

      for (Map<String, Object> row : tagUsageRows) {
        String targetFQNHash = (String) row.get("targetFQNHash");
        String tagFQN = (String) row.get("tagFQN");
        Integer source = (Integer) row.get("source");

        // Find the actual FQN for this hash by checking all entity types
        String targetFQN = fqnHashToFqnCache.get(targetFQNHash);
        if (targetFQN == null) {
          targetFQN = findEntityFQNByHash(targetFQNHash);
          if (targetFQN != null) {
            fqnHashToFqnCache.put(targetFQNHash, targetFQN);
          }
        }

        if (targetFQN != null) {
          // Update the tag_usage row with the FQN
          handle
              .createUpdate(
                  "UPDATE tag_usage SET targetFQN = :targetFQN WHERE targetFQNHash = :targetFQNHash AND tagFQN = :tagFQN AND source = :source")
              .bind("targetFQN", targetFQN)
              .bind("targetFQNHash", targetFQNHash)
              .bind("tagFQN", tagFQN)
              .bind("source", source)
              .execute();

          updated++;
          if (updated % 100 == 0) {
            LOG.info("Updated {} tag_usage rows with FQN values", updated);
          }
        } else {
          LOG.warn("Could not find entity for FQN hash: {}", targetFQNHash);
        }
      }

      LOG.info("Completed populating FQN columns. Updated {} rows", updated);

    } catch (Exception e) {
      LOG.error("Error populating FQN columns in tag_usage", e);
      throw new RuntimeException("Failed to populate FQN columns", e);
    }
  }

  /**
   * Step 2: Update all entity JSONs to include their relationships
   * This enables fast reads without needing JOINs
   */
  public void updateEntityJsonsWithRelationships() {
    LOG.info("Starting to update entity JSONs with relationships");

    int totalUpdated = 0;

    // Process each entity type
    for (String entityType : Entity.getEntityList()) {
      try {
        LOG.info("Processing entity type: {}", entityType);
        int entityCount = updateEntitiesOfType(entityType);
        totalUpdated += entityCount;
        LOG.info("Updated {} entities of type {}", entityCount, entityType);
      } catch (Exception e) {
        LOG.error("Error processing entity type {}: {}", entityType, e.getMessage(), e);
      }
    }

    LOG.info("Completed updating entity JSONs. Total entities updated: {}", totalUpdated);
  }

  private int updateEntitiesOfType(String entityType) {
    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);

      if (repository == null) {
        LOG.debug("Skipping entity type {} - no repository found", entityType);
        return 0;
      }

      EntityDAO<?> dao = repository.getDao();

      // Build fields list based on what the entity type supports using repository's flags
      List<String> fieldsList = new ArrayList<>();

      if (repository.isSupportsTags()) {
        fieldsList.add(FIELD_TAGS);
      }
      if (repository.isSupportsOwners()) {
        fieldsList.add(FIELD_OWNERS);
      }
      if (repository.isSupportsDomains()) {
        fieldsList.add(FIELD_DOMAINS);
      }
      // Check if entity supports dataProducts (field doesn't have getter)
      if (repository.getAllowedFields().contains(FIELD_DATA_PRODUCTS)) {
        fieldsList.add(FIELD_DATA_PRODUCTS);
      }

      // If entity doesn't support any of these fields, skip it
      if (fieldsList.isEmpty()) {
        LOG.debug("Skipping entity type {} - doesn't support relationship fields", entityType);
        return 0;
      }

      String fields = String.join(",", fieldsList);
      LOG.debug("Processing entity type {} with fields: {}", entityType, fields);

      int updated = 0;
      String afterCursor = null;
      ListFilter filter = new ListFilter(Include.ALL);

      do {
        // Get a batch of entities
        ResultList<? extends EntityInterface> entities =
            repository.listAfter(
                null, // uriInfo
                repository.getFields(fields),
                filter,
                BATCH_SIZE,
                afterCursor);

        for (EntityInterface entity : entities.getData()) {
          try {
            updateEntityJson(entity, dao, repository);
            updated++;

            if (updated % 100 == 0) {
              LOG.debug("Updated {} {} entities", updated, entityType);
            }
          } catch (Exception e) {
            LOG.error(
                "Error updating entity {} {}: {}", entityType, entity.getId(), e.getMessage());
          }
        }

        afterCursor = entities.getPaging() != null ? entities.getPaging().getAfter() : null;

      } while (afterCursor != null);

      return updated;

    } catch (Exception e) {
      LOG.error("Error updating entities of type {}: {}", entityType, e.getMessage(), e);
      return 0;
    }
  }

  private void updateEntityJson(
      EntityInterface entity, EntityDAO dao, EntityRepository<?> repository) {
    try {
      String currentJson = dao.findById(dao.getTableName(), entity.getId(), "");
      if (currentJson == null) {
        return;
      }

      ObjectNode entityNode = (ObjectNode) mapper.readTree(currentJson);
      boolean needsUpdate = false;

      // Add tags if the entity supports tags
      if (repository.isSupportsTags()) {
        List<TagLabel> tags = entity.getTags();
        if (!entityNode.has(FIELD_TAGS) && tags != null && !tags.isEmpty()) {
          ArrayNode tagsArray = mapper.valueToTree(tags);
          entityNode.set(FIELD_TAGS, tagsArray);
          needsUpdate = true;
        }
      }

      // Add owners if the entity supports owners
      if (repository.isSupportsOwners()) {
        List<EntityReference> owners = entity.getOwners();
        if (!entityNode.has(FIELD_OWNERS) && owners != null && !owners.isEmpty()) {
          ArrayNode ownersArray = mapper.valueToTree(owners);
          entityNode.set(FIELD_OWNERS, ownersArray);
          needsUpdate = true;
        }
      }

      // Add domains if the entity supports domains
      if (repository.isSupportsDomains()) {
        List<EntityReference> domains = entity.getDomains();
        if (!entityNode.has(FIELD_DOMAINS) && domains != null && !domains.isEmpty()) {
          ArrayNode domainsArray = mapper.valueToTree(domains);
          entityNode.set(FIELD_DOMAINS, domainsArray);
          needsUpdate = true;
        }
      }

      // Add dataProducts if the entity supports dataProducts
      if (repository.getAllowedFields().contains(FIELD_DATA_PRODUCTS)) {
        List<EntityReference> dataProducts = entity.getDataProducts();
        if (!entityNode.has(FIELD_DATA_PRODUCTS)
            && dataProducts != null
            && !dataProducts.isEmpty()) {
          ArrayNode dataProductsArray = mapper.valueToTree(dataProducts);
          entityNode.set(FIELD_DATA_PRODUCTS, dataProductsArray);
          needsUpdate = true;
        }
      }

      // For tables, also handle column tags
      if (entity instanceof Table) {
        Table table = (Table) entity;
        if (table.getColumns() != null) {
          needsUpdate |= updateTableColumnTags(entityNode, table);
        }
      }

      if (needsUpdate) {
        String updatedJson = mapper.writeValueAsString(entityNode);
        dao.update(entity.getId(), entity.getFullyQualifiedName(), updatedJson);
        LOG.trace("Updated entity {} with relationships in JSON", entity.getId());
      }

    } catch (Exception e) {
      LOG.error("Error updating entity JSON for {}: {}", entity.getId(), e.getMessage());
    }
  }

  private boolean updateTableColumnTags(ObjectNode tableNode, Table table) {
    try {
      ArrayNode columnsNode = (ArrayNode) tableNode.get("columns");
      if (columnsNode == null) {
        return false;
      }

      boolean updated = false;

      // Create a map of column names to their tags
      Map<String, List<TagLabel>> columnTagsMap = new HashMap<>();
      for (Column column : table.getColumns()) {
        if (column.getTags() != null && !column.getTags().isEmpty()) {
          columnTagsMap.put(column.getName(), column.getTags());
        }
      }

      // Update the JSON columns with tags
      for (int i = 0; i < columnsNode.size(); i++) {
        ObjectNode columnNode = (ObjectNode) columnsNode.get(i);
        String columnName = columnNode.get("name").asText();

        List<TagLabel> tags = columnTagsMap.get(columnName);
        if (tags != null && !tags.isEmpty() && !columnNode.has("tags")) {
          ArrayNode tagsArray = mapper.valueToTree(tags);
          columnNode.set("tags", tagsArray);
          updated = true;
        }
      }

      return updated;

    } catch (Exception e) {
      LOG.error("Error updating table column tags: {}", e.getMessage());
      return false;
    }
  }

  private String findEntityFQNByHash(String fqnHash) {
    // Try to find the entity by checking each entity type
    for (String entityType : Entity.getEntityList()) {
      try {
        EntityRepository<?> repository = Entity.getEntityRepository(entityType);
        if (repository == null) {
          continue;
        }
        EntityDAO<?> dao = repository.getDao();

        // Query the entity table for this FQN hash
        String tableName = dao.getTableName();
        String query =
            String.format(
                "SELECT fqnHash, fullyQualifiedName FROM %s WHERE fqnHash = :fqnHash", tableName);

        List<Map<String, Object>> results =
            handle.createQuery(query).bind("fqnHash", fqnHash).mapToMap().list();

        if (!results.isEmpty()) {
          return (String) results.get(0).get("fullyQualifiedName");
        }

      } catch (Exception e) {
        // Entity type doesn't have this FQN hash, continue to next type
        LOG.trace("Entity type {} doesn't have FQN hash {}", entityType, fqnHash);
      }
    }

    return null;
  }
}
