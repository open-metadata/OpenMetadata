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

package org.openmetadata.catalog.jdbi3;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.tags.Tag;
import org.openmetadata.catalog.resources.tags.TagResource;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.TagCategory;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.Source;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class TagCategoryRepository extends EntityRepository<TagCategory> {
  private final TagRepository tagRepository;

  public TagCategoryRepository(CollectionDAO dao, TagRepository tagRepository) {
    super(TagResource.TAG_COLLECTION_PATH, Entity.TAG_CATEGORY, TagCategory.class, dao.tagCategoryDAO(), dao, "", "");
    allowEdits = true;
    this.tagRepository = tagRepository;
  }

  /** Initialize a category one time when the service comes up for the first time */
  @Transaction
  public void initCategory(TagCategory category) throws IOException {
    String json = dao.findJsonByFqn(category.getName(), Include.ALL);
    if (json == null) {
      LOG.info("Tag category {} is not initialized", category.getName());
      storeEntity(category, false);

      // Only two levels of tag allowed under a category
      for (Tag primaryTag : category.getChildren()) {
        primaryTag.setFullyQualifiedName(FullyQualifiedName.build(category.getName(), primaryTag.getName()));
        tagRepository.storeEntity(primaryTag, false);
      }
    } else {
      LOG.info("Tag category {} is already initialized", category.getName());
    }
  }

  // Populate TagCategory with children details
  private TagCategory populateCategoryTags(TagCategory category, Fields fields) throws IOException {
    // Get tags under that match category prefix
    ListFilter listFilter = new ListFilter(Include.ALL).addQueryParam("parent", category.getName());
    List<String> groupJsons = daoCollection.tagDAO().listAfter(listFilter, 10000, "");

    List<Tag> tagList = new ArrayList<>();
    for (String json : groupJsons) {
      Tag tag = tagRepository.setFields(JsonUtils.readValue(json, Tag.class), fields);
      tagList.add(tagRepository.populateChildrenTags(tag, fields));
    }
    return category.withChildren(tagList.isEmpty() ? null : tagList);
  }

  @Override
  public EntityUpdater getUpdater(TagCategory original, TagCategory updated, Operation operation) {
    return new TagCategoryUpdater(original, updated, operation);
  }

  @Override
  public TagCategory setFields(TagCategory category, Fields fields) throws IOException {
    populateCategoryTags(category, fields);
    return category.withUsageCount(fields.contains("usageCount") ? getUsageCount(category) : null);
  }

  @Override
  public void prepare(TagCategory entity) throws IOException {
    setFullyQualifiedName(entity);
  }

  @Override
  public void storeEntity(TagCategory category, boolean update) throws IOException {
    List<Tag> primaryTags = category.getChildren();
    category.setChildren(null); // Children are not stored as json and are constructed on the fly
    store(category.getId(), category, update);
    category.withChildren(primaryTags);
  }

  @Override
  public void storeRelationships(TagCategory entity) {}

  private Integer getUsageCount(TagCategory category) {
    return daoCollection.tagUsageDAO().getTagCount(Source.TAG.ordinal(), category.getName());
  }

  @Transaction
  public TagCategory delete(UriInfo uriInfo, String id) throws IOException {
    TagCategory category = get(uriInfo, id, Fields.EMPTY_FIELDS, Include.NON_DELETED);
    dao.delete(id);
    daoCollection.tagDAO().deleteTagsByPrefix(category.getName());
    daoCollection.tagUsageDAO().deleteTagLabels(Source.TAG.ordinal(), category.getName());
    daoCollection.tagUsageDAO().deleteTagLabelsByPrefix(Source.TAG.ordinal(), category.getName());
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

  public class TagCategoryUpdater extends EntityUpdater {
    public TagCategoryUpdater(TagCategory original, TagCategory updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // TODO handle name change
      recordChange("categoryType", original.getCategoryType(), updated.getCategoryType());
      updateName(original, updated);
    }

    public void updateName(TagCategory original, TagCategory updated) throws IOException {
      if (!original.getName().equals(updated.getName())) {
        // Category name changed - update tag names starting from category and all the children tags
        LOG.info("Tag category name changed from {} to {}", original.getName(), updated.getName());
        tagRepository.updateChildrenTagNames(original.getName(), updated.getName());
        recordChange("name", original.getName(), updated.getName());
      }

      // Populate response fields
      populateCategoryTags(updated, Fields.EMPTY_FIELDS);
    }
  }
}
