package org.openmetadata.service.resources.dqtests;

import static org.openmetadata.service.Entity.TEST_CASE;

import java.util.UUID;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityTimeSeriesMapper;
import org.openmetadata.service.util.RestUtil;

public class TestCaseResultMapper
    implements EntityTimeSeriesMapper<TestCaseResult, CreateTestCaseResult> {
  @Override
  public TestCaseResult createToEntity(CreateTestCaseResult create, String user) {
    TestCase testCase = Entity.getEntityByName(TEST_CASE, create.getFqn(), "", Include.ALL);
    RestUtil.validateTimestampMilliseconds(create.getTimestamp());
    return new TestCaseResult()
        .withId(UUID.randomUUID())
        .withTestCaseFQN(testCase.getFullyQualifiedName())
        .withTimestamp(create.getTimestamp())
        .withTestCaseStatus(create.getTestCaseStatus())
        .withResult(create.getResult())
        .withSampleData(create.getSampleData())
        .withTestResultValue(create.getTestResultValue())
        .withPassedRows(create.getPassedRows())
        .withFailedRows(create.getFailedRows())
        .withPassedRowsPercentage(create.getPassedRowsPercentage())
        .withFailedRowsPercentage(create.getFailedRowsPercentage())
        .withIncidentId(create.getIncidentId())
        .withMaxBound(create.getMaxBound())
        .withMinBound(create.getMinBound());
  }
}
