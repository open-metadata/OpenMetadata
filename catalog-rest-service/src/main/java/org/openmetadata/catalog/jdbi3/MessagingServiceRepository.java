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
import org.openmetadata.catalog.entity.services.MessagingService;
import org.openmetadata.catalog.resources.services.messaging.MessagingServiceResource;
import org.openmetadata.catalog.secrets.SecretsManager;
import org.openmetadata.catalog.type.MessagingConnection;

public class MessagingServiceRepository extends ServiceRepository<MessagingService, MessagingConnection> {
  private static final String UPDATE_FIELDS = "owner, connection";

  public MessagingServiceRepository(CollectionDAO dao, SecretsManager secretsManager) {
    super(
        MessagingServiceResource.COLLECTION_PATH,
        Entity.MESSAGING_SERVICE,
        dao,
        dao.messagingServiceDAO(),
        secretsManager,
        MessagingConnection.class,
        UPDATE_FIELDS);
  }

  @Override
  protected String getServiceType(MessagingService messagingService) {
    return messagingService.getServiceType().value();
  }
}
