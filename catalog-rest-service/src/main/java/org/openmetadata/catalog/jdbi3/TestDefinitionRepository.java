package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.TEST_DEFINITION;

import java.io.IOException;
import org.openmetadata.catalog.resources.dqtests.TestDefinitionResource;
import org.openmetadata.catalog.tests.TestDefinition;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;

public class TestDefinitionRepository extends EntityRepository<TestDefinition> {
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

  public TestDefinitionRepository(CollectionDAO dao) {
    super(
        TestDefinitionResource.COLLECTION_PATH,
        TEST_DEFINITION,
        TestDefinition.class,
        dao.testDefinitionDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public TestDefinition setFields(TestDefinition entity, EntityUtil.Fields fields) throws IOException {
    entity.setOwner(fields.contains("owner") ? getOwner(entity) : null);
    return entity;
  }

  @Override
  public void prepare(TestDefinition entity) throws IOException {
    setFullyQualifiedName(entity);
    // validate test platforms
    if (entity.getTestPlatforms() == null || entity.getTestPlatforms().isEmpty()) {
      throw new IllegalArgumentException("testPlatforms must not be empty");
    }
  }

  @Override
  public void storeEntity(TestDefinition entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity.getId(), entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(TestDefinition entity) {
    storeOwner(entity, entity.getOwner());
  }

  public class TestDefinitionUpdater extends EntityUpdater {
    public TestDefinitionUpdater(TestDefinition original, TestDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("testPlatforms", original.getTestPlatforms(), updated.getTestPlatforms());
      recordChange("parameterDefinition", original.getParameterDefinition(), updated.getParameterDefinition());
    }
  }
}
