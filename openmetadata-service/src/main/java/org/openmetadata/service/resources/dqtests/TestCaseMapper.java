package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.feeds.MessageParser;

public class TestCaseMapper implements EntityMapper<TestCase, CreateTestCase> {
  @Override
  public TestCase createToEntity(CreateTestCase create, String user) {
    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(create.getEntityLink());
    return copy(new TestCase(), create, user)
        .withDescription(create.getDescription())
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withParameterValues(create.getParameterValues())
        .withEntityLink(create.getEntityLink())
        .withComputePassedFailedRowCount(create.getComputePassedFailedRowCount())
        .withUseDynamicAssertion(create.getUseDynamicAssertion())
        .withEntityFQN(entityLink.getFullyQualifiedFieldValue())
        .withTestDefinition(getEntityReference(Entity.TEST_DEFINITION, create.getTestDefinition()))
        .withTags(create.getTags())
        .withCreatedBy(user);
  }
}
