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

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATABASE_SERVICE;
import static org.openmetadata.service.resources.EntityResource.searchClient;

import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.index.engine.DocumentMissingException;
import org.elasticsearch.rest.RestStatus;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.resources.databases.DatabaseResource;
import org.openmetadata.service.search.SearchEventPublisher;
import org.openmetadata.service.search.SearchRetriableException;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class DatabaseRepository extends EntityRepository<Database> {
  public DatabaseRepository(CollectionDAO dao) {
    super(DatabaseResource.COLLECTION_PATH, Entity.DATABASE, Database.class, dao.databaseDAO(), dao, "", "");
    supportsSearchIndex = true;
  }

  @Override
  public void setFullyQualifiedName(Database database) {
    database.setFullyQualifiedName(FullyQualifiedName.build(database.getService().getName(), database.getName()));
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
    EntityReference service = database.getService();
    addRelationship(service.getId(), database.getId(), service.getType(), Entity.DATABASE, Relationship.CONTAINS);
  }

  @Override
  public Database setInheritedFields(Database database, Fields fields) {
    DatabaseService service = Entity.getEntity(DATABASE_SERVICE, database.getService().getId(), "domain", ALL);
    return inheritDomain(database, fields, service);
  }

  private List<EntityReference> getSchemas(Database database) {
    return database == null
        ? null
        : findTo(database.getId(), Entity.DATABASE, Relationship.CONTAINS, Entity.DATABASE_SCHEMA);
  }

  @Override
  public void postUpdate(Database entity) {}

  @Override
  public void deleteFromSearch(Database entity, String changeType) {
    if (supportsSearchIndex) {
      String contextInfo = entity != null ? String.format("Entity Info : %s", entity) : null;
      try {
        if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
          searchClient.softDeleteOrRestoreEntityFromSearch(
              entity.getEntityReference(), changeType.equals(RestUtil.ENTITY_SOFT_DELETED));
        } else {
          searchClient.updateSearchEntityDeleted(entity.getEntityReference(), "", "database.fullyQualifiedName");
        }
      } catch (DocumentMissingException ex) {
        LOG.error("Missing Document", ex);
        SearchEventPublisher.updateElasticSearchFailureStatus(
            contextInfo,
            EventPublisherJob.Status.ACTIVE_WITH_ERROR,
            String.format(
                "Missing Document while Updating ES. Reason[%s], Cause[%s], Stack [%s]",
                ex.getMessage(), ex.getCause(), ExceptionUtils.getStackTrace(ex)));
      } catch (ElasticsearchException e) {
        LOG.error("failed to update ES doc");
        LOG.debug(e.getMessage());
        if (e.status() == RestStatus.GATEWAY_TIMEOUT || e.status() == RestStatus.REQUEST_TIMEOUT) {
          LOG.error("Error in publishing to ElasticSearch");
          SearchEventPublisher.updateElasticSearchFailureStatus(
              contextInfo,
              EventPublisherJob.Status.ACTIVE_WITH_ERROR,
              String.format(
                  "Timeout when updating ES request. Reason[%s], Cause[%s], Stack [%s]",
                  e.getMessage(), e.getCause(), ExceptionUtils.getStackTrace(e)));
          throw new SearchRetriableException(e.getMessage());
        } else {
          SearchEventPublisher.updateElasticSearchFailureStatus(
              contextInfo,
              EventPublisherJob.Status.ACTIVE_WITH_ERROR,
              String.format(
                  "Failed while updating ES. Reason[%s], Cause[%s], Stack [%s]",
                  e.getMessage(), e.getCause(), ExceptionUtils.getStackTrace(e)));
          LOG.error(e.getMessage(), e);
        }
      } catch (IOException ie) {
        SearchEventPublisher.updateElasticSearchFailureStatus(
            contextInfo,
            EventPublisherJob.Status.ACTIVE_WITH_ERROR,
            String.format(
                "Issue in updating ES request. Reason[%s], Cause[%s], Stack [%s]",
                ie.getMessage(), ie.getCause(), ExceptionUtils.getStackTrace(ie)));
        throw new EventPublisherException(ie.getMessage());
      }
    }
  }

  public Database setFields(Database database, Fields fields) {
    database.setService(getContainer(database.getId()));
    database.setDatabaseSchemas(
        fields.contains("databaseSchemas") ? getSchemas(database) : database.getDatabaseSchemas());
    if (database.getUsageSummary() == null) {
      database.setUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), database.getId())
              : null);
    }
    return database;
  }

  public Database clearFields(Database database, Fields fields) {
    database.setDatabaseSchemas(fields.contains("databaseSchemas") ? database.getDatabaseSchemas() : null);
    return database.withUsageSummary(fields.contains("usageSummary") ? database.getUsageSummary() : null);
  }

  @Override
  public void restorePatchAttributes(Database original, Database updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Override
  public EntityRepository<Database>.EntityUpdater getUpdater(Database original, Database updated, Operation operation) {
    return new DatabaseUpdater(original, updated, operation);
  }

  private void populateService(Database database) {
    DatabaseService service = Entity.getEntity(database.getService(), "", Include.NON_DELETED);
    database.setService(service.getEntityReference());
    database.setServiceType(service.getServiceType());
  }

  public class DatabaseUpdater extends EntityUpdater {
    public DatabaseUpdater(Database original, Database updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      recordChange("retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod());
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
    }
  }
}
