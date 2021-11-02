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
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Thesaurus;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.thesauruses.ThesaurusResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class ThesaurusRepository extends EntityRepository<Thesaurus> {
  private static final Logger LOG = LoggerFactory.getLogger(ThesaurusRepository.class);
  private static final Fields THESAURUS_UPDATE_FIELDS = new Fields(ThesaurusResource.FIELD_LIST,
          "owner,tags");
  private static final Fields THESAURUS_PATCH_FIELDS = new Fields(ThesaurusResource.FIELD_LIST,
          "owner,tags");
  private final CollectionDAO dao;

  public ThesaurusRepository(CollectionDAO dao) {
    super(ThesaurusResource.COLLECTION_PATH, Thesaurus.class, dao.thesaurusDAO(), dao, THESAURUS_PATCH_FIELDS, THESAURUS_UPDATE_FIELDS);
    this.dao = dao;
  }


  public static String getFQN(Thesaurus thesaurus) {
    return (thesaurus.getName());
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.relationshipDAO().findToCount(id.toString(), Relationship.CONTAINS.ordinal(), Entity.THESAURUS) > 0) {
      throw new IllegalArgumentException("Thesaurus is not empty");
    }
    if (dao.thesaurusDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.THESAURUS, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Transaction
  public EntityReference getOwnerReference(Thesaurus thesaurus) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), thesaurus.getOwner());
  }

  @Override
  public Thesaurus setFields(Thesaurus thesaurus, Fields fields) throws IOException {
    thesaurus.setDisplayName(thesaurus.getDisplayName());
    thesaurus.setOwner(fields.contains("owner") ? getOwner(thesaurus) : null);
    thesaurus.setFollowers(fields.contains("followers") ? getFollowers(thesaurus) : null);
    thesaurus.setTags(fields.contains("tags") ? getTags(thesaurus.getFullyQualifiedName()) : null);
    thesaurus.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            thesaurus.getId()) : null);
    return thesaurus;
  }

  @Override
  public void restorePatchAttributes(Thesaurus original, Thesaurus updated) throws IOException, ParseException {

  }

  @Override
  public EntityInterface<Thesaurus> getEntityInterface(Thesaurus entity) {
    return new ThesaurusEntityInterface(entity);
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }


  @Override
  public void validate(Thesaurus thesaurus) throws IOException {
    thesaurus.setFullyQualifiedName(getFQN(thesaurus));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), thesaurus.getOwner()); // Validate owner
    thesaurus.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), thesaurus.getTags()));
  }

  @Override
  public void store(Thesaurus thesaurus, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = thesaurus.getOwner();
    List<TagLabel> tags = thesaurus.getTags();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    thesaurus.withOwner(null).withHref(null).withTags(null);

    if (update) {
      dao.thesaurusDAO().update(thesaurus.getId(), JsonUtils.pojoToJson(thesaurus));
    } else {
      dao.thesaurusDAO().insert(thesaurus);
    }

    // Restore the relationships
    thesaurus.withOwner(owner).withTags(tags);
  }

  @Override
  public void storeRelationships(Thesaurus thesaurus) throws IOException {
    setOwner(thesaurus, thesaurus.getOwner());
    applyTags(thesaurus);
  }

  @Override
  public EntityUpdater getUpdater(Thesaurus original, Thesaurus updated, boolean patchOperation) throws IOException {
    return new ThesaurusUpdater(original, updated, patchOperation);
  }

  private EntityReference getOwner(Thesaurus thesaurus) throws IOException {
    return thesaurus == null ? null : EntityUtil.populateOwner(thesaurus.getId(), dao.relationshipDAO(),
            dao.userDAO(), dao.teamDAO());
  }

  public void setOwner(Thesaurus thesaurus, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), thesaurus.getId(), Entity.THESAURUS, owner);
    thesaurus.setOwner(owner);
  }

  private void applyTags(Thesaurus thesaurus) throws IOException {
    // Add thesaurus level tags by adding tag to thesaurus relationship
    EntityUtil.applyTags(dao.tagDAO(), thesaurus.getTags(), thesaurus.getFullyQualifiedName());
    thesaurus.setTags(getTags(thesaurus.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Thesaurus thesaurus) throws IOException {
    return thesaurus == null ? null : EntityUtil.getFollowers(thesaurus.getId(), dao.relationshipDAO(), dao.userDAO());
  }

  public static class ThesaurusEntityInterface implements EntityInterface<Thesaurus> {
    private final Thesaurus entity;

    public ThesaurusEntityInterface(Thesaurus entity) {
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
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public URI getHref() { return entity.getHref(); }

    @Override
    public List<EntityReference> getFollowers() { return entity.getFollowers(); }

    @Override
    public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.THESAURUS);
    }

    @Override
    public Thesaurus getEntity() { return entity; }

    @Override
    public void setId(UUID id) { entity.setId(id); }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) { entity.setOwner(owner); }

    @Override
    public Thesaurus withHref(URI href) { return entity.withHref(href); }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class ThesaurusUpdater extends EntityUpdater {
    public ThesaurusUpdater(Thesaurus original, Thesaurus updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

  }
}
