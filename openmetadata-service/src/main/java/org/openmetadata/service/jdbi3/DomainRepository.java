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
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.resources.EntityResource.searchClient;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.domains.DomainResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class DomainRepository extends EntityRepository<Domain> {
  private static final String UPDATE_FIELDS = "parent,children,experts";

  public DomainRepository(CollectionDAO dao) {
    super(DomainResource.COLLECTION_PATH, DOMAIN, Domain.class, dao.domainDAO(), dao, UPDATE_FIELDS, UPDATE_FIELDS);
    supportsSearchIndex = true;
  }

  @Override
  public Domain setFields(Domain entity, Fields fields) {
    return entity.withParent(fields.contains("parent") ? getParent(entity) : entity.getParent());
  }

  @Override
  public Domain clearFields(Domain entity, Fields fields) {
    entity.withParent(fields.contains("parent") ? entity.getParent() : null);
    return entity;
  }

  @Override
  public void prepare(Domain entity, boolean update) {
    // Parent, Experts, Owner are already validated
  }

  @Override
  public void storeEntity(Domain entity, boolean update) {
    EntityReference parent = entity.getParent();
    entity.withParent(null);
    store(entity, update);
    entity.withParent(parent);
  }

  @Override
  public void storeRelationships(Domain entity) {
    if (entity.getParent() != null) {
      addRelationship(entity.getParent().getId(), entity.getId(), DOMAIN, DOMAIN, Relationship.CONTAINS);
    }
    for (EntityReference expert : listOrEmpty(entity.getExperts())) {
      addRelationship(entity.getId(), expert.getId(), DOMAIN, Entity.USER, Relationship.EXPERT);
    }
  }

  @Override
  public Domain setInheritedFields(Domain domain, Fields fields) {
    // If subdomain does not have owner and experts, then inherit it from parent domain
    EntityReference parentRef = domain.getParent() != null ? domain.getParent() : getParent(domain);
    if (parentRef != null) {
      Domain parent = Entity.getEntity(DOMAIN, parentRef.getId(), "owner,experts", ALL);
      inheritOwner(domain, fields, parent);
      inheritExperts(domain, fields, parent);
    }
    return domain;
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
  public void deleteFromSearch(Domain entity, String changeType) {
    if (supportsSearchIndex) {
      String scriptTxt =
          "for (int i = 0; i < ctx._source.domain.length; i++) { if (ctx._source.domain[i].fullyQualifiedName == '%s') { ctx._source.domain.remove(i) }}";
      if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
        searchClient.softDeleteOrRestoreEntityFromSearch(
            JsonUtils.deepCopy(entity, Domain.class),
            changeType.equals(RestUtil.ENTITY_SOFT_DELETED),
            "domain.fullyQualifiedName");
      } else {
        searchClient.deleteEntityAndRemoveRelationships(
            JsonUtils.deepCopy(entity, Domain.class), scriptTxt, "domain.fullyQualifiedName");
      }
    }
  }

  public class DomainUpdater extends EntityUpdater {
    public DomainUpdater(Domain original, Domain updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      recordChange("domainType", original.getDomainType(), updated.getDomainType());
    }
  }
}
