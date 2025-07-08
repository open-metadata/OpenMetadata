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

import static org.openmetadata.csv.CsvUtil.addDomains;
import static org.openmetadata.csv.CsvUtil.addExtension;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addGlossaryTerms;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;
import static org.openmetadata.csv.CsvUtil.addTagTiers;
import static org.openmetadata.csv.CsvUtil.formatCsv;
import static org.openmetadata.service.Entity.DATABASE;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.DATABASE_SERVICE;
import static org.openmetadata.service.Entity.STORED_PROCEDURE;
import static org.openmetadata.service.Entity.TABLE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DatabaseServiceRepository
    extends ServiceEntityRepository<DatabaseService, DatabaseConnection> {
  public DatabaseServiceRepository() {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.DATABASE_SERVICE,
        Entity.getCollectionDAO().dbServiceDAO(),
        DatabaseConnection.class,
        "",
        ServiceType.DATABASE);
    supportsSearch = true;
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    DatabaseService databaseService =
        getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS); // Validate database name
    DatabaseRepository repository = (DatabaseRepository) Entity.getEntityRepository(DATABASE);
    List<Database> databases =
        repository.listAllForCSV(
            repository.getFields("name,owners,tags,domain,extension"),
            databaseService.getFullyQualifiedName());

    databases.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new DatabaseServiceCsv(databaseService, user, recursive)
        .exportAllCsv(databases, recursive);
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    // Validate database service
    DatabaseService databaseService =
        getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS); // Validate glossary name
    DatabaseServiceCsv databaseServiceCsv =
        new DatabaseServiceCsv(databaseService, user, recursive);
    List<CSVRecord> records;
    if (recursive) {
      records = databaseServiceCsv.parse(csv, recursive);
    } else {
      records = databaseServiceCsv.parse(csv);
    }
    return databaseServiceCsv.importCsv(records, dryRun);
  }

  public static class DatabaseServiceCsv extends EntityCsv<Database> {
    public final CsvDocumentation DOCUMENTATION;
    public final List<CsvHeader> HEADERS;
    private final DatabaseService service;
    private final boolean recursive;

    public DatabaseServiceCsv(DatabaseService service, String user, boolean recursive) {
      super(DATABASE, getCsvDocumentation(DATABASE_SERVICE, recursive).getHeaders(), user);
      this.service = service;
      this.DOCUMENTATION = getCsvDocumentation(DATABASE_SERVICE, recursive);
      this.HEADERS = DOCUMENTATION.getHeaders();
      this.recursive = recursive;
    }

    /**
     * Export all databases with their child entities (schema, tables, stored procedures, columns)
     */
    public String exportAllCsv(List<Database> databases, boolean recursive) throws IOException {
      if (!recursive) {
        return this.exportCsv(databases);
      }
      CsvFile csvFile = new CsvFile().withHeaders(HEADERS);
      for (Database database : databases) {
        addEntityToCSV(csvFile, database, DATABASE);
        DatabaseRepository databaseRepository =
            (DatabaseRepository) Entity.getEntityRepository(DATABASE);
        String dbCsv =
            databaseRepository.exportToCsv(database.getFullyQualifiedName(), importedBy, recursive);
        if (dbCsv != null && !dbCsv.isEmpty()) {
          try {
            // Parse the CSV content
            CSVParser parser = CSVParser.parse(dbCsv, CSVFormat.DEFAULT.withFirstRecordAsHeader());
            for (CSVRecord record : parser) {
              // Convert the CSV record to a List<String>
              List<String> recordList = new ArrayList<>();
              for (int i = 0; i < record.size(); i++) {
                recordList.add(record.get(i));
              }
              // Add the record to the CSV file using the overridden addRecord method
              this.addRecord(csvFile, recordList);
            }
          } catch (Exception e) {
            LOG.error("Error parsing database CSV: {}", e.getMessage());
          }
        }
      }

      return formatCsv(csvFile);
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

      if (recursive) {
        Object retentionPeriod = EntityUtil.getEntityField(entity, "retentionPeriod");
        Object sourceUrl = EntityUtil.getEntityField(entity, "sourceUrl");
        addField(recordList, retentionPeriod == null ? "" : retentionPeriod.toString());
        addField(recordList, sourceUrl == null ? "" : sourceUrl.toString());
      }

      // Handle optional fields that may not exist in all entity types
      addDomains(recordList, entity.getDomains());
      addExtension(recordList, entity.getExtension());

      // Add entityType and fullyQualifiedName
      if (recursive) {
        addField(recordList, entityType);
        addField(recordList, entity.getFullyQualifiedName());
      }

      addRecord(csvFile, recordList);
    }

    /**
     * Add a record to the CSV file
     */
    @Override
    public void addRecord(CsvFile csvFile, List<String> recordList) {
      List<List<String>> records = csvFile.getRecords();
      if (records == null) {
        records = new ArrayList<>();
      }
      records.add(recordList);
      csvFile.withRecords(records);
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
      String databaseFqn =
          FullyQualifiedName.add(service.getFullyQualifiedName(), csvRecord.get(0));
      Database database;
      try {
        database = Entity.getEntityByName(DATABASE, databaseFqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Database not found: {}, it will be created with Import.", databaseFqn);
        database = new Database().withService(service.getEntityReference());
      }

      // Headers: name, displayName, description, owners, tags, glossaryTerms, tiers, certification,
      // domain, extension
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));

      AssetCertification certification = getCertificationLabels(csvRecord.get(7));

      database
          .withName(csvRecord.get(0))
          .withFullyQualifiedName(databaseFqn)
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withCertification(certification)
          .withDomains(getDomains(printer, csvRecord, 8))
          .withExtension(getExtension(printer, csvRecord, 9));

      if (processRecord) {
        createEntity(printer, csvRecord, database, DATABASE);
      }
    }

    protected void createEntityWithRecursion(CSVPrinter printer, List<CSVRecord> csvRecords)
        throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      // Get entityType and fullyQualifiedName if provided
      String entityType = csvRecord.size() > 12 ? csvRecord.get(12) : DATABASE;
      String entityFQN = csvRecord.size() > 13 ? csvRecord.get(13) : null;

      if (DATABASE.equals(entityType)) {
        createDatabaseEntity(printer, csvRecord, entityFQN);
      } else if (DATABASE_SCHEMA.equals(entityType)) {
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

    private void createDatabaseEntity(CSVPrinter printer, CSVRecord csvRecord, String entityFQN)
        throws IOException {
      String databaseFqn =
          entityFQN != null
              ? entityFQN
              : FullyQualifiedName.add(service.getFullyQualifiedName(), csvRecord.get(0));

      Database database;
      try {
        database = Entity.getEntityByName(DATABASE, databaseFqn, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Database not found: {}, it will be created with Import.", databaseFqn);
        database = new Database().withService(service.getEntityReference());
      }

      // Headers: name, displayName, description, owners, tags, glossaryTerms, tiers, domain
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));
      AssetCertification certification = getCertificationLabels(csvRecord.get(7));
      database
          .withName(csvRecord.get(0))
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withCertification(certification)
          .withSourceUrl(csvRecord.get(9))
          .withDomains(getDomains(printer, csvRecord, 10))
          .withExtension(getExtension(printer, csvRecord, 11));

      if (processRecord) {
        createEntity(printer, csvRecord, database, DATABASE);
      }
    }

    @Override
    protected void createSchemaEntity(CSVPrinter printer, CSVRecord csvRecord, String entityFQN)
        throws IOException {
      // If FQN is not provided, construct it from database FQN and schema name
      if (entityFQN == null) {
        throw new IllegalArgumentException(
            "Schema import requires fullyQualifiedName to determine the schema it belongs to");
      }
      String dbFQN = FullyQualifiedName.getParentFQN(entityFQN);

      Database database;
      try {
        database = Entity.getEntityByName(DATABASE, dbFQN, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        LOG.warn("Database not found: {}. Handling based on dryRun mode.", dbFQN);
        if (importResult.getDryRun()) {
          // Dry run mode: Simulate a schema for validation without persisting it
          database =
              new Database()
                  .withName(dbFQN)
                  .withService(service.getEntityReference())
                  .withId(UUID.randomUUID());
        } else {
          throw new IllegalArgumentException("Database not found: " + dbFQN);
        }
      }

      DatabaseSchema schema;
      DatabaseSchemaRepository databaseSchemaRepository =
          (DatabaseSchemaRepository) Entity.getEntityRepository(DATABASE_SCHEMA);
      String schemaFqn = FullyQualifiedName.add(dbFQN, csvRecord.get(0));
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
      AssetCertification certification = getCertificationLabels(csvRecord.get(7));
      schema
          .withId(UUID.randomUUID())
          .withName(csvRecord.get(0))
          .withDisplayName(csvRecord.get(1))
          .withFullyQualifiedName(schemaFqn)
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withCertification(certification)
          .withRetentionPeriod(csvRecord.get(8))
          .withSourceUrl(csvRecord.get(9))
          .withDomains(getDomains(printer, csvRecord, 10))
          .withExtension(getExtension(printer, csvRecord, 11))
          .withUpdatedAt(System.currentTimeMillis())
          .withUpdatedBy(importedBy);
      if (processRecord) {
        createEntity(printer, csvRecord, schema, DATABASE_SCHEMA);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Database entity) {
      addEntityToCSV(csvFile, entity, DATABASE);
    }
  }
}
