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
import static org.openmetadata.service.Entity.DATABASE;
import static org.openmetadata.service.Entity.DATABASE_SERVICE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
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
  public String exportToCsv(String name, String user) throws IOException {
    DatabaseService databaseService =
        getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS); // Validate database name
    DatabaseRepository repository = (DatabaseRepository) Entity.getEntityRepository(DATABASE);
    List<Database> databases =
        repository.listAllForCSV(
            repository.getFields("name,owners,tags,domain,extension"),
            databaseService.getFullyQualifiedName());

    databases.sort(Comparator.comparing(EntityInterface::getFullyQualifiedName));
    return new DatabaseServiceCsv(databaseService, user).exportCsv(databases);
  }

  @Override
  public CsvImportResult importFromCsv(String name, String csv, boolean dryRun, String user)
      throws IOException {
    // Validate database service
    DatabaseService databaseService =
        getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS); // Validate glossary name
    DatabaseServiceCsv databaseServiceCsv = new DatabaseServiceCsv(databaseService, user);
    return databaseServiceCsv.importCsv(csv, dryRun);
  }

  @Override
  public void storeRelationships(DatabaseService service) {
    super.storeRelationships(service);
    if (service.getIngestionAgent() != null) {
      addRelationship(
          service.getId(),
          service.getIngestionAgent().getId(),
          entityType,
          service.getIngestionAgent().getType(),
          Relationship.HAS);
    }
  }

  public static class DatabaseServiceCsv extends EntityCsv<Database> {
    public static final CsvDocumentation DOCUMENTATION = getCsvDocumentation(DATABASE_SERVICE);
    public static final List<CsvHeader> HEADERS = DOCUMENTATION.getHeaders();
    private final DatabaseService service;

    DatabaseServiceCsv(DatabaseService service, String user) {
      super(DATABASE, DOCUMENTATION.getHeaders(), user);
      this.service = service;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
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

      // Headers: name, displayName, description, owners, tags, glossaryTerms, tiers, domain
      // Field 1,2,3,6,7 - database service name, displayName, description
      List<TagLabel> tagLabels =
          getTagLabels(
              printer,
              csvRecord,
              List.of(
                  Pair.of(4, TagLabel.TagSource.CLASSIFICATION),
                  Pair.of(5, TagLabel.TagSource.GLOSSARY),
                  Pair.of(6, TagLabel.TagSource.CLASSIFICATION)));
      database
          .withName(csvRecord.get(0))
          .withDisplayName(csvRecord.get(1))
          .withDescription(csvRecord.get(2))
          .withOwners(getOwners(printer, csvRecord, 3))
          .withTags(tagLabels)
          .withDomain(getEntityReference(printer, csvRecord, 7, Entity.DOMAIN))
          .withExtension(getExtension(printer, csvRecord, 8));

      if (processRecord) {
        createEntity(printer, csvRecord, database);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, Database entity) {
      // Headers: name, displayName, description, owners, tags, glossaryTerms, tiers, domain
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addOwners(recordList, entity.getOwners());
      addTagLabels(recordList, entity.getTags());
      addGlossaryTerms(recordList, entity.getTags());
      addTagTiers(recordList, entity.getTags());
      String domain =
          entity.getDomain() == null || Boolean.TRUE.equals(entity.getDomain().getInherited())
              ? ""
              : entity.getDomain().getFullyQualifiedName();
      addField(recordList, domain);
      addExtension(recordList, entity.getExtension());
      addRecord(csvFile, recordList);
    }
  }
}
