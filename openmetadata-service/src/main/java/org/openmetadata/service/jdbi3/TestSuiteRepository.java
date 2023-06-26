package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;
import static org.openmetadata.service.jdbi3.TestCaseRepository.TESTCASE_RESULT_EXTENSION;

import java.io.IOException;
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
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class TestSuiteRepository extends EntityRepository<TestSuite> {
  private static final String UPDATE_FIELDS = "owner,tests";
  private static final String PATCH_FIELDS = "owner,tests";

  public TestSuiteRepository(CollectionDAO dao) {
    super(
        TestSuiteResource.COLLECTION_PATH,
        TEST_SUITE,
        TestSuite.class,
        dao.testSuiteDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public TestSuite setFields(TestSuite entity, EntityUtil.Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setSummary(fields.contains("summary") ? getTestSummary(entity) : null);
    return entity.withTests(fields.contains("tests") ? getTestCases(entity) : null);
  }

  private TestSummary getTestSummary(TestSuite entity) throws IOException {
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

  private List<EntityReference> getTestCases(TestSuite entity) throws IOException {
    List<CollectionDAO.EntityRelationshipRecord> testCases =
        findTo(entity.getId(), TEST_SUITE, Relationship.CONTAINS, TEST_CASE);
    return EntityUtil.getEntityReferences(testCases);
  }

  @Override
  public EntityRepository<TestSuite>.EntityUpdater getUpdater(
      TestSuite original, TestSuite updated, Operation operation) {
    return new TestSuiteUpdater(original, updated, operation);
  }

  @Override
  public void storeEntity(TestSuite entity, boolean update) throws IOException {
    store(entity, update);
  }

  @Override
  public void storeRelationships(TestSuite entity) throws IOException {
    storeOwner(entity, entity.getOwner());
    if (entity.getExecutable()) {
      storeExecutableRelationship(entity);
    }
  }

  public void storeExecutableRelationship(TestSuite testSuite) throws IOException {
    Table table =
        Entity.getEntityByName(
            Entity.TABLE, testSuite.getExecutableEntityReference().getFullyQualifiedName(), null, null);
    addRelationship(table.getId(), testSuite.getId(), Entity.TABLE, TEST_SUITE, Relationship.CONTAINS);
  }

  public RestUtil.DeleteResponse<TestSuite> deleteLogicalTestSuite(
      SecurityContext securityContext, TestSuite original, boolean hardDelete) throws IOException {
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

  private EntityReference getIngestionPipeline(TestSuite testSuite) throws IOException {
    return getToEntityRef(testSuite.getId(), Relationship.CONTAINS, Entity.INGESTION_PIPELINE, false);
  }

  public class TestSuiteUpdater extends EntityUpdater {
    public TestSuiteUpdater(TestSuite original, TestSuite updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      List<EntityReference> origTests = listOrEmpty(original.getTests());
      List<EntityReference> updatedTests = listOrEmpty(updated.getTests());
      recordChange("tests", origTests, updatedTests);
    }
  }
}
