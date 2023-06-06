package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_DEFINITION;

import java.io.IOException;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

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
    return entity.withOwner(fields.contains(Entity.FIELD_OWNER) ? getOwner(entity) : null);
  }

  @Override
  public void prepare(TestDefinition entity) {
    // validate test platforms
    if (CommonUtil.nullOrEmpty(entity.getTestPlatforms())) {
      throw new IllegalArgumentException("testPlatforms must not be empty");
    }
  }

  @Override
  public void storeEntity(TestDefinition entity, boolean update) throws IOException {
    store(entity, update);
  }

  @Override
  public void storeRelationships(TestDefinition entity) {
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(TestDefinition original, TestDefinition updated, Operation operation) {
    return new TestDefinitionUpdater(original, updated, operation);
  }

  public class TestDefinitionUpdater extends EntityUpdater {
    public TestDefinitionUpdater(TestDefinition original, TestDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("testPlatforms", original.getTestPlatforms(), updated.getTestPlatforms());
      recordChange("supportedDataTypes", original.getSupportedDataTypes(), updated.getSupportedDataTypes());
      recordChange("parameterDefinition", original.getParameterDefinition(), updated.getParameterDefinition());
    }
  }
}
