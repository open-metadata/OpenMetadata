package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_CONNECTION_DEFINITION;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.connections.TestConnectionDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

/*
 We won't have any POST/PUT operations on these definitions.
 They are created by the server and will be updated, if needed, via migration files.
*/
public class TestConnectionDefinitionRepository extends EntityRepository<TestConnectionDefinition> {

  private static final String UPDATE_FIELDS = "steps";
  private static final String PATCH_FIELDS = "";

  public TestConnectionDefinitionRepository() {
    super(
        TestConnectionDefinitionResource.COLLECTION_PATH,
        TEST_CONNECTION_DEFINITION,
        TestConnectionDefinition.class,
        Entity.getCollectionDAO().testConnectionDefinitionDAO(),
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  /**
   * TestConnectionDefinitions are created from JSON data. The FQN will be generated out of the informed name and
   * `.testConnectionDefinition`
   */
  @Override
  public void setFullyQualifiedName(TestConnectionDefinition entity) {
    entity.setFullyQualifiedName(entity.getName() + ".testConnectionDefinition");
  }

  @Override
  public void setFields(TestConnectionDefinition entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(TestConnectionDefinition entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(TestConnectionDefinition entity, boolean update) {
    // validate steps
    if (CommonUtil.nullOrEmpty(entity.getSteps())) {
      throw new IllegalArgumentException("Steps must not be empty");
    }
  }

  @Override
  public void storeEntity(TestConnectionDefinition entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeRelationships(TestConnectionDefinition entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityRepository<TestConnectionDefinition>.EntityUpdater getUpdater(
      TestConnectionDefinition original,
      TestConnectionDefinition updated,
      Operation operation,
      ChangeSource changeSource) {
    return new TestConnectionDefinitionUpdater(original, updated, operation);
  }

  public class TestConnectionDefinitionUpdater extends EntityUpdater {
    public TestConnectionDefinitionUpdater(
        TestConnectionDefinition original, TestConnectionDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("steps", original.getSteps(), updated.getSteps(), true);
    }
  }
}
