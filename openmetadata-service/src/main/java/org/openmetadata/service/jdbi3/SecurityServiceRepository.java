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

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.csv.CsvUtil.addField;
import static org.openmetadata.csv.CsvUtil.addOwners;
import static org.openmetadata.csv.CsvUtil.addTagLabels;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;
import org.apache.commons.lang3.tuple.Pair;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.csv.CsvDocumentation;
import org.openmetadata.schema.type.csv.CsvFile;
import org.openmetadata.schema.type.csv.CsvHeader;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.services.security.SecurityServiceResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class SecurityServiceRepository
    extends ServiceEntityRepository<SecurityService, SecurityConnection> {

  private static final String UPDATE_FIELDS = "owners,tags,connection";
  private static final String PATCH_FIELDS = "owners,tags,connection";

  public SecurityServiceRepository() {
    super(
        SecurityServiceResource.COLLECTION_PATH,
        Entity.SECURITY_SERVICE,
        Entity.getCollectionDAO().securityServiceDAO(),
        SecurityConnection.class,
        UPDATE_FIELDS,
        ServiceType.SECURITY);
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(SecurityService securityService) {
    // For services, FQN is just the service name
    securityService.setFullyQualifiedName(FullyQualifiedName.build(securityService.getName()));
  }

  @Override
  public void prepare(SecurityService securityService, boolean update) {
    // Call parent to handle connection encryption and other service-level preparations
    super.prepare(securityService, update);

    // Additional security service specific preparations can be added here
  }

  @Override
  public void storeEntity(SecurityService securityService, boolean update) {
    // Store the security service entity
    store(securityService, update);
  }

  @Override
  public void storeRelationships(SecurityService securityService) {
    // Call parent to handle ingestion runner relationship
    super.storeRelationships(securityService);

    // Additional relationships can be added here if needed
  }

  @Override
  public void setInheritedFields(SecurityService securityService, EntityUtil.Fields fields) {
    // For services, typically minimal inheritance is needed
    // Domain inheritance can be added here if needed
  }

  @Override
  public void clearFields(SecurityService securityService, EntityUtil.Fields fields) {
    // Clear fields based on the requested fields
    // Call parent to handle standard service fields like pipelines
    super.clearFields(securityService, fields);
  }

  @Override
  public void setFields(SecurityService securityService, EntityUtil.Fields fields) {
    // Set fields based on the requested fields
    // Call parent to handle standard service fields like pipelines
    super.setFields(securityService, fields);
  }

  @Override
  public void restorePatchAttributes(SecurityService original, SecurityService updated) {
    // Restore attributes that shouldn't be changed via PATCH
    super.restorePatchAttributes(original, updated);

    // Service type should not change
    updated.withServiceType(original.getServiceType());
  }

  @Override
  public ServiceEntityRepository<SecurityService, SecurityConnection>.ServiceUpdater getUpdater(
      SecurityService original, SecurityService updated, Operation operation) {
    return new SecurityServiceUpdater(original, updated, operation);
  }

  @Override
  public String exportToCsv(String name, String user, boolean recursive) throws IOException {
    SecurityService securityService = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new SecurityServiceCsv(securityService, user).exportCsv(List.of(securityService));
  }

  @Override
  public CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    SecurityService securityService = getByName(null, name, EntityUtil.Fields.EMPTY_FIELDS);
    return new SecurityServiceCsv(securityService, user).importCsv(csv, dryRun);
  }

  public static class SecurityServiceCsv extends EntityCsv<SecurityService> {
    public static final List<CsvHeader> HEADERS;
    public static final CsvDocumentation DOCUMENTATION;

    static {
      HEADERS =
          listOf(
              new CsvHeader().withName("name").withRequired(true),
              new CsvHeader().withName("displayName"),
              new CsvHeader().withName("description"),
              new CsvHeader().withName("serviceType").withRequired(true),
              new CsvHeader().withName("owners"),
              new CsvHeader().withName("tags"),
              new CsvHeader().withName("domain"),
              new CsvHeader().withName("dataProducts"));

      DOCUMENTATION =
          new CsvDocumentation()
              .withHeaders(HEADERS)
              .withSummary("SecurityService CSV documentation for import/export");
    }

    private final SecurityService securityService;

    SecurityServiceCsv(SecurityService securityService, String user) {
      super(Entity.SECURITY_SERVICE, HEADERS, user);
      this.securityService = securityService;
    }

    @Override
    protected void createEntity(CSVPrinter printer, List<CSVRecord> csvRecords) throws IOException {
      CSVRecord csvRecord = getNextRecord(printer, csvRecords);

      String serviceName = csvRecord.get(0);
      String serviceDisplayName = csvRecord.get(1);
      String serviceDescription = csvRecord.get(2);
      String serviceTypeStr = csvRecord.get(3);

      SecurityService newSecurityService;
      try {
        newSecurityService =
            Entity.getEntityByName(Entity.SECURITY_SERVICE, serviceName, "*", Include.NON_DELETED);
      } catch (EntityNotFoundException ex) {
        // SecurityService not found, it will be created with Import
        newSecurityService =
            new SecurityService().withName(serviceName).withFullyQualifiedName(serviceName);
      }

      // Update security service fields from CSV
      newSecurityService
          .withDisplayName(nullOrEmpty(serviceDisplayName) ? null : serviceDisplayName)
          .withDescription(nullOrEmpty(serviceDescription) ? null : serviceDescription)
          .withOwners(getOwners(printer, csvRecord, 4))
          .withTags(
              getTagLabels(
                  printer, csvRecord, List.of(Pair.of(5, TagLabel.TagSource.CLASSIFICATION))))
          .withDomain(getDomain(printer, csvRecord, 6));

      if (processRecord) {
        createEntity(printer, csvRecord, newSecurityService, Entity.SECURITY_SERVICE);
      }
    }

    @Override
    protected void addRecord(CsvFile csvFile, SecurityService entity) {
      List<String> recordList = new ArrayList<>();
      addField(recordList, entity.getName());
      addField(recordList, entity.getDisplayName());
      addField(recordList, entity.getDescription());
      addField(recordList, entity.getServiceType() != null ? entity.getServiceType().value() : "");
      addOwners(recordList, entity.getOwners());
      addTagLabels(recordList, entity.getTags());
      addField(
          recordList,
          entity.getDomain() == null
                  || Boolean.TRUE.equals(entity.getDomain().get(0).getInherited())
              ? ""
              : entity.getDomain().get(0).getFullyQualifiedName());
      addField(recordList, ""); // dataProducts - placeholder for future use
      addRecord(csvFile, recordList);
    }
  }

  public class SecurityServiceUpdater extends ServiceUpdater {
    public SecurityServiceUpdater(
        SecurityService original, SecurityService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      // Call parent to handle connection and ingestion runner updates
      super.entitySpecificUpdate(consolidatingChanges);

      // Handle security service specific updates
      recordChange("serviceType", original.getServiceType(), updated.getServiceType());
    }
  }
}
