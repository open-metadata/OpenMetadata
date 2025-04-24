package org.openmetadata.service.resources.dqtests;

import org.openmetadata.schema.api.tests.CreateTestCaseResolutionStatus;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityTimeSeriesMapper;

public class TestCaseResolutionStatusMapper
    implements EntityTimeSeriesMapper<TestCaseResolutionStatus, CreateTestCaseResolutionStatus> {
  @Override
  public TestCaseResolutionStatus createToEntity(
      CreateTestCaseResolutionStatus create, String user) {
    TestCase testCaseEntity =
        Entity.getEntityByName(Entity.TEST_CASE, create.getTestCaseReference(), null, Include.ALL);
    User userEntity = Entity.getEntityByName(Entity.USER, user, null, Include.ALL);

    return new TestCaseResolutionStatus()
        .withTimestamp(System.currentTimeMillis())
        .withTestCaseResolutionStatusType(create.getTestCaseResolutionStatusType())
        .withTestCaseResolutionStatusDetails(create.getTestCaseResolutionStatusDetails())
        .withUpdatedBy(userEntity.getEntityReference())
        .withUpdatedAt(System.currentTimeMillis())
        .withTestCaseReference(testCaseEntity.getEntityReference())
        .withSeverity(create.getSeverity());
  }
}
