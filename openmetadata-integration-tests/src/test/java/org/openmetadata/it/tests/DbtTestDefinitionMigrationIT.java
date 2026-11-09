package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.v210.DbtTestDefinitionMigration;

/** Recreates pre-sharing database records and runs the real bootstrap repair in both dialects. */
@Isolated
class DbtTestDefinitionMigrationIT {
  private static final String DESCRIPTION = "dbt uniqueness check";
  private static final String HISTORY =
      "{\"timestamp\":1700000000000,\"testCaseStatus\":\"Failed\",\"result\":\"duplicate\"}";

  @Test
  void consolidatesDefinitionsWithoutChangingCasesOrHistory() {
    inFixture(
        handle -> {
          final String generic = genericName();
          final TestDefinition first =
              definition(handle, generic, "_orders", TestDefinitionEntityType.COLUMN);
          final TestDefinition second =
              definition(handle, generic, "_customers", TestDefinitionEntityType.COLUMN);
          final TestDefinition table =
              definition(handle, generic, "_table_orders", TestDefinitionEntityType.TABLE);
          final TestCase firstCase = testCase(handle, first, "orders", false);
          final TestCase secondCase = testCase(handle, second, "customers", false);
          final TestCase tableCase = testCase(handle, table, "orders", false);
          final CollectionDAO dao = handle.attach(CollectionDAO.class);
          dao.indexMappingVersionDAO()
              .upsertIndexMappingVersion("testCase", "before", "{}", "2.1.0", 1L, "admin");
          dao.testCaseDAO().update(firstCase.withTestDefinition(first.getEntityReference()));
          firstCase.setTestDefinition(null);
          dao.entityExtensionDAO()
              .insert(
                  firstCase.getId(),
                  "testCase.version.0.1",
                  "testCase",
                  JsonUtils.pojoToJson(firstCase));
          dao.entityExtensionDAO()
              .insert(
                  first.getId(),
                  "testDefinition.version.0.1",
                  "testDefinition",
                  JsonUtils.pojoToJson(first));
          dao.testCaseResultTimeSeriesDao()
              .insert(
                  firstCase.getFullyQualifiedName(),
                  "testCase.testCaseResult",
                  "testCaseResult",
                  HISTORY);
          final String beforeHistory = resultJson(handle, firstCase);
          migrate(handle);
          final TestDefinition shared = readDefinition(handle, generic);
          final TestDefinition sharedTable = readDefinition(handle, generic + "_table");
          assertNotNull(shared);
          assertNotNull(sharedTable);
          assertCase(handle, firstCase, shared);
          assertCase(handle, secondCase, shared);
          assertCase(handle, tableCase, sharedTable);
          assertNull(readDefinition(handle, first.getName()));
          assertNull(readDefinition(handle, second.getName()));
          assertNull(readDefinition(handle, table.getName()));
          assertEquals(beforeHistory, resultJson(handle, firstCase));
          assertEquals(1, extensionCount(handle, firstCase.getId()));
          assertEquals(0, extensionCount(handle, first.getId()));
          assertNull(dao.indexMappingVersionDAO().getMappingHash("testCase"));
          dao.indexMappingVersionDAO()
              .upsertIndexMappingVersion("testCase", "after", "{}", "2.1.0", 1L, "admin");
          migrate(handle);
          assertEquals("after", dao.indexMappingVersionDAO().getMappingHash("testCase"));
          assertEquals(shared, readDefinition(handle, generic));
          assertCase(handle, firstCase, shared);
          assertEquals(beforeHistory, resultJson(handle, firstCase));
        });
  }

  @Test
  void reusesSharedDefinitionAcrossMoreThanOneCaseBatch() {
    inFixture(
        handle -> {
          final String generic = genericName();
          final TestDefinition shared =
              definition(handle, generic, "", TestDefinitionEntityType.COLUMN);
          final TestDefinition legacy =
              definition(handle, generic, "_legacy", TestDefinitionEntityType.COLUMN);
          for (int i = 0; i < 501; i++) {
            testCase(handle, legacy, "table" + i, false);
          }
          migrate(handle);
          assertEquals(shared, readDefinition(handle, generic));
          assertEquals(
              501,
              handle
                  .createQuery(
                      "SELECT COUNT(*) FROM entity_relationship WHERE fromId = :id AND toEntity = 'testCase'")
                  .bind("id", shared.getId().toString())
                  .mapTo(Integer.class)
                  .one());
          assertNull(readDefinition(handle, legacy.getName()));
        });
  }

  @Test
  void retainsDefinitionWhileSoftDeletedCaseReferencesIt() {
    inFixture(
        handle -> {
          final String generic = genericName();
          final TestDefinition legacy =
              definition(handle, generic, "_legacy", TestDefinitionEntityType.COLUMN);
          final TestCase active = testCase(handle, legacy, "active", false);
          final TestCase deleted = testCase(handle, legacy, "deleted", true);
          migrate(handle);
          assertCase(handle, active, readDefinition(handle, generic));
          assertCase(handle, deleted, legacy);
          assertEquals(legacy, readDefinition(handle, legacy.getName()));
          migrate(handle);
          assertCase(handle, deleted, legacy);
        });
  }

  @Test
  void preservesCustomizedAmbiguousOrOrphanedDefinitions() {
    inFixture(
        handle -> {
          final TestDefinition customized =
              definition(handle, genericName(), "_legacy", TestDefinitionEntityType.COLUMN);
          final TestCase customCase = testCase(handle, customized, "custom", false);
          customized.setDescription("User customization");
          handle.attach(CollectionDAO.class).testDefinitionDAO().update(customized);
          final TestDefinition orphan =
              definition(handle, genericName(), "_orphan", TestDefinitionEntityType.COLUMN);
          final TestDefinition conflicting =
              definition(handle, genericName(), "_conflicting", TestDefinitionEntityType.COLUMN);
          final TestDefinition ambiguous =
              definition(handle, genericName(), "_legacy", TestDefinitionEntityType.COLUMN);
          final TestCase ambiguousCase = testCase(handle, ambiguous, "ambiguous", false);
          handle
              .attach(CollectionDAO.class)
              .relationshipDAO()
              .insert(conflicting.getId(), ambiguousCase.getId(), "testDefinition", "testCase", 0);
          final TestDefinition owned =
              definition(handle, genericName(), "_owned", TestDefinitionEntityType.COLUMN);
          final TestCase ownedCase = testCase(handle, owned, "owned", false);
          handle
              .attach(CollectionDAO.class)
              .relationshipDAO()
              .insert(UUID.randomUUID(), owned.getId(), "user", "testDefinition", 8);
          migrate(handle);
          assertEquals(customized, readDefinition(handle, customized.getName()));
          assertCase(handle, customCase, customized);
          assertEquals(orphan, readDefinition(handle, orphan.getName()));
          assertEquals(ambiguous, readDefinition(handle, ambiguous.getName()));
          assertEquals(owned, readDefinition(handle, owned.getName()));
          assertCase(handle, ownedCase, owned);
        });
  }

  @Test
  void preservesCasesWhenSharedDefinitionIsIncompatible() {
    inFixture(
        handle -> {
          final String generic = genericName();
          final TestDefinition shared =
              definition(handle, generic, "", TestDefinitionEntityType.TABLE);
          final TestDefinition legacy =
              definition(handle, generic, "_legacy", TestDefinitionEntityType.COLUMN);
          final TestCase testCase = testCase(handle, legacy, "orders", false);
          migrate(handle);
          assertEquals(shared, readDefinition(handle, generic));
          assertEquals(legacy, readDefinition(handle, legacy.getName()));
          assertCase(handle, testCase, legacy);
        });
  }

  @Test
  void bootstrapRecordsCompletionAndFailedStepsRemainRetryable() {
    final AtomicInteger runs = new AtomicInteger();
    final MigrationDAO dao = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    DataMigrationStep.runOnce(
        dao, "2.1.0", DbtTestDefinitionMigration.STEP_NAME, runs::incrementAndGet);
    assertEquals(0, runs.get(), "bootstrap must have recorded the actual migration step");
    inFixture(
        handle -> {
          final String step = genericName();
          final MigrationDAO fixtureDao = handle.attach(MigrationDAO.class);
          assertThrows(
              IllegalStateException.class,
              () ->
                  DataMigrationStep.runOnce(
                      fixtureDao,
                      "2.1.0",
                      step,
                      () -> {
                        throw new IllegalStateException("interrupted migration");
                      }));
          DataMigrationStep.runOnce(fixtureDao, "2.1.0", step, runs::incrementAndGet);
          DataMigrationStep.runOnce(fixtureDao, "2.1.0", step, runs::incrementAndGet);
          assertEquals(1, runs.get());
        });
  }

  private static void inFixture(final Consumer<Handle> test) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              handle.begin();
              try {
                test.accept(handle);
              } finally {
                handle.rollback();
              }
            });
  }

  private static String genericName() {
    return "dbt_" + UUID.randomUUID().toString().replace("-", "");
  }

  private static TestDefinition definition(
      final Handle handle,
      final String generic,
      final String suffix,
      final TestDefinitionEntityType scope) {
    final String name = generic + suffix;
    final TestDefinition definition =
        new TestDefinition()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withDescription(DESCRIPTION)
            .withEntityType(scope)
            .withProvider(ProviderType.USER)
            .withTestPlatforms(List.of(TestPlatform.DBT))
            .withParameterDefinition(
                List.of(
                    new TestCaseParameter()
                        .withName(generic)
                        .withDisplayName(generic)
                        .withRequired(false)))
            .withEnabled(true)
            .withDeleted(false)
            .withVersion(0.1)
            .withUpdatedBy("admin")
            .withUpdatedAt(1700000000000L);
    handle.attach(CollectionDAO.class).testDefinitionDAO().insert(definition, name);
    return definition;
  }

  private static TestCase testCase(
      final Handle handle,
      final TestDefinition definition,
      final String table,
      final boolean deleted) {
    final String entityFqn = "service.db.schema." + table;
    final String column =
        definition.getEntityType() == TestDefinitionEntityType.COLUMN ? "::columns::id" : "";
    final TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName(definition.getName())
            .withFullyQualifiedName(entityFqn + "." + definition.getName())
            .withDescription(DESCRIPTION)
            .withEntityFQN(entityFqn)
            .withEntityLink("<#E::table::" + entityFqn + column + ">")
            .withParameterValues(
                List.of(
                    new TestCaseParameterValue()
                        .withName(definition.getParameterDefinition().getFirst().getName())
                        .withValue("")))
            .withDeleted(deleted)
            .withVersion(0.1)
            .withUpdatedBy("admin")
            .withUpdatedAt(1700000000000L);
    final CollectionDAO dao = handle.attach(CollectionDAO.class);
    dao.testCaseDAO().insert(testCase, testCase.getFullyQualifiedName());
    dao.relationshipDAO()
        .insert(definition.getId(), testCase.getId(), "testDefinition", "testCase", 0);
    return testCase;
  }

  private static void assertCase(
      final Handle handle, final TestCase expected, final TestDefinition definition) {
    final TestCase actual =
        JsonUtils.readValue(
            handle
                .createQuery("SELECT json FROM test_case WHERE id = :id")
                .bind("id", expected.getId().toString())
                .mapTo(String.class)
                .one(),
            TestCase.class);
    assertEquals(expected, actual, "case identity, metadata and parameters must be unchanged");
    assertFalse(JsonUtils.readTree(JsonUtils.pojoToJson(actual)).hasNonNull("testDefinition"));
    assertEquals(
        definition.getId().toString(),
        handle
            .createQuery(
                "SELECT fromId FROM entity_relationship WHERE toId = :id AND fromEntity = 'testDefinition' AND relation = 0")
            .bind("id", expected.getId().toString())
            .mapTo(String.class)
            .one());
  }

  private static TestDefinition readDefinition(final Handle handle, final String name) {
    return handle
        .createQuery("SELECT json FROM test_definition WHERE name = :name")
        .bind("name", name)
        .mapTo(String.class)
        .findOne()
        .map(json -> JsonUtils.readValue(json, TestDefinition.class))
        .orElse(null);
  }

  private static String resultJson(final Handle handle, final TestCase testCase) {
    return handle
        .createQuery(
            "SELECT r.json FROM data_quality_data_time_series r JOIN test_case tc ON tc.fqnHash = r.entityFQNHash WHERE tc.id = :id")
        .bind("id", testCase.getId().toString())
        .mapTo(String.class)
        .one();
  }

  private static int extensionCount(final Handle handle, final UUID id) {
    return handle
        .createQuery("SELECT COUNT(*) FROM entity_extension WHERE id = :id")
        .bind("id", id.toString())
        .mapTo(Integer.class)
        .one();
  }

  private static void migrate(final Handle handle) {
    DbtTestDefinitionMigration.migrate(handle, TestSuiteBootstrap.getConnectionType());
  }
}
