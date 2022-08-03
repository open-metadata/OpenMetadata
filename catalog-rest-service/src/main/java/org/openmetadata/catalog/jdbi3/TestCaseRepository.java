package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.TEST_CASE;
import static org.openmetadata.catalog.Entity.TEST_DEFINITION;
import static org.openmetadata.catalog.Entity.TEST_SUITE;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.resources.dqtests.TestSuiteResource;
import org.openmetadata.catalog.test.TestCaseParameter;
import org.openmetadata.catalog.test.TestCaseParameterValue;
import org.openmetadata.catalog.tests.TestCase;
import org.openmetadata.catalog.tests.TestDefinition;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class TestCaseRepository extends EntityRepository<TestCase> {
  private static final String UPDATE_FIELDS = "owner,entity,testSuite,testDefinition";
  private static final String PATCH_FIELDS = "owner,entity,testSuite,testDefinition";

  public TestCaseRepository(CollectionDAO dao) {
    super(
        TestSuiteResource.COLLECTION_PATH,
        TEST_CASE,
        TestCase.class,
        dao.testCaseDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public TestCase setFields(TestCase test, EntityUtil.Fields fields) throws IOException {
    test.setEntity(fields.contains("entity") ? getEntity(test) : null);
    test.setTestSuite(fields.contains("testSuite") ? getTestSuite(test) : null);
    test.setTestDefinition(fields.contains("testDefinition") ? getTestDefinition(test) : null);
    test.setOwner(fields.contains("owner") ? getOwner(test) : null);
    return test;
  }

  @Override
  public void prepare(TestCase test) throws IOException {
    EntityReference tableRef =
        Entity.getEntityReferenceById(Entity.TABLE, test.getEntity().getId(), Include.NON_DELETED);
    // validate test definition and test suite
    Entity.getEntityReferenceById(Entity.TEST_DEFINITION, test.getTestDefinition().getId(), Include.NON_DELETED);
    Entity.getEntityReferenceById(Entity.TEST_SUITE, test.getTestSuite().getId(), Include.NON_DELETED);
    TestDefinition testDefinition =
        Entity.getEntity(test.getTestDefinition(), EntityUtil.Fields.EMPTY_FIELDS, Include.NON_DELETED);
    validateTestParameters(test.getParameterValues(), testDefinition.getParameterDefinition());
    test.setFullyQualifiedName(FullyQualifiedName.add(tableRef.getFullyQualifiedName(), test.getName()));
    test.setOwner(Entity.getEntityReference(test.getOwner()));
  }

  private EntityReference getEntity(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.CONTAINS, null, true);
  }

  private EntityReference getTestSuite(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.HAS, null, true);
  }

  private EntityReference getTestDefinition(TestCase test) throws IOException {
    return getFromEntityRef(test.getId(), Relationship.APPLIED_TO, TEST_DEFINITION, true);
  }

  private void validateTestParameters(
      List<TestCaseParameterValue> parameterValues, List<TestCaseParameter> parameterDefinition) {
    if (parameterDefinition.isEmpty() && !parameterValues.isEmpty()) {
      throw new IllegalArgumentException("Parameter Values doesn't match Test Definition Parameters");
    }
    Map<String, Object> values = new HashMap<>();
    for (TestCaseParameterValue testCaseParameterValue : parameterValues) {
      values.put(testCaseParameterValue.getName(), testCaseParameterValue.getValue());
    }
    for (TestCaseParameter parameter : parameterDefinition) {
      if (parameter.getRequired()
          && (!values.containsKey(parameter.getName()) || values.get(parameter.getName()) == null)) {
        throw new IllegalArgumentException(
            "Required parameter " + parameter.getName() + " is not passed in parameterValues");
      }
    }
  }

  @Override
  public void storeEntity(TestCase test, boolean update) throws IOException {
    EntityReference owner = test.getOwner();
    EntityReference entity = test.getEntity();
    EntityReference testSuite = test.getTestSuite();
    EntityReference testDefinition = test.getTestDefinition();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    test.withOwner(null).withHref(null).withEntity(null).withTestSuite(null).withTestDefinition(null);
    store(test.getId(), test, update);

    // Restore the relationships
    test.withOwner(owner).withEntity(entity).withTestSuite(testSuite).withTestDefinition(testDefinition);
  }

  @Override
  public void storeRelationships(TestCase test) {
    // Add relationship from testSuite to test
    addRelationship(test.getTestSuite().getId(), test.getId(), TEST_SUITE, TEST_CASE, Relationship.HAS);
    // Add relationship from entity to test
    addRelationship(
        test.getEntity().getId(), test.getId(), test.getEntity().getType(), TEST_CASE, Relationship.CONTAINS);
    // Add relationship from test definition to test
    addRelationship(
        test.getTestDefinition().getId(), test.getId(), TEST_DEFINITION, TEST_CASE, Relationship.APPLIED_TO);
    // Add test owner relationship
    storeOwner(test, test.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(TestCase original, TestCase updated, Operation operation) {
    return new TestUpdater(original, updated, operation);
  }

  public class TestUpdater extends EntityUpdater {
    public TestUpdater(TestCase original, TestCase updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateFromRelationships(
          "entity",
          updated.getEntity().getType(),
          new ArrayList<>(List.of(original.getEntity())),
          new ArrayList<>(List.of(updated.getEntity())),
          Relationship.CONTAINS,
          TEST_CASE,
          updated.getId());
      updateFromRelationships(
          "testSuite",
          TEST_SUITE,
          new ArrayList<>(List.of(original.getTestSuite())),
          new ArrayList<>(List.of(updated.getTestSuite())),
          Relationship.HAS,
          TEST_CASE,
          updated.getId());
      updateFromRelationships(
          "testDefinition",
          TEST_DEFINITION,
          new ArrayList<>(List.of(original.getTestDefinition())),
          new ArrayList<>(List.of(updated.getTestDefinition())),
          Relationship.APPLIED_TO,
          TEST_CASE,
          updated.getId());
      recordChange("parameterValues", original.getParameterValues(), updated.getParameterValues());
    }
  }
}
