package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.TEST_CONNECTION_DEFINITION;

import java.io.IOException;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.connections.TestConnectionDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

public class TestConnectionDefinitionRepository extends EntityRepository<TestConnectionDefinition> {

  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

  public TestConnectionDefinitionRepository(CollectionDAO dao) {
    super(
        TestConnectionDefinitionResource.COLLECTION_PATH,
        TEST_CONNECTION_DEFINITION,
        TestConnectionDefinition.class,
        dao.testConnectionDefinitionDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public TestConnectionDefinition setFields(TestConnectionDefinition entity, EntityUtil.Fields fields)
      throws IOException {
    return entity.withOwner(fields.contains(Entity.FIELD_OWNER) ? getOwner(entity) : null);
  }

  @Override
  public void prepare(TestConnectionDefinition entity) throws IOException {
    // validate steps
    if (CommonUtil.nullOrEmpty(entity.getSteps())) {
      throw new IllegalArgumentException("Steps must not be empty");
    }
  }

  @Override
  public void storeEntity(TestConnectionDefinition entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(TestConnectionDefinition entity) throws IOException {
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(
      TestConnectionDefinition original, TestConnectionDefinition updated, Operation operation) {
    return new TestConnectionDefinitionUpdater(original, updated, operation);
  }

  public class TestConnectionDefinitionUpdater extends EntityUpdater {
    public TestConnectionDefinitionUpdater(
        TestConnectionDefinition original, TestConnectionDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("steps", original.getSteps(), updated.getSteps());
    }
  }
}
