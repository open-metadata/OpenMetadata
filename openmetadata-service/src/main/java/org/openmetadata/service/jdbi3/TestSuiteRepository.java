package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.jdbi3.TestCaseRepository.TESTCASE_RESULT_EXTENSION;
import static org.openmetadata.service.util.FullyQualifiedName.quoteName;

import java.util.List;
import java.util.stream.Collectors;
import javax.ws.rs.core.SecurityContext;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.TestSuiteResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestSuiteRepository extends EntityRepository<TestSuite> {
  private static final String UPDATE_FIELDS = "tests";
  private static final String PATCH_FIELDS = "tests";

  public TestSuiteRepository(CollectionDAO dao) {
    super(
        TestSuiteResource.COLLECTION_PATH,
        TEST_SUITE,
        TestSuite.class,
        dao.testSuiteDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
    quoteFqn = false;
  }

  @Override
  public TestSuite setFields(TestSuite entity, EntityUtil.Fields fields) {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : entity.getPipelines());
    entity.setSummary(fields.contains("summary") ? getTestSummary(entity) : entity.getSummary());
    return entity.withTests(fields.contains("tests") ? getTestCases(entity) : entity.getTests());
  }

  @Override
  public TestSuite clearFields(TestSuite entity, EntityUtil.Fields fields) {
    entity.setPipelines(fields.contains("pipelines") ? entity.getPipelines() : null);
    entity.setSummary(fields.contains("summary") ? entity.getSummary() : null);
    return entity.withTests(fields.contains("tests") ? entity.getTests() : null);
  }

  @Override
  public void setFullyQualifiedName(TestSuite testSuite) {
    if (testSuite.getExecutableEntityReference() != null) {
      testSuite.setFullyQualifiedName(
          FullyQualifiedName.add(testSuite.getExecutableEntityReference().getFullyQualifiedName(), "testSuite"));
    } else {
      testSuite.setFullyQualifiedName(quoteName(testSuite.getName()));
    }
  }

  private TestSummary getTestSummary(TestSuite entity) {
    List<EntityReference> testCases = getTestCases(entity);
    List<String> testCaseFQNs =
        testCases.stream().map(EntityReference::getFullyQualifiedName).collect(Collectors.toList());

    return EntityUtil.getTestCaseExecutionSummary(
        daoCollection.entityExtensionTimeSeriesDao(), testCaseFQNs, TESTCASE_RESULT_EXTENSION);
  }

  @Override
  public void prepare(TestSuite entity) {
    /* Nothing to do */
  }

  private List<EntityReference> getTestCases(TestSuite entity) {
    return findTo(entity.getId(), TEST_SUITE, Relationship.CONTAINS, TEST_CASE);
  }

  @Override
  public EntityRepository<TestSuite>.EntityUpdater getUpdater(
      TestSuite original, TestSuite updated, Operation operation) {
    return new TestSuiteUpdater(original, updated, operation);
  }

  @Override
  public void storeEntity(TestSuite entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(TestSuite entity) {
    if (Boolean.TRUE.equals(entity.getExecutable())) {
      storeExecutableRelationship(entity);
    }
  }

  public void storeExecutableRelationship(TestSuite testSuite) {
    Table table =
        Entity.getEntityByName(
            Entity.TABLE, testSuite.getExecutableEntityReference().getFullyQualifiedName(), null, null);
    addRelationship(table.getId(), testSuite.getId(), Entity.TABLE, TEST_SUITE, Relationship.CONTAINS);
  }

  public RestUtil.DeleteResponse<TestSuite> deleteLogicalTestSuite(
      SecurityContext securityContext, TestSuite original, boolean hardDelete) {
    // deleting a logical will delete the test suite and only remove
    // the relationship to test cases if hardDelete is true. Test Cases
    // will not be deleted.
    String updatedBy = securityContext.getUserPrincipal().getName();
    preDelete(original);
    setFieldsInternal(original, putFields);

    String changeType;
    TestSuite updated = JsonUtils.readValue(JsonUtils.pojoToJson(original), TestSuite.class);
    setFieldsInternal(updated, putFields);

    if (supportsSoftDelete && !hardDelete) {
      updated.setUpdatedBy(updatedBy);
      updated.setUpdatedAt(System.currentTimeMillis());
      updated.setDeleted(true);
      EntityUpdater updater = getUpdater(original, updated, Operation.SOFT_DELETE);
      updater.update();
      changeType = RestUtil.ENTITY_SOFT_DELETED;
    } else {
      cleanup(updated);
      changeType = RestUtil.ENTITY_DELETED;
    }
    LOG.info("{} deleted {}", hardDelete ? "Hard" : "Soft", updated.getFullyQualifiedName());
    return new RestUtil.DeleteResponse<>(updated, changeType);
  }

  public class TestSuiteUpdater extends EntityUpdater {
    public TestSuiteUpdater(TestSuite original, TestSuite updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      List<EntityReference> origTests = listOrEmpty(original.getTests());
      List<EntityReference> updatedTests = listOrEmpty(updated.getTests());
      recordChange("tests", origTests, updatedTests);
    }
  }
}
