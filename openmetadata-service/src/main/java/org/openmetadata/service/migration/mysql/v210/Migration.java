/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.migration.mysql.v210;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.addCreateConversationRuleToDataConsumerPolicy;
import static org.openmetadata.service.migration.utils.v210.MigrationUtil.refreshConversationNotificationTemplates;

import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.migration.utils.v210.ConversationReferenceMigration;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;

public class Migration extends MigrationProcessImpl {
  public Migration(final MigrationFile migrationFile) {
    super(migrationFile);
  }

  @Override
  public void runDataMigration() {
    ConversationMigration.migrate(handle, MYSQL);
    ConversationReferenceMigration.migrate(handle, MYSQL);
    refreshConversationNotificationTemplates();
    addCreateConversationRuleToDataConsumerPolicy(collectionDAO);
    new MigrationUtil(handle, MYSQL).archiveLegacyThreadStorage();
  }
}
