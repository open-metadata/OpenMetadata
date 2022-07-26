package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.TEST;

import java.io.IOException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.resources.dqtests.TestSuiteResource;
import org.openmetadata.catalog.tests.Test;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;

public class TestRepository extends EntityRepository<Test> {
  private static final String UPDATE_FIELDS = "owner,entity,testSuite";
  private static final String PATCH_FIELDS = "owner,entity,testSuite";

  public TestRepository(CollectionDAO dao) {
    super(TestSuiteResource.COLLECTION_PATH, TEST, Test.class, dao.testDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
  }

  @Override
  public Test setFields(Test entity, EntityUtil.Fields fields) throws IOException {
    return entity;
  }

  @Override
  public void prepare(Test entity) throws IOException {
    setFullyQualifiedName(entity);
    entity.setOwner(Entity.getEntityReference(entity.getOwner()));
  }

  @Override
  public void storeEntity(Test entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity.getId(), entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(Test entity) {
    storeOwner(entity, entity.getOwner());
  }

  public class TestUpdater extends EntityUpdater {
    public TestUpdater(Test original, Test updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("description", original.getDescription(), updated.getDescription());
      recordChange("entity", original.getEntity(), updated.getEntity());
      recordChange("testSuite", original.getTestSuite(), updated.getTestSuite());
      recordChange("parameterValues", original.getParameterValues(), updated.getParameterValues());
    }
  }
}
