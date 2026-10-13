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

package org.openmetadata.service.resources.data;

import java.util.UUID;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.util.EntityUtil;

public class DataContractMapper {
  public static DataContract createEntity(CreateDataContract create, String user) {
    EntityReference entity = create.getEntity();
    rejectContradictingIdentity(entity);

    // Build basic fields
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withEntity(entity)
        .withEntityStatus(create.getEntityStatus())
        .withSchema(create.getSchema())
        .withSemantics(create.getSemantics())
        .withQualityExpectations(create.getQualityExpectations())
        .withOwners(create.getOwners())
        .withReviewers(create.getReviewers())
        .withEffectiveFrom(create.getEffectiveFrom())
        .withEffectiveUntil(create.getEffectiveUntil())
        .withSourceUrl(create.getSourceUrl())
        .withTermsOfUse(
            create.getTermsOfUse() != null
                ? new org.openmetadata.schema.entity.data.TermsOfUse()
                    .withContent(create.getTermsOfUse())
                    .withInherited(false)
                : null)
        .withSecurity(create.getSecurity())
        .withSla(create.getSla())
        .withExtension(create.getExtension())
        .withOdcsQualityRules(create.getOdcsQualityRules())
        .withOdcsElementExtensions(create.getOdcsElementExtensions())
        .withUpdatedBy(user)
        .withUpdatedAt(System.currentTimeMillis());
  }

  // The stored reference is built from the entity's id and type, so a name or FQN in the request
  // must describe that same entity instead of being silently discarded.
  private static void rejectContradictingIdentity(EntityReference requested) {
    boolean namesEntity =
        requested != null
            && requested.getId() != null
            && (requested.getName() != null || requested.getFullyQualifiedName() != null);
    if (namesEntity) {
      EntityReference actual =
          Entity.getEntityReferenceById(requested.getType(), requested.getId(), Include.ALL);
      if (differs(requested.getName(), actual.getName())
          || differs(requested.getFullyQualifiedName(), actual.getFullyQualifiedName())) {
        throw BadRequestException.of(
            String.format(
                "Entity reference %s %s is '%s', which does not match the name or "
                    + "fullyQualifiedName in the request",
                actual.getType(), actual.getId(), actual.getFullyQualifiedName()));
      }
    }
  }

  private static boolean differs(String requested, String actual) {
    return requested != null && !requested.equals(actual);
  }

  public static DataContract trimFields(DataContract dataContract, Include include) {
    dataContract.setOwners(EntityUtil.getEntityReferences(dataContract.getOwners(), include));
    dataContract.setReviewers(EntityUtil.getEntityReferences(dataContract.getReviewers(), include));

    if (include.value().equals("entity") || include.value().equals("all")) {
      dataContract.setEntity(Entity.getEntityReference(dataContract.getEntity(), include));
    }

    return dataContract;
  }
}
