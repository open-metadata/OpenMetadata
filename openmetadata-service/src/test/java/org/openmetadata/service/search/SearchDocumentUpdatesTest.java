package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;

class SearchDocumentUpdatesTest {
  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testcase", Entity.TEST_CASE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("testsuite", Entity.TEST_SUITE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("pipeline", Entity.PIPELINE);
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("query", Entity.QUERY);
  }

  @Test
  void buildBulkScriptedPartialUpdateFencesCompleteTestSuiteRelationshipSnapshots() {
    TestCase testCase =
        new TestCase().withId(UUID.randomUUID()).withName("testCase").withVersion(1.0);
    TestSuite addedTestSuite =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("addedLogicalSuite")
            .withFullyQualifiedName("addedLogicalSuite");
    testCase.setTestSuites(List.of(addedTestSuite));
    testCase.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(testCase.getVersion())
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_TEST_SUITES)
                        .withNewValue(List.of(addedTestSuite)))));

    SearchDocumentUpdate partialUpdate =
        SearchDocumentUpdates.buildBulkScriptedPartialUpdate(testCase, 42L);

    assertNotNull(partialUpdate);
    assertTrue(
        partialUpdate
            .script()
            .contains("params.testSuitesRevision >= ctx._source.testSuitesRevision"));
    assertTrue(partialUpdate.script().contains("ctx._source.testSuites = params.testSuites"));
    assertEquals(42L, partialUpdate.parameters().get("testSuitesRevision"));
    List<?> replacement = (List<?>) partialUpdate.parameters().get(Entity.FIELD_TEST_SUITES);
    assertEquals(
        addedTestSuite.getId().toString(),
        ((Map<?, ?>) replacement.getFirst()).get("id").toString());
    assertNull(SearchDocumentUpdates.buildBulkScriptedPartialUpdate(testCase, null));

    testCase.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(testCase.getVersion())
            .withFieldsAdded(
                List.of(
                    new FieldChange()
                        .withName(Entity.FIELD_TEST_SUITES)
                        .withNewValue(testCase.getTestSuites()))));
    assertNull(SearchDocumentUpdates.buildBulkScriptedPartialUpdate(testCase, 43L));

    testCase.setChangeDescription(null);
    assertNotNull(SearchDocumentUpdates.buildBulkScriptedPartialUpdate(testCase, 44L));
  }

  @Test
  void aRelationshipReplacementIsOrderedByItsRevisionAlone() {
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("testCase")
            .withVersion(1.0)
            .withUpdatedAt(30L);
    SearchDocumentUpdate replacement = SearchDocumentUpdates.relationshipFieldsAt(testCase, 6L);

    SearchDocumentUpdate guarded = SearchVersionGuard.apply(replacement, testCase, 40L);

    assertEquals(replacement, guarded);
    assertFalse(guarded.parameters().containsKey(SearchVersionGuard.SOURCE_READ_AT));
  }

  @Test
  void theRestOfAFencedEntitysDocumentIsStillOrderedByReadTime() {
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName("testCase")
            .withVersion(1.0)
            .withUpdatedAt(30L);
    SearchDocumentUpdate preserving =
        SearchDocumentUpdates.buildRelationshipDocumentUpdate(testCase, Map.of("name", "testCase"));

    SearchDocumentUpdate guarded = SearchVersionGuard.apply(preserving, testCase, 40L);

    assertEquals(40L, guarded.parameters().get(SearchVersionGuard.SOURCE_READ_AT));
    assertTrue(guarded.script().contains("omStale"));
  }

  @Test
  void buildRelationshipDocumentUpdatePreservesTestCaseRevisionOwnedFields() {
    TestCase testCase =
        new TestCase().withId(UUID.randomUUID()).withName("testCase").withVersion(1.0);
    Map<String, Object> document =
        Map.of(
            "name",
            "testCase",
            Entity.FIELD_TEST_SUITES,
            List.of(Map.of("id", UUID.randomUUID().toString())),
            TestCaseRepository.TEST_SUITES_REVISION_FIELD,
            12L);

    SearchDocumentUpdate update =
        SearchDocumentUpdates.buildRelationshipDocumentUpdate(testCase, document);

    assertNotNull(update);
    assertEquals(document, update.parameters());
    assertTrue(update.scriptedUpsert());
    assertTrue(update.script().contains("preserveRelationship"));
    assertTrue(update.script().contains("k != 'testSuites'"));
    assertTrue(update.script().contains("k != 'testSuitesRevision'"));
    assertNull(SearchDocumentUpdates.buildRelationshipDocumentUpdate(table(), document));
  }

  @Test
  void relationshipDocumentUpdateConvertsNullFieldsIntoExplicitRemovals() {
    TestCase testCase =
        new TestCase().withId(UUID.randomUUID()).withName("testCase").withVersion(1.0);
    Map<String, Object> document = new HashMap<>();
    document.put("name", "testCase");
    document.put("description", null);
    document.put("fieldsToRemove", List.of("displayName"));

    SearchDocumentUpdate update =
        SearchDocumentUpdates.buildRelationshipDocumentUpdate(testCase, document);

    assertNotNull(update);
    Map<String, Object> parameters = update.parametersForIndexing();
    assertEquals("testCase", parameters.get("name"));
    assertFalse(parameters.containsKey("description"));
    assertEquals(List.of("description", "displayName"), parameters.get("fieldsToRemove"));
  }

  @Test
  void buildLogicalTestSuiteUpdatesFenceAndPreserveTests() {
    EntityReference testCaseReference =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TEST_CASE).withName("test");
    TestSuite logicalSuite =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("logicalSuite")
            .withFullyQualifiedName("logicalSuite")
            .withBasic(false)
            .withVersion(1.0)
            .withTests(List.of(testCaseReference));
    logicalSuite.setChangeDescription(
        new ChangeDescription()
            .withPreviousVersion(logicalSuite.getVersion())
            .withFieldsUpdated(
                List.of(
                    new FieldChange().withName("tests").withNewValue(logicalSuite.getTests()))));

    SearchDocumentUpdate fenced =
        SearchDocumentUpdates.buildBulkScriptedPartialUpdate(logicalSuite, 19L);

    assertNotNull(fenced);
    assertTrue(fenced.script().contains("params.testsRevision >= ctx._source.testsRevision"));
    assertTrue(fenced.script().contains("ctx._source.tests = params.tests"));
    assertEquals(19L, fenced.parameters().get(TestSuiteRepository.TESTS_REVISION_FIELD));

    Map<String, Object> logicalSuiteDocument =
        Map.of(
            "name",
            "logicalSuite",
            "tests",
            List.of(Map.of("id", testCaseReference.getId().toString())),
            TestSuiteRepository.TESTS_REVISION_FIELD,
            19L);
    SearchDocumentUpdate preserving =
        SearchDocumentUpdates.buildRelationshipDocumentUpdate(logicalSuite, logicalSuiteDocument);
    assertNotNull(preserving);
    assertTrue(preserving.script().contains("k != 'tests'"));
    assertTrue(preserving.script().contains("k != 'testsRevision'"));

    logicalSuite.setBasic(true);
    assertNull(
        SearchDocumentUpdates.buildRelationshipDocumentUpdate(logicalSuite, logicalSuiteDocument));
    assertNull(SearchDocumentUpdates.buildBulkScriptedPartialUpdate(logicalSuite, 20L));
  }

  @Test
  void bulkPolicyAvoidsParsingDocumentsThatDoNotNeedAScript() {
    assertNull(
        SearchDocumentUpdates.forBulkWrite(
            table(),
            false,
            null,
            () -> {
              throw new AssertionError("Ordinary bulk replacements do not need another JSON parse");
            }));
    final TestCase test = new TestCase().withId(UUID.randomUUID()).withName("test");
    assertNotNull(
        SearchDocumentUpdates.forBulkWrite(
            test,
            true,
            11L,
            () -> {
              throw new AssertionError(
                  "Relationship replacements do not need the full document parameters");
            }));
    final var full =
        SearchDocumentUpdates.forBulkWrite(test, false, null, () -> Map.of("name", "test"));
    assertTrue(full.scriptedUpsert());
    assertEquals("test", full.parameters().get("name"));
    assertThrows(
        IllegalStateException.class,
        () -> SearchDocumentUpdates.forBulkWrite(table(), true, 11L, Map::of));
  }

  private static Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("asset")
        .withFullyQualifiedName("service.db.schema.asset")
        .withColumns(List.of())
        .withVersion(1.0)
        .withUpdatedAt(100L);
  }
}
