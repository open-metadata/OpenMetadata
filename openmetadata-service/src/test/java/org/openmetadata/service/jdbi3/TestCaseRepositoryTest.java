package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class TestCaseRepositoryTest {

  @Test
  void postUpdateHydratesTestSuitesBeforeLifecycleUpdate() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.testCaseDAO()).thenReturn(mock(CollectionDAO.TestCaseDAO.class));

    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<EntityLifecycleEventDispatcher> lifecycleDispatcher =
            Mockito.mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<RdfUpdater> ignoredRdfUpdater = Mockito.mockStatic(RdfUpdater.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entity.when(() -> Entity.getEntityFields(TestCase.class)).thenCallRealMethod();
      lifecycleDispatcher.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);

      EntityReference basicSuiteRef = entityReference(Entity.TEST_SUITE, "basicSuite");
      TestSuite logicalSuite =
          new TestSuite()
              .withId(UUID.randomUUID())
              .withName("logicalSuite")
              .withFullyQualifiedName("logicalSuite")
              .withBasic(false);
      HydratingTestCaseRepository repository =
          new HydratingTestCaseRepository(basicSuiteRef, List.of(logicalSuite));

      UUID testCaseId = UUID.randomUUID();
      TestCase original =
          testCase(testCaseId, "original", basicSuiteRef).withTestSuites(List.of(logicalSuite));
      TestCase updated = testCase(testCaseId, "updated", basicSuiteRef).withTestSuites(null);

      repository.postUpdate(original, updated);

      assertNotNull(repository.capturedFields);
      assertTrue(repository.capturedFields.contains(TestCaseRepository.TEST_SUITE_FIELD));
      assertTrue(repository.capturedFields.contains(Entity.FIELD_TEST_SUITES));
      assertTrue(
          updated.getTestSuites().stream()
              .anyMatch(suite -> suite.getId().equals(logicalSuite.getId())));
    }
  }

  private static TestCase testCase(UUID id, String description, EntityReference basicSuiteRef) {
    return new TestCase()
        .withId(id)
        .withName("row_count")
        .withFullyQualifiedName("service.database.schema.table.row_count")
        .withDescription(description)
        .withEntityLink("<#E::table::service.database.schema.table>")
        .withTestSuite(basicSuiteRef);
  }

  private static EntityReference entityReference(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private static class HydratingTestCaseRepository extends TestCaseRepository {
    private final EntityReference basicSuiteRef;
    private final List<TestSuite> testSuites;
    private Fields capturedFields;

    private HydratingTestCaseRepository(EntityReference basicSuiteRef, List<TestSuite> testSuites) {
      this.basicSuiteRef = basicSuiteRef;
      this.testSuites = testSuites;
    }

    @Override
    public void setFields(TestCase test, Fields fields, RelationIncludes relationIncludes) {
      capturedFields = fields;
      if (fields.contains(TEST_SUITE_FIELD)) {
        test.setTestSuite(basicSuiteRef);
      }
      if (fields.contains(Entity.FIELD_TEST_SUITES)) {
        test.setTestSuites(testSuites);
      }
    }
  }
}
