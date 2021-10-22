/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.resources.tags.TagResource;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagCategory;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public class TagRepositoryHelper {
  public static final Logger LOG = LoggerFactory.getLogger(TagRepositoryHelper.class);

  public TagRepositoryHelper(CollectionDAO repo3) { this.repo3 = repo3; }

  private final CollectionDAO repo3;

  /**
   * Initialize a category one time when the service comes up for the first time
   */
  @Transaction
  public void initCategory(TagCategory category) throws JsonProcessingException {
    String json = repo3.tagDAO().findCategory(category.getName());
    if (json == null) {
      TagResource.LOG.info("Tag category {} is not initialized", category.getName());
      createCategoryInternal(category);

      // Only two levels of tag allowed under a category
      for (Tag primaryTag : category.getChildren()) {
        createTagInternal(category.getName(), primaryTag);
      }
    } else {
      TagResource.LOG.info("Tag category {} is already initialized", category.getName());
    }
  }

  @Transaction
  public TagCategory createCategory(TagCategory category) throws JsonProcessingException {
    return createCategoryInternal(category);
  }

  @Transaction
  public Tag createPrimaryTag(String category, Tag tag) throws IOException {
    // Validate category
    EntityUtil.validate(category, repo3.tagDAO().findCategory(category), TagCategory.class);
    return createTagInternal(category, tag);
  }

  @Transaction
  public Tag createSecondaryTag(String category, String primaryTag, Tag tag) throws IOException {
    // Validate category
    EntityUtil.validate(category, repo3.tagDAO().findCategory(category), TagCategory.class);

    String primaryTagFQN = category + "." + primaryTag;
    EntityUtil.validate(primaryTag, repo3.tagDAO().findTag(primaryTagFQN), Tag.class);

    return createTagInternal(primaryTagFQN, tag);
  }

  @Transaction
  public List<TagCategory> listCategories(Fields fields) throws IOException {
    List<String> jsons = repo3.tagDAO().listCategories();
    List<TagCategory> list = new ArrayList<>();
    for (String json : jsons) {
      TagCategory category = JsonUtils.readValue(json, TagCategory.class);
      list.add(setFields(category, fields));
    }
    return list;
  }

  @Transaction
  public TagCategory getCategory(String categoryName, Fields fields) throws IOException {
    TagCategory category = EntityUtil.validate(categoryName, repo3.tagDAO().findCategory(categoryName), TagCategory.class);
    category = setFields(category, fields);
    return populateCategoryTags(category, fields);
  }

  @Transaction
  public Tag getTag(String category, String fqn, Fields fields) throws IOException {
    // Validate category
    EntityUtil.validate(category, repo3.tagDAO().findCategory(category), TagCategory.class);

    // Get tags that match <category>.<tagName>
    Tag tag = setFields(EntityUtil.validate(fqn, repo3.tagDAO().findTag(fqn), Tag.class), fields);
    return populateChildrenTags(tag, fields);
  }

  @Transaction
  public TagCategory updateCategory(String category, TagCategory updated) throws IOException {
    // Validate category
    TagCategory original = EntityUtil.validate(category, repo3.tagDAO().findCategory(category), TagCategory.class);
    if (!original.getName().equals(updated.getName())) {
      // Category name changed - update tag names starting from category and all the children tags
      LOG.info("Tag category name changed from {} to {}", original.getName(), updated.getName());
      updateChildrenTagNames(original.getName(), updated.getName());
      original.setName(updated.getName());
    }
    original.setDescription(updated.getDescription());
    original.setCategoryType(updated.getCategoryType());
    repo3.tagDAO().updateCategory(category, JsonUtils.pojoToJson(original));

    // Populate response fields
    return populateCategoryTags(original, null);
  }

  @Transaction
  public Tag updatePrimaryTag(String categoryName, String primaryTag, Tag updated) throws IOException {
    // Validate categoryName
    EntityUtil.validate(categoryName, repo3.tagDAO().findCategory(categoryName), TagCategory.class);
    return updateTag(categoryName, primaryTag, updated);
  }

  @Transaction
  public Tag updateSecondaryTag(String categoryName, String primaryTag, String secondaryTag, Tag updated)
          throws IOException {
    // Validate categoryName
    EntityUtil.validate(categoryName, repo3.tagDAO().findCategory(categoryName), TagCategory.class);
    String fqnPrefix = categoryName + "." + primaryTag;
    return updateTag(fqnPrefix, secondaryTag, updated);
  }

  private Tag updateTag(String fqnPrefix, String tagName, Tag updated) throws IOException {
    // Validate tag that needs to be updated exists
    String originalFQN = fqnPrefix + "." + tagName;
    Tag original = EntityUtil.validate(originalFQN, repo3.tagDAO().findTag(originalFQN), Tag.class);

    if (!original.getName().equals(updated.getName())) {
      // Tag name changed
      LOG.info("Tag name changed from {} to {}", original.getName(), updated.getName());
      String updatedFQN = fqnPrefix + "." + updated.getName();
      updateChildrenTagNames(originalFQN, updatedFQN);
      original.withName(updated.getName()).withFullyQualifiedName(updatedFQN);
    }
    original.withDescription(updated.getDescription()).withAssociatedTags(updated.getAssociatedTags());
    repo3.tagDAO().updateTag(originalFQN, JsonUtils.pojoToJson(original));

    // Populate children
    return populateChildrenTags(original, null);
  }

  /**
   * Replace category name:
   * prefix = cat1 and newPrefix = cat2 replaces the FQN of all the children tags of a category
   * from cat1.primaryTag1.secondaryTag1 to cat2.primaryTag1.secondaryTag1
   * <p>
   * Replace primary tag name:
   * Prefix = cat1.primaryTag1 and newPrefix = cat1.primaryTag2 replaces the FQN of all the children tags
   * from cat1.primaryTag1.secondaryTag1 to cat2.primaryTag2.secondaryTag1
   */
  private void updateChildrenTagNames(String prefix, String newPrefix) throws IOException {
    // Update the fully qualified names of all the primary and secondary tags
    List<String> groupJsons = repo3.tagDAO().listChildrenTags(prefix);

    for (String json : groupJsons) {
      Tag tag = JsonUtils.readValue(json, Tag.class);
      String oldFQN = tag.getFullyQualifiedName();
      String newFQN = oldFQN.replace(prefix, newPrefix);
      LOG.info("Replacing tag fqn from {} to {}", oldFQN, newFQN);
      tag.setFullyQualifiedName(oldFQN.replace(prefix, newPrefix));
      repo3.tagDAO().updateTag(oldFQN, JsonUtils.pojoToJson(tag));
      updateChildrenTagNames(oldFQN, newFQN);
    }
  }

  private TagCategory createCategoryInternal(TagCategory category) throws JsonProcessingException {
    List<Tag> primaryTags = category.getChildren();
    category.setChildren(null); // Children are not stored as json and are constructed on the fly
    repo3.tagDAO().insertCategory(JsonUtils.pojoToJson(category));
    LOG.info("Create a new tag category {}", category.getName());
    return category.withChildren(primaryTags);
  }

  private Tag createTagInternal(String parentFQN, Tag tag) throws JsonProcessingException {
    // First add the tag
    List<Tag> tags = tag.getChildren();
    tag.setChildren(null); // Children of tag group are not stored as json but constructed on the fly
    tag.setFullyQualifiedName(parentFQN + "." + tag.getName());
    repo3.tagDAO().insertTag(JsonUtils.pojoToJson(tag));
    tag.setChildren(tags);
    TagResource.LOG.info("Added tag {}", tag.getFullyQualifiedName());

    // Then add the children
    for (Tag children : Optional.ofNullable(tags).orElse(Collections.emptyList())) {
      children.setChildren(null); // No children allowed for the leaf tag
      children.setFullyQualifiedName(children.getFullyQualifiedName() + "." + children.getName());
      TagResource.LOG.info("Added tag {}", children.getFullyQualifiedName());
      repo3.tagDAO().insertTag(JsonUtils.pojoToJson(children));
    }
    return tag;
  }

  // Populate TagCategory with children details
  private TagCategory populateCategoryTags(TagCategory category, Fields fields) throws IOException {
    // Get tags under that match category prefix
    List<String> groupJsons = repo3.tagDAO().listChildrenTags(category.getName());

    List<Tag> tagList = new ArrayList<>();
    for (String json : groupJsons) {
      Tag tag = setFields(JsonUtils.readValue(json, Tag.class), fields);
      tagList.add(populateChildrenTags(tag, fields));
    }
    return category.withChildren(tagList.isEmpty() ? null : tagList);
  }

  // Populate the children tags for a given tag
  private Tag populateChildrenTags(Tag tag, Fields fields) throws IOException {
    List<String> tagJsons = repo3.tagDAO().listChildrenTags(tag.getFullyQualifiedName());

    // Get tags under the given tag
    List<Tag> tagList = new ArrayList<>();
    for (String json : Optional.ofNullable(tagJsons).orElse(Collections.emptyList())) {
      Tag childTag = setFields(JsonUtils.readValue(json, Tag.class), fields);
      tagList.add(populateChildrenTags(childTag, fields));
    }
    return tag.withChildren(tagList.size() > 0 ? tagList : null);
  }

  private TagCategory setFields(TagCategory category, Fields fields) {
    if (fields == null) {
      return category;
    }
    return category.withUsageCount(fields.contains("usageCount") ? getUsageCount(category) : null);
  }

  private Tag setFields(Tag tag, Fields fields) {
    if (fields == null) {
      return tag;
    }
    return tag.withUsageCount(fields.contains("usageCount") ? getUsageCount(tag) : null);
  }

  private Integer getUsageCount(TagCategory category) {
    return repo3.tagDAO().getTagCount(category.getName());
  }

  private Integer getUsageCount(Tag tag) {
    return repo3.tagDAO().getTagCount(tag.getFullyQualifiedName());
  }

  public static class TagLabelMapper implements RowMapper<TagLabel> {
    @Override
    public TagLabel map(ResultSet r, org.jdbi.v3.core.statement.StatementContext ctx) throws SQLException {
      return new TagLabel().withLabelType(TagLabel.LabelType.values()[r.getInt("labelType")])
              .withState(TagLabel.State.values()[r.getInt("state")])
              .withTagFQN(r.getString("tagFQN"));
    }
  }
}
