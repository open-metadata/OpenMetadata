/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.QualityValidation;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * A DQ pipeline that ends FAILED or PARTIAL_SUCCESS must not finalize the contract as Success, even
 * when the test suite still carries an all-passing summary from an earlier run.
 */
class DataContractUpdateDQResultsTest {

  private static final String TEST_CASE_FQN = "db.schema.table.tc_one";

  private DataContractRepository dataContractRepository;

  @BeforeEach
  void setUp() {
    Entity.setCollectionDAO(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
    dataContractRepository = new DataContractRepository(new OpenMetadataApplicationConfig());
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  private TestSuite suiteWith(TestCaseStatus status) {
    ResultSummary summary =
        new ResultSummary().withTestCaseName(TEST_CASE_FQN).withStatus(status).withTimestamp(0L);
    EntityReference testCase =
        new EntityReference().withFullyQualifiedName(TEST_CASE_FQN).withType(Entity.TEST_CASE);
    return new TestSuite().withTests(List.of(testCase)).withTestCaseResultSummary(List.of(summary));
  }

  private DataContractResult applyOutcome(TestSuite suite, PipelineStatusType state) {
    DataContractResult result =
        new DataContractResult().withContractExecutionStatus(ContractExecutionStatus.Running);
    dataContractRepository.applyDQPipelineOutcome(result, suite, state);
    return result;
  }

  @Test
  void failedPipelineWithEmptySummaryIsAborted() {
    DataContractResult result = applyOutcome(new TestSuite(), PipelineStatusType.FAILED);

    assertEquals(ContractExecutionStatus.Aborted, result.getContractExecutionStatus());
    assertTrue(result.getResult().contains(PipelineStatusType.FAILED.toString()));
  }

  @Test
  void partialSuccessWithStalePassingSummaryIsAbortedAndKeepsNoStaleCounts() {
    DataContractResult result =
        applyOutcome(suiteWith(TestCaseStatus.Success), PipelineStatusType.PARTIAL_SUCCESS);

    assertEquals(ContractExecutionStatus.Aborted, result.getContractExecutionStatus());
    assertNull(result.getQualityValidation());
  }

  @Test
  void successPipelineWithPassingSummaryIsSuccessWithRealCounts() {
    DataContractResult result =
        applyOutcome(suiteWith(TestCaseStatus.Success), PipelineStatusType.SUCCESS);

    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
    QualityValidation validation = result.getQualityValidation();
    assertEquals(1, validation.getPassed());
    assertEquals(0, validation.getFailed());
  }

  @Test
  void successPipelineWithFailingSummaryIsFailed() {
    DataContractResult result =
        applyOutcome(suiteWith(TestCaseStatus.Failed), PipelineStatusType.SUCCESS);

    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
  }

  @Test
  void nullPipelineStateKeepsSuccessFlow() {
    DataContractResult result = applyOutcome(suiteWith(TestCaseStatus.Success), null);

    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
  }

  @Test
  void onlyFailedAndPartialSuccessAbort() {
    assertTrue(DataContractRepository.didPipelineAbort(PipelineStatusType.FAILED));
    assertTrue(DataContractRepository.didPipelineAbort(PipelineStatusType.PARTIAL_SUCCESS));
    assertFalse(DataContractRepository.didPipelineAbort(PipelineStatusType.SUCCESS));
    assertFalse(DataContractRepository.didPipelineAbort(null));
  }
}
