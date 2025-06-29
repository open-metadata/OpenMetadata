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
import static org.openmetadata.service.Entity.STORED_PROCEDURE;
import static org.openmetadata.service.Entity.TABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.schema.type.AssetCertification;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.databases.DatabaseSchemaResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

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
  public void setFieldsInBulk(Fields fields, List<DatabaseSchema> entities) {
    // Bulk fetch and set default fields for all schemas
    fetchAndSetDefaultFields(entities);

    // Set other fields if requested
    if (fields.contains("tables")) {
      fetchAndSetTables(entities);
    }

    if (fields.contains(DATABASE_SCHEMA_PROFILER_CONFIG)) {
      fetchAndSetDatabaseSchemaProfilerConfigs(entities);
    }

    if (fields.contains("usageSummary")) {
      fetchAndSetUsageSummaries(entities);
    }

    // Inherit fields from parent
    setInheritedFields(entities, fields);

    // Clear fields not requested
    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private void fetchAndSetDefaultFields(List<DatabaseSchema> schemas) {
    if (schemas == null || schemas.isEmpty()) {
      return;
    }

    // Batch fetch database references for all schemas
    var databaseRefsMap = batchFetchDatabases(schemas);

    // Get unique database IDs and fetch them in batch
    var uniqueDatabaseIds =
        databaseRefsMap.values().stream().map(EntityReference::getId).distinct().toList();

    // Bulk fetch all databases using the repository to ensure fields are properly set
    var databaseRepository = (DatabaseRepository) Entity.getEntityRepository(Entity.DATABASE);

    // Get all databases from database in bulk
    var databasesList =
        databaseRepository
            .getDao()
            .findEntitiesByIds(new ArrayList<>(uniqueDatabaseIds), Include.ALL);

    // Use setFieldsInBulk to efficiently set all required fields including service
    databaseRepository.setFieldsInBulk(Fields.EMPTY_FIELDS, databasesList);

    var databases =
        databasesList.stream().collect(Collectors.toMap(Database::getId, database -> database));

    // Set fields for all schemas
    schemas.forEach(
        schema -> {
          var databaseRef = databaseRefsMap.get(schema.getId());
          if (databaseRef != null) {
            var database = databases.get(databaseRef.getId());
            if (database != null) {
              schema.withDatabase(databaseRef).withService(database.getService());
            }
          }
        });
  }

  private Map<UUID, EntityReference> batchFetchDatabases(List<DatabaseSchema> schemas) {
    var databaseMap = new HashMap<UUID, EntityReference>();
    if (schemas == null || schemas.isEmpty()) {
      return databaseMap;
    }

    // Single batch query to get all databases for all schemas
    // Database (from) -> CONTAINS -> DatabaseSchema (to)
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(schemas), Relationship.CONTAINS.ordinal(), Include.ALL);

    // Collect all unique database IDs first
    var databaseIds =
        records.stream()
            .filter(rec -> Entity.DATABASE.equals(rec.getFromEntity()))
            .map(rec -> UUID.fromString(rec.getFromId()))
            .distinct()
            .toList();

    // Batch fetch all database entity references
    var databaseRefs = Entity.getEntityReferencesByIds(Entity.DATABASE, databaseIds, Include.ALL);
    var databaseRefMap =
        databaseRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    // Map schemas to their databases
    records.forEach(
        record -> {
          // Only process records where the from entity is DATABASE
          if (Entity.DATABASE.equals(record.getFromEntity())) {
            var schemaId = UUID.fromString(record.getToId());
            var databaseId = UUID.fromString(record.getFromId());
            var databaseRef = databaseRefMap.get(databaseId);
            if (databaseRef != null) {
              databaseMap.put(schemaId, databaseRef);
            }
          }
        });

    return databaseMap;
  }

  private void fetchAndSetTables(List<DatabaseSchema> schemas) {
    // TODO: Implement bulk fetching of tables
    schemas.forEach(schema -> schema.setTables(getTables(schema)));
  }

  private void fetchAndSetDatabaseSchemaProfilerConfigs(List<DatabaseSchema> schemas) {
    // TODO: Implement bulk fetching of profiler configs
    schemas.forEach(
        schema -> schema.setDatabaseSchemaProfilerConfig(getDatabaseSchemaProfilerConfig(schema)));
  }

  private void fetchAndSetUsageSummaries(List<DatabaseSchema> schemas) {
    if (schemas == null || schemas.isEmpty()) {
      return;
    }

    var usageMap =
        EntityUtil.getLatestUsageForEntities(daoCollection.usageDAO(), entityListToUUID(schemas));

    schemas.forEach(schema -> schema.withUsageSummary(usageMap.get(schema.getId())));
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
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    DatabaseSchema schema = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database schema

    // Get tables under this schema
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
    List<Table> tables =
        tableRepository.listAllForCSV(
            tableRepository.getFields("owners,tags,domain,extension"),
            schema.getFullyQualifiedName());
    tables.forEach(
        table -> tableRepository.setFieldsInternal(table, new Fields(Set.of("columns", "tags"))));
    tables.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Get stored procedures under this schema
    StoredProcedureRepository spRepository =
        (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
    List<StoredProcedure> storedProcedures =
        spRepository.listAllForCSV(
            spRepository.getFields("owners,tags,domain,extension,storedProcedureCode"),
            schema.getFullyQualifiedName());
    storedProcedures.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Export all entities using a single CSV
    return new DatabaseSchemaCsv(schema, user, recursive)
        .exportAllCsv(tables, storedProcedures, recursive);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    DatabaseSchema schema = null;
    try {
      schema = getByName(null, name, getFields("database,service")); // Fetch with container context
    } catch (EntityNotFoundException e) {
      if (!dryRun) {
        throw e;
      } else {
        LOG.warn(
            "Dry run mode: DatabaseSchema '{}' not found. Skipping existence validation.", name);
        schema = new DatabaseSchema().withName(name);
      }
    }

    DatabaseSchemaCsv schemaCsv = new DatabaseSchemaCsv(schema, user, recursive);
    List<CSVRecord> records;
    if (recursive) {
      records = schemaCsv.parse(csv, recursive);
    } else {
      records = schemaCsv.parse(csv);
    }
    return schemaCsv.importCsv(records, dryRun);
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
    public final CsvDocumentation DOCUMENTATION;
    public final List<CsvHeader> HEADERS;
    private final DatabaseSchema schema;
    private final boolean recursive;

    public DatabaseSchemaCsv(DatabaseSchema schema, String user, boolean recursive) {
      super(TABLE, getCsvDocumentation(Entity.DATABASE_SCHEMA, recursive).getHeaders(), user);
      this.schema = schema;
      this.DOCUMENTATION = getCsvDocumentation(Entity.DATABASE_SCHEMA, recursive);
      this.HEADERS = DOCUMENTATION.getHeaders();
      this.recursive = recursive;
    }

    /**
     * Export tables and stored procedures under this schema
     */
    public String exportAllCsv(
        List<Table> tables, List<StoredProcedure> storedProcedures, boolean recursive)
        throws IOException {
      // Create CSV file
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);

      // Add tables with entityType = table and include columns
      TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
      for (Table table : tables) {
        // Export the table entity
        addEntityToCSV(csvFile, table, TABLE);
        if (!recursive) {
          continue;
        }
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
      addField(
          recordList,
          entity.getCertification() != null && entity.getCertification().getTagLabel() != null
              ? entity.getCertification().getTagLabel().getTagFQN()
              : "");
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
      // Add entityType and
      if (recursive) {
        addField(recordList, entityType);
        addField(recordList, entity.getFullyQualifiedName());

        addField(recordList, ""); // column specific fields, empty for entity
        addField(recordList, ""); // column specific fields, empty for entity
        addField(recordList, ""); // column specific fields, empty for entity
        addField(recordList, ""); // column specific fields, empty for entity

        if (STORED_PROCEDURE.equals(entityType)) {
          StoredProcedure sp = (StoredProcedure) entity;
          String code =
              sp.getStoredProcedureCode() != null ? sp.getStoredProcedureCode().getCode() : "";
          String language =
              sp.getStoredProcedureCode() != null
                      && sp.getStoredProcedureCode().getLanguage() != null
                  ? sp.getStoredProcedureCode().getLanguage().toString()
                  : "";

          addField(recordList, code);
          addField(recordList, language);
        } else {
          addField(recordList, "");
          addField(recordList, "");
        }
      }
      addRecord(csvFile, recordList);
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      if (recursive) {
        createEntityWithRecursion(printer, csvRecords);
      } else {
        createEntityWithoutRecursion(printer, csvRecords);
      }
    }

    protected void createEntityWithoutRecursion(CSVPrinter printer, List<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      String tableFqn = FullyQualifiedName.add(schema.getFullyQualifiedName(), csvRecord.get(0));
      Table table;
      try {
        table = Entity.getEntityByName(TABLE, tableFqn, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        LOG.warn("Table not found: {}, it will be created with Import.", tableFqn);
        table =
            new Table()
                .withService(schema.getService())
                .withDatabase(schema.getDatabase())
                .withDatabaseSchema(schema.getEntityReference());
      }

      // Headers: name, displayName, description, owners, tags, glossaryTerms, tiers, certification,
      // retentionPeriod,
      // sourceUrl, domain
      // Field 1,2,3,6,7 - database schema name, displayName, description
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));

      AssetCertification certification = getCertificationLabels(csvRecord.get(7));

      table
          .withName(csvRecord.get(0))
          .withFullyQualifiedName(tableFqn)
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withCertification(certification)
          .withRetentionPeriod(csvRecord.get(8))
          .withSourceUrl(csvRecord.get(9))
          .withColumns(nullOrEmpty(table.getColumns()) ? new ArrayList<>() : table.getColumns())
          .withDomain(getEntityReference(printer, csvRecord, 10, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 11));

      if (processRecord) {
        createEntity(printer, csvRecord, table, TABLE);
      }
    }

    protected void createEntityWithRecursion(CSVPrinter printer, List<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      // Get entityType and fullyQualifiedName if provided
      String entityType = csvRecord.size() > 12 ? csvRecord.get(12) : TABLE;
      String entityFQN = csvRecord.size() > 13 ? csvRecord.get(13) : null;

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

    @Override
    protected void addRecord(CsvFile csvFile, Table entity) {
      addEntityToCSV(csvFile, entity, TABLE);
    }
  }
}
