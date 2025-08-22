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
import org.openmetadata.service.util.EntityUtil;

public class DataContractMapper {
  public static DataContract createEntity(CreateDataContract create, String user) {
    // Create a reference for the entity specified in the contract
    EntityReference entity = create.getEntity();

    // Build basic fields
    DataContract dataContract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName(create.getName())
            .withDisplayName(create.getDisplayName())
            .withDescription(create.getDescription())
            .withEntity(entity)
            .withStatus(create.getStatus())
            .withSchema(create.getSchema())
            .withSemantics(create.getSemantics())
            .withQualityExpectations(create.getQualityExpectations())
            .withOwners(create.getOwners())
            .withReviewers(create.getReviewers())
            .withEffectiveFrom(create.getEffectiveFrom())
            .withEffectiveUntil(create.getEffectiveUntil())
            .withSourceUrl(create.getSourceUrl())
            .withExtension(create.getExtension())
            .withUpdatedBy(user)
            .withUpdatedAt(System.currentTimeMillis());

    return dataContract;
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
