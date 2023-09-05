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

import static org.openmetadata.service.Entity.CLASSIFICATION;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.resources.EntityResource.searchClient;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.index.engine.DocumentMissingException;
import org.elasticsearch.rest.RestStatus;
import org.jdbi.v3.core.mapper.RowMapper;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.search.SearchEventPublisher;
import org.openmetadata.service.search.SearchRetriableException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class ClassificationRepository extends EntityRepository<Classification> {
  public ClassificationRepository(CollectionDAO dao) {
    super(
        ClassificationResource.TAG_COLLECTION_PATH,
        Entity.CLASSIFICATION,
        Classification.class,
        dao.classificationDAO(),
        dao,
        "",
        "");
    quoteFqn = true;
    supportsSearchIndex = true;
  }

  @Override
  public EntityUpdater getUpdater(Classification original, Classification updated, Operation operation) {
    return new ClassificationUpdater(original, updated, operation);
  }

  @Override
  public Classification setFields(Classification classification, Fields fields) {
    classification.withTermCount(fields.contains("termCount") ? getTermCount(classification) : null);
    return classification.withUsageCount(fields.contains("usageCount") ? getUsageCount(classification) : null);
  }

  @Override
  public Classification clearFields(Classification classification, Fields fields) {
    classification.withTermCount(fields.contains("termCount") ? classification.getTermCount() : null);
    return classification.withUsageCount(fields.contains("usageCount") ? classification.getUsageCount() : null);
  }

  @Override
  public void prepare(Classification entity, boolean update) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(Classification classification, boolean update) {
    store(classification, update);
  }

  @Override
  public void storeRelationships(Classification entity) {
    // No relationships to store beyond what is stored in the super class
  }

  private int getTermCount(Classification classification) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("parent", classification.getFullyQualifiedName());
    return daoCollection.tagDAO().listCount(filter);
  }

  private Integer getUsageCount(Classification classification) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.CLASSIFICATION.ordinal(), classification.getName());
  }

  public static class TagLabelMapper implements RowMapper<TagLabel> {
    @Override
    public TagLabel map(ResultSet r, org.jdbi.v3.core.statement.StatementContext ctx) throws SQLException {
      return new TagLabel()
          .withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
          .withState(TagLabel.State.values()[r.getInt("state")])
          .withTagFQN(r.getString("tagFQN"));
    }
  }

  @Override
  @SuppressWarnings("unused")
  public void postUpdate(Classification entity) {
    String scriptTxt = "ctx._source.disabled=true";
    try {
      searchClient.updateSearchEntityUpdated(entity.getEntityReference(), scriptTxt);
    } catch (DocumentMissingException ex) {
      LOG.error("Missing Document", ex);
    } catch (ElasticsearchException e) {
      LOG.error("failed to update ES doc");
      LOG.debug(e.getMessage());
    } catch (IOException ie) {
      throw new EventPublisherException(ie.getMessage());
    }
  }

  @Override
  public void deleteFromSearch(Classification entity, String changeType) {
    if (supportsSearchIndex) {
      String contextInfo = entity != null ? String.format("Entity Info : %s", entity) : null;
      try {
        if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
          searchClient.softDeleteOrRestoreEntityFromSearch(
              entity.getEntityReference(), changeType.equals(RestUtil.ENTITY_SOFT_DELETED));
        } else {
          searchClient.updateSearchEntityDeleted(entity.getEntityReference(), "", "classification.fullyQualifiedName");
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

  public class ClassificationUpdater extends EntityUpdater {
    public ClassificationUpdater(Classification original, Classification updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      // TODO handle name change
      // TODO mutuallyExclusive from false to true?
      recordChange("mutuallyExclusive", original.getMutuallyExclusive(), updated.getMutuallyExclusive());
      recordChange("disabled,", original.getDisabled(), updated.getDisabled());
      updateName(original, updated);
    }

    public void updateName(Classification original, Classification updated) {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Classification name changed - update tag names starting from classification and all the children tags
        LOG.info("Classification name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.tagDAO().updateFqn(original.getName(), updated.getName());
        daoCollection
            .tagUsageDAO()
            .updateTagPrefix(TagSource.CLASSIFICATION.ordinal(), original.getName(), updated.getName());
        recordChange("name", original.getName(), updated.getName());
        invalidateClassification(original.getId());
      }
    }

    private void invalidateClassification(UUID classificationId) {
      // Name of the classification changed. Invalidate the classification and all the children tags
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(CLASSIFICATION, classificationId));
      List<EntityRelationshipRecord> tagRecords =
          findToRecords(classificationId, CLASSIFICATION, Relationship.CONTAINS, TAG);
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
      }
    }

    private void invalidateTags(UUID tagId) {
      // The name of the tag changed. Invalidate that tag and all the children from the cache
      List<EntityRelationshipRecord> tagRecords = findToRecords(tagId, TAG, Relationship.CONTAINS, TAG);
      CACHE_WITH_ID.invalidate(new ImmutablePair<>(TAG, tagId));
      for (EntityRelationshipRecord tagRecord : tagRecords) {
        invalidateTags(tagRecord.getId());
      }
    }
  }
}
