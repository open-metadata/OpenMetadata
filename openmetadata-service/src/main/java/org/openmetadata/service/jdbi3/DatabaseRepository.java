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
import org.apache.commons.text.StringEscapeUtils;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvUtil;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.AssetCertification;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.databases.DatabaseResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

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

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("name", this::fetchAndSetService);
    fieldFetchers.put("databaseSchemas", this::fetchAndSetDatabaseSchemas);
    fieldFetchers.put(DATABASE_PROFILER_CONFIG, this::fetchAndSetDatabaseProfilerConfigs);
    fieldFetchers.put("usageSummary", this::fetchAndSetUsageSummaries);
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
    if (entity.getService() == null) {
      return null;
    }
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
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
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
    return new DatabaseCsv(database, user, recursive).exportAllCsv(schemas, recursive);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    Database database = null;
    try {
      database = getByName(null, name, getFields("service"));
    } catch (EntityNotFoundException e) {
      if (!dryRun) {
        throw e;
      } else {
        LOG.warn("Dry run mode: Database '{}' not found. Skipping existence validation.", name);
        database = new Database().withName(name);
      }
    }
    DatabaseCsv databaseCsv = new DatabaseCsv(database, user, recursive);

    List<CSVRecord> records;
    if (recursive) {
      records = databaseCsv.parse(csv, recursive);
    } else {
      records = databaseCsv.parse(csv);
    }
    return databaseCsv.importCsv(records, dryRun);
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

  @Override
  public void setFieldsInBulk(Fields fields, List<Database> entities) {
    // Always set default service field for all databases
    fetchAndSetDefaultService(entities);

    fetchAndSetFields(entities, fields);
    fetchAndSetDatabaseSpecificFields(entities, fields);
    setInheritedFields(entities, fields);

    entities.forEach(entity -> clearFieldsInternal(entity, fields));
  }

  private void fetchAndSetDatabaseSpecificFields(List<Database> databases, Fields fields) {
    if (databases == null || databases.isEmpty()) {
      return;
    }

    if (fields.contains("databaseSchemas")) {
      fetchAndSetDatabaseSchemas(databases, fields);
    }

    if (fields.contains(DATABASE_PROFILER_CONFIG)) {
      fetchAndSetDatabaseProfilerConfigs(databases, fields);
    }

    if (fields.contains("usageSummary")) {
      fetchAndSetUsageSummaries(databases, fields);
    }
  }

  private void fetchAndSetDatabaseSchemas(List<Database> databases, Fields fields) {
    if (!fields.contains("databaseSchemas") || databases == null || databases.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true, databases, batchFetchDatabaseSchemas(databases), Database::setDatabaseSchemas);
  }

  private void fetchAndSetDatabaseProfilerConfigs(List<Database> databases, Fields fields) {
    if (!fields.contains(DATABASE_PROFILER_CONFIG) || databases == null || databases.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        databases,
        batchFetchDatabaseProfilerConfigs(databases),
        Database::setDatabaseProfilerConfig);
  }

  private void fetchAndSetUsageSummaries(List<Database> databases, Fields fields) {
    if (!fields.contains("usageSummary") || databases == null || databases.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        databases,
        EntityUtil.getLatestUsageForEntities(daoCollection.usageDAO(), entityListToUUID(databases)),
        Database::setUsageSummary);
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

  private Map<UUID, List<EntityReference>> batchFetchDatabaseSchemas(List<Database> databases) {
    var schemasMap = new HashMap<UUID, List<EntityReference>>();
    if (databases == null || databases.isEmpty()) {
      return schemasMap;
    }

    // Initialize empty lists for all databases
    databases.forEach(database -> schemasMap.put(database.getId(), new ArrayList<>()));

    // Single batch query to get all schemas for all databases
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(databases),
                Relationship.CONTAINS.ordinal(),
                DATABASE_SCHEMA,
                Include.ALL);

    // Collect all unique schema IDs first
    var schemaIds = records.stream().map(rec -> UUID.fromString(rec.getToId())).distinct().toList();

    // Batch fetch all schema entity references
    var schemaRefs = Entity.getEntityReferencesByIds(DATABASE_SCHEMA, schemaIds, Include.ALL);
    var schemaRefMap =
        schemaRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    // Group schemas by database ID
    records.forEach(
        record -> {
          var databaseId = UUID.fromString(record.getFromId());
          var schemaId = UUID.fromString(record.getToId());
          var schemaRef = schemaRefMap.get(schemaId);
          if (schemaRef != null) {
            schemasMap.get(databaseId).add(schemaRef);
          }
        });

    return schemasMap;
  }

  private Map<UUID, DatabaseProfilerConfig> batchFetchDatabaseProfilerConfigs(
      List<Database> databases) {
    var configMap = new HashMap<UUID, DatabaseProfilerConfig>();
    if (databases == null || databases.isEmpty()) {
      return configMap;
    }

    // Use batch extension query for profiler configs
    var records =
        daoCollection
            .entityExtensionDAO()
            .getExtensionsBatch(entityListToStrings(databases), DATABASE_PROFILER_CONFIG_EXTENSION);

    records.forEach(
        record -> {
          try {
            var config = JsonUtils.readValue(record.extensionJson(), DatabaseProfilerConfig.class);
            configMap.put(record.id(), config);
          } catch (Exception e) {
            configMap.put(record.id(), null);
          }
        });

    // Ensure all databases have an entry (null if no config found)
    databases.forEach(
        database -> {
          if (!configMap.containsKey(database.getId())) {
            configMap.put(database.getId(), null);
          }
        });

    return configMap;
  }

  private void fetchAndSetDefaultService(List<Database> databases) {
    if (databases == null || databases.isEmpty()) {
      return;
    }

    // Batch fetch service references for all databases
    var serviceMap = batchFetchServices(databases);

    // Set service for all databases
    databases.forEach(database -> database.setService(serviceMap.get(database.getId())));
  }

  private Map<UUID, EntityReference> batchFetchServices(List<Database> databases) {
    var serviceMap = new HashMap<UUID, EntityReference>();
    if (databases == null || databases.isEmpty()) {
      return serviceMap;
    }

    // Single batch query to get all services for all databases
    // Use Include.ALL to get all relationships including those for soft-deleted entities
    var records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(databases), Relationship.CONTAINS.ordinal(), Include.ALL);

    // Collect all unique service IDs first
    var serviceIds =
        records.stream()
            .filter(rec -> Entity.DATABASE_SERVICE.equals(rec.getFromEntity()))
            .map(rec -> UUID.fromString(rec.getFromId()))
            .distinct()
            .toList();

    // Batch fetch all service entity references
    var serviceRefs =
        Entity.getEntityReferencesByIds(Entity.DATABASE_SERVICE, serviceIds, Include.ALL);
    var serviceRefMap =
        serviceRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref));

    // Map databases to their services
    records.forEach(
        record -> {
          if (Entity.DATABASE_SERVICE.equals(record.getFromEntity())) {
            var databaseId = UUID.fromString(record.getToId());
            var serviceId = UUID.fromString(record.getFromId());
            var serviceRef = serviceRefMap.get(serviceId);
            if (serviceRef != null) {
              serviceMap.put(databaseId, serviceRef);
            }
          }
        });

    return serviceMap;
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
    public final CsvDocumentation DOCUMENTATION;
    public final List<CsvHeader> HEADERS;
    private final Database database;
    private final boolean recursive;

    public DatabaseCsv(Database database, String user, boolean recursive) {
      super(DATABASE_SCHEMA, getCsvDocumentation(Entity.DATABASE, recursive).getHeaders(), user);
      this.database = database;
      this.DOCUMENTATION = getCsvDocumentation(Entity.DATABASE, recursive);
      this.HEADERS = DOCUMENTATION.getHeaders();
      this.recursive = recursive;
    }

    /**
     * Export database schemas and all their child entities (tables, views, stored procedures)
     */
    public String exportAllCsv(List<DatabaseSchema> schemas, boolean recursive) throws IOException {
      // Create CSV file with schemas
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);

      // Add schemas
      for (DatabaseSchema schema : schemas) {
        addEntityToCSV(csvFile, schema, DATABASE_SCHEMA);
        if (!recursive) {
          continue;
        }

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
          tableRepository.setFieldsInternal(table, new Fields(Set.of("columns", "tags")));
          // Add all columns as separate rows
          tableRepository.exportColumnsRecursively(table, csvFile);
        }

        // Get stored procedures under each schema
        StoredProcedureRepository spRepository =
            (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
        List<StoredProcedure> storedProcedures =
            spRepository.listAllForCSV(
                spRepository.getFields("owners,tags,domain,extension,storedProcedureCode"),
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
      // Add entityType and fullyQualifiedName
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
          // If not stored procedure, add empty placeholders to maintain column alignment
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

    protected void createEntityWithRecursion(CSVPrinter printer, List<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) {
        throw new IllegalArgumentException("Invalid Csv");
      }

      // Get entityType and fullyQualifiedName if provided
      String entityType = csvRecord.size() > 12 ? csvRecord.get(12) : DATABASE_SCHEMA;
      String entityFQN =
          csvRecord.size() > 13 ? StringEscapeUtils.unescapeCsv(csvRecord.get(13)) : null;

      if (DATABASE_SCHEMA.equals(entityType)) {
        createSchemaEntity(printer, csvRecord, entityFQN);
      } else if (TABLE.equals(entityType)) {
        createTableEntity(printer, csvRecord, entityFQN);
      } else if (STORED_PROCEDURE.equals(entityType)) {
        createStoredProcedureEntity(printer, csvRecord, entityFQN);
      } else if ("column".equals(entityType)) {
        createColumnEntity(printer, csvRecord, entityFQN);
      } else {
        LOG.warn("Unknown entity type: {}", entityType);
      }
    }

    protected void createEntityWithoutRecursion(CSVPrinter printer, List<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      String schemaFqn = FullyQualifiedName.add(database.getFullyQualifiedName(), csvRecord.get(0));
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

      // Headers: name, displayName, description, owner, tags, glossaryTerms, tiers, certification,
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

      schema
          .withName(csvRecord.get(0))
          .withFullyQualifiedName(schemaFqn)
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withCertification(certification)
          .withRetentionPeriod(csvRecord.get(8))
          .withSourceUrl(csvRecord.get(9))
          .withDomain(getEntityReference(printer, csvRecord, 10, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 11));
      if (processRecord) {
        createEntity(printer, csvRecord, schema, DATABASE_SCHEMA);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, DatabaseSchema entity) {
      addEntityToCSV(csvFile, entity, DATABASE_SCHEMA);
    }
  }
}
