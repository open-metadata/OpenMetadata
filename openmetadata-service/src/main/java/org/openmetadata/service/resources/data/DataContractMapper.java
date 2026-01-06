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

import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;
import org.openmetadata.service.util.EntityUtil;

@Mapper(entityType = Entity.DATA_CONTRACT)
public class DataContractMapper implements EntityMapper<DataContract, CreateDataContract> {

  @Override
  public DataContract createToEntity(CreateDataContract create, String user) {
    return copy(new DataContract(), create, user)
        .withEntity(create.getEntity())
        .withEntityStatus(create.getEntityStatus())
        .withSchema(create.getSchema())
        .withSemantics(create.getSemantics())
        .withQualityExpectations(create.getQualityExpectations())
        .withEffectiveFrom(create.getEffectiveFrom())
        .withEffectiveUntil(create.getEffectiveUntil())
        .withSourceUrl(create.getSourceUrl())
        .withTermsOfUse(create.getTermsOfUse())
        .withSecurity(create.getSecurity())
        .withSla(create.getSla());
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
