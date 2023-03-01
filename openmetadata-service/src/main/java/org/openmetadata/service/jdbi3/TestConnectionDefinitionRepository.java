package org.openmetadata.service.jdbi3;


import org.openmetadata.schema.entity.services.connections.TestConnectionDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.service.resources.dqtests.TestDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

import java.io.IOException;

import static org.openmetadata.service.Entity.TEST_DEFINITION;

public class TestConnectionDefinitionRepository extends EntityRepository<TestConnectionDefinition> {

  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

  public TestConnectionDefinitionRepository(CollectionDAO dao) {
    super(
        TestDefinitionResource.COLLECTION_PATH,
        TEST_DEFINITION,
        TestConnectionDefinition.class,
        dao.testConnectionDefinitionDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public TestConnectionDefinition setFields(TestConnectionDefinition entity, EntityUtil.Fields fields) throws IOException {
    return null;
  }

  @Override
  public void prepare(TestConnectionDefinition entity) throws IOException {

  }

  @Override
  public void storeEntity(TestConnectionDefinition entity, boolean update) throws IOException {

  }

  @Override
  public void storeRelationships(TestConnectionDefinition entity) throws IOException {

  }
}
