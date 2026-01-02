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

package org.openmetadata.service.services.serviceentities;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DriveServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.services.drive.DriveServiceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.DRIVE_SERVICE)
public class DriveServiceEntityService
    extends AbstractServiceEntityService<DriveService, DriveServiceRepository, DriveConnection> {

  @Getter private final DriveServiceMapper mapper = new DriveServiceMapper();

  @Inject
  public DriveServiceEntityService(
      DriveServiceRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DRIVE_SERVICE, DriveService.class),
        repository,
        authorizer,
        limits,
        ServiceType.DRIVE);
  }

  @Override
  protected String extractServiceType(DriveService service) {
    return service.getServiceType().value();
  }
}
