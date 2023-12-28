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

import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwner;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.TABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.DatabaseSchemaProfilerConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
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
    schema.setSourceHash(fields.contains("sourceHash") ? schema.getSourceHash() : null);
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
        Entity.getEntity(Entity.DATABASE, schema.getDatabase().getId(), "owner,domain", ALL);
    inheritOwner(schema, fields, database);
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
    return Entity.getEntity(entity.getDatabase(), fields, Include.NON_DELETED);
  }

  @Override
  public EntityRepository<DatabaseSchema>.EntityUpdater getUpdater(
      DatabaseSchema original, DatabaseSchema updated, Operation operation) {
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
  public String exportToCsv(String name, String user) throws IOException {
    DatabaseSchema schema = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database schema
    TableRepository repository = (TableRepository) Entity.getEntityRepository(TABLE);
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("databaseSchema", name);
    List<Table> tables = repository.listAll(repository.getFields("owner,tags,domain"), filter);
    tables.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new DatabaseSchemaCsv(schema, user).exportCsv(tables);
  }

  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user)
      throws IOException {
    DatabaseSchema schema = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database schema
    return new DatabaseSchemaCsv(schema, user).importCsv(csv, dryRun);
  }

  public class DatabaseSchemaUpdater extends EntityUpdater {
    public DatabaseSchemaUpdater(
        DatabaseSchema original, DatabaseSchema updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
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

    @Override
    protected void createEntity(CSVPrinter printer, Iterator<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      String tableFqn = FullyQualifiedName.add(schema.getFullyQualifiedName(), csvRecord.get(0));
      Table table;
      try {
        table = Entity.getEntityByName(TABLE, tableFqn, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        importFailure(printer, entityNotFound(0, TABLE, tableFqn), csvRecord);
        processRecord = false;
        return;
      }

      // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
      // Field 1,2,3,6,7 - database schema name, displayName, description
      table
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwner(getOwner(printer, csvRecord, 3))
          .withTags(getTagLabels(printer, csvRecord, 4))
          .withRetentionPeriod(csvRecord.get(5))
          .withSourceUrl(csvRecord.get(6))
          .withDomain(getEntityReference(printer, csvRecord, 7, Entity.DOMAIN));

      if (processRecord) {
        createEntity(printer, csvRecord, table);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Table entity) {
      // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addOwner(recordList, entity.getOwner());
      addTagLabels(recordList, entity.getTags());
      addField(recordList, entity.getRetentionPeriod());
      addField(recordList, entity.getSourceUrl());
      String domain =
          entity.getDomain() == null || Boolean.TRUE.equals(entity.getDomain().getInherited())
              ? ""
              : entity.getDomain().getFullyQualifiedName();
      addField(recordList, domain);
      addRecord(csvFile, recordList);
    }
  }
}
