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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.tags.Tag;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.tags.TagResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class TagRepository extends EntityRepository<Tag> {
  public TagRepository(CollectionDAO dao) {
    super(TagResource.TAG_COLLECTION_PATH, Entity.TAG, Tag.class, dao.tagDAO(), dao, "", "");
  }

  // Populate the children tags for a given tag
  Tag populateChildrenTags(Tag tag, Fields fields) throws IOException {
    ListFilter listFilter = new ListFilter(Include.ALL).addQueryParam("parent", tag.getFullyQualifiedName());
    List<String> tagJsons = dao.listAfter(listFilter, 10000, null);

    // Get tags under the given tag
    List<Tag> tagList = new ArrayList<>();
    for (String json : listOrEmpty(tagJsons)) {
      Tag childTag = setFieldsInternal(JsonUtils.readValue(json, Tag.class), fields);
      tagList.add(populateChildrenTags(childTag, fields));
    }
    return tag.withChildren(!tagList.isEmpty() ? tagList : null);
  }

  @Override
  public void prepare(Tag entity) {
    String[] split = FullyQualifiedName.split(entity.getFullyQualifiedName());
    String categoryName = split[0];
    daoCollection.tagCategoryDAO().findEntityByName(categoryName);

    if (split.length == 3) { // Secondary tag is being created. Check the primary tag
      dao.findEntityByName(FullyQualifiedName.build(split[0], split[1]));
    }
  }

  @Override
  public void storeEntity(Tag tag, boolean update) throws IOException {
    List<Tag> tags = tag.getChildren();
    tag.setChildren(null); // Children of tag group are not stored as json but constructed on the fly
    store(tag, update);
    tag.setChildren(tags);
    LOG.info("Added tag {}", tag.getFullyQualifiedName());

    // Then add the children
    for (Tag children : listOrEmpty(tag.getChildren())) {
      children.setChildren(null); // No children allowed for the leaf tag
      children.setFullyQualifiedName(FullyQualifiedName.add(children.getFullyQualifiedName(), children.getName()));
      LOG.info("Added tag {}", children.getFullyQualifiedName());
      dao.insert(children);
    }
  }

  @Override
  public void storeRelationships(Tag entity) {}

  @Override
  public void setFullyQualifiedName(Tag entity) {
    /* Nothing to do since it is already setup */
  }

  @Override
  public EntityRepository<Tag>.EntityUpdater getUpdater(Tag original, Tag updated, Operation operation) {
    return new TagUpdater(original, updated, operation);
  }

  @Override
  protected void postDelete(Tag entity) {
    // Cleanup all the tag labels using this tag
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.TAG.ordinal(), entity.getFullyQualifiedName());
  }

  @Override
  public Tag setFields(Tag tag, Fields fields) throws IOException {
    populateChildrenTags(tag, fields);
    return tag.withUsageCount(fields.contains("usageCount") ? getUsageCount(tag) : null);
  }

  private Integer getUsageCount(Tag tag) {
    return daoCollection.tagUsageDAO().getTagCount(TagSource.TAG.ordinal(), tag.getFullyQualifiedName());
  }

  @Transaction
  public Tag delete(UriInfo uriInfo, UUID id) throws IOException {
    Tag tag = get(uriInfo, id, Fields.EMPTY_FIELDS, Include.NON_DELETED);
    checkSystemEntityDeletion(tag);
    dao.delete(id.toString());
    daoCollection.tagDAO().deleteTagsByPrefix(tag.getFullyQualifiedName());
    daoCollection.tagUsageDAO().deleteTagLabels(TagSource.TAG.ordinal(), tag.getFullyQualifiedName());
    daoCollection.tagUsageDAO().deleteTagLabelsByPrefix(TagSource.TAG.ordinal(), tag.getFullyQualifiedName());
    return tag;
  }

  public class TagUpdater extends EntityUpdater {
    public TagUpdater(Tag original, Tag updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("mutuallyExclusive", original.getMutuallyExclusive(), updated.getMutuallyExclusive());
      updateName(original, updated);
    }

    public void updateName(Tag original, Tag updated) throws IOException {
      if (!original.getName().equals(updated.getName())) {
        if (ProviderType.SYSTEM.equals(original.getProvider())) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.systemEntityRenameNotAllowed(original.getName(), entityType));
        }
        // Category name changed - update tag names starting from category and all the children tags
        LOG.info("Tag name changed from {} to {}", original.getName(), updated.getName());
        daoCollection.tagDAO().updateFqn(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        daoCollection.tagUsageDAO().rename(original.getFullyQualifiedName(), updated.getFullyQualifiedName());
        recordChange("name", original.getName(), updated.getName());
      }

      // Populate response fields
      populateChildrenTags(updated, Fields.EMPTY_FIELDS);
    }
  }
}
