package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_CONNECTION_DEFINITION;

import java.util.Set;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.services.connections.TestConnectionDefinitionResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/*
 We won't have any POST/PUT operations on these definitions.
 They are created by the server and will be updated, if needed, via migration files.
*/
@Repository()
public class TestConnectionDefinitionRepository implements EntityPolicy<TestConnectionDefinition> {

  private static final String UPDATE_FIELDS = "steps";

  private static final String PATCH_FIELDS = "";

  public TestConnectionDefinitionRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                TestConnectionDefinitionResource.COLLECTION_PATH,
                TEST_CONNECTION_DEFINITION,
                TestConnectionDefinition.class,
                Entity.getCollectionDAO().testConnectionDefinitionDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
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
  public void setFields(
      TestConnectionDefinition entity,
      EntityUtil.Fields fields,
      RelationIncludes relationIncludes) {
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
    persistence().store(entity, update);
  }

  @Override
  public void storeRelationships(TestConnectionDefinition entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityUpdater<TestConnectionDefinition> getUpdater(
      TestConnectionDefinition original,
      TestConnectionDefinition updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new TestConnectionDefinitionUpdater(original, updated, operation).mutation();
  }

  public class TestConnectionDefinitionUpdater
      implements EntitySpecificMutation<TestConnectionDefinition> {

    public TestConnectionDefinitionUpdater(
        TestConnectionDefinition original,
        TestConnectionDefinition updated,
        EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(
        EntityUpdater<TestConnectionDefinition> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "steps",
          () ->
              entityUpdate.recordChange(
                  "steps",
                  entityUpdate.getOriginal().getSteps(),
                  entityUpdate.getUpdated().getSteps(),
                  true));
    }

    private final EntityUpdater<TestConnectionDefinition> entityUpdate;

    public EntityUpdater<TestConnectionDefinition> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<TestConnectionDefinition> entityContext;

  @Override
  public final EntityPolicyContext<TestConnectionDefinition> context() {
    return entityContext;
  }
}
