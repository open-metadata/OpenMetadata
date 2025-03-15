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

import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.csv.CsvUtil.addTagTiers;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;
import static org.openmetadata.service.Entity.TABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.DatabaseProfilerConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatabaseResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class DatabaseRepository extends EntityRepository<Database> {

  public static final String DATABASE_PROFILER_CONFIG_EXTENSION = "database.databaseProfilerConfig";

  public static final String DATABASE_PROFILER_CONFIG = "databaseProfilerConfig";

  public DatabaseRepository() {
    super(
        DatabaseResource.COLLECTION_PATH,
        Entity.DATABASE,
        Database.class,
        Entity.getCollectionDAO().databaseDAO(),
        "",
        "");
    supportsSearch = true;
    fieldFetchers.put("name", this::fetchAndSetService);
  }

  @Override
  public void setFullyQualifiedName(Database database) {
    database.setFullyQualifiedName(
        FullyQualifiedName.build(database.getService().getName(), database.getName()));
  }

  @Override
  public void prepare(Database database, boolean update) {
    populateService(database);
  }

  @Override
  public void storeEntity(Database database, boolean update) {
    // Relationships and fields such as service are not stored as part of json
    EntityReference service = database.getService();
    database.withService(null);
    store(database, update);
    database.withService(service);
  }

  @Override
  public void storeRelationships(Database database) {
    addServiceRelationship(database, database.getService());
  }

  private List<EntityReference> getSchemas(Database database) {
    return database == null
        ? null
        : findTo(database.getId(), Entity.DATABASE, Relationship.CONTAINS, Entity.DATABASE_SCHEMA);
  }

  @Override
  public EntityInterface getParentEntity(Database entity, String fields) {
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public void entityRelationshipReindex(Database original, Database updated) {
    super.entityRelationshipReindex(original, updated);

    // Update search indexes of assets and entity on database displayName change
    if (!Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      searchRepository
          .getSearchClient()
          .reindexAcrossIndices("database.fullyQualifiedName", original.getEntityReference());
    }
  }

  @Override
  public String exportToCsv(String name, String user) throws IOException {
    Database database = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database name

    // Get schemas
    DatabaseSchemaRepository schemaRepository =
        (DatabaseSchemaRepository) Entity.getEntityRepository(DATABASE_SCHEMA);
    List<DatabaseSchema> schemas =
        schemaRepository.listAllForCSV(
            schemaRepository.getFields("owners,tags,domain,extension"),
            database.getFullyQualifiedName());
    schemas.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Export schemas and all their child entities
    return new DatabaseCsv(database, user).exportAllCsv(schemas);
  }

  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user)
      throws IOException {
    Database database =
        getByName(
            null,
            name,
            getFields(
                "service")); // Validate database name, and get service needed in case of create
    DatabaseCsv databaseCsv = new DatabaseCsv(database, user);
    return databaseCsv.importCsv(csv, dryRun);
  }

  public void setFields(Database database, Fields fields) {
    database.setService(getContainer(database.getId()));
    database.setDatabaseSchemas(
        fields.contains("databaseSchemas") ? getSchemas(database) : database.getDatabaseSchemas());
    database.setDatabaseProfilerConfig(
        fields.contains(DATABASE_PROFILER_CONFIG)
            ? getDatabaseProfilerConfig(database)
            : database.getDatabaseProfilerConfig());
    if (database.getUsageSummary() == null) {
      database.setUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), database.getId())
              : null);
    }
  }

  public void clearFields(Database database, Fields fields) {
    database.setDatabaseSchemas(
        fields.contains("databaseSchemas") ? database.getDatabaseSchemas() : null);
    database.setDatabaseProfilerConfig(
        fields.contains(DATABASE_PROFILER_CONFIG) ? database.getDatabaseProfilerConfig() : null);
    database.withUsageSummary(fields.contains("usageSummary") ? database.getUsageSummary() : null);
  }

  @Override
  public void restorePatchAttributes(Database original, Database updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public EntityRepository<Database>.EntityUpdater getUpdater(
      Database original, Database updated, Operation operation, ChangeSource changeSource) {
    return new DatabaseUpdater(original, updated, operation);
  }

  private void populateService(Database database) {
    DatabaseService service = Entity.getEntity(database.getService(), "", Include.NON_DELETED);
    database.setService(service.getEntityReference());
    database.setServiceType(service.getServiceType());
  }

  public Database addDatabaseProfilerConfig(
      UUID databaseId, DatabaseProfilerConfig databaseProfilerConfig) {
    // Validate the request content
    Database database = find(databaseId, Include.NON_DELETED);
    if (databaseProfilerConfig.getProfileSampleType() != null
        && databaseProfilerConfig.getProfileSample() != null) {
      EntityUtil.validateProfileSample(
          databaseProfilerConfig.getProfileSampleType().toString(),
          databaseProfilerConfig.getProfileSample());
    }

    daoCollection
        .entityExtensionDAO()
        .insert(
            databaseId,
            DATABASE_PROFILER_CONFIG_EXTENSION,
            DATABASE_PROFILER_CONFIG,
            JsonUtils.pojoToJson(databaseProfilerConfig));
    clearFields(database, Fields.EMPTY_FIELDS);
    return database.withDatabaseProfilerConfig(databaseProfilerConfig);
  }

  public DatabaseProfilerConfig getDatabaseProfilerConfig(Database database) {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionDAO()
            .getExtension(database.getId(), DATABASE_PROFILER_CONFIG_EXTENSION),
        DatabaseProfilerConfig.class);
  }

  public Database deleteDatabaseProfilerConfig(UUID databaseId) {
    // Validate the request content
    Database database = find(databaseId, Include.NON_DELETED);
    daoCollection.entityExtensionDAO().delete(databaseId, DATABASE_PROFILER_CONFIG_EXTENSION);
    clearFieldsInternal(database, Fields.EMPTY_FIELDS);
    return database;
  }

  private void fetchAndSetService(List<Database> entities, Fields fields) {
    if (entities == null || entities.isEmpty() || (!fields.contains("name"))) {
      return;
    }

    EntityReference service = getContainer(entities.get(0).getId());
    for (Database database : entities) {
      database.setService(service);
    }
  }

  public class DatabaseUpdater extends EntityUpdater {
    public DatabaseUpdater(Database original, Database updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod());
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
    }
  }

  public static class DatabaseCsv extends EntityCsv<DatabaseSchema> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(Entity.DATABASE);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final Database database;

    DatabaseCsv(Database database, String user) {
      super(DATABASE_SCHEMA, DOCUMENTATION.getHeaders(), user);
      this.database = database;
    }

    /**
     * Export database schemas and all their child entities (tables, views, stored procedures)
     */
    public String exportAllCsv(List<DatabaseSchema> schemas) throws IOException {
      // Create CSV file with schemas
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);

      // Add schemas
      for (DatabaseSchema schema : schemas) {
        addEntityToCSV(csvFile, schema, DATABASE_SCHEMA);

        // Get tables under each schema
        TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
        List<Table> tables =
            tableRepository.listAllForCSV(
                tableRepository.getFields("owners,tags,domain,extension,columns"),
                schema.getFullyQualifiedName());

        // Add tables and their columns
        for (Table table : tables) {
          // Add the table entity
          addEntityToCSV(csvFile, table, TABLE);

          // Add all columns as separate rows
          tableRepository.exportColumnsRecursively(table, csvFile);
        }

        // Get stored procedures under each schema
        StoredProcedureRepository spRepository =
            (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
        List<StoredProcedure> storedProcedures =
            spRepository.listAllForCSV(
                spRepository.getFields("owners,tags,domain,extension"),
                schema.getFullyQualifiedName());

        // Add stored procedures
        for (StoredProcedure sp : storedProcedures) {
          addEntityToCSV(csvFile, sp, STORED_PROCEDURE);
        }
      }

      return CsvUtil.formatCsv(csvFile);
    }

    /**
     * Add entity to CSV file with entity type
     */
    public <E extends EntityInterface> void addEntityToCSV(
        CsvFile csvFile, E entity, String entityType) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addOwners(recordList, entity.getOwners());
      addTagLabels(recordList, entity.getTags());
      addGlossaryTerms(recordList, entity.getTags());
      addTagTiers(recordList, entity.getTags());
      Object retentionPeriod = EntityUtil.getEntityField(entity, "retentionPeriod");
      Object sourceUrl = EntityUtil.getEntityField(entity, "sourceUrl");
      addField(recordList, retentionPeriod == null ? "" : retentionPeriod.toString());
      addField(recordList, sourceUrl == null ? "" : sourceUrl.toString());
      String domain =
          entity.getDomain() == null || Boolean.TRUE.equals(entity.getDomain().getInherited())
              ? ""
              : entity.getDomain().getFullyQualifiedName();
      addField(recordList, domain);
      addExtension(recordList, entity.getExtension());
      // Add entityType and fullyQualifiedName
      addField(recordList, entityType);
      addField(recordList, entity.getFullyQualifiedName());
      addRecord(csvFile, recordList);
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      // Get entityType and fullyQualifiedName if provided
      String entityType = csvRecord.size() > 11 ? csvRecord.get(11) : DATABASE_SCHEMA;
      String entityFQN = csvRecord.size() > 12 ? csvRecord.get(12) : null;

      if (DATABASE_SCHEMA.equals(entityType)) {
        createSchemaEntity(printer, csvRecord, entityFQN);
      } else if (TABLE.equals(entityType)) {
        createTableEntity(printer, csvRecord, entityFQN);
      } else if (STORED_PROCEDURE.equals(entityType)) {
        createStoredProcedureEntity(printer, csvRecord, entityFQN);
      } else {
        LOG.warn("Unknown entity type: {}", entityType);
      }
    }

    private void createSchemaEntity(CSVPrinter printer, CSVRecord csvRecord, String entityFQN)
        throws IOException {
      // If FQN is not provided, construct it from database FQN and schema name
      String schemaFqn =
          entityFQN != null
              ? entityFQN
              : FullyQualifiedName.add(database.getFullyQualifiedName(), csvRecord.get(0));

      DatabaseSchema schema;
      try {
        schema = Entity.getEntityByName(DATABASE_SCHEMA, schemaFqn, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        LOG.warn("Database Schema not found: {}, it will be created with Import.", schemaFqn);
        schema =
            new DatabaseSchema()
                .withDatabase(database.getEntityReference())
                .withService(database.getService());
      }

      // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers retentionPeriod,
      // sourceUrl, domain
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));
      schema
          .withName(csvRecord.get(0))
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withRetentionPeriod(csvRecord.get(7))
          .withSourceUrl(csvRecord.get(8))
          .withDomain(getEntityReference(printer, csvRecord, 9, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 10));
      if (processRecord) {
        createEntity(printer, csvRecord, schema);
      }
    }

    private void createTableEntity(CSVPrinter printer, CSVRecord csvRecord, String entityFQN)
        throws IOException {
      // Implementation for creating a table entity from CSV
      // Parse schema FQN from table FQN or use database FQN + schema name
      String schemaFQN;
      String tableName = csvRecord.get(0);

      if (entityFQN != null) {
        // Extract schema FQN from table FQN
        schemaFQN = FullyQualifiedName.getParentFQN(entityFQN);
      } else {
        // If no entity FQN provided, we need to determine which schema this table belongs to
        // This might require looking up schemas and finding the right one
        throw new IllegalArgumentException(
            "Table import requires fullyQualifiedName to determine the schema it belongs to");
      }

      // Get the schema
      DatabaseSchema schema;
      try {
        schema = Entity.getEntityByName(DATABASE_SCHEMA, schemaFQN, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        throw new IllegalArgumentException("Schema not found: " + schemaFQN);
      }

      TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
      Table table;

      try {
        table = Entity.getEntityByName(TABLE, entityFQN, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        LOG.warn("Table not found: {}, it will be created with Import.", entityFQN);
        table =
            new Table()
                .withName(tableName)
                .withService(schema.getService())
                .withDatabase(schema.getDatabase())
                .withDatabaseSchema(schema.getEntityReference());
      }

      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));

      table
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withRetentionPeriod(csvRecord.get(7))
          .withSourceUrl(csvRecord.get(8))
          .withDomain(getEntityReference(printer, csvRecord, 9, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 10));

      if (processRecord) {
        // Use the table repository to create/update the table
        tableRepository.createOrUpdate(null, table);
      }
    }

    private void createStoredProcedureEntity(
        CSVPrinter printer, CSVRecord csvRecord, String entityFQN) throws IOException {
      // Implementation for creating a stored procedure entity from CSV
      // Similar to createTableEntity but for stored procedures

      String schemaFQN;
      String spName = csvRecord.get(0);

      if (entityFQN != null) {
        // Extract schema FQN from SP FQN
        schemaFQN = FullyQualifiedName.getParentFQN(entityFQN);
      } else {
        // If no entity FQN provided, we need to determine which schema this SP belongs to
        throw new IllegalArgumentException(
            "Stored procedure import requires fullyQualifiedName to determine the schema it belongs to");
      }

      // Get the schema
      DatabaseSchema schema;
      try {
        schema = Entity.getEntityByName(DATABASE_SCHEMA, schemaFQN, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        throw new IllegalArgumentException("Schema not found: " + schemaFQN);
      }

      StoredProcedureRepository spRepository =
          (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
      StoredProcedure sp;

      try {
        sp = Entity.getEntityByName(STORED_PROCEDURE, entityFQN, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        LOG.warn("Stored procedure not found: {}, it will be created with Import.", entityFQN);
        sp =
            new StoredProcedure()
                .withName(spName)
                .withService(schema.getService())
                .withDatabase(schema.getDatabase())
                .withDatabaseSchema(schema.getEntityReference());
      }

      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));

      sp.withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withSourceUrl(csvRecord.get(8))
          .withDomain(getEntityReference(printer, csvRecord, 9, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 10));

      if (processRecord) {
        // Use the stored procedure repository to create/update the SP
        spRepository.createOrUpdate(null, sp);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, DatabaseSchema entity) {
      addEntityToCSV(csvFile, entity, DATABASE_SCHEMA);
    }
  }
}
