/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.migration.v208;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;

import java.lang.reflect.Field;
import java.util.function.Function;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v208.ConnectionSecretsEncryptionMigration;
import org.openmetadata.service.migration.utils.v208.DataProductDomainContainmentRepair;
import org.openmetadata.service.migration.utils.v208.MigrationUtil;
import org.openmetadata.service.migration.utils.v208.WorkflowRedeployMigration;

class WorkflowRedeployEntryPointTest {

  @ParameterizedTest(name = "{0}")
  @MethodSource("migrationEntryPoints")
  void runDataMigrationRewritesThenRedeploysTheWorkflows(
      String database, Function<MigrationFile, MigrationProcessImpl> createMigration)
      throws Exception {
    MigrationProcessImpl migration = createMigration.apply(mock(MigrationFile.class));
    setField(migration, "handle", mock(Handle.class));
    setField(migration, "collectionDAO", mock(CollectionDAO.class));
    setField(migration, "migrationDAO", mock(MigrationDAO.class));

    try (MockedStatic<ConnectionSecretsEncryptionMigration> secretsEncryption =
            mockStatic(ConnectionSecretsEncryptionMigration.class);
        MockedStatic<DataProductDomainContainmentRepair> containmentRepair =
            mockStatic(DataProductDomainContainmentRepair.class);
        MockedStatic<MigrationUtil> migrationUtil = mockStatic(MigrationUtil.class);
        MockedStatic<WorkflowRedeployMigration> workflowRedeploy =
            mockStatic(WorkflowRedeployMigration.class);
        MockedStatic<WorkflowHandler> workflowHandler = mockStatic(WorkflowHandler.class)) {
      migration.runDataMigration();

      migrationUtil.verify(MigrationUtil::rewriteWorkflowRules);
      // `migrate` runs before Flowable starts, so the steps that deploy workflows start it.
      workflowHandler.verify(() -> WorkflowHandler.initialize(any(), eq(true)), times(2));
      workflowRedeploy.verify(WorkflowRedeployMigration::redeploy);
    }
  }

  private static Stream<Arguments> migrationEntryPoints() {
    return Stream.of(
        Arguments.of(
            "MySQL",
            (Function<MigrationFile, MigrationProcessImpl>)
                org.openmetadata.service.migration.mysql.v208.Migration::new),
        Arguments.of(
            "PostgreSQL",
            (Function<MigrationFile, MigrationProcessImpl>)
                org.openmetadata.service.migration.postgres.v208.Migration::new));
  }

  private static void setField(MigrationProcessImpl migration, String fieldName, Object value)
      throws ReflectiveOperationException {
    Field field = MigrationProcessImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(migration, value);
  }
}
