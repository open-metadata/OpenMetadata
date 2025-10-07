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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.SecurityConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.security.SecurityServiceResource;

@Slf4j
public class SecurityServiceRepository
    extends ServiceEntityRepository<SecurityService, SecurityConnection> {

  public SecurityServiceRepository() {
    super(
        SecurityServiceResource.COLLECTION_PATH,
        Entity.SECURITY_SERVICE,
        Entity.getCollectionDAO().securityServiceDAO(),
        SecurityConnection.class,
        "",
        ServiceType.SECURITY);
    supportsSearch = true;
  }
}
