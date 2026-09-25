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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;

class ODCSQualityRuleExporterTest {
  private static final String TABLE_FQN = "svc.db.sch.orders";

  private final TestCase createdFromRule =
      testCase("odcs_status_is_set", "status", "columnValuesToBeNotNull");
  private final TestCase addedInOpenMetadata =
      testCase("id_is_unique", "id", "columnValuesToBeUnique");
  private final Map<UUID, TestCase> testCases =
      Map.of(
          createdFromRule.getId(), createdFromRule,
          addedInOpenMetadata.getId(), addedInOpenMetadata);
  private final ODCSQualityRuleExporter exporter =
      new ODCSQualityRuleExporter(reference -> testCases.get(reference.getId()), ref -> table());

  @Test
  void onlyTestCasesThatNoOdcsRuleProducedAreExported() {
    DataContract contract =
        contract(List.of(createdFromRule, addedInOpenMetadata))
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withName("Status is set")
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES)
                        .withColumn("status")
                        .withMustBe(0.0)));

    List<ODCSQualityRule> rules = exporter.nativeTestCaseRules(contract);

    assertEquals(1, rules.size());
    assertEquals("id_is_unique", rules.getFirst().getId());
    assertEquals(ODCSQualityRule.OdcsQualityMetric.DUPLICATE_VALUES, rules.getFirst().getMetric());
  }

  @Test
  void storedRuleThatCannotRunDoesNotStopTheExport() {
    DataContract contract =
        contract(List.of(addedInOpenMetadata))
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withName("Codes")
                        .withRule("regex")
                        .withColumn("status")
                        .withMustBe(0.0)));

    List<ODCSQualityRule> rules = exporter.nativeTestCaseRules(contract);

    assertEquals("id_is_unique", rules.getFirst().getId());
  }

  @Test
  void deletedTestCasesAreSkipped() {
    EntityReference gone = new EntityReference().withId(UUID.randomUUID()).withType("testCase");
    DataContract contract = contract(List.of()).withQualityExpectations(List.of(gone));

    assertTrue(exporter.nativeTestCaseRules(contract).isEmpty());
  }

  @Test
  void slaFreshnessThatAStoredRuleStatesIsExportedOnlyAsTheRule() {
    DataContract contract =
        contract(List.of())
            .withOdcsQualityRules(List.of(freshnessRule(24.0)))
            .withSla(refreshEvery(24, TABLE_FQN + ".updated_at"));

    ODCSDataContract odcs = exporter.toODCS(contract);

    assertEquals(List.of(), slaPropertyNames(odcs));
  }

  @Test
  void slaFreshnessTheRulesDoNotStateIsExported() {
    DataContract contract =
        contract(List.of())
            .withOdcsQualityRules(List.of(freshnessRule(24.0)))
            .withSla(refreshEvery(12, TABLE_FQN + ".updated_at"));

    ODCSDataContract odcs = exporter.toODCS(contract);

    assertEquals(List.of("freshness"), slaPropertyNames(odcs));
    assertEquals("12", odcs.getSlaProperties().getFirst().getValue());
  }

  @Test
  void slaFreshnessOnAnotherColumnThanTheRuleIsExported() {
    DataContract contract =
        contract(List.of())
            .withOdcsQualityRules(List.of(freshnessRule(24.0)))
            .withSla(refreshEvery(24, TABLE_FQN + ".status"));

    ODCSDataContract odcs = exporter.toODCS(contract);

    assertEquals(List.of("freshness"), slaPropertyNames(odcs));
  }

  private static ODCSQualityRule freshnessRule(double hours) {
    return new ODCSQualityRule()
        .withName("Fresh")
        .withMetric(ODCSQualityRule.OdcsQualityMetric.FRESHNESS)
        .withColumn("updated_at")
        .withMustBeLessOrEqualTo(hours)
        .withUnit("hours");
  }

  private static ContractSLA refreshEvery(int hours, String columnFqn) {
    return new ContractSLA()
        .withRefreshFrequency(
            new RefreshFrequency().withInterval(hours).withUnit(RefreshFrequency.Unit.HOUR))
        .withColumnName(columnFqn);
  }

  private static List<String> slaPropertyNames(ODCSDataContract odcs) {
    return listOrEmpty(odcs.getSlaProperties()).stream().map(ODCSSlaProperty::getProperty).toList();
  }

  private static DataContract contract(List<TestCase> linked) {
    return new DataContract()
        .withName("orders_contract")
        .withEntity(
            new EntityReference().withId(UUID.randomUUID()).withType("table").withName("orders"))
        .withQualityExpectations(linked.stream().map(TestCase::getEntityReference).toList());
  }

  private static TestCase testCase(String name, String column, String definition) {
    return new TestCase()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(TABLE_FQN + "." + column + "." + name)
        .withEntityLink("<#E::table::" + TABLE_FQN + "::columns::" + column + ">")
        .withTestDefinition(
            new EntityReference().withType("testDefinition").withFullyQualifiedName(definition))
        .withParameterValues(List.of());
  }

  private static Table table() {
    return new Table()
        .withFullyQualifiedName(TABLE_FQN)
        .withColumns(
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.INT),
                new Column().withName("status").withDataType(ColumnDataType.STRING)));
  }
}
