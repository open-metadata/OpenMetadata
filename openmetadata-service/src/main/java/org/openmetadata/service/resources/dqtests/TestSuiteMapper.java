package org.openmetadata.service.resources.dqtests;

import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class TestSuiteMapper implements EntityMapper<TestSuite, CreateTestSuite> {
  @Override
  public TestSuite createToEntity(CreateTestSuite create, String user) {
    TestSuite testSuite =
        copy(new TestSuite(), create, user)
            .withDescription(create.getDescription())
            .withDisplayName(create.getDisplayName())
            .withName(create.getName());
    if (create.getBasicEntityReference() != null) {
      Table table =
          Entity.getEntityByName(Entity.TABLE, create.getBasicEntityReference(), null, null);
      EntityReference entityReference =
          new EntityReference()
              .withId(table.getId())
              .withFullyQualifiedName(table.getFullyQualifiedName())
              .withName(table.getName())
              .withType(Entity.TABLE);
      testSuite.setBasicEntityReference(entityReference);
    }
    return testSuite;
  }
}
