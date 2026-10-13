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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Adds the contract's own test cases to its ODCS export. Test cases that an ODCS rule of the
 * contract produced are already exported as that rule, word for word, so only the others are
 * converted, which keeps export → import → export free of duplicates.
 */
public final class ODCSQualityRuleExporter {
  private final Function<EntityReference, TestCase> testCaseLoader;
  private final Function<EntityReference, Table> tableLoader;

  /**
   * @param testCaseLoader loads a linked test case with its test definition, or returns null when
   *     it no longer exists
   */
  public ODCSQualityRuleExporter(
      Function<EntityReference, TestCase> testCaseLoader,
      Function<EntityReference, Table> tableLoader) {
    this.testCaseLoader = testCaseLoader;
    this.tableLoader = tableLoader;
  }

  public List<ODCSQualityRule> nativeTestCaseRules(DataContract contract) {
    boolean hasTestCases =
        contract.getEntity() != null
            && Entity.TABLE.equals(contract.getEntity().getType())
            && !nullOrEmpty(contract.getQualityExpectations());
    return hasTestCases ? convertNativeTestCases(contract) : List.of();
  }

  private List<ODCSQualityRule> convertNativeTestCases(DataContract contract) {
    Set<String> createdFromRules = testCasesCreatedFromRules(contract);
    String tableAnchor = contract.getEntity().getName();
    return contract.getQualityExpectations().stream()
        .map(testCaseLoader)
        .filter(Objects::nonNull)
        .filter(testCase -> !createdFromRules.contains(key(testCase.getFullyQualifiedName())))
        .map(testCase -> ODCSTestCaseExporter.toRule(testCase, tableAnchor))
        .toList();
  }

  private Set<String> testCasesCreatedFromRules(DataContract contract) {
    List<ODCSQualityRule> rules = listOrEmpty(contract.getOdcsQualityRules());
    return rules.isEmpty()
        ? Set.of()
        : ODCSQualityRuleMapper.map(
                rules, ODCSTableTarget.of(tableLoader.apply(contract.getEntity())))
            .stream()
            .filter(TestCaseOutcome.class::isInstance)
            .map(outcome -> key(fullyQualifiedName(((TestCaseOutcome) outcome).testCase())))
            .collect(Collectors.toSet());
  }

  private static String fullyQualifiedName(CreateTestCase testCase) {
    return FullyQualifiedName.add(
        EntityLink.parse(testCase.getEntityLink()).getFullyQualifiedFieldValue(),
        EntityInterfaceUtil.quoteName(testCase.getName()));
  }

  private static String key(String fullyQualifiedName) {
    return fullyQualifiedName == null ? "" : fullyQualifiedName.toLowerCase(Locale.ROOT);
  }
}
