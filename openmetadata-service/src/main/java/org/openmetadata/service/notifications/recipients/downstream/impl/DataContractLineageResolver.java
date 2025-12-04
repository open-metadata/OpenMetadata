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

package org.openmetadata.service.notifications.recipients.downstream.impl;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertsRuleEvaluator;
import org.openmetadata.service.notifications.recipients.downstream.EntityLineageResolver;

/**
 * Resolves DataContract to its referenced entity for lineage traversal.
 *
 * A DataContract defines schema, quality, and SLA guarantees for a data asset. It doesn't
 * participate in lineage itself, but references the actual data asset (Table, Topic, API
 * Endpoint, etc.) through its `entity` field.
 *
 * This resolver extracts the referenced entity so downstream notifications can properly
 * traverse lineage from the actual data asset being contracted.
 *
 * Examples:
 * - DataContract on Table1 → returns Table1 (for lineage traversal)
 * - DataContract on Topic1 → returns Topic1
 * - DataContract on APIEndpoint1 → returns APIEndpoint1
 *
 * The referenced entity may itself have parents (e.g., Table in a Schema in a Database),
 * which will be recursively resolved by LineageBasedDownstreamHandler.
 */
@Slf4j
public class DataContractLineageResolver implements EntityLineageResolver {

  @Override
  public Set<EntityReference> resolveTraversalEntities(ChangeEvent changeEvent) {
    DataContract dataContract = null;

    try {
      if (changeEvent.getEntity() != null) {
        dataContract = (DataContract) AlertsRuleEvaluator.getEntity(changeEvent);
      }
    } catch (Exception e) {
      LOG.warn("Failed to deserialize DataContract from ChangeEvent payload", e);
    }

    return extractEntityFromDataContract(dataContract, changeEvent.getEntityId());
  }

  @Override
  public Set<EntityReference> resolveTraversalEntities(UUID entityId, String entityType) {
    DataContract dataContract = null;

    try {
      EntityInterface contractEntity =
          Entity.getEntity(Entity.DATA_CONTRACT, entityId, "", Include.NON_DELETED);

      if (contractEntity instanceof DataContract dc) {
        dataContract = dc;
      }
    } catch (Exception e) {
      LOG.warn("Failed to resolve entity reference for DataContract {}", entityId, e);
    }

    return extractEntityFromDataContract(dataContract, entityId);
  }

  private Set<EntityReference> extractEntityFromDataContract(
      DataContract dataContract, UUID entityId) {
    Set<EntityReference> parents = new HashSet<>();

    if (dataContract == null) {
      return parents;
    }

    EntityReference referencedEntity = dataContract.getEntity();

    if (referencedEntity != null) {
      LOG.debug(
          "Resolved DataContract {} to entity {} {}",
          entityId,
          referencedEntity.getType(),
          referencedEntity.getId());

      parents.add(referencedEntity);
    } else {
      LOG.warn("DataContract {} has no referenced entity", entityId);
    }

    return parents;
  }

  @Override
  public String getEntityType() {
    return Entity.DATA_CONTRACT;
  }
}
