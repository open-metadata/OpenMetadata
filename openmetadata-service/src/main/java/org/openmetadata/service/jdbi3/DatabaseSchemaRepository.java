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
import static org.openmetadata.csv.CsvUtil.addDomains;
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
import java.util.HashSet;
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
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
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
import org.openmetadata.schema.type.ProfileSampleConfig;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.StaticSamplingConfig;
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
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DatabaseSchemaRepository extends EntityRepository<DatabaseSchema> {

  public static final String DATABASE_SCHEMA_PROFILER_CONFIG_EXTENSION =
      "databaseSchema.databaseSchemaProfilerConfig";

  public static final String DATABASE_SCHEMA_PROFILER_CONFIG = "databaseSchemaProfilerConfig";
  private static final String RETENTION_PERIOD_FIELD = "retentionPeriod";

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
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(DatabaseSchema schema, boolean update) {
    store(schema, update);
  }

  @Override
  public void storeEntities(List<DatabaseSchema> schemas) {
    storeMany(schemas);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<DatabaseSchema> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(DatabaseSchema::getId).toList();
    deleteToMany(ids, Entity.DATABASE_SCHEMA, Relationship.CONTAINS, Entity.DATABASE);
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

  @Override
  protected void storeEntitySpecificRelationshipsForMany(List<DatabaseSchema> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (DatabaseSchema schema : entities) {
      if (schema.getDatabase() == null || schema.getDatabase().getId() == null) {
        continue;
      }
      EntityReference database = schema.getDatabase();
      relationships.add(
          newRelationship(
              database.getId(),
              schema.getId(),
              database.getType(),
              Entity.DATABASE_SCHEMA,
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
  }

  private List<EntityReference> getTables(DatabaseSchema schema) {
    return schema == null
        ? Collections.emptyList()
        : findTo(schema.getId(), Entity.DATABASE_SCHEMA, Relationship.CONTAINS, TABLE);
  }

  @Override
  public void setFields(DatabaseSchema schema, Fields fields, RelationIncludes relationIncludes) {
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
    if (hasDefaultFields(schema)) {
      return;
    }

    EntityReference databaseRef = schema.getDatabase();
    if (databaseRef == null || databaseRef.getId() == null) {
      databaseRef = getContainer(schema.getId());
    }

    EntityReference serviceRef = schema.getService();
    if ((serviceRef == null || serviceRef.getId() == null)
        && databaseRef != null
        && databaseRef.getId() != null) {
      // Fast path: schema JSON already stores database ref, resolve service directly from database.
      serviceRef =
          getFromEntityRef(
              databaseRef.getId(), Entity.DATABASE, Relationship.CONTAINS, null, false);
    }

    // Fallback for legacy rows with incomplete parent refs.
    if ((serviceRef == null || serviceRef.getId() == null)
        && databaseRef != null
        && databaseRef.getId() != null) {
      Database database = Entity.getEntity(databaseRef, "", Include.ALL);
      serviceRef = database.getService();
    }

    schema.withDatabase(databaseRef).withService(serviceRef);
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<DatabaseSchema> entities) {
    // Bulk fetch and set default fields for all schemas
    fetchAndSetDefaultFields(entities);

    // Fetch common fields like owners, tags, domain, etc.
    fetchAndSetFields(entities, fields);

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

    // Database and service references are part of default response contract for list/get.
    boolean includeDatabaseDetails = true;
    boolean includeServiceDetails = true;

    List<DatabaseSchema> schemasMissingDefaults =
        schemas.stream()
            .filter(
                schema -> {
                  boolean missingDatabase =
                      schema.getDatabase() == null || schema.getDatabase().getId() == null;
                  boolean missingService =
                      schema.getService() == null || schema.getService().getId() == null;
                  return missingDatabase || (includeServiceDetails && missingService);
                })
            .toList();
    if (schemasMissingDefaults.isEmpty()) {
      return;
    }

    var databaseRefsMap = batchFetchDatabases(schemasMissingDefaults, includeDatabaseDetails);
    Map<UUID, EntityReference> databaseToServiceRefs =
        includeServiceDetails
            ? batchFetchServicesForDatabases(
                databaseRefsMap.values().stream()
                    .map(EntityReference::getId)
                    .collect(Collectors.toSet()),
                true)
            : Collections.emptyMap();

    schemasMissingDefaults.forEach(
        schema -> {
          var databaseRef = databaseRefsMap.get(schema.getId());
          if (databaseRef != null) {
            schema.withDatabase(databaseRef);
            if (includeServiceDetails) {
              schema.withService(databaseToServiceRefs.get(databaseRef.getId()));
            }
          }
        });
  }

  private Map<UUID, EntityReference> batchFetchServicesForDatabases(
      Set<UUID> databaseIds, boolean includeDetails) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (databaseIds == null || databaseIds.isEmpty()) {
      return serviceMap;
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                databaseIds.stream().map(UUID::toString).toList(),
                Relationship.CONTAINS.ordinal(),
                Include.ALL);

    for (CollectionDAO.EntityRelationshipObject record : records) {
      if (record.getFromEntity() == null
          || record.getFromId() == null
          || record.getToId() == null) {
        continue;
      }
      if (!includeDetails) {
        serviceMap.put(
            UUID.fromString(record.getToId()),
            new EntityReference()
                .withId(UUID.fromString(record.getFromId()))
                .withType(record.getFromEntity()));
      }
    }

    if (includeDetails) {
      Map<String, Set<UUID>> serviceIdsByType = new HashMap<>();
      for (CollectionDAO.EntityRelationshipObject record : records) {
        if (record.getFromEntity() == null
            || record.getFromId() == null
            || record.getToId() == null) {
          continue;
        }
        serviceIdsByType
            .computeIfAbsent(record.getFromEntity(), ignored -> new HashSet<>())
            .add(UUID.fromString(record.getFromId()));
      }

      Map<String, Map<UUID, EntityReference>> serviceRefsByType = new HashMap<>();
      for (Map.Entry<String, Set<UUID>> entry : serviceIdsByType.entrySet()) {
        List<EntityReference> refs =
            Entity.getEntityReferencesByIds(
                entry.getKey(), new ArrayList<>(entry.getValue()), Include.ALL);
        serviceRefsByType.put(
            entry.getKey(),
            refs.stream()
                .collect(
                    Collectors.toMap(EntityReference::getId, ref -> ref, (left, right) -> left)));
      }

      for (CollectionDAO.EntityRelationshipObject record : records) {
        Map<UUID, EntityReference> refsForType = serviceRefsByType.get(record.getFromEntity());
        if (refsForType == null) {
          continue;
        }
        EntityReference serviceRef = refsForType.get(UUID.fromString(record.getFromId()));
        if (serviceRef != null) {
          serviceMap.put(UUID.fromString(record.getToId()), serviceRef);
        }
      }
    }
    return serviceMap;
  }

  private boolean hasDefaultFields(DatabaseSchema schema) {
    return schema.getDatabase() != null && schema.getService() != null;
  }

  private Map<UUID, EntityReference> batchFetchDatabases(
      List<DatabaseSchema> schemas, boolean includeDetails) {
    var databaseMap = new HashMap<UUID, EntityReference>();
    if (schemas == null || schemas.isEmpty()) {
      return databaseMap;
    }
    var relations =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(schemas), Relationship.CONTAINS.ordinal(), Include.ALL);

    var databaseIds =
        relations.stream()
            .filter(relation -> Entity.DATABASE.equals(relation.getFromEntity()))
            .map(relation -> UUID.fromString(relation.getFromId()))
            .distinct()
            .toList();

    Map<UUID, EntityReference> databaseRefMap = new HashMap<>();
    if (includeDetails) {
      // Batch fetch all database entity references
      var databaseRefs = Entity.getEntityReferencesByIds(Entity.DATABASE, databaseIds, Include.ALL);
      databaseRefMap.putAll(
          databaseRefs.stream().collect(Collectors.toMap(EntityReference::getId, ref -> ref)));
    }

    // Map schemas to their databases
    relations.forEach(
        relation -> {
          // Only process records where the from entity is DATABASE
          if (Entity.DATABASE.equals(relation.getFromEntity())) {
            var schemaId = UUID.fromString(relation.getToId());
            var databaseId = UUID.fromString(relation.getFromId());
            var databaseRef =
                includeDetails
                    ? databaseRefMap.get(databaseId)
                    : new EntityReference().withId(databaseId).withType(Entity.DATABASE);
            if (databaseRef != null) {
              databaseMap.put(schemaId, databaseRef);
            }
          }
        });

    return databaseMap;
  }

  private void fetchAndSetTables(List<DatabaseSchema> schemas) {
    if (schemas == null || schemas.isEmpty()) {
      return;
    }

    // Get all schema IDs
    List<String> schemaIds =
        schemas.stream().map(schema -> schema.getId().toString()).distinct().toList();

    // Bulk fetch all table relationships
    List<CollectionDAO.EntityRelationshipObject> tableRelations =
        daoCollection
            .relationshipDAO()
            .findToBatch(schemaIds, Relationship.CONTAINS.ordinal(), Entity.DATABASE_SCHEMA, TABLE);

    // Group table IDs by schema
    Map<UUID, List<UUID>> schemaToTableIds = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject relation : tableRelations) {
      UUID schemaId = UUID.fromString(relation.getFromId());
      UUID tableId = UUID.fromString(relation.getToId());
      schemaToTableIds.computeIfAbsent(schemaId, k -> new ArrayList<>()).add(tableId);
    }

    // Get all unique table IDs
    List<UUID> allTableIds =
        schemaToTableIds.values().stream().flatMap(List::stream).distinct().toList();

    // Bulk fetch all table references
    Map<UUID, EntityReference> tableReferences = new HashMap<>();
    if (!allTableIds.isEmpty()) {
      List<EntityReference> tableRefs =
          Entity.getEntityReferencesByIds(TABLE, allTableIds, Include.ALL);
      for (EntityReference ref : tableRefs) {
        tableReferences.put(ref.getId(), ref);
      }
    }

    // Set tables on each schema
    for (DatabaseSchema schema : schemas) {
      List<UUID> tableIds = schemaToTableIds.get(schema.getId());
      if (tableIds != null) {
        List<EntityReference> tables =
            tableIds.stream()
                .map(tableReferences::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        schema.setTables(tables);
      } else {
        schema.setTables(Collections.emptyList());
      }
    }
  }

  private void fetchAndSetDatabaseSchemaProfilerConfigs(List<DatabaseSchema> schemas) {
    if (schemas == null || schemas.isEmpty()) {
      return;
    }

    // Since bulk fetch is not available for extensions, we'll optimize by caching results
    Map<UUID, DatabaseSchemaProfilerConfig> configCache = new HashMap<>();

    for (DatabaseSchema schema : schemas) {
      DatabaseSchemaProfilerConfig config = getProfilerConfigForSchema(schema, configCache);
      schema.setDatabaseSchemaProfilerConfig(config);
    }
  }

  private DatabaseSchemaProfilerConfig getProfilerConfigForSchema(
      DatabaseSchema schema, Map<UUID, DatabaseSchemaProfilerConfig> configCache) {
    if (schema.getId() == null) {
      return null;
    }

    // Check if already in cache
    if (configCache.containsKey(schema.getId())) {
      return configCache.get(schema.getId());
    }

    // Fetch and cache the config
    DatabaseSchemaProfilerConfig config = fetchProfilerConfig(schema.getId());
    configCache.put(schema.getId(), config);
    return config;
  }

  private DatabaseSchemaProfilerConfig fetchProfilerConfig(UUID schemaId) {
    try {
      String configJson =
          daoCollection
              .entityExtensionDAO()
              .getExtension(schemaId, DATABASE_SCHEMA_PROFILER_CONFIG_EXTENSION);
      if (configJson != null) {
        return JsonUtils.readValue(configJson, DatabaseSchemaProfilerConfig.class);
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch/parse profiler config for schema {}: {}", schemaId, e.getMessage());
    }
    return null;
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
  protected boolean requiresParentForInheritance(DatabaseSchema schema, Fields fields) {
    return super.requiresParentForInheritance(schema, fields)
        || (shouldResolveRetentionInheritance(fields) && schema.getRetentionPeriod() == null);
  }

  @Override
  public void setInheritedFields(DatabaseSchema schema, Fields fields) {
    if (schema.getDatabase() == null || schema.getDatabase().getId() == null) {
      return;
    }

    boolean needsOwnersOrDomains = super.requiresParentForInheritance(schema, fields);
    boolean needsRetention =
        shouldResolveRetentionInheritance(fields) && schema.getRetentionPeriod() == null;
    if (!needsOwnersOrDomains && !needsRetention) {
      return;
    }

    String inheritanceFields =
        needsOwnersOrDomains
            ? (needsRetention ? "owners,domains,retentionPeriod" : "owners,domains")
            : "retentionPeriod";
    Database database =
        getOrLoadInheritanceParent(schema.getDatabase(), inheritanceFields, Database.class);
    if (database == null) {
      return;
    }
    if (needsOwnersOrDomains) {
      inheritOwners(schema, fields, database);
      inheritDomains(schema, fields, database);
    }
    if (needsRetention) {
      schema.withRetentionPeriod(database.getRetentionPeriod());
    }
  }

  @Override
  public void restorePatchAttributes(DatabaseSchema original, DatabaseSchema updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  protected EntityReference getParentReference(DatabaseSchema entity) {
    return entity.getDatabase();
  }

  @Override
  protected String getInheritableFields() {
    return "owners,domains,retentionPeriod";
  }

  @Override
  protected void applyInheritance(DatabaseSchema entity, Fields fields, EntityInterface parent) {
    inheritOwners(entity, fields, parent);
    inheritDomains(entity, fields, parent);
    if (parent instanceof Database database) {
      entity.withRetentionPeriod(
          entity.getRetentionPeriod() == null
              ? database.getRetentionPeriod()
              : entity.getRetentionPeriod());
    }
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
    var database = (Database) getCachedParentOrLoad(schema.getDatabase(), "", ALL);
    schema
        .withDatabase(database.getEntityReference())
        .withService(database.getService())
        .withServiceType(database.getServiceType());
  }

  private boolean shouldResolveRetentionInheritance(Fields fields) {
    return fields == null
        || fields.getFieldList().isEmpty()
        || fields.contains(RETENTION_PERIOD_FIELD);
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
    return exportToCsv(name, user, recursive, null);
  }

  @Override
  public String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    DatabaseSchema schema = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database schema

    // Get tables under this schema
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
    List<Table> tables =
        tableRepository.listAllForCSV(
            tableRepository.getFields("owners,tags,domains,extension"),
            schema.getFullyQualifiedName());
    tables.forEach(
        table -> tableRepository.setFieldsInternal(table, new Fields(Set.of("columns", "tags"))));
    tables.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Get stored procedures under this schema
    StoredProcedureRepository spRepository =
        (StoredProcedureRepository) Entity.getEntityRepository(STORED_PROCEDURE);
    List<StoredProcedure> storedProcedures =
        spRepository.listAllForCSV(
            spRepository.getFields("owners,tags,domains,extension,storedProcedureCode"),
            schema.getFullyQualifiedName());
    storedProcedures.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));

    // Export all entities using a single CSV
    return new DatabaseSchemaCsv(schema, user, recursive)
        .exportAllCsv(tables, storedProcedures, recursive, callback);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    DatabaseSchema schema = null;
    try {
      schema = getByName(null, name, getFields("database,service"));
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
    return schemaCsv.importCsv(records, dryRun, callback);
  }

  public class DatabaseSchemaUpdater extends EntityUpdater {
    public DatabaseSchemaUpdater(
        DatabaseSchema original, DatabaseSchema updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "retentionPeriod",
          () ->
              recordChange(
                  "retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod()));
      compareAndUpdate(
          "sourceUrl",
          () -> recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl()));
      compareAndUpdate(
          "sourceHash",
          () ->
              recordChange(
                  "sourceHash",
                  original.getSourceHash(),
                  updated.getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }
  }

  public DatabaseSchema addDatabaseSchemaProfilerConfig(
      UUID databaseSchemaId, DatabaseSchemaProfilerConfig databaseSchemaProfilerConfig) {
    // Validate the request content
    DatabaseSchema databaseSchema = find(databaseSchemaId, Include.NON_DELETED);

    ProfileSampleConfig profileSampleConfig = databaseSchemaProfilerConfig.getProfileSampleConfig();
    if (!nullOrEmpty(profileSampleConfig) && !nullOrEmpty(profileSampleConfig.getConfig())) {
      ProfileSampleConfig.SampleConfigType sampleConfigType =
          profileSampleConfig.getSampleConfigType();
      if (!nullOrEmpty(sampleConfigType)
          && sampleConfigType.equals(ProfileSampleConfig.SampleConfigType.STATIC)) {
        StaticSamplingConfig staticConfig =
            JsonUtils.convertValue(profileSampleConfig.getConfig(), StaticSamplingConfig.class);
        if (staticConfig.getProfileSampleType() != null
            && staticConfig.getProfileSample() != null) {
          EntityUtil.validateProfileSample(
              staticConfig.getProfileSampleType().toString(), staticConfig.getProfileSample());
        }
      }
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
        List<Table> tables,
        List<StoredProcedure> storedProcedures,
        boolean recursive,
        CsvExportProgressCallback callback)
        throws IOException {
      // Create CSV file
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);

      int total = tables.size() + storedProcedures.size();
      int exported = 0;
      int batchNumber = 0;

      // Add tables with entityType = table and include columns
      TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
      for (Table table : tables) {
        // Export the table entity
        addEntityToCSV(csvFile, table, TABLE);
        if (recursive) {
          // Export all columns as separate rows with entityType = COLUMN
          tableRepository.exportColumnsRecursively(table, csvFile);
        }
        exported++;

        if (exported % DEFAULT_BATCH_SIZE == 0 || exported == total) {
          batchNumber++;
          if (callback != null) {
            String message =
                String.format(
                    "Exported %d of %d entities (batch %d)", exported, total, batchNumber);
            callback.onProgress(exported, total, message);
          }
        }
      }

      // Add stored procedures with entityType = storedProcedure
      for (StoredProcedure sp : storedProcedures) {
        addEntityToCSV(csvFile, sp, STORED_PROCEDURE);
        exported++;

        if (exported % DEFAULT_BATCH_SIZE == 0 || exported == total) {
          batchNumber++;
          if (callback != null) {
            String message =
                String.format(
                    "Exported %d of %d entities (batch %d)", exported, total, batchNumber);
            callback.onProgress(exported, total, message);
          }
        }
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
      addDomains(recordList, entity.getDomains());
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
      if (importResult.getDryRun()) {
        // Dry run mode - check if exists, create simulation if not
        try {
          table = Entity.getEntityByName(TABLE, tableFqn, "*", Include.NON_DELETED);
        } catch (EntityNotFoundException ex) {
          LOG.warn("Dry run: Table not found: {}, simulating creation.", tableFqn);
          table =
              new Table()
                  .withService(schema.getService())
                  .withDatabase(schema.getDatabase())
                  .withDatabaseSchema(schema.getEntityReference());
        }
      } else {
        // Dry Run = false, True Run - use dependency resolution (checks flush list)
        try {
          table = getEntityWithDependencyResolution(TABLE, tableFqn, "*", Include.NON_DELETED);
        } catch (EntityNotFoundException ex) {
          LOG.warn("Table not found: {}, it will be created with Import.", tableFqn);
          table =
              new Table()
                  .withService(schema.getService())
                  .withDatabase(schema.getDatabase())
                  .withDatabaseSchema(schema.getEntityReference());
        }
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
          .withDomains(getDomains(printer, csvRecord, 10))
          .withExtension(getExtension(printer, csvRecord, 11));

      if (processRecord) {
        createEntity(printer, csvRecord, table, TABLE);
      }
    }

    protected void createEntityWithRecursion(CSVPrinter printer, List<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      if (csvRecord == null) {
        return; // Error has already been logged by getNextRecord, just skip this record
      }

      // Get entityType and fullyQualifiedName if provided
      String entityType = csvRecord.size() > 12 ? csvRecord.get(12) : TABLE;
      String entityFQN = csvRecord.size() > 13 ? csvRecord.get(13) : null;
      rowEntityType = entityType;

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
