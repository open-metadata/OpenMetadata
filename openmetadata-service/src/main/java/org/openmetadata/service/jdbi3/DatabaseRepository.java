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
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;

import java.io.IOException;
import java.util.ArrayList;
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
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.DatabaseProfilerConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
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
  public String exportToCsv(String name, String user) throws IOException {
    Database database = getByName(null, name, Fields.EMPTY_FIELDS); // Validate database name
    DatabaseSchemaRepository repository =
        (DatabaseSchemaRepository) Entity.getEntityRepository(DATABASE_SCHEMA);
    ListFilter filter = new ListFilter(Include.NON_DELETED).addQueryParam("database", name);
    List<DatabaseSchema> schemas =
        repository.listAll(repository.getFields("owner,tags,domain"), filter);
    schemas.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new DatabaseCsv(database, user).exportCsv(schemas);
  }

  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user)
      throws IOException {
    Database database = getByName(null, name, Fields.EMPTY_FIELDS); // Validate glossary name
    DatabaseCsv databaseCsv = new DatabaseCsv(database, user);
    return databaseCsv.importCsv(csv, dryRun);
  }

  public void setFields(Database database, Fields fields) {
    database.setService(getContainer(database.getId()));
    database.setSourceHash(fields.contains("sourceHash") ? database.getSourceHash() : null);
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
      Database original, Database updated, Operation operation) {
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

  public class DatabaseUpdater extends EntityUpdater {
    public DatabaseUpdater(Database original, Database updated, Operation operation) {
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

  public static class DatabaseCsv extends EntityCsv<DatabaseSchema> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(Entity.DATABASE);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final Database database;

    DatabaseCsv(Database database, String user) {
      super(DATABASE_SCHEMA, DOCUMENTATION.getHeaders(), user);
      this.database = database;
    }

    @Override
    protected void createEntity(CSVPrinter printer, Iterator<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);
      String schemaFqn = FullyQualifiedName.add(database.getFullyQualifiedName(), csvRecord.get(0));
      DatabaseSchema schema;
      try {
        schema = Entity.getEntityByName(DATABASE_SCHEMA, schemaFqn, "*", Include.NON_DELETED);
      } catch (Exception ex) {
        importFailure(printer, entityNotFound(0, DATABASE_SCHEMA, schemaFqn), csvRecord);
        processRecord = false;
        return;
      }

      // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
      // Field 1,2,3,6,7 - database schema name, displayName, description
      schema
          .withName(csvRecord.get(0))
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwner(getOwner(printer, csvRecord, 3))
          .withTags(getTagLabels(printer, csvRecord, 4))
          .withRetentionPeriod(csvRecord.get(5))
          .withSourceUrl(csvRecord.get(6))
          .withDomain(getEntityReference(printer, csvRecord, 7, Entity.DOMAIN));
      if (processRecord) {
        createEntity(printer, csvRecord, schema);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, DatabaseSchema entity) {
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
