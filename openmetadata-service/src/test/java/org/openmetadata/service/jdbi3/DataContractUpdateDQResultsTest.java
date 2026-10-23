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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.LatestResult;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.datacontract.QualityValidation;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * Regression tests for {@link DataContractRepository#updateContractDQResults}. The pipeline-state
 * handler fires it for {@link PipelineStatusType#SUCCESS}, {@link PipelineStatusType#FAILED} and
 * {@link PipelineStatusType#PARTIAL_SUCCESS} alike; pre-fix all three compiled with a {@code
 * Success} fallback, so a run that failed before recording any test-case result (or that only had
 * stale results from a previous run) was finalized as {@link ContractExecutionStatus#Success} — a
 * false positive on the contract's quality guarantee.
 *
 * <p>The tests exercise {@code updateContractDQResults} end to end through the only production
 * call path ({@code getLatestResult -> validateDQ -> compileResult -> addContractResult ->
 * ChangeEvent}), stubbing the {@link Entity} statics and the time-series DAO at the boundary. The
 * data contract's latest result is hydrated as a {@code Running} result (as {@code
 * validateContract} leaves it once the DQ pipeline is triggered), and the asserted outcome is the
 * returned {@link DataContractResult#getContractExecutionStatus()}.
 */
class DataContractUpdateDQResultsTest {

  private static final String CONTRACT_FQN = "service.db.schema.table.dataContract_contract";
  private static final UUID CONTRACT_ID = UUID.randomUUID();
  private static final UUID TABLE_ID = UUID.randomUUID();
  private static final String TC_FQN_A = "service.db.schema.table.tc_a";
  private static final String TC_FQN_B = "service.db.schema.table.tc_b";

  private CollectionDAO collectionDAO;
  private DataContractRepository repository;
  private EntityReference contractRef;
  private DataContract dataContract;
  private String runningResultJson;
  private EntityReference tableRef;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Entity.setCollectionDAO(collectionDAO);
    repository = new DataContractRepository(new OpenMetadataApplicationConfig());

    tableRef =
        new EntityReference()
            .withId(TABLE_ID)
            .withType(Entity.TABLE)
            .withFullyQualifiedName("service.db.schema.table");
    contractRef =
        new EntityReference()
            .withId(CONTRACT_ID)
            .withType(Entity.DATA_CONTRACT)
            .withFullyQualifiedName(CONTRACT_FQN);

    DataContractResult runningResult =
        new DataContractResult()
            .withId(UUID.randomUUID())
            .withDataContractFQN(CONTRACT_FQN)
            .withContractExecutionStatus(ContractExecutionStatus.Running)
            .withTimestamp(System.currentTimeMillis());
    runningResultJson = JsonUtils.pojoToJson(runningResult);

    dataContract =
        new DataContract()
            .withId(CONTRACT_ID)
            .withName("contract")
            .withFullyQualifiedName(CONTRACT_FQN)
            .withEntity(tableRef)
            .withUpdatedAt(System.currentTimeMillis())
            .withQualityExpectations(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType(Entity.TEST_CASE)
                        .withFullyQualifiedName(TC_FQN_A)))
            .withLatestResult(
                new LatestResult()
                    .withResultId(runningResult.getId())
                    .withTimestamp(runningResult.getTimestamp())
                    .withStatus(ContractExecutionStatus.Running));
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  private EntityReference ref(String fqn) {
    return new EntityReference().withFullyQualifiedName(fqn).withType(Entity.TEST_CASE);
  }

  private ResultSummary summary(String fqn, TestCaseStatus status) {
    return new ResultSummary().withTestCaseName(fqn).withStatus(status).withTimestamp(1L);
  }

  private DataContractResult finalize(TestSuite testSuite, PipelineStatusType pipelineState) {
    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      mockedEntity
          .when(() -> Entity.getEntity(contractRef, "entity,owners,reviewers", Include.NON_DELETED))
          .thenReturn(dataContract);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.DATA_CONTRACT, CONTRACT_FQN, "*", Include.ALL))
          .thenReturn(dataContract);
      mockedEntity
          .when(() -> Entity.getEntityReferenceById(Entity.TABLE, TABLE_ID, Include.NON_DELETED))
          .thenReturn(tableRef);
      when(collectionDAO
              .entityExtensionTimeSeriesDao()
              .getLatestExtensionByKey(any(), any(), any(), any()))
          .thenReturn(runningResultJson);

      return repository.updateContractDQResults(contractRef, testSuite, pipelineState);
    }
  }

  private TestSuite suite(List<EntityReference> tests, List<ResultSummary> summary) {
    return new TestSuite().withTests(tests).withTestCaseResultSummary(summary);
  }

  private TestSuite blankSuite() {
    // A test case is referenced, but no result has ever been recorded for it.
    return suite(List.of(ref(TC_FQN_A)), List.of());
  }

  private TestSuite allPassingSuite() {
    return suite(List.of(ref(TC_FQN_A)), List.of(summary(TC_FQN_A, TestCaseStatus.Success)));
  }

  private TestSuite mixedSuite() {
    return suite(
        List.of(ref(TC_FQN_A), ref(TC_FQN_B)),
        List.of(
            summary(TC_FQN_A, TestCaseStatus.Success), summary(TC_FQN_B, TestCaseStatus.Failed)));
  }

  @Test
  @DisplayName("a FAILED pipeline with no recorded results finalizes as Aborted, not Success")
  void failedPipelineWithNoResults_isAborted() {
    DataContractResult result = finalize(blankSuite(), PipelineStatusType.FAILED);

    assertEquals(
        ContractExecutionStatus.Aborted,
        result.getContractExecutionStatus(),
        "A pipeline that FAILED before recording any test result must not report the contract as Success");
    assertNotNull(result.getResult(), "An Aborted run must carry an explanatory result message");
    assertTrue(
        result.getResult().toLowerCase().contains("failed"),
        "The message must state the pipeline state: " + result.getResult());
    assertTrue(
        result.getResult().contains("without recording any test results"),
        "The message must explain no results were recorded: " + result.getResult());
  }

  @Test
  @DisplayName("a PARTIAL_SUCCESS pipeline with no recorded results finalizes as Aborted")
  void partialSuccessPipelineWithNoResults_isAborted() {
    DataContractResult result = finalize(blankSuite(), PipelineStatusType.PARTIAL_SUCCESS);

    assertEquals(ContractExecutionStatus.Aborted, result.getContractExecutionStatus());
    assertNotNull(result.getResult());
    assertTrue(
        result.getResult().toLowerCase().contains("partialsuccess"),
        "The message must state the pipeline state: " + result.getResult());
  }

  @Test
  @DisplayName(
      "a non-SUCCESS pipeline with only stale/passing results finalizes as Aborted, not Success")
  void failedPipelineWithStalePassingResults_isAborted() {
    // A previous run recorded a passing result; this run fails before recording anything new, but
    // the summary still holds the previous (stale) passing result. Pre-fix this finalized as
    // Success — the false positive this fix targets.
    DataContractResult result = finalize(allPassingSuite(), PipelineStatusType.FAILED);

    assertEquals(
        ContractExecutionStatus.Aborted,
        result.getContractExecutionStatus(),
        "A non-SUCCESS pipeline must not be verified as passing on the strength of results that "
            + "may belong to a previous run");
    assertNotNull(result.getResult());
    assertTrue(
        result.getResult().contains("may not reflect the current run"),
        "The message must warn the recorded results may be stale: " + result.getResult());
  }

  @Test
  @DisplayName("a non-SUCCESS pipeline that recorded real failures still finalizes as Failed")
  void failedPipelineWithRealFailures_isFailedAndCarriesNoPipelineMessage() {
    // The common-failure case: tests ran and some failed, so the pipeline reports FAILED and the
    // recorded results contain real failures. This must keep finalizing as Failed (compileResult
    // demotes the Aborted fallback) and must not gain a pipeline-level message.
    DataContractResult result = finalize(mixedSuite(), PipelineStatusType.FAILED);

    assertEquals(
        ContractExecutionStatus.Failed,
        result.getContractExecutionStatus(),
        "Recorded test failures must keep the contract Failed, regardless of the Aborted fallback");
    QualityValidation qv = result.getQualityValidation();
    assertNotNull(qv);
    assertEquals(1, qv.getFailed());
    assertNull(
        result.getResult(),
        "When recorded failures explain the status, no pipeline-level message is added");
  }

  @Test
  @DisplayName("a SUCCESS pipeline with no recorded results keeps the existing Success behavior")
  void successPipelineWithNoResults_isSuccess() {
    // Blank validation on a SUCCESS run is the pre-existing behavior the NaN guard relies on; the
    // fix must not regress it.
    DataContractResult result = finalize(blankSuite(), PipelineStatusType.SUCCESS);

    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
    assertNull(result.getResult(), "A SUCCESS run must not acquire a pipeline-level message");
  }

  @Test
  @DisplayName("a SUCCESS pipeline with recorded passing results finalizes as Success")
  void successPipelineWithPassingResults_isSuccess() {
    DataContractResult result = finalize(allPassingSuite(), PipelineStatusType.SUCCESS);

    assertEquals(ContractExecutionStatus.Success, result.getContractExecutionStatus());
    QualityValidation qv = result.getQualityValidation();
    assertNotNull(qv);
    assertEquals(0, qv.getFailed());
    assertEquals(1, qv.getPassed());
    assertEquals(1, qv.getTotal());
  }

  @Test
  @DisplayName("a SUCCESS pipeline with recorded failures finalizes as Failed")
  void successPipelineWithFailures_isFailed() {
    DataContractResult result = finalize(mixedSuite(), PipelineStatusType.SUCCESS);

    assertEquals(ContractExecutionStatus.Failed, result.getContractExecutionStatus());
    QualityValidation qv = result.getQualityValidation();
    assertNotNull(qv);
    assertEquals(1, qv.getFailed());
  }
}
