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
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.domains.DomainResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DomainRepository extends EntityRepository<Domain> {
  private static final String UPDATE_FIELDS = "parent,children,owner,experts";

  public DomainRepository(CollectionDAO dao) {
    super(
        DomainResource.COLLECTION_PATH,
        Entity.DOMAIN,
        Domain.class,
        dao.domainDAO(),
        dao,
        UPDATE_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public Domain setFields(Domain entity, Fields fields) throws IOException {
    entity.withParent(fields.contains("parent") ? getParent(entity) : null);
    entity.withChildren(fields.contains("children") ? getChildren(entity) : null);
    return entity.withExperts(fields.contains("experts") ? getExperts(entity) : null);
  }

  private EntityReference getParent(Domain entity) throws IOException {
    return getFromEntityRef(entity.getId(), Relationship.CONTAINS, DOMAIN, false);
  }

  private List<EntityReference> getChildren(Domain entity) throws IOException {
    List<EntityRelationshipRecord> ids = findTo(entity.getId(), DOMAIN, Relationship.CONTAINS, DOMAIN);
    return EntityUtil.populateEntityReferences(ids, GLOSSARY_TERM);
  }

  private List<EntityReference> getExperts(Domain entity) throws IOException {
    List<EntityRelationshipRecord> ids = findTo(entity.getId(), Entity.DOMAIN, Relationship.EXPERT, Entity.USER);
    return EntityUtil.populateEntityReferences(ids, Entity.USER);
  }

  @Override
  public void prepare(Domain entity) throws IOException {
    // Parent, Experts, Owner are already validated
  }

  @Override
  public void storeEntity(Domain entity, boolean update) throws IOException {
    EntityReference parent = entity.getParent();
    List<EntityReference> children = entity.getChildren();
    List<EntityReference> experts = entity.getExperts();
    entity.withParent(null).withChildren(null).withExperts(null);
    store(entity, update);
    entity.withParent(parent).withChildren(children).withExperts(experts);
  }

  @Override
  public void storeRelationships(Domain entity) {
    if (entity.getParent() != null) {
      addRelationship(entity.getParent().getId(), entity.getId(), Entity.DOMAIN, Entity.DOMAIN, Relationship.CONTAINS);
    }
    for (EntityReference expert : listOrEmpty(entity.getExperts())) {
      addRelationship(entity.getId(), expert.getId(), Entity.DOMAIN, Entity.USER, Relationship.EXPERT);
    }
  }

  @Override
  public EntityUpdater getUpdater(Domain original, Domain updated, Operation operation) {
    return new DomainUpdater(original, updated, operation);
  }

  @Override
  public void restorePatchAttributes(Domain original, Domain updated) {
    updated.withParent(original.getParent()); // Parent can't be changed
    updated.withChildren(original.getChildren()); // Children can't be changed
  }

  @Override
  public void setFullyQualifiedName(Domain entity) {
    // Validate parent
    if (entity.getParent() == null) { // Top level domain
      entity.setFullyQualifiedName(FullyQualifiedName.build(entity.getName()));
    } else { // Sub domain
      EntityReference parent = entity.getParent();
      entity.setFullyQualifiedName(FullyQualifiedName.add(parent.getFullyQualifiedName(), entity.getName()));
    }
  }

  @Override
  public String getFullyQualifiedNameHash(Domain entity) {
    return FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
  }

  public class DomainUpdater extends EntityUpdater {
    public DomainUpdater(Domain original, Domain updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateExperts();
    }

    private void updateExperts() throws JsonProcessingException {
      List<EntityReference> origExperts = listOrEmpty(original.getExperts());
      List<EntityReference> updatedExperts = listOrEmpty(updated.getExperts());
      updateToRelationships(
          "experts",
          Entity.DOMAIN,
          original.getId(),
          Relationship.EXPERT,
          Entity.USER,
          origExperts,
          updatedExperts,
          false);
    }
  }
}
