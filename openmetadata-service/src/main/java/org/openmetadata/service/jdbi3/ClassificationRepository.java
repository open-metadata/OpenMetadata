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

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.tags.ClassificationResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ClassificationRepository extends EntityRepository<Classification> {

  private static final int TAG_LABEL_TAG_USAGE_SOURCE = 0;

  public ClassificationRepository(CollectionDAO dao) {
    super(
        ClassificationResource.TAG_COLLECTION_PATH,
        Entity.CLASSIFICATION,
        Classification.class,
        dao.classificationDAO(),
        dao,
        "",
        "");
  }

  @Override
  public EntityUpdater getUpdater(Classification original, Classification updated, Operation operation) {
    return new ClassificationUpdater(original, updated, operation);
  }

  @Override
  public Classification setFields(Classification category, Fields fields) {
    category.withTermCount(fields.contains("termCount") ? getTermCount(category) : null);
    return category.withUsageCount(fields.contains("usageCount") ? getUsageCount(category) : null);
  }

  @Override
  public void prepare(Classification entity) {
    /* Nothing to do */
  }

  @Override
  public void storeEntity(Classification category, boolean update) throws IOException {
    store(category, update);
  }

  @Override
  public void storeRelationships(Classification entity) {}

  private int getTermCount(Classification category) {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("parent", FullyQualifiedName.build(category.getName()));
    return daoCollection.tagDAO().listCount(filter);
  }

  private Integer getUsageCount(Classification category) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.TAG.ordinal(), category.getName());
  }

  @Transaction
  public Classification delete(UriInfo uriInfo, UUID id) throws IOException {
    Classification category = get(uriInfo, id, Fields.EMPTY_FIELDS, Include.NON_DELETED);
    checkSystemEntityDeletion(category);
    dao.delete(id.toString());
    daoCollection.tagDAO().deleteTagsByPrefix(category.getName());
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.TAG.ordinal(), category.getName());
    daoCollection.tagUsageDAO().deleteTagLabelsByPrefix(TagSource.TAG.ordinal(), category.getName());
    return category;
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

  public class ClassificationUpdater extends EntityUpdater {
    public ClassificationUpdater(Classification original, Classification updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // TODO handle name change
      // TODO mutuallyExclusive from false to true?
      recordChange("mutuallyExclusive", original.getMutuallyExclusive(), updated.getMutuallyExclusive());
      updateName(original, updated);
    }

    public void updateName(Classification original, Classification updated) throws IOException {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Category name changed - update tag names starting from category and all the children tags
        LOG.info("Classification name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.tagDAO().updateFqn(original.getName(), updated.getName());
        daoCollection.tagUsageDAO().updateTagPrefix(original.getName(), updated.getName(), TAG_LABEL_TAG_USAGE_SOURCE);
        recordChange("name", original.getName(), updated.getName());
      }
    }
  }
}
