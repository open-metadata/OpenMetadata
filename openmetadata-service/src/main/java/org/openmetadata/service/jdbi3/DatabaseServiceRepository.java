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
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;

@Slf4j
public class DatabaseServiceRepository extends ServiceEntityRepository<DatabaseService, DatabaseConnection> {

  public DatabaseServiceRepository() {
    super(
      DatabaseServiceResource.COLLECTION_PATH,
      Entity.DATABASE_SERVICE,
      Entity.getCollectionDAO().dbServiceDAO(),
      DatabaseConnection.class,
      "",
      ServiceType.DATABASE
    );
    supportsSearch = true;
  }
}
