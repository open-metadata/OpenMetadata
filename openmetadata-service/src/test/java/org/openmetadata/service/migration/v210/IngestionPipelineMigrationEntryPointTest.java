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

package org.openmetadata.service.migration.v210;

import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.lang.reflect.Field;
import java.util.function.Function;
import java.util.stream.Stream;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.migration.api.MigrationProcessImpl;
import org.openmetadata.service.migration.utils.MigrationFile;
import org.openmetadata.service.migration.utils.v210.ConversationMigration;
import org.openmetadata.service.migration.utils.v210.ConversationReferenceMigration;
import org.openmetadata.service.migration.utils.v210.IngestionPipelineMigrationUtil;
import org.openmetadata.service.migration.utils.v210.MigrationUtil;
import org.openmetadata.service.migration.utils.v210.OntologyMigration;

class IngestionPipelineMigrationEntryPointTest {

  @ParameterizedTest(name = "{0}")
  @MethodSource("migrationEntryPoints")
  void runDataMigrationBackfillsLegacySourceConfigTypes(
      String database, Function<MigrationFile, MigrationProcessImpl> createMigration)
      throws Exception {
    MigrationProcessImpl migration = createMigration.apply(mock(MigrationFile.class));
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    setField(migration, "handle", mock(Handle.class, RETURNS_DEEP_STUBS));
    setField(migration, "collectionDAO", collectionDAO);

    try (MockedStatic<ConversationMigration> conversationMigration =
            mockStatic(ConversationMigration.class);
        MockedStatic<ConversationReferenceMigration> conversationReferenceMigration =
            mockStatic(ConversationReferenceMigration.class);
        MockedStatic<MigrationUtil> migrationUtil = mockStatic(MigrationUtil.class);
        MockedStatic<OntologyMigration> ontologyMigration = mockStatic(OntologyMigration.class);
        MockedStatic<IngestionPipelineMigrationUtil> ingestionPipelineMigration =
            mockStatic(IngestionPipelineMigrationUtil.class)) {
      migration.runDataMigration();

      ingestionPipelineMigration.verify(
          () -> IngestionPipelineMigrationUtil.backfillSourceConfigTypes(collectionDAO));
    }
  }

  private static Stream<Arguments> migrationEntryPoints() {
    return Stream.of(
        Arguments.of(
            "MySQL",
            (Function<MigrationFile, MigrationProcessImpl>)
                org.openmetadata.service.migration.mysql.v210.Migration::new),
        Arguments.of(
            "PostgreSQL",
            (Function<MigrationFile, MigrationProcessImpl>)
                org.openmetadata.service.migration.postgres.v210.Migration::new));
  }

  private static void setField(MigrationProcessImpl migration, String fieldName, Object value)
      throws ReflectiveOperationException {
    Field field = MigrationProcessImpl.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(migration, value);
  }
}
