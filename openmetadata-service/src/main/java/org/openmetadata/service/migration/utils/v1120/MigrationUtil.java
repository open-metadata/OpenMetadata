package org.openmetadata.service.migration.utils.v1120;

import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.migration.utils.LongStatementsUtil.executeAndUpdate;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ColumnUtil;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Migration utility to fix FQN and FQN hash for entities whose parent service name contains dots.
 *
 * <p>Prior to this fix, the FQN was incorrectly built using getService().getName() instead of
 * getService().getFullyQualifiedName(). This caused service names with dots (e.g., "my.service")
 * to be incorrectly represented in child entity FQNs.
 *
 * <p>For example, if service FQN is "my.service" (quoted as "\"my.service\""), a Database named
 * "mydb" would incorrectly have FQN "my.service.mydb" instead of the correct "\"my.service\".mydb"
 */
@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  /**
   * Find all service IDs that have dots in their names. These are the services whose child entities
   * need FQN fixes.
   */
  private static Set<UUID> findServicesWithDotsInName(Handle handle, String serviceTable) {
    Set<UUID> serviceIds = new HashSet<>();
    String query = String.format("SELECT id FROM %s WHERE name LIKE '%%.%%'", serviceTable);

    try {
      List<Map<String, Object>> rows = handle.createQuery(query).mapToMap().list();
      for (Map<String, Object> row : rows) {
        Object idObj = row.get("id");
        if (idObj != null) {
          serviceIds.add(UUID.fromString(idObj.toString()));
        }
      }
    } catch (Exception e) {
      LOG.warn(
          "Error finding services with dots in name from {}: {}", serviceTable, e.getMessage());
    }

    return serviceIds;
  }

  /** Find entity IDs that belong to the given parent entities via relationship table. */
  private static Set<UUID> findChildEntityIds(
      CollectionDAO collectionDAO, Set<UUID> parentIds, String fromType, String toType) {
    Set<UUID> childIds = new HashSet<>();
    for (UUID parentId : parentIds) {
      List<CollectionDAO.EntityRelationshipRecord> records =
          collectionDAO
              .relationshipDAO()
              .findTo(parentId, fromType, Relationship.CONTAINS.ordinal(), toType);
      for (CollectionDAO.EntityRelationshipRecord record : records) {
        childIds.add(record.getId());
      }
    }
    return childIds;
  }

  /** Fix FQN and hash for Database entities that have services with dots in their names. */
  public static void fixDatabaseFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix Database FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "dbservice_entity");
    if (serviceIds.isEmpty()) {
      LOG.info("No database services with dots in names found. Skipping Database FQN fix.");
      return;
    }
    LOG.info("Found {} database services with dots in names", serviceIds.size());

    int fixedCount = 0;
    for (UUID serviceId : serviceIds) {
      try {
        var service = collectionDAO.dbServiceDAO().findEntityById(serviceId);
        if (service == null) continue;

        String serviceFqn = service.getFullyQualifiedName();
        if (serviceFqn == null || !serviceFqn.contains("\"")) continue;

        Set<UUID> databaseIds =
            findChildEntityIds(
                collectionDAO, Set.of(serviceId), Entity.DATABASE_SERVICE, Entity.DATABASE);

        for (UUID databaseId : databaseIds) {
          try {
            Database database = collectionDAO.databaseDAO().findEntityById(databaseId);
            if (database == null) continue;

            String expectedFqn = FullyQualifiedName.add(serviceFqn, database.getName());
            String currentFqn = database.getFullyQualifiedName();

            if (!expectedFqn.equals(currentFqn)) {
              LOG.debug("Fixing Database FQN: {} -> {}", currentFqn, expectedFqn);
              database.setFullyQualifiedName(expectedFqn);
              collectionDAO.databaseDAO().update(database);
              fixedCount++;
            }
          } catch (Exception e) {
            LOG.warn("Error processing database entity {}: {}", databaseId, e.getMessage());
          }
        }
      } catch (Exception e) {
        LOG.warn("Error processing service {}: {}", serviceId, e.getMessage());
      }
    }

    LOG.info("Fixed {} Database entities with incorrect FQN hash", fixedCount);
  }

  /**
   * Fix FQN and hash for DatabaseSchema entities whose parent database has a service with dots in
   * its name. Must be called after fixDatabaseFqnHash.
   */
  public static void fixDatabaseSchemaFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix DatabaseSchema FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "dbservice_entity");
    if (serviceIds.isEmpty()) {
      LOG.info("No database services with dots in names found. Skipping DatabaseSchema FQN fix.");
      return;
    }

    Set<UUID> databaseIds =
        findChildEntityIds(collectionDAO, serviceIds, Entity.DATABASE_SERVICE, Entity.DATABASE);
    if (databaseIds.isEmpty()) {
      LOG.info("No databases found under services with dots. Skipping DatabaseSchema FQN fix.");
      return;
    }

    Set<UUID> schemaIds =
        findChildEntityIds(collectionDAO, databaseIds, Entity.DATABASE, Entity.DATABASE_SCHEMA);
    LOG.info("Found {} database schemas to check", schemaIds.size());

    int fixedCount = 0;
    for (UUID schemaId : schemaIds) {
      try {
        DatabaseSchema schema = collectionDAO.databaseSchemaDAO().findEntityById(schemaId);
        if (schema == null) continue;

        Database database =
            collectionDAO.databaseDAO().findEntityById(schema.getDatabase().getId());
        if (database == null) continue;

        String databaseFqn = database.getFullyQualifiedName();
        if (databaseFqn == null || !databaseFqn.contains("\"")) continue;

        String expectedFqn = FullyQualifiedName.add(databaseFqn, schema.getName());
        String currentFqn = schema.getFullyQualifiedName();

        if (!expectedFqn.equals(currentFqn)) {
          LOG.debug("Fixing DatabaseSchema FQN: {} -> {}", currentFqn, expectedFqn);
          schema.setFullyQualifiedName(expectedFqn);
          collectionDAO.databaseSchemaDAO().update(schema);
          fixedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error processing DatabaseSchema entity {}: {}", schemaId, e.getMessage());
      }
    }

    LOG.info("Fixed {} DatabaseSchema entities with incorrect FQN hash", fixedCount);
  }

  /**
   * Fix FQN and hash for Table entities whose parent schema has a service with dots in its name.
   * Must be called after fixDatabaseSchemaFqnHash.
   */
  public static void fixTableFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix Table FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "dbservice_entity");
    if (serviceIds.isEmpty()) {
      LOG.info("No database services with dots in names found. Skipping Table FQN fix.");
      return;
    }

    Set<UUID> databaseIds =
        findChildEntityIds(collectionDAO, serviceIds, Entity.DATABASE_SERVICE, Entity.DATABASE);
    if (databaseIds.isEmpty()) {
      LOG.info("No databases found under services with dots. Skipping Table FQN fix.");
      return;
    }

    Set<UUID> schemaIds =
        findChildEntityIds(collectionDAO, databaseIds, Entity.DATABASE, Entity.DATABASE_SCHEMA);
    if (schemaIds.isEmpty()) {
      LOG.info("No schemas found under services with dots. Skipping Table FQN fix.");
      return;
    }

    Set<UUID> tableIds =
        findChildEntityIds(collectionDAO, schemaIds, Entity.DATABASE_SCHEMA, Entity.TABLE);
    LOG.info("Found {} tables to check", tableIds.size());

    int fixedCount = 0;
    for (UUID tableId : tableIds) {
      try {
        Table table = collectionDAO.tableDAO().findEntityById(tableId);
        if (table == null) continue;

        DatabaseSchema schema =
            collectionDAO.databaseSchemaDAO().findEntityById(table.getDatabaseSchema().getId());
        if (schema == null) continue;

        String schemaFqn = schema.getFullyQualifiedName();
        if (schemaFqn == null || !schemaFqn.contains("\"")) continue;

        String expectedFqn = FullyQualifiedName.add(schemaFqn, table.getName());
        String currentFqn = table.getFullyQualifiedName();

        if (!expectedFqn.equals(currentFqn)) {
          LOG.debug("Fixing Table FQN: {} -> {}", currentFqn, expectedFqn);
          table.setFullyQualifiedName(expectedFqn);
          ColumnUtil.setColumnFQN(expectedFqn, table.getColumns());
          collectionDAO.tableDAO().update(table);
          fixedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error processing Table entity {}: {}", tableId, e.getMessage());
      }
    }

    LOG.info("Fixed {} Table entities with incorrect FQN hash", fixedCount);
  }

  /**
   * Fix FQN and hash for StoredProcedure entities whose parent schema has a service with dots in
   * its name. Must be called after fixDatabaseSchemaFqnHash.
   */
  public static void fixStoredProcedureFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix StoredProcedure FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "dbservice_entity");
    if (serviceIds.isEmpty()) {
      LOG.info("No database services with dots in names found. Skipping StoredProcedure FQN fix.");
      return;
    }

    Set<UUID> databaseIds =
        findChildEntityIds(collectionDAO, serviceIds, Entity.DATABASE_SERVICE, Entity.DATABASE);
    if (databaseIds.isEmpty()) {
      LOG.info("No databases found under services with dots. Skipping StoredProcedure FQN fix.");
      return;
    }

    Set<UUID> schemaIds =
        findChildEntityIds(collectionDAO, databaseIds, Entity.DATABASE, Entity.DATABASE_SCHEMA);
    if (schemaIds.isEmpty()) {
      LOG.info("No schemas found under services with dots. Skipping StoredProcedure FQN fix.");
      return;
    }

    Set<UUID> spIds =
        findChildEntityIds(
            collectionDAO, schemaIds, Entity.DATABASE_SCHEMA, Entity.STORED_PROCEDURE);
    LOG.info("Found {} stored procedures to check", spIds.size());

    int fixedCount = 0;
    for (UUID spId : spIds) {
      try {
        StoredProcedure sp = collectionDAO.storedProcedureDAO().findEntityById(spId);
        if (sp == null) continue;

        DatabaseSchema schema =
            collectionDAO.databaseSchemaDAO().findEntityById(sp.getDatabaseSchema().getId());
        if (schema == null) continue;

        String schemaFqn = schema.getFullyQualifiedName();
        if (schemaFqn == null || !schemaFqn.contains("\"")) continue;

        String expectedFqn = FullyQualifiedName.add(schemaFqn, sp.getName());
        String currentFqn = sp.getFullyQualifiedName();

        if (!expectedFqn.equals(currentFqn)) {
          LOG.debug("Fixing StoredProcedure FQN: {} -> {}", currentFqn, expectedFqn);
          sp.setFullyQualifiedName(expectedFqn);
          collectionDAO.storedProcedureDAO().update(sp);
          fixedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error processing StoredProcedure entity {}: {}", spId, e.getMessage());
      }
    }

    LOG.info("Fixed {} StoredProcedure entities with incorrect FQN hash", fixedCount);
  }

  /**
   * Fix FQN and hash for DashboardDataModel entities that have services with dots in their names.
   */
  public static void fixDashboardDataModelFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info(
        "Starting migration to fix DashboardDataModel FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "dashboard_service_entity");
    if (serviceIds.isEmpty()) {
      LOG.info(
          "No dashboard services with dots in names found. Skipping DashboardDataModel FQN fix.");
      return;
    }
    LOG.info("Found {} dashboard services with dots in names", serviceIds.size());

    int fixedCount = 0;
    for (UUID serviceId : serviceIds) {
      try {
        var service = collectionDAO.dashboardServiceDAO().findEntityById(serviceId);
        if (service == null) continue;

        String serviceFqn = service.getFullyQualifiedName();
        if (serviceFqn == null || !serviceFqn.contains("\"")) continue;

        Set<UUID> dataModelIds =
            findChildEntityIds(
                collectionDAO,
                Set.of(serviceId),
                Entity.DASHBOARD_SERVICE,
                Entity.DASHBOARD_DATA_MODEL);

        for (UUID dataModelId : dataModelIds) {
          try {
            DashboardDataModel dataModel =
                collectionDAO.dashboardDataModelDAO().findEntityById(dataModelId);
            if (dataModel == null) continue;

            String expectedFqn = FullyQualifiedName.add(serviceFqn + ".model", dataModel.getName());
            String currentFqn = dataModel.getFullyQualifiedName();

            if (!expectedFqn.equals(currentFqn)) {
              LOG.debug("Fixing DashboardDataModel FQN: {} -> {}", currentFqn, expectedFqn);
              dataModel.setFullyQualifiedName(expectedFqn);
              ColumnUtil.setColumnFQN(expectedFqn, dataModel.getColumns());
              collectionDAO.dashboardDataModelDAO().update(dataModel);
              fixedCount++;
            }
          } catch (Exception e) {
            LOG.warn(
                "Error processing DashboardDataModel entity {}: {}", dataModelId, e.getMessage());
          }
        }
      } catch (Exception e) {
        LOG.warn("Error processing service {}: {}", serviceId, e.getMessage());
      }
    }

    LOG.info("Fixed {} DashboardDataModel entities with incorrect FQN hash", fixedCount);
  }

  /** Fix FQN and hash for APICollection entities that have services with dots in their names. */
  public static void fixApiCollectionFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix APICollection FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "api_service_entity");
    if (serviceIds.isEmpty()) {
      LOG.info("No API services with dots in names found. Skipping APICollection FQN fix.");
      return;
    }
    LOG.info("Found {} API services with dots in names", serviceIds.size());

    int fixedCount = 0;
    for (UUID serviceId : serviceIds) {
      try {
        var service = collectionDAO.apiServiceDAO().findEntityById(serviceId);
        if (service == null) continue;

        String serviceFqn = service.getFullyQualifiedName();
        if (serviceFqn == null || !serviceFqn.contains("\"")) continue;

        Set<UUID> collectionIds =
            findChildEntityIds(
                collectionDAO, Set.of(serviceId), Entity.API_SERVICE, Entity.API_COLLECTION);

        for (UUID collectionId : collectionIds) {
          try {
            APICollection apiCollection =
                collectionDAO.apiCollectionDAO().findEntityById(collectionId);
            if (apiCollection == null) continue;

            String expectedFqn = FullyQualifiedName.add(serviceFqn, apiCollection.getName());
            String currentFqn = apiCollection.getFullyQualifiedName();

            if (!expectedFqn.equals(currentFqn)) {
              LOG.debug("Fixing APICollection FQN: {} -> {}", currentFqn, expectedFqn);
              apiCollection.setFullyQualifiedName(expectedFqn);
              collectionDAO.apiCollectionDAO().update(apiCollection);
              fixedCount++;
            }
          } catch (Exception e) {
            LOG.warn("Error processing APICollection entity {}: {}", collectionId, e.getMessage());
          }
        }
      } catch (Exception e) {
        LOG.warn("Error processing service {}: {}", serviceId, e.getMessage());
      }
    }

    LOG.info("Fixed {} APICollection entities with incorrect FQN hash", fixedCount);
  }

  /**
   * Fix FQN and hash for APIEndpoint entities whose parent collection has a service with dots in
   * its name. Must be called after fixApiCollectionFqnHash.
   */
  public static void fixApiEndpointFqnHash(Handle handle, CollectionDAO collectionDAO) {
    LOG.info("Starting migration to fix APIEndpoint FQN hash for services with dots in names");

    Set<UUID> serviceIds = findServicesWithDotsInName(handle, "api_service_entity");
    if (serviceIds.isEmpty()) {
      LOG.info("No API services with dots in names found. Skipping APIEndpoint FQN fix.");
      return;
    }

    Set<UUID> collectionIds =
        findChildEntityIds(collectionDAO, serviceIds, Entity.API_SERVICE, Entity.API_COLLECTION);
    if (collectionIds.isEmpty()) {
      LOG.info("No API collections found under services with dots. Skipping APIEndpoint FQN fix.");
      return;
    }

    Set<UUID> endpointIds =
        findChildEntityIds(
            collectionDAO, collectionIds, Entity.API_COLLECTION, Entity.API_ENDPOINT);
    LOG.info("Found {} API endpoints to check", endpointIds.size());

    int fixedCount = 0;
    for (UUID endpointId : endpointIds) {
      try {
        APIEndpoint apiEndpoint = collectionDAO.apiEndpointDAO().findEntityById(endpointId);
        if (apiEndpoint == null) continue;

        APICollection apiCollection =
            collectionDAO.apiCollectionDAO().findEntityById(apiEndpoint.getApiCollection().getId());
        if (apiCollection == null) continue;

        String collectionFqn = apiCollection.getFullyQualifiedName();
        if (collectionFqn == null || !collectionFqn.contains("\"")) continue;

        String expectedFqn = FullyQualifiedName.add(collectionFqn, apiEndpoint.getName());
        String currentFqn = apiEndpoint.getFullyQualifiedName();

        if (!expectedFqn.equals(currentFqn)) {
          LOG.debug("Fixing APIEndpoint FQN: {} -> {}", currentFqn, expectedFqn);
          apiEndpoint.setFullyQualifiedName(expectedFqn);
          collectionDAO.apiEndpointDAO().update(apiEndpoint);
          fixedCount++;
        }
      } catch (Exception e) {
        LOG.warn("Error processing APIEndpoint entity {}: {}", endpointId, e.getMessage());
      }
    }

    LOG.info("Fixed {} APIEndpoint entities with incorrect FQN hash", fixedCount);
  }

  public static Map<String, QueryStatus> updateClassificationAndRecognizers(
      String classificationStatement,
      String tagStatement,
      Handle handle,
      MigrationDAO migrationDAO,
      String version,
      boolean isForceMigration) {
    Map<String, QueryStatus> result = new HashMap<>();
    List<LoadTags> loadTagsList;
    try {
      loadTagsList =
          EntityRepository.getEntitiesFromSeedData(
              CLASSIFICATION, ".*json/data/tags/piiTagsWithRecognizers.json$", LoadTags.class);
    } catch (IOException e) {
      LOG.error("Failed to load tag data", e);
      result.put(
          "loadPiiTagsSeedData",
          new QueryStatus(
              QueryStatus.Status.FAILURE, "Failed to load PII seed data: " + e.getMessage()));
      return result;
    }

    for (LoadTags loadTags : loadTagsList) {
      String classification = loadTags.getCreateClassification().getName();
      // Update Classification Config
      Object[] args = {
        JsonUtils.pojoToJson(loadTags.getCreateClassification().getAutoClassificationConfig()),
        classification
      };
      Map<String, QueryStatus> res =
          executeAndUpdate(
              handle, migrationDAO, version, isForceMigration, classificationStatement, args);

      result.putAll(res);

      for (CreateTag createTag : loadTags.getCreateTags()) {
        Boolean autoClassificationEnabled = createTag.getAutoClassificationEnabled();
        // Update tags config
        Object[] tagArgs = {
          Boolean.TRUE.equals(autoClassificationEnabled) ? "true" : "false",
          createTag.getAutoClassificationPriority(),
          JsonUtils.pojoToJson(createTag.getRecognizers()),
          classification + "." + createTag.getName()
        };
        Map<String, QueryStatus> tagRes =
            executeAndUpdate(
                handle, migrationDAO, version, isForceMigration, tagStatement, tagArgs);
        result.putAll(tagRes);
      }
    }

    return result;
  }
}
