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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.csv.CsvUtil.addTagTiers;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;
import static org.openmetadata.service.Entity.TABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
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
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DatabaseSchemaProfilerConfig;
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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.databases.DatabaseSchemaResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class DatabaseSchemaRepository extends EntityRepository<DatabaseSchema> {

  public static final String DATABASE_SCHEMA_PROFILER_CONFIG_EXTENSION =
      "databaseSchema.databaseSchemaProfilerConfig";

  public static final String DATABASE_SCHEMA_PROFILER_CONFIG = "databaseSchemaProfilerConfig";

  public DatabaseSchemaRepository() {
    super(
        DatabaseSchemaResource.COLLECTION_PATH,
        Entity.DATABASE_SCHEMA,
        DatabaseSchema.class,
        Entity.getCollectionDAO().databaseSchemaDAO(),
        "",
        "");
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(DatabaseSchema schema) {
    schema.setFullyQualifiedName(
        FullyQualifiedName.add(schema.getDatabase().getFullyQualifiedName(), schema.getName()));
  }

  @Override
  public void prepare(DatabaseSchema schema, boolean update) {
    populateDatabase(schema);
  }

  @Override
  public void storeEntity(DatabaseSchema schema, boolean update) {
    // Relationships and fields such as service are derived and not stored as part of json
    EntityReference service = schema.getService();
    schema.withService(null);

    store(schema, update);
    // Restore the relationships
    schema.withService(service);
  }

  @Override
  public void storeRelationships(DatabaseSchema schema) {
    EntityReference database = schema.getDatabase();
    addRelationship(
        database.getId(),
        schema.getId(),
        database.getType(),
        Entity.DATABASE_SCHEMA,
        Relationship.CONTAINS);
  }

  private List<EntityReference> getTables(DatabaseSchema schema) {
    return schema == null
        ? Collections.emptyList()
        : findTo(schema.getId(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS, TABLE);
  }

  public void setFields(DatabaseSchema schema, Fields fields) {
    setDefaultFields(schema);
    schema.setTables(fields.contains("tables") ? getTables(schema) : null);
    schema.setDatabaseSchemaProfilerConfig(
        fields.contains(DATABASE_SCHEMA_PROFILER_CONFIG)
            ? getDatabaseSchemaProfilerConfig(schema)
            : schema.getDatabaseSchemaProfilerConfig());
    schema.withUsageSummary(
        fields.contains("usageSummary")
            ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), schema.getId())
            : null);
  }

  public void clearFields(DatabaseSchema schema, Fields fields) {
    schema.setTables(fields.contains("tables") ? schema.getTables() : null);
    schema.setDatabaseSchemaProfilerConfig(
        fields.contains(DATABASE_SCHEMA_PROFILER_CONFIG)
            ? schema.getDatabaseSchemaProfilerConfig()
            : null);
    schema.withUsageSummary(fields.contains("usageSummary") ? schema.getUsageSummary() : null);
  }

  private void setDefaultFields(DatabaseSchema schema) {
    EntityReference databaseRef = getContainer(schema.getId());
    Database database = Entity.getEntity(databaseRef, "", Include.ALL);
    schema.withDatabase(databaseRef).withService(database.getService());
  }

  @Override
  public void setInheritedFields(DatabaseSchema schema, Fields fields) {
    Database database =
        Entity.getEntity(Entity.DATABASE, schema.getDatabase().getId(), "owners,domain", ALL);
    inheritOwners(schema, fields, database);
    inheritDomain(schema, fields, database);
    schema.withRetentionPeriod(
        schema.getRetentionPeriod() == null
            ? database.getRetentionPeriod()
            : schema.getRetentionPeriod());
  }

  @Override
  public void restorePatchAttributes(DatabaseSchema original, DatabaseSchema updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public EntityInterface getParentEntity(DatabaseSchema entity, String fields) {
    return Entity.getEntity(entity.getDatabase(), fields, ALL);
  }

  @Override
  public EntityRepository<DatabaseSchema>.EntityUpdater getUpdater(
      DatabaseSchema original,
      DatabaseSchema updated,
      Operation operation,
      ChangeSource changeSource) {
    return new DatabaseSchemaUpdater(original, updated, operation);
  }

  private void populateDatabase(DatabaseSchema schema) {
    Database database = Entity.getEntity(schema.getDatabase(), "", ALL);
    schema
        .withDatabase(database.getEntityReference())
        .withService(database.getService())
        .withServiceType(database.getServiceType());
  }

  @Override
  public void entityRelationshipReindex(DatabaseSchema original, DatabaseSchema updated) {
    super.entityRelationshipReindex(original, updated);

    // Update search indexes of assets and entity on databaseSchema displayName change
    if (!Objects.equals(original.getDisplayName(), updated.getDisplayName())) {
      searchRepository
          .getSearchClient()
          .reindexAcrossIndices("databaseSchema.fullyQualifiedName", original.getEntityReference());
    }
  }

  @Override
  public String exportToCsv(String name, String user) throws IOException {
    DatabaseSchema schema = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database schema

    // Get tables under this schema
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
    List<Table> tables =
        tableRepository.listAllForCSV(
            tableRepository.getFields("owners,tags,domain,extension"),
            schema.getFullyQualifiedName());
    tables.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Get stored procedures under this schema
    StoredProcedureRepository spRepository =
        (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
    List<StoredProcedure> storedProcedures =
        spRepository.listAllForCSV(
            spRepository.getFields("owners,tags,domain,extension"), schema.getFullyQualifiedName());
    storedProcedures.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Export all entities using a single CSV
    return new DatabaseSchemaCsv(schema, user).exportAllCsv(tables, storedProcedures);
  }

  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user)
      throws IOException {
    DatabaseSchema schema =
        getByName(null, name, getFields("database,service")); // Validate database schema
    return new DatabaseSchemaCsv(schema, user).importCsv(csv, dryRun);
  }

  public class DatabaseSchemaUpdater extends EntityUpdater {
    public DatabaseSchemaUpdater(
        DatabaseSchema original, DatabaseSchema updated, Operation operation) {
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

  public DatabaseSchema addDatabaseSchemaProfilerConfig(
      UUID databaseSchemaId, DatabaseSchemaProfilerConfig databaseSchemaProfilerConfig) {
    // Validate the request content
    DatabaseSchema databaseSchema = find(databaseSchemaId, Include.NON_DELETED);

    if (databaseSchemaProfilerConfig.getProfileSampleType() != null
        && databaseSchemaProfilerConfig.getProfileSample() != null) {
      EntityUtil.validateProfileSample(
          databaseSchemaProfilerConfig.getProfileSampleType().toString(),
          databaseSchemaProfilerConfig.getProfileSample());
    }

    daoCollection
        .entityExtensionDAO()
        .insert(
            databaseSchemaId,
            DATABASE_SCHEMA_PROFILER_CONFIG_EXTENSION,
            DATABASE_SCHEMA_PROFILER_CONFIG,
            JsonUtils.pojoToJson(databaseSchemaProfilerConfig));
    clearFields(databaseSchema, Fields.EMPTY_FIELDS);
    return databaseSchema.withDatabaseSchemaProfilerConfig(databaseSchemaProfilerConfig);
  }

  public DatabaseSchemaProfilerConfig getDatabaseSchemaProfilerConfig(
      DatabaseSchema databaseSchema) {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionDAO()
            .getExtension(databaseSchema.getId(), DATABASE_SCHEMA_PROFILER_CONFIG_EXTENSION),
        DatabaseSchemaProfilerConfig.class);
  }

  public DatabaseSchema deleteDatabaseSchemaProfilerConfig(UUID databaseSchemaId) {
    // Validate the request content
    DatabaseSchema database = find(databaseSchemaId, Include.NON_DELETED);
    daoCollection
        .entityExtensionDAO()
        .delete(databaseSchemaId, DATABASE_SCHEMA_PROFILER_CONFIG_EXTENSION);
    setFieldsInternal(database, Fields.EMPTY_FIELDS);
    return database;
  }

  public static class DatabaseSchemaCsv extends EntityCsv<Table> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(DATABASE_SCHEMA);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final DatabaseSchema schema;

    DatabaseSchemaCsv(DatabaseSchema schema, String user) {
      super(TABLE, DOCUMENTATION.getHeaders(), user);
      this.schema = schema;
    }

    /**
     * Export tables and stored procedures under this schema
     */
    public String exportAllCsv(List<Table> tables, List<StoredProcedure> storedProcedures)
        throws IOException {
      // Create CSV file
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);

      // Add tables with entityType = table and include columns
      TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
      for (Table table : tables) {
        // Export the table entity
        addEntityToCSV(csvFile, table, TABLE);

        // Export all columns as separate rows with entityType = COLUMN
        tableRepository.exportColumnsRecursively(table, csvFile);
      }

      // Add stored procedures with entityType = storedProcedure
      for (StoredProcedure sp : storedProcedures) {
        addEntityToCSV(csvFile, sp, STORED_PROCEDURE);
      }

      return CsvUtil.formatCsv(csvFile);
    }

    /**
     * Add entity to CSV file with entity type and fully qualified name
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
      String entityType = csvRecord.size() > 11 ? csvRecord.get(11) : TABLE;
      String entityFQN = csvRecord.size() > 12 ? csvRecord.get(12) : null;

      if (TABLE.equals(entityType)) {
        createTableEntity(printer, csvRecord, entityFQN);
      } else if (STORED_PROCEDURE.equals(entityType)) {
        createStoredProcedureEntity(printer, csvRecord, entityFQN);
      } else if ("column".equals(entityType)) {
        createColumnEntity(printer, csvRecord, entityFQN);
      } else {
        LOG.warn("Unsupported entity type in schema CSV: {}", entityType);
      }
    }

    private void createTableEntity(CSVPrinter printer, CSVRecord csvRecord, String entityFQN)
        throws IOException {
      // If FQN is not provided, construct it from schema FQN and table name
      String tableFqn =
          entityFQN != null
              ? entityFQN
              : FullyQualifiedName.add(schema.getFullyQualifiedName(), csvRecord.get(0));

      Table table;
      try {
        table = Entity.getEntityByName(TABLE, tableFqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        // Table not found, create a new one
        LOG.warn("Table not found: {}, it will be created with Import.", tableFqn);
        table =
            new Table()
                .withId(UUID.randomUUID())
                .withFullyQualifiedName(tableFqn)
                .withService(schema.getService())
                .withDatabase(schema.getDatabase())
                .withDatabaseSchema(schema.getEntityReference());
      }

      // Headers: name, displayName, description, owners, tags, glossaryTerms, tiers
      // retentionPeriod, sourceUrl, domain
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));
      table
          .withName(csvRecord.get(0))
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withRetentionPeriod(csvRecord.get(7))
          .withSourceUrl(csvRecord.get(8))
          .withColumns(nullOrEmpty(table.getColumns()) ? new ArrayList<>() : table.getColumns())
          .withDomain(getEntityReference(printer, csvRecord, 9, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 10))
          .withUpdatedAt(System.currentTimeMillis())
          .withUpdatedBy(importedBy);

      if (processRecord) {
        createEntity(printer, csvRecord, table);
      }
    }

    private void createStoredProcedureEntity(
        CSVPrinter printer, CSVRecord csvRecord, String entityFQN) throws IOException {
      // If FQN is not provided, construct it from schema FQN and stored procedure name
      String spFqn =
          entityFQN != null
              ? entityFQN
              : FullyQualifiedName.add(schema.getFullyQualifiedName(), csvRecord.get(0));

      StoredProcedureRepository spRepository =
          (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
      StoredProcedure sp;

      try {
        sp = Entity.getEntityByName(STORED_PROCEDURE, spFqn, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        LOG.warn("Stored procedure not found: {}, it will be created with Import.", spFqn);
        sp =
            new StoredProcedure()
                .withName(csvRecord.get(0))
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
        // Use the SP repository to create/update the stored procedure
        spRepository.createOrUpdate(null, sp);
      }
    }

    private void createColumnEntity(CSVPrinter printer, CSVRecord csvRecord, String entityFQN)
        throws IOException {
      if (entityFQN == null) {
        LOG.error("Column entry is missing table reference in fullyQualifiedName");
        return;
      }

      // Extract table name from FQN
      String tableFQN = FullyQualifiedName.getParentFQN(entityFQN);
      TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
      Table table;
      try {
        table = Entity.getEntityByName(TABLE, tableFQN, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Table not found for column: {}, skipping column creation.", entityFQN);
        return;
      }
      List<Column> columns = table.getColumns() == null ? new ArrayList<>() : table.getColumns();
      Column column =
          new Column()
              .withName(csvRecord.get(0))
              .withFullyQualifiedName(entityFQN)
              .withDisplayName(csvRecord.get(1))
              .withDescription(csvRecord.get(2))
              .withDataType(ColumnDataType.fromValue(csvRecord.get(14)))
              .withDataLength(
                  nullOrEmpty(csvRecord.get(16)) ? null : Integer.parseInt(csvRecord.get(16)));
      columns.add(column);
      table.withColumns(columns);

      if (processRecord && !importResult.getDryRun()) {
        tableRepository.createOrUpdate(null, table);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Table entity) {
      addEntityToCSV(csvFile, entity, TABLE);
    }
  }
}
