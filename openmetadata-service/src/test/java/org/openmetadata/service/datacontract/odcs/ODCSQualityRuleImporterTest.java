/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.SlaOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.util.RestUtil.PutResponse;

/**
 * The test case repository is the only boundary mocked: it stands in for the database with an
 * in-memory map keyed by test case FQN, so the tests observe which test cases end up stored.
 */
class ODCSQualityRuleImporterTest {
  private static final String TABLE_FQN = "svc.db.sch.orders";
  private static final String USER = "admin";

  private final Map<String, TestCase> stored = new HashMap<>();
  private final List<Boolean> guardedOverwrites = new ArrayList<>();
  private TestCaseRepository repository;
  private ODCSQualityRuleImporter importer;

  @BeforeEach
  void setUp() {
    repository = mock(TestCaseRepository.class);
    when(repository.getByNameOrNull(any(), anyString(), any(), any(), anyBoolean()))
        .thenAnswer(invocation -> Optional.ofNullable(stored.get(invocation.getArgument(1))));
    when(repository.createOrUpdate(any(), any(TestCase.class), eq(USER)))
        .thenAnswer(
            invocation -> {
              TestCase testCase = invocation.getArgument(1);
              testCase.setId(UUID.randomUUID());
              stored.put(testCase.getFullyQualifiedName(), testCase);
              return new PutResponse<>(Response.Status.CREATED, testCase, EventType.ENTITY_CREATED);
            });
    doAnswer(
            invocation -> {
              TestCase testCase = invocation.getArgument(0);
              testCase.setFullyQualifiedName(testCase.getEntityFQN() + "." + testCase.getName());
              return null;
            })
        .when(repository)
        .setFullyQualifiedName(any(TestCase.class));
    importer =
        new ODCSQualityRuleImporter(new ODCSTestCaseMaterializer(repository), ref -> table());
  }

  @Test
  void rulesWithATestEquivalentAreLinkedAsQualityExpectations() {
    DataContract contract = contract(nullValues("Status is set", "status"));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    assertInstanceOf(TestCaseOutcome.class, outcomes.getFirst());
    assertEquals(1, contract.getQualityExpectations().size());
    assertEquals("odcs_status_is_set", contract.getQualityExpectations().getFirst().getName());
    assertTrue(stored.containsKey(TABLE_FQN + ".status.odcs_status_is_set"));
    assertEquals(List.of(false), guardedOverwrites);
  }

  @Test
  void nothingIsWrittenUnlessEveryTestCaseMayBe() {
    DataContract contract =
        contract(nullValues("Status is set", "status"), nullValues("Id is set", "id"));
    ODCSQualityRuleImporter.Request deniedForId =
        new ODCSQualityRuleImporter.Request(
            contract,
            Set.of(),
            (testCase, overwritesExisting) -> {
              if ("odcs_id_is_set".equals(testCase.getName())) {
                throw new AuthorizationException("Principal is not allowed to create tests");
              }
            },
            USER);

    assertThrows(AuthorizationException.class, () -> importer.apply(deniedForId));
    assertTrue(stored.isEmpty());
  }

  @Test
  void freshnessRuleSetsTheContractRefreshFrequencyAndColumn() {
    DataContract contract = contract(freshness("updated_at", 6.0));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    assertInstanceOf(SlaOutcome.class, outcomes.getFirst());
    assertEquals(6, contract.getSla().getRefreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, contract.getSla().getRefreshFrequency().getUnit());
    assertEquals(TABLE_FQN + ".updated_at", contract.getSla().getColumnName());
    assertTrue(contract.getQualityExpectations().isEmpty());
  }

  @Test
  void slaColumnNamedByTheDocumentPointsAtTheTableColumn() {
    DataContract contract = contract().withSla(new ContractSLA().withColumnName("UPDATED_AT"));

    boolean dropped = importer.resolveSlaColumn(contract);

    assertFalse(dropped);
    assertEquals(TABLE_FQN + ".updated_at", contract.getSla().getColumnName());
  }

  @Test
  void slaColumnTheTableDoesNotHaveIsDropped() {
    DataContract contract = contract().withSla(new ContractSLA().withColumnName("loaded_at"));

    boolean dropped = importer.resolveSlaColumn(contract);

    assertTrue(dropped);
    assertNull(contract.getSla().getColumnName());
  }

  @Test
  void slaColumnIsLeftAloneOutsideTables() {
    DataContract contract =
        contract()
            .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("topic"))
            .withSla(new ContractSLA().withColumnName("loaded_at"));

    assertFalse(importer.resolveSlaColumn(contract));
    assertEquals("loaded_at", contract.getSla().getColumnName());
  }

  @Test
  void freshnessRuleDoesNotOverrideAFrequencyTheSlaAlreadyDeclares() {
    DataContract contract = contract(freshness("updated_at", 6.0));
    contract.setSla(
        new ContractSLA()
            .withRefreshFrequency(
                new RefreshFrequency().withInterval(1).withUnit(RefreshFrequency.Unit.DAY)));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    UnsupportedOutcome conflict = assertInstanceOf(UnsupportedOutcome.class, outcomes.getFirst());
    assertTrue(conflict.reason().contains("1 day(s)"), conflict.reason());
    assertTrue(conflict.reason().contains("6 hour(s)"), conflict.reason());
    assertEquals(1, contract.getSla().getRefreshFrequency().getInterval());
  }

  /** An exported contract states its refresh frequency both as an SLA property and as the rule. */
  @Test
  void freshnessRuleThatAgreesWithTheSlaCountsAsApplied() {
    DataContract contract = contract(freshness("updated_at", 6.0));
    contract.setSla(
        new ContractSLA()
            .withRefreshFrequency(
                new RefreshFrequency().withInterval(6).withUnit(RefreshFrequency.Unit.HOUR)));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    assertInstanceOf(SlaOutcome.class, outcomes.getFirst());
    assertEquals(TABLE_FQN + ".updated_at", contract.getSla().getColumnName());
  }

  @Test
  void aDifferentTestCaseWithTheSameNameIsLeftAloneAndTheRuleSkipped() {
    TestCase someoneElses = existingTest("status_check", "status", "columnValuesToBeUnique");
    DataContract contract = contract(nullValues("Status check", "status").withId("status_check"));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    UnsupportedOutcome skipped = assertInstanceOf(UnsupportedOutcome.class, outcomes.getFirst());
    assertTrue(skipped.reason().contains("status_check"));
    assertTrue(contract.getQualityExpectations().isEmpty());
    assertEquals(
        "columnValuesToBeUnique",
        stored
            .get(someoneElses.getFullyQualifiedName())
            .getTestDefinition()
            .getFullyQualifiedName());
  }

  @Test
  void anEquivalentTestCaseOwnedByNobodyHereIsLinkedWithoutRewritingIt() {
    TestCase someoneElses = existingTest("status_check", "status", "columnValuesToBeNotNull");
    DataContract contract = contract(nullValues("Status check", "status").withId("status_check"));

    importer.apply(request(contract, Set.of()));

    assertEquals(someoneElses.getId(), contract.getQualityExpectations().getFirst().getId());
    assertTrue(guardedOverwrites.isEmpty());
  }

  @Test
  void aTestCaseRunningTheSameTestWithOtherParametersIsLeftAloneAndTheRuleSkipped() {
    TestCase someoneElses =
        existingTest("status_check", "status", "columnValuesToBeNotNull")
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("threshold").withValue("5")));
    DataContract contract = contract(nullValues("Status check", "status").withId("status_check"));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    assertInstanceOf(UnsupportedOutcome.class, outcomes.getFirst());
    assertTrue(contract.getQualityExpectations().isEmpty());
    assertTrue(guardedOverwrites.isEmpty());
    assertEquals(
        "5",
        stored
            .get(someoneElses.getFullyQualifiedName())
            .getParameterValues()
            .getFirst()
            .getValue());
  }

  @Test
  void aTestCaseTheContractAlreadyLinksIsUpdatedInPlace() {
    TestCase owned = existingTest("status_check", "status", "columnValuesToBeUnique");
    DataContract contract = contract(nullValues("Status check", "status").withId("status_check"));

    importer.apply(request(contract, Set.of(owned.getId())));

    assertEquals(List.of(true), guardedOverwrites);
    assertEquals(
        "columnValuesToBeNotNull",
        stored.get(owned.getFullyQualifiedName()).getTestDefinition().getFullyQualifiedName());
  }

  @Test
  void reimportingARuleKeepsTheReviewStatusItsTestCaseReached() {
    TestCase owned =
        existingTest("status_check", "status", "columnValuesToBeNotNull")
            .withEntityStatus(EntityStatus.APPROVED);
    DataContract contract = contract(nullValues("Status check", "status").withId("status_check"));

    importer.apply(request(contract, Set.of(owned.getId())));

    assertEquals(
        EntityStatus.APPROVED, stored.get(owned.getFullyQualifiedName()).getEntityStatus());
  }

  @Test
  void aTestCaseOpenMetadataRejectsIsReportedAndTheOthersAreStillCreated() {
    doThrow(BadRequestException.of("Parameter threshold is invalid"))
        .doNothing()
        .when(repository)
        .prepareInternal(any(TestCase.class), eq(false));
    DataContract contract =
        contract(nullValues("Status is set", "status"), nullValues("Id is set", "id"));

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    UnsupportedOutcome rejected = assertInstanceOf(UnsupportedOutcome.class, outcomes.get(0));
    assertTrue(rejected.reason().contains("Parameter threshold is invalid"));
    assertInstanceOf(TestCaseOutcome.class, outcomes.get(1));
    assertEquals(1, contract.getQualityExpectations().size());
  }

  @Test
  void contractsOnOtherEntitiesAreLeftUnchanged() {
    DataContract contract = contract(nullValues("Status is set", "status"));
    contract.getEntity().setType("topic");

    List<ODCSRuleOutcome> outcomes = importer.apply(request(contract, Set.of()));

    assertTrue(outcomes.isEmpty());
    assertNull(contract.getQualityExpectations());
  }

  private ODCSQualityRuleImporter.Request request(DataContract contract, Set<UUID> owned) {
    return new ODCSQualityRuleImporter.Request(
        contract,
        owned,
        (testCase, overwritesExisting) -> guardedOverwrites.add(overwritesExisting),
        USER);
  }

  private TestCase existingTest(String name, String column, String definition) {
    TestCase testCase =
        new TestCase()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(TABLE_FQN + "." + column + "." + name)
            .withTestDefinition(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType("testDefinition")
                    .withFullyQualifiedName(definition));
    stored.put(testCase.getFullyQualifiedName(), testCase);
    return testCase;
  }

  private static DataContract contract(ODCSQualityRule... rules) {
    return new DataContract()
        .withName("orders_contract")
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("table"))
        .withOdcsQualityRules(List.of(rules));
  }

  private static ODCSQualityRule nullValues(String name, String column) {
    return new ODCSQualityRule()
        .withName(name)
        .withMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES)
        .withColumn(column)
        .withMustBe(0.0);
  }

  private static ODCSQualityRule freshness(String column, double hours) {
    return new ODCSQualityRule()
        .withName("Fresh")
        .withMetric(ODCSQualityRule.OdcsQualityMetric.FRESHNESS)
        .withColumn(column)
        .withMustBeLessOrEqualTo(hours)
        .withUnit("hours");
  }

  private static Table table() {
    return new Table()
        .withFullyQualifiedName(TABLE_FQN)
        .withColumns(
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column().withName("status").withDataType(ColumnDataType.STRING),
                new Column().withName("updated_at").withDataType(ColumnDataType.TIMESTAMP)));
  }
}
