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

package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource;
import org.openmetadata.catalog.secrets.SecretsManager;

public class DatabaseServiceRepository extends ServiceRepository<DatabaseService, DatabaseConnection> {
  public DatabaseServiceRepository(CollectionDAO dao, SecretsManager secretsManager) {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.DATABASE_SERVICE,
        dao,
        dao.dbServiceDAO(),
        secretsManager,
        DatabaseConnection.class);
  }

  @Override
  protected String getServiceType(DatabaseService databaseService) {
    return databaseService.getServiceType().value();
  }
}
