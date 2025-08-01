package org.openmetadata.service.resources.dqtests;

import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.service.mapper.EntityMapper;

public class TestDefinitionMapper implements EntityMapper<TestDefinition, CreateTestDefinition> {
  @Override
  public TestDefinition createToEntity(CreateTestDefinition create, String user) {
    return copy(new TestDefinition(), create, user)
        .withDescription(create.getDescription())
        .withEntityType(create.getEntityType())
        .withTestPlatforms(create.getTestPlatforms())
        .withSupportedDataTypes(create.getSupportedDataTypes())
        .withDisplayName(create.getDisplayName())
        .withParameterDefinition(create.getParameterDefinition())
        .withName(create.getName());
  }
}
