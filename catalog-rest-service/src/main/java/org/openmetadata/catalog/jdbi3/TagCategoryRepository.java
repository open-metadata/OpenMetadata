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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.resources.tags.TagResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagCategory;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.Source;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class TagCategoryRepository extends EntityRepository<TagCategory> {
  public TagCategoryRepository(CollectionDAO dao) {
    super(TagResource.TAG_COLLECTION_PATH, Entity.TAG_CATEGORY, TagCategory.class, dao.tagCategoryDAO(), dao, "", "");
    allowEdits = true;
  }

  /** Initialize a category one time when the service comes up for the first time */
  @Transaction
  public void initCategory(TagCategory category) throws IOException {
    String json = dao.findJsonByFqn(category.getName(), Include.ALL);
    if (json == null) {
      LOG.info("Tag category {} is not initialized", category.getName());
      createCategoryInternal(category);

      // Only two levels of tag allowed under a category
      for (Tag primaryTag : category.getChildren()) {
        createTagInternal(category.getName(), primaryTag);
      }
    } else {
      LOG.info("Tag category {} is already initialized", category.getName());
    }
  }

  // TODO delete
  @Transaction
  public TagCategory updateCategory(String category, TagCategory updated) throws IOException {
    // Validate category
    TagCategory original = dao.findEntityByName(category);
    if (!original.getName().equals(updated.getName())) {
      // Category name changed - update tag names starting from category and all the children tags
      LOG.info("Tag category name changed from {} to {}", original.getName(), updated.getName());
      updateChildrenTagNames(original.getName(), updated.getName());
      original.setName(updated.getName());
    }
    original.setDescription(updated.getDescription());
    original.setCategoryType(updated.getCategoryType());
    dao.update(original.getId(), JsonUtils.pojoToJson(original));

    // Populate response fields
    return populateCategoryTags(original, null);
  }

  // TODO delete
  /**
   * Replace category name: prefix = cat1 and newPrefix = cat2 replaces the FQN of all the children tags of a category
   * from cat1.primaryTag1.secondaryTag1 to cat2.primaryTag1.secondaryTag1
   *
   * <p>Replace primary tag name: Prefix = cat1.primaryTag1 and newPrefix = cat1.primaryTag2 replaces the FQN of all the
   * children tags from cat1.primaryTag1.secondaryTag1 to cat2.primaryTag2.secondaryTag1
   */
  private void updateChildrenTagNames(String prefix, String newPrefix) throws IOException {
    // Update the fully qualified names of all the primary and secondary tags
    List<String> groupJsons = daoCollection.tagDAO().listChildrenTags(prefix);

    for (String json : groupJsons) {
      Tag tag = JsonUtils.readValue(json, Tag.class);
      String oldFQN = tag.getFullyQualifiedName();
      String newFQN = oldFQN.replace(prefix, newPrefix);
      LOG.info("Replacing tag fqn from {} to {}", oldFQN, newFQN);
      tag.setFullyQualifiedName(oldFQN.replace(prefix, newPrefix));
      daoCollection.tagDAO().updateTag(oldFQN, JsonUtils.pojoToJson(tag));
      updateChildrenTagNames(oldFQN, newFQN);
    }
  }

  private TagCategory createCategoryInternal(TagCategory category) throws IOException {
    storeEntity(category, false);
    return category;
  }

  private Tag createTagInternal(String parentFQN, Tag tag) throws JsonProcessingException {
    // First add the tag
    List<Tag> tags = tag.getChildren();
    tag.setChildren(null); // Children of tag group are not stored as json but constructed on the fly
    tag.setFullyQualifiedName(FullyQualifiedName.add(parentFQN, tag.getName()));
    daoCollection.tagDAO1().insert(tag);
    tag.setChildren(tags);
    LOG.info("Added tag {}", tag.getFullyQualifiedName());

    // Then add the children
    for (Tag children : listOrEmpty(tags)) {
      children.setChildren(null); // No children allowed for the leaf tag
      children.setFullyQualifiedName(FullyQualifiedName.add(children.getFullyQualifiedName(), children.getName()));
      LOG.info("Added tag {}", children.getFullyQualifiedName());
      daoCollection.tagDAO1().insert(children);
    }
    return tag;
  }

  // Populate TagCategory with children details
  private TagCategory populateCategoryTags(TagCategory category, Fields fields) throws IOException {
    // Get tags under that match category prefix
    List<String> groupJsons = daoCollection.tagDAO().listChildrenTags(category.getName());

    List<Tag> tagList = new ArrayList<>();
    for (String json : groupJsons) {
      // TODO clean this up
      EntityRepository<Tag> tagRepository = Entity.getEntityRepository(Entity.TAG);
      Tag tag = tagRepository.setFields(JsonUtils.readValue(json, Tag.class), fields);
      tagList.add(populateChildrenTags(tag, fields));
    }
    return category.withChildren(tagList.isEmpty() ? null : tagList);
  }

  // Populate the children tags for a given tag
  private Tag populateChildrenTags(Tag tag, Fields fields) throws IOException {
    List<String> tagJsons = daoCollection.tagDAO().listChildrenTags(tag.getFullyQualifiedName());

    // Get tags under the given tag
    List<Tag> tagList = new ArrayList<>();
    for (String json : listOrEmpty(tagJsons)) {
      // TODO clean this up
      EntityRepository<Tag> tagRepository = Entity.getEntityRepository(Entity.TAG);
      Tag childTag = tagRepository.setFields(JsonUtils.readValue(json, Tag.class), fields);
      tagList.add(populateChildrenTags(childTag, fields));
    }
    return tag.withChildren(!tagList.isEmpty() ? tagList : null);
  }

  @Override
  public EntityRepository<TagCategory>.EntityUpdater getUpdater(
      TagCategory original, TagCategory updated, Operation operation) {
    return new TagCategoryUpdater(original, updated, operation);
  }

  @Override
  public EntityInterface<TagCategory> getEntityInterface(TagCategory entity) {
    return new TagCategoryEntityInterface(entity);
  }

  @Override
  public TagCategory setFields(TagCategory category, Fields fields) throws IOException {
    populateCategoryTags(category, fields);
    return category.withUsageCount(fields.contains("usageCount") ? getUsageCount(category) : null);
  }

  @Override
  public void prepare(TagCategory entity) throws IOException {
    // Nothing to do
  }

  @Override
  public void storeEntity(TagCategory category, boolean update) throws IOException {
    List<Tag> primaryTags = category.getChildren();
    category.setChildren(null); // Children are not stored as json and are constructed on the fly
    store(category.getId(), category, update);
    category.withChildren(primaryTags);
    System.out.println("XXX " + JsonUtils.pojoToJson(category, true));
  }

  @Override
  public void storeRelationships(TagCategory entity) {}

  private Integer getUsageCount(TagCategory category) {
    return daoCollection.tagDAO().getTagCount(Source.TAG.ordinal(), category.getName());
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

  public class TagCategoryEntityInterface extends EntityInterface<TagCategory> {

    TagCategoryEntityInterface(TagCategory entity) {
      super(Entity.TAG_CATEGORY, entity);
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public TagCategory getEntity() {
      return entity;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public TagCategory withHref(URI href) {
      return entity.withHref(href);
    }
  }

  public class TagCategoryUpdater extends EntityUpdater {
    public TagCategoryUpdater(TagCategory original, TagCategory updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // TODO handle name change
      recordChange("categoryType", original.getEntity().getCategoryType(), updated.getEntity().getCategoryType());
      updateName(original.getEntity(), updated.getEntity());
    }

    public void updateName(TagCategory original, TagCategory updated) throws IOException {
      if (!original.getName().equals(updated.getName())) {
        // Category name changed - update tag names starting from category and all the children tags
        LOG.info("Tag category name changed from {} to {}", original.getName(), updated.getName());
        updateChildrenTagNames(original.getName(), updated.getName());
        recordChange("name", original.getName(), updated.getName());
      }

      // Populate response fields
      populateCategoryTags(updated, null);
    }
  }
}
