package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.TEST_SUITE;

import java.io.IOException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.resources.dqtests.TestSuiteResource;
import org.openmetadata.catalog.tests.TestSuite;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;

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
    entity.setOwner(fields.contains("owner") ? getOwner(entity) : null);
    entity.setPipeline(fields.contains("pipelines") ? getIngestionPipeline(entity) : null);
    return entity;
  }

  @Override
  public void prepare(TestSuite entity) throws IOException {
    setFullyQualifiedName(entity);
  }

  @Override
  public void storeEntity(TestSuite entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity.getId(), entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(TestSuite entity) {
    storeOwner(entity, entity.getOwner());
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
      recordChange("tests", original.getTests(), updated.getTests());
    }
  }
}
