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

import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.datacontract.QualityValidation;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * Regression tests for {@code DataContractRepository.validateDQ}. The method is private and the
 * sole producer of {@link QualityValidation#getQualityScore()} for a data contract, so it is
 * exercised reflectively. It only reads the supplied {@link TestSuite} pojo, so no DAO traffic is
 * expected during the call; the {@link Entity} static collection DAO is set up only to satisfy the
 * repository constructor.
 */
class DataContractValidateDQTest {

  private DataContractRepository dataContractRepository;
  private Method validateDQ;

  @BeforeEach
  void setUp() throws Exception {
    Entity.setCollectionDAO(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    dataContractRepository = new DataContractRepository(config);
    validateDQ = DataContractRepository.class.getDeclaredMethod("validateDQ", TestSuite.class);
    validateDQ.setAccessible(true);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  private QualityValidation validateDQ(TestSuite testSuite) throws Exception {
    return (QualityValidation) validateDQ.invoke(dataContractRepository, testSuite);
  }

  private EntityReference ref(String fqn) {
    return new EntityReference().withFullyQualifiedName(fqn).withType(Entity.TEST_CASE);
  }

  private ResultSummary summary(String fqn, TestCaseStatus status) {
    return new ResultSummary().withTestCaseName(fqn).withStatus(status).withTimestamp(0L);
  }

  private void assertBlankValidation(QualityValidation validation) {
    assertNull(
        validation.getQualityScore(),
        "Empty/filtered-out suites must keep qualityScore null instead of computing NaN");
    assertNull(validation.getPassed());
    assertNull(validation.getFailed());
    assertNull(validation.getTotal());
    assertFalse(
        JsonUtils.pojoToJson(validation).contains("NaN"),
        "qualityScore must never be serialised as the NaN token");
  }

  @Test
  @DisplayName(
      "every referenced test case soft-deleted/filtered out returns the blank baseline, not NaN")
  void allReferencedTestsFilteredOut_returnsBlankValidationWithoutNaN() throws Exception {
    // listLastTestCaseResultsForTestSuite returns stale rows for soft-deleted test cases (no
    // tc.deleted filter), while testSuite.getTests() is empty (Include.NON_DELETED). The
    // post-filter
    // testSummary is empty — without the guard this divisions 0/0.0 -> Double.NaN.
    List<ResultSummary> staleResults =
        List.of(summary("db.schema.table.tc_one", TestCaseStatus.Success));
    TestSuite testSuite =
        new TestSuite().withTests(List.of()).withTestCaseResultSummary(staleResults);

    QualityValidation validation = validateDQ(testSuite);

    assertBlankValidation(validation);
  }

  @Test
  @DisplayName(
      "only stale (non-referenced) result entries filter out and return the blank baseline")
  void onlyStaleEntries_returnsBlankValidationWithoutNaN() throws Exception {
    // The contract still references tc_kept, but only stale results for a soft-deleted tc remain.
    List<ResultSummary> staleResults =
        List.of(summary("db.schema.table.tc_deleted", TestCaseStatus.Failed));
    TestSuite testSuite =
        new TestSuite()
            .withTests(List.of(ref("db.schema.table.tc_kept")))
            .withTestCaseResultSummary(staleResults);

    QualityValidation validation = validateDQ(testSuite);

    assertBlankValidation(validation);
  }

  @Test
  @DisplayName("mixed suite computes the expected finite score and ignores stale results")
  void mixedSuite_computesExpectedScoreAndIgnoresStaleResults() throws Exception {
    // Two referenced tests: one Success, one Failed. A third stale result for a soft-deleted test
    // must be filtered out and never influence passed/failed/total/qualityScore.
    TestSuite testSuite =
        new TestSuite()
            .withTests(List.of(ref("db.schema.table.tc_one"), ref("db.schema.table.tc_two")))
            .withTestCaseResultSummary(
                List.of(
                    summary("db.schema.table.tc_one", TestCaseStatus.Success),
                    summary("db.schema.table.tc_two", TestCaseStatus.Failed),
                    summary("db.schema.table.tc_stale_soft_deleted", TestCaseStatus.Success)));

    QualityValidation validation = validateDQ(testSuite);

    assertEquals(1, validation.getPassed());
    assertEquals(1, validation.getFailed());
    assertEquals(2, validation.getTotal());
    assertEquals(50.0, validation.getQualityScore());
    assertTrue(Double.isFinite(validation.getQualityScore()));
  }

  @Test
  @DisplayName("blank validation serialises and round-trips without ever producing a NaN token")
  void blankValidationRoundTripsWithoutNaN() throws Exception {
    TestSuite testSuite = new TestSuite().withTests(List.of()).withTestCaseResultSummary(List.of());

    QualityValidation validation = validateDQ(testSuite);

    // QualityValidation uses @JsonInclude(NON_NULL), so a null qualityScore is omitted entirely.
    String json = JsonUtils.pojoToJson(validation);
    assertFalse(json.contains("NaN"), "No NaN token in serialised validation: " + json);
    QualityValidation roundTripped = JsonUtils.readValue(json, QualityValidation.class);
    assertNull(roundTripped.getQualityScore());
  }
}
