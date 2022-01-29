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

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Glossary;
import org.openmetadata.catalog.resources.glossary.GlossaryResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class GlossaryRepository extends EntityRepository<Glossary> {
  private static final Fields GLOSSARY_UPDATE_FIELDS = new Fields(GlossaryResource.FIELD_LIST, "owner,tags");
  private static final Fields GLOSSARY_PATCH_FIELDS = new Fields(GlossaryResource.FIELD_LIST, "owner,tags");
  private final CollectionDAO dao;

  public GlossaryRepository(CollectionDAO dao) {
    super(
        GlossaryResource.COLLECTION_PATH,
        Entity.GLOSSARY,
        Glossary.class,
        dao.glossaryDAO(),
        dao,
        GLOSSARY_PATCH_FIELDS,
        GLOSSARY_UPDATE_FIELDS,
        true,
        true,
        false);
    this.dao = dao;
  }

  public static String getFQN(Glossary glossary) {
    return (glossary.getName());
  }

  @Transaction
  public EntityReference getOwnerReference(Glossary glossary) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), glossary.getOwner());
  }

  @Override
  public Glossary setFields(Glossary glossary, Fields fields) throws IOException, ParseException {
    glossary.setDisplayName(glossary.getDisplayName());
    glossary.setOwner(fields.contains("owner") ? getOwner(glossary) : null);
    glossary.setFollowers(fields.contains("followers") ? getFollowers(glossary) : null);
    glossary.setTags(fields.contains("tags") ? getTags(glossary.getFullyQualifiedName()) : null);
    glossary.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(), glossary.getId()) : null);
    return glossary;
  }

  @Override
  public void prepare(Glossary glossary) throws IOException {
    glossary.setFullyQualifiedName(getFQN(glossary));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), glossary.getOwner()); // Validate owner
    glossary.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), glossary.getTags()));
  }

  @Override
  public void storeEntity(Glossary glossary, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = glossary.getOwner();
    List<TagLabel> tags = glossary.getTags();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    glossary.withOwner(null).withHref(null).withTags(null);

    if (update) {
      dao.glossaryDAO().update(glossary.getId(), JsonUtils.pojoToJson(glossary));
    } else {
      dao.glossaryDAO().insert(glossary);
    }

    // Restore the relationships
    glossary.withOwner(owner).withTags(tags);
  }

  @Override
  public void restorePatchAttributes(Glossary original, Glossary updated) {}

  @Override
  public EntityInterface<Glossary> getEntityInterface(Glossary entity) {
    return new GlossaryEntityInterface(entity);
  }

  @Override
  public void storeRelationships(Glossary glossary) {
    setOwner(glossary, glossary.getOwner());
    applyTags(glossary);
  }

  @Override
  public EntityUpdater getUpdater(Glossary original, Glossary updated, Operation operation) {
    return new GlossaryUpdater(original, updated, operation);
  }

  public static class GlossaryEntityInterface implements EntityInterface<Glossary> {
    private final Glossary entity;

    public GlossaryEntityInterface(Glossary entity) {
      this.entity = entity;
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
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    public String getSkos() {
      return entity.getSkos();
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
    public List<EntityReference> getFollowers() {
      return entity.getFollowers();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.GLOSSARY);
    }

    @Override
    public Glossary getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return null;
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
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Glossary withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class GlossaryUpdater extends EntityUpdater {
    public GlossaryUpdater(Glossary original, Glossary updated, Operation operation) {
      super(original, updated, operation);
    }
  }
}
