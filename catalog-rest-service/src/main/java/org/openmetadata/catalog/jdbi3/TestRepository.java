package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.TEST;

import java.io.IOException;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.resources.dqtests.TestSuiteResource;
import org.openmetadata.catalog.tests.Test;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.FullyQualifiedName;

public class TestRepository extends EntityRepository<Test> {
  private static final String UPDATE_FIELDS = "owner,entity,testSuite,testDefinition";
  private static final String PATCH_FIELDS = "owner,entity,testSuite,testDefinition";

  public TestRepository(CollectionDAO dao) {
    super(TestSuiteResource.COLLECTION_PATH, TEST, Test.class, dao.testDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
  }

  @Override
  public Test setFields(Test test, EntityUtil.Fields fields) throws IOException {
    test.setEntity(fields.contains("entity") ? test.getEntity() : null);
    test.setTestSuite(fields.contains("testSuite") ? test.getTestSuite() : null);
    test.setTestDefinition(fields.contains("testDefinition") ? test.getTestDefinition() : null);
    test.setOwner(fields.contains("owner") ? getOwner(test) : null);
    return test;
  }

  @Override
  public void prepare(Test test) throws IOException {
    test.setFullyQualifiedName(FullyQualifiedName.add(test.getEntity().getFullyQualifiedName(), test.getName()));
    test.setOwner(Entity.getEntityReference(test.getOwner()));
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
      recordChange("entity", original.getEntity(), updated.getEntity());
      recordChange("testSuite", original.getTestSuite(), updated.getTestSuite());
      recordChange("testDefinition", original.getTestDefinition(), updated.getTestDefinition());
      recordChange("parameterValues", original.getParameterValues(), updated.getParameterValues());
    }
  }
}
